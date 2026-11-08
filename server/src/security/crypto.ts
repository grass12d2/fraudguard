import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { config } from "../config.js";

const key = Buffer.from(config.dataKey, "hex");

if (key.length !== 32) {
  throw new Error("DATA_KEY must be exactly 32 bytes (64 hex characters)");
}

/**
 * AES-256-GCM encryption.
 * Output format: iv.tag.ciphertext
 */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

/**
 * AES-256-GCM decryption.
 */
export function decrypt(token: string): string {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [iv, tag, encrypted] = parts.map((part) =>
    Buffer.from(part, "base64url"),
  );

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid encrypted data");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}