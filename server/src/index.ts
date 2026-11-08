
import express, {
    type ErrorRequestHandler,
} from "express";

import cookieParser from "cookie-parser";

import { config } from "./config.js";
import { pool, migrate } from "./db.js";
import { redis } from "./redis.js";
import { authRouter } from "./routes/auth.js";
import {
    requireAuth,
    requireRole,
} from "./middleware/auth.js";

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use("/api/auth", authRouter);

app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    await redis.ping();

    res.json({
        status: "ok",
        database: "connected",
        redis: "connected",
    });
});

// Test: kiểm tra xác thực người dùng
app.get("/api/test-auth", requireAuth, (_req, res) => {
    res.json({
        message: "Authentication successful",
        user: res.locals.user,
    });
});

// Test: kiểm tra quyền admin
app.get(
    "/api/test-admin",
    requireAuth,
    requireRole("admin"),
    (_req, res) => {
        res.json({
            message: "Admin access granted",
        });
    },
);

app.use((_req, res) => {
    res.status(404).json({
        error: "Not found",
    });
});

const errorHandler: ErrorRequestHandler = (
    err,
    _req,
    res,
    _next
) => {
    console.error(err);

    res.status(500).json({
        error: "Internal server error",
    });
};

app.use(errorHandler);

async function startServer() {
    try {
        await pool.query("SELECT 1");
        await redis.ping();

        await migrate();

        app.listen(config.port, () => {
            console.log(
                `FraudGuard server running at http://localhost:${config.port}`
            );
        });
    } catch (error) {
        console.error("Failed to start server:", error);

        await pool.end();
        redis.disconnect();

        process.exit(1);
    }
}

startServer();
