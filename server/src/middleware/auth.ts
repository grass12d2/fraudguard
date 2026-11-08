import type { RequestHandler } from "express";

import { pool } from "../db.js";
import { ah } from "../util.js";
import {
  verifyToken,
  type AccessClaims,
} from "../security/tokens.js";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  status: string;
  balance: string;
  totp_enabled: boolean;
}

export const requireAuth: RequestHandler = ah(
  async (req, res, next) => {
    const token = req.cookies?.access;

    if (typeof token !== "string") {
      return res.status(401).json({
        error: "Требуется авторизация",
      });
    }

    let claims: AccessClaims;

    try {
      claims = verifyToken<AccessClaims>(token, "access");
    } catch {
      return res.status(401).json({
        error: "Недействительный или просроченный токен",
      });
    }

    const userId = Number(claims.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Недействительный токен",
      });
    }

    const { rows } = await pool.query<AuthUser>(
      `SELECT
         id,
         email,
         role,
         status,
         balance,
         totp_enabled
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.status(401).json({
        error: "Пользователь не найден",
      });
    }

    const user = rows[0];

    if (user.status === "frozen") {
      return res.status(403).json({
        error: "Учётная запись заморожена",
      });
    }

    res.locals.user = user;

    next();
  },
);

export function requireRole(role: string): RequestHandler {
  return (req, res, next) => {
    const user = res.locals.user as AuthUser | undefined;

    if (!user) {
      return res.status(401).json({
        error: "Требуется авторизация",
      });
    }

    if (user.role !== role) {
      return res.status(403).json({
        error: "Недостаточно прав",
      });
    }

    next();
  };
}