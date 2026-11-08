
import { Redis } from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 2,

    retryStrategy(times: number) {
        return Math.min(times * 200, 2000);
    },
});
