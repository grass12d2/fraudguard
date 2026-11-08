
import { getDeviceId } from "./fingerprint";

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public body: unknown
    ) {
        super(message);
    }
}

export async function api<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
): Promise<T> {
    const res = await fetch(`/api${path}`, {
        method: options.method ?? (options.body ? "POST" : "GET"),
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-Device-Id": await getDeviceId(),
        },
        body:
            options.body !== undefined
                ? JSON.stringify(options.body)
                : undefined,
    });

    const data = (await res.json().catch(() => ({}))) as T & {
        error?: string;
    };

    if (!res.ok) {
        throw new ApiError(
            res.status,
            data.error ?? `Ошибка ${res.status}`,
            data
        );
    }

    return data;
}
