
import type { RequestHandler } from "express";

import { isIpBlocked } from "../services/loginGuard.js";
import { logEvent } from "../services/securityEvents.js";

// Блокировка запросов с IP-адресов из чёрного списка
export const ipBlocklist: RequestHandler = (
    req,
    res,
    next,
) => {
    const ip = req.ip ?? "unknown";

    isIpBlocked(ip)
        .then(async (blocked) => {
            if (blocked) {
                await logEvent({
                    type: "RATE_LIMITED",
                    severity: "low",
                    ip,
                    details: {
                        reason: "IP_BLOCKED",
                        path: req.path,
                    },
                });

                return res.status(403).json({
                    error: "Доступ с вашего адреса ограничен",
                });
            }

            return next();
        })
        .catch(next);
};
