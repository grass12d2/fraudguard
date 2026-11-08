
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  pwd: string,
  salt: Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number }
) => Promise<Buffer>;

const N = 16384, r = 8, p = 1, KEYLEN = 32;

// Формат хранения: scrypt$N$r$p$соль$хеш
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, { N, r, p });

  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [alg, n, rr, pp, saltB64, hashB64] = stored.split("$");

  if (alg !== "scrypt" || !n || !rr || !pp || !saltB64 || !hashB64) {
    return false;
  }

  try {
    const expected = Buffer.from(hashB64, "base64");

    if (expected.length !== KEYLEN) return false;

    const actual = await scryptAsync(
      password,
      Buffer.from(saltB64, "base64"),
      expected.length,
      {
        N: Number(n),
        r: Number(rr),
        p: Number(pp),
      }
    );

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Хеш-«пустышка» для несуществующих пользователей (см. задание 3)
export const DUMMY_HASH = await hashPassword(
  randomBytes(16).toString("hex")
);
