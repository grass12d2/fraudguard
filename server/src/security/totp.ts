import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encode Buffer thành Base32.
 */
export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode Base32 thành Buffer.
 */
export function base32Decode(input: string): Buffer {
  const normalized = input
    .toUpperCase()
    .replace(/=+$/, "")
    .replace(/\s/g, "");

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error("Invalid Base32 secret");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Tạo secret ngẫu nhiên 160 bit.
 */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * HOTP theo RFC 4226, sử dụng HMAC-SHA1.
 */
export function hotp(secret: string, counter: number): string {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new RangeError("Invalid HOTP counter");
  }

  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));

  const hash = createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();

  const offset = hash[hash.length - 1] & 0x0f;

  const code =
    (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;

  return code.toString().padStart(6, "0");
}

/**
 * Xác định bước TOTP hiện tại (30 giây).
 */
export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / 30);
}

/**
 * Xác minh TOTP.
 * Trả về time-step hợp lệ hoặc null nếu mã sai.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }

  const step = currentStep(now);

  for (const candidate of [step - 1, step, step + 1]) {
    if (candidate < 0) {
      continue;
    }

    const expected = Buffer.from(hotp(secret, candidate));
    const actual = Buffer.from(code);

    if (
      expected.length === actual.length &&
      timingSafeEqual(expected, actual)
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * Tạo URI để ứng dụng Authenticator quét QR.
 */
export function otpauthUri(
  secret: string,
  email: string,
  issuer = "FraudGuard",
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);

  return (
    `otpauth://totp/${label}` +
    `?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&digits=6&period=30`
  );
}