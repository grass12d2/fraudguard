
import { createHash } from "node:crypto";

import { pool } from "../db.js";
import { redis } from "../redis.js";
import { logEvent } from "./securityEvents.js";

// Создание серверного отпечатка устройства
function createDeviceFingerprint(
    clientFingerprint: string,
    userAgent: string,
): string {
    return createHash("sha256")
        .update(`${clientFingerprint}:${userAgent}`)
        .digest("hex");
}

// Определение подсети IPv4 /24
function getNetwork(ip: string): string | null {
    const normalizedIp = ip.replace(/^::ffff:/, "");

    const parts = normalizedIp.split(".");

    if (
        parts.length !== 4 ||
        parts.some(
            (part) =>
                !/^\d{1,3}$/.test(part) ||
                Number(part) > 255,
        )
    ) {
        return null;
    }

    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

// Регистрация устройства и проверка новой сети
export async function completeLogin(
    userId: number,
    email: string,
    ip: string,
    clientFingerprint: string,
    userAgent: string,
): Promise<void> {
    const fingerprint = createDeviceFingerprint(
        clientFingerprint,
        userAgent,
    );

    // Проверка и сохранение устройства
    const result = await pool.query(
        `INSERT INTO devices (
            user_id,
            fingerprint,
            last_ip
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, fingerprint)
         DO UPDATE SET last_ip = EXCLUDED.last_ip
         RETURNING (xmax = 0) AS is_new`,
        [userId, fingerprint, ip],
    );

    if (result.rows[0]?.is_new) {
        await logEvent({
            type: "NEW_DEVICE_LOGIN",
            severity: "medium",
            userId,
            email,
            ip,
            details: {
                fingerprint,
                userAgent,
            },
        });
    }

    // Проверка новой сети
    const network = getNetwork(ip);

    if (network) {
        const previousNetwork = await redis.getset(
            `user:network:${userId}`,
            network,
        );

        if (
            previousNetwork !== null &&
            previousNetwork !== network
        ) {
            await logEvent({
                type: "NEW_NETWORK_LOGIN",
                severity: "low",
                userId,
                email,
                ip,
                details: {
                    previousNetwork,
                    currentNetwork: network,
                },
            });
        }
    }
}
