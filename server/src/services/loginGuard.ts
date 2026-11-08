
import { redis } from "../redis.js";

// Пороговые значения защиты от подбора паролей
export const LIMITS = {
    accountFailures: 5,
    accountWindowSec: 15 * 60,

    ipFailures: 20,
    ipWindowSec: 60 * 60,

    stuffingEmails: 10,
    stuffingWindowSec: 10 * 60,

    ipBlockSec: 60 * 60,
};

// Атомарное увеличение счётчика с установкой TTL
async function incrWindow(
    key: string,
    windowSec: number,
): Promise<number> {
    const result = await redis
        .multi()
        .incr(key)
        .expire(key, windowSec, "NX")
        .exec();

    if (!result || result[0]?.[0] || result[1]?.[0]) {
        throw new Error("Redis counter transaction failed");
    }

    return Number(result[0]?.[1]);
}

// Проверка блокировки учётной записи
export async function isAccountLocked(
    email: string,
): Promise<boolean> {
    const count = Number(
        await redis.get(`lf:acct:${email}`) ?? 0,
    );

    return count >= LIMITS.accountFailures;
}

// Проверка блокировки IP-адреса
export async function isIpBlocked(
    ip: string,
): Promise<boolean> {
    return (
        await redis.exists(`block:ip:${ip}`)
    ) === 1;
}

// Регистрация неудачной попытки входа
export async function registerFailure(
    email: string,
    ip: string,
): Promise<{
    accountFailures: number;
    ipFailures: number;
    distinctEmails: number;
    accountLocked: boolean;
    ipBlocked: boolean;
    credentialStuffing: boolean;
}> {
    const accountFailures = await incrWindow(
        `lf:acct:${email}`,
        LIMITS.accountWindowSec,
    );

    const ipFailures = await incrWindow(
        `lf:ip:${ip}`,
        LIMITS.ipWindowSec,
    );

    const emailSetKey = `cs:ip:${ip}`;

    await redis
        .multi()
        .sadd(emailSetKey, email)
        .expire(
            emailSetKey,
            LIMITS.stuffingWindowSec,
            "NX",
        )
        .exec();

    const distinctEmails = await redis.scard(emailSetKey);

    const accountLocked =
        accountFailures >= LIMITS.accountFailures;

    const credentialStuffing =
        distinctEmails >= LIMITS.stuffingEmails;

    let ipBlocked = false;

    if (
        credentialStuffing ||
        ipFailures >= LIMITS.ipFailures
    ) {
        await redis.set(
            `block:ip:${ip}`,
            "1",
            "EX",
            LIMITS.ipBlockSec,
            "NX",
        );

        ipBlocked = true;
    }

    return {
        accountFailures,
        ipFailures,
        distinctEmails,
        accountLocked,
        ipBlocked,
        credentialStuffing,
    };
}

// Сброс счётчика неудачных попыток после успешного входа
export async function resetAccountFailures(
    email: string,
): Promise<void> {
    await redis.del(`lf:acct:${email}`);
}