
import { pool } from "../db.js";

export interface SecurityEvent {
    type: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    userId?: number | null;
    email?: string | null;
    ip?: string | null;
    details?: Record<string, unknown>;
}

// Запись события безопасности в PostgreSQL и stdout
export async function logEvent(
    event: SecurityEvent,
): Promise<void> {
    const {
        type,
        severity,
        userId = null,
        email = null,
        ip = null,
        details = {},
    } = event;

    await pool.query(
        `INSERT INTO security_events
            (user_id, email, type, severity, ip, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            userId,
            email,
            type,
            severity,
            ip,
            JSON.stringify(details),
        ],
    );

    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type,
        severity,
        userId,
        email,
        ip,
        details,
    }));
}
