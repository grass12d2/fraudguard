
import type { Response } from "express";

const COOKIE_NAME = "access";
const COOKIE_MAX_AGE = 30 * 60 * 1000;

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
};

export function setAuthCookie(
    res: Response,
    token: string,
): void {
    res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: COOKIE_MAX_AGE,
    });
}

export function clearAuthCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, cookieOptions);
}
