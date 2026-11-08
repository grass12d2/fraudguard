const STORAGE_KEY = "fraudguard-install-id";

function getInstallId(): string {
  let id = localStorage.getItem(STORAGE_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}

export async function getDeviceId(): Promise<string> {
  const data = [
    getInstallId(),
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}