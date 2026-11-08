
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
    connectionString: config.databaseUrl,
});

export async function migrate(): Promise<void> {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      totp_secret TEXT,
      totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      balance NUMERIC(12,2) NOT NULL DEFAULT 100000,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint TEXT NOT NULL,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_ip TEXT,
      PRIMARY KEY (user_id, fingerprint)
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      recipient TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      risk_score INT NOT NULL DEFAULT 0,
      reasons JSONB NOT NULL DEFAULT '[]',
      ip TEXT,
      fingerprint TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS security_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INT,
      email TEXT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      ip TEXT,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
