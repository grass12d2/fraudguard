
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),

  isProd: process.env.NODE_ENV === "production",

  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://fraudguard:fraudguard@localhost:5432/fraudguard",

  redisUrl:
    process.env.REDIS_URL ?? "redis://localhost:6379",

  jwtSecret:
    process.env.JWT_SECRET ?? "dev-only-change-this-secret",

  dataKey:
    process.env.DATA_KEY ?? "0123456789abcdef".repeat(4),

  appUrl:
    process.env.APP_URL ?? "http://localhost:5173",

  mailMode:
    process.env.MAIL_MODE ?? "smtp",

  smtpHost:
    process.env.SMTP_HOST ?? "127.0.0.1",

  smtpPort:
    Number(process.env.SMTP_PORT ?? 1025),

  trustProxy:
    Number(process.env.TRUST_PROXY ?? 0),

  adminEmail:
    process.env.ADMIN_EMAIL ?? "admin@fraudguard.local",

  adminPassword:
    process.env.ADMIN_PASSWORD ?? "Admin#Passw0rd!",
};
