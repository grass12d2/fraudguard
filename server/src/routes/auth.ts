
import { Router } from "express";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import QRCode from "qrcode";

import { pool } from "../db.js";
import { config } from "../config.js";
import { redis } from "../redis.js";
import { ah } from "../util.js";

import { validate } from "../middleware/validate.js";
import {
    requireAuth,
    type AuthUser,
} from "../middleware/auth.js";

import {
    hashPassword,
    verifyPassword,
    DUMMY_HASH,
} from "../security/password.js";

import {
    signAccess,
    signMfa,
    verifyToken,
    type MfaClaims,
} from "../security/tokens.js";

import {
    setAuthCookie,
    clearAuthCookie,
} from "../security/session.js";

import {
    generateSecret,
    otpauthUri,
    verifyTotp,
} from "../security/totp.js";

import {
    encrypt,
    decrypt,
} from "../security/crypto.js";

import { sendVerificationEmail } from "../services/mailer.js";


export const authRouter = Router();

// ============================================
// SCHEMAS
// ============================================

// Правила создания пароля
const password = z.string()
    .min(10, "Не менее 10 символов")
    .max(128)
    .regex(/[a-z]/, "Нужна строчная буква")
    .regex(/[A-Z]/, "Нужна заглавная буква")
    .regex(/\d/, "Нужна цифра")
    .regex(/[^A-Za-z0-9]/, "Нужен спецсимвол");

// Регистрация
const registerSchema = z.object({
    email: z.string()
        .trim()
        .toLowerCase()
        .email("Некорректный email")
        .max(254),
    password,
});

// Вход по паролю
const loginSchema = z.object({
    email: z.string()
        .trim()
        .toLowerCase()
        .email("Некорректный email")
        .max(254),
    password: z.string().min(1).max(128),
});

// Вход по TOTP
const loginTotpSchema = z.object({
    mfaToken: z.string().min(1).max(2000),
    code: z.string()
        .regex(/^\d{6}$/, "Введите 6-значный код"),
});

// ============================================
// HELPERS
// ============================================

// Генерация случайного токена
function randomToken(): string {
    return randomBytes(32).toString("base64url");
}

// SHA-256 хеширование токена
function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

// Временная реализация.
// Полностью реализуется в задании 3.
async function logEvent(
    event: Record<string, unknown>,
): Promise<void> {
    console.log(event);
}

// Получение IP клиента
function clientIp(req: import("express").Request): string {
    return req.ip ?? "unknown";
}

// ============================================
// REGISTER
// POST /api/auth/register
// ============================================

authRouter.post(
    "/register",
    validate(registerSchema),
    ah(async (req, res) => {
        const {
            email,
            password,
        } = req.body as z.infer<typeof registerSchema>;

        const hash = await hashPassword(password);

        const { rows } = await pool.query(
            `INSERT INTO users (email, password_hash)
             VALUES ($1, $2)
             ON CONFLICT (email) DO NOTHING
             RETURNING id`,
            [email, hash],
        );

        if (rows.length) {
            const token = randomToken();

            // В базе хранится только хеш токена
            await pool.query(
                `INSERT INTO email_tokens
                 VALUES ($1, $2, now() + interval '24 hours')`,
                [sha256(token), rows[0].id],
            );

            await sendVerificationEmail(
                email,
                `${config.appUrl}/verify-email?token=${token}`,
            );

            await logEvent({
                type: "REGISTERED",
                severity: "info",
                userId: rows[0].id,
                email,
                ip: clientIp(req),
            });
        }

        // Одинаковый ответ для нового и занятого адреса
        res.status(202).json({
            message:
                "Если адрес свободен, на него отправлено письмо для подтверждения",
        });
    }),
);

// ============================================
// VERIFY EMAIL
// POST /api/auth/verify-email
// ============================================

authRouter.post(
    "/verify-email",
    validate(z.object({
        token: z.string().min(20).max(100),
    })),
    ah(async (req, res) => {
        const { token } = req.body as { token: string };

        const { rows } = await pool.query(
            `DELETE FROM email_tokens
             WHERE token_hash = $1
             RETURNING user_id, expires_at`,
            [sha256(token)],
        );

        if (
            !rows.length ||
            new Date(rows[0].expires_at) <= new Date()
        ) {
            return res.status(400).json({
                error: "Ссылка недействительна",
            });
        }

        await pool.query(
            `UPDATE users
             SET email_verified = true
             WHERE id = $1`,
            [rows[0].user_id],
        );

        await logEvent({
            type: "EMAIL_VERIFIED",
            severity: "info",
            userId: rows[0].user_id,
            ip: clientIp(req),
        });

        return res.json({
            message: "Адрес электронной почты подтверждён",
        });
    }),
);

// ============================================
// LOGIN
// POST /api/auth/login
// ============================================

authRouter.post(
    "/login",
    validate(loginSchema),
    ah(async (req, res) => {
        const {
            email,
            password: loginPassword,
        } = req.body as z.infer<typeof loginSchema>;

        const { rows } = await pool.query<{
            id: number;
            email: string;
            password_hash: string;
            email_verified: boolean;
            totp_enabled: boolean;
            role: string;
            status: string;
        }>(
            `SELECT
                id,
                email,
                password_hash,
                email_verified,
                totp_enabled,
                role,
                status
             FROM users
             WHERE email = $1
             LIMIT 1`,
            [email],
        );

        const user = rows[0];

        // Проверка пароля даже если пользователь не найден
        const passwordValid = await verifyPassword(
            loginPassword,
            user?.password_hash ?? DUMMY_HASH,
        );

        if (!user || !passwordValid) {
            await logEvent({
                type: "LOGIN_FAILED",
                severity: "warning",
                email,
                ip: clientIp(req),
            });

            return res.status(401).json({
                error: "Неверный email или пароль",
            });
        }

        // Проверка подтверждения email
        if (!user.email_verified) {
            return res.status(403).json({
                error: "Подтвердите адрес электронной почты",
            });
        }

        // Проверка замороженного аккаунта
        if (user.status === "frozen") {
            return res.status(403).json({
                error: "Учётная запись заморожена",
            });
        }

        // Если включена двухфакторная аутентификация
        if (user.totp_enabled) {
            const fingerprint = req.get("X-Device-Id");

            if (
                !fingerprint ||
                !/^[a-f0-9]{64}$/i.test(fingerprint)
            ) {
                return res.status(400).json({
                    error: "Некорректный идентификатор устройства",
                });
            }

            const mfaToken = signMfa(
                user.id,
                fingerprint,
            );

            return res.json({
                mfaRequired: true,
                mfaToken,
            });
        }

        // Создание access JWT
        const accessToken = signAccess(
            user.id,
            user.role,
        );

        // Установка защищённой cookie
        setAuthCookie(res, accessToken);

        await logEvent({
            type: "LOGIN_SUCCESS",
            severity: "info",
            userId: user.id,
            email: user.email,
            ip: clientIp(req),
        });

        return res.json({
            message: "Вход выполнен успешно",
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        });
    }),
);

// ============================================
// LOGIN WITH TOTP
// POST /api/auth/login/totp
// ============================================

authRouter.post(
    "/login/totp",
    validate(loginTotpSchema),
    ah(async (req, res) => {
        const {
            mfaToken,
            code,
        } = req.body as z.infer<typeof loginTotpSchema>;

        // Проверка MFA-токена
        let claims: MfaClaims;

        try {
            claims = verifyToken<MfaClaims>(
                mfaToken,
                "mfa",
            );
        } catch {
            return res.status(401).json({
                error: "Недействительный или просроченный MFA-токен",
            });
        }

        // Проверка привязки к устройству
        const fingerprint = req.get("X-Device-Id");

        if (
            !fingerprint ||
            !/^[a-f0-9]{64}$/i.test(fingerprint) ||
            claims.fp !== fingerprint
        ) {
            return res.status(401).json({
                error: "Устройство не совпадает",
            });
        }

        // Получение пользователя
        const { rows } = await pool.query<{
            id: number;
            email: string;
            role: string;
            status: string;
            totp_secret: string | null;
            totp_enabled: boolean;
        }>(
            `SELECT
                id,
                email,
                role,
                status,
                totp_secret,
                totp_enabled
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [claims.sub],
        );

        const user = rows[0];

        if (
            !user ||
            user.status === "frozen" ||
            !user.totp_enabled ||
            !user.totp_secret
        ) {
            return res.status(401).json({
                error: "Недействительная MFA-сессия",
            });
        }

        // Расшифровка секрета TOTP
        let secret: string;

        try {
            secret = decrypt(user.totp_secret);
        } catch {
            console.error("Failed to decrypt TOTP secret");

            return res.status(500).json({
                error: "Ошибка проверки двухфакторной аутентификации",
            });
        }

        // Проверка кода TOTP
        const step = verifyTotp(secret, code);

        if (step === null) {
            await logEvent({
                type: "TOTP_FAILED",
                severity: "warning",
                userId: user.id,
                ip: clientIp(req),
            });

            return res.status(401).json({
                error: "Неверный код подтверждения",
            });
        }

        // Защита от повторного использования кода
        const replayKey = `totp:used:${user.id}:${step}`;

        const fresh = await redis.set(
            replayKey,
            "1",
            "EX",
            120,
            "NX",
        );

        if (fresh !== "OK") {
            await logEvent({
                type: "TOTP_REPLAY",
                severity: "warning",
                userId: user.id,
                ip: clientIp(req),
            });

            return res.status(401).json({
                error: "Код уже использован",
            });
        }

        // Создание полноценной сессии
        const accessToken = signAccess(
            user.id,
            user.role,
        );

        setAuthCookie(res, accessToken);

        await logEvent({
            type: "LOGIN_SUCCESS",
            severity: "info",
            userId: user.id,
            email: user.email,
            ip: clientIp(req),
        });

        return res.json({
            message: "Вход выполнен успешно",
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        });
    }),
);


// ============================================
// LOGOUT
// POST /api/auth/logout
// ============================================

authRouter.post(
    "/logout",
    (_req, res) => {
        clearAuthCookie(res);

        return res.json({
            message: "Выход выполнен успешно",
        });
    },
);

// ============================================
// CURRENT USER
// GET /api/auth/me
// ============================================

authRouter.get(
    "/me",
    requireAuth,
    (_req, res) => {
        const user = res.locals.user as AuthUser;

        return res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                balance: user.balance,
                totp_enabled: user.totp_enabled,
            },
        });
    },
);


// ============================================
// 2FA SETUP
// POST /api/auth/2fa/setup
// ============================================


authRouter.post(
    "/2fa/setup",
    requireAuth,
    ah(async (_req, res) => {
        const user = res.locals.user as AuthUser;

        // Получаем email и состояние 2FA
        const { rows } = await pool.query<{
            email: string;
            totp_enabled: boolean;
        }>(
            `SELECT email, totp_enabled
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [user.id],
        );

        if (!rows.length) {
            return res.status(404).json({
                error: "Пользователь не найден",
            });
        }

        if (rows[0].totp_enabled) {
            return res.status(409).json({
                error: "Двухфакторная аутентификация уже включена",
            });
        }

        // Генерируем новый секрет TOTP
        const secret = generateSecret();

        // Шифруем секрет перед сохранением в БД
        const encryptedSecret = encrypt(secret);

        await pool.query(
            `UPDATE users
             SET totp_secret = $1,
                 totp_enabled = false
             WHERE id = $2`,
            [encryptedSecret, user.id],
        );

        // Создаём URI для приложения-аутентификатора
        const uri = otpauthUri(
            secret,
            rows[0].email,
            "FraudGuard",
        );

        // Генерируем QR-код
        const qrCode = await QRCode.toDataURL(uri);

        return res.json({
            message: "Отсканируйте QR-код в приложении-аутентификаторе",
            qrCode,
            secret,
        });
    }),
);


// ============================================
// 2FA ENABLE
// POST /api/auth/2fa/enable
// ============================================

authRouter.post(
    "/2fa/enable",
    requireAuth,
    validate(z.object({
        code: z.string().regex(/^\d{6}$/, "Введите 6-значный код"),
    })),
    ah(async (req, res) => {
        const user = res.locals.user as AuthUser;
        const { code } = req.body as { code: string };

        // Получаем сохранённый секрет
        const { rows } = await pool.query<{
            totp_secret: string | null;
            totp_enabled: boolean;
        }>(
            `SELECT totp_secret, totp_enabled
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [user.id],
        );

        if (!rows.length || !rows[0].totp_secret) {
            return res.status(400).json({
                error: "Сначала выполните настройку 2FA",
            });
        }

        if (rows[0].totp_enabled) {
            return res.status(409).json({
                error: "Двухфакторная аутентификация уже включена",
            });
        }

        // Расшифровываем секрет
        let secret: string;

        try {
            secret = decrypt(rows[0].totp_secret);
        } catch {
            console.error("Failed to decrypt TOTP secret");

            return res.status(500).json({
                error: "Ошибка проверки двухфакторной аутентификации",
            });
        }

        // Проверяем код TOTP
        const step = verifyTotp(secret, code);

        if (step === null) {
            return res.status(400).json({
                error: "Неверный код подтверждения",
            });
        }

        // Запрещаем повторное использование кода
        const replayKey = `totp:used:${user.id}:${step}`;

        const fresh = await redis.set(
            replayKey,
            "1",
            "EX",
            120,
            "NX",
        );

        if (fresh !== "OK") {
            return res.status(400).json({
                error: "Код уже использован",
            });
        }

        // Включаем двухфакторную аутентификацию
        await pool.query(
            `UPDATE users
             SET totp_enabled = true
             WHERE id = $1`,
            [user.id],
        );

        await logEvent({
            type: "TOTP_ENABLED",
            severity: "info",
            userId: user.id,
            ip: clientIp(req),
        });

        return res.json({
            message: "Двухфакторная аутентификация включена",
        });
    }),
);