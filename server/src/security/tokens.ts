import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";

export interface AccessClaims extends JwtPayload {
  sub: string;
  role: string;
  purpose: "access";
}

export interface MfaClaims extends JwtPayload {
  sub: string;
  fp: string;
  purpose: "mfa";
}

export function signAccess(
  userId: number | string,
  role: string,
): string {
  return jwt.sign(
    {
      role,
      purpose: "access",
    },
    config.jwtSecret,
    {
      algorithm: "HS256",
      subject: String(userId),
      expiresIn: "30m",
    },
  );
}

export function signMfa(
  userId: number | string,
  fingerprint: string,
): string {
  return jwt.sign(
    {
      fp: fingerprint,
      purpose: "mfa",
    },
    config.jwtSecret,
    {
      algorithm: "HS256",
      subject: String(userId),
      expiresIn: "5m",
    },
  );
}

export function verifyToken<T extends JwtPayload>(
  token: string,
  purpose: "access" | "mfa",
): T {
  const decoded = jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
  });

  if (
    typeof decoded === "string" ||
    decoded.purpose !== purpose ||
    typeof decoded.sub !== "string"
  ) {
    throw new Error("Invalid token");
  }

  return decoded as T;
}