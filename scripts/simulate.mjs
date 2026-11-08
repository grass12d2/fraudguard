#!/usr/bin/env node
// Сценарии проверки защитных механизмов учебного стенда FraudGuard.
// Запускать ТОЛЬКО против собственного стенда (по умолчанию https://localhost).
//
//   node simulate.mjs bruteforce <email> [slow]   — подбор пароля (slow — 1 попытка в 7 с)
//   node simulate.mjs stuffing                     — перебор разных email с одного IP (≈80 с)
//   node simulate.mjs fraud <email> <password>     — серия переводов: обычные, подозрительные, мошеннические
//   node simulate.mjs spoof                        — попытка подменить IP заголовком X-Forwarded-For
//
// Для самоподписанного сертификата: NODE_EXTRA_CA_CERTS=../deploy/nginx/certs/server.crt
const BASE = process.env.BASE_URL ?? "https://localhost";
const [, , scenario, ...args] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function session(deviceId = "simulator-device") {
  let cookie = "";
  return async (method, path, body, headers = {}) => {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { "content-type": "application/json", "x-device-id": deviceId, cookie, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}

async function bruteforce(email, mode = "fast") {
  const s = session("bruteforce");
  for (let i = 1; i <= 8; i++) {
    const { status, data } = await s("POST", "/auth/login", { email, password: `Wrong#Pass${i}` });
    console.log(`попытка ${i}: ${status} ${data.error ?? ""}`);
    if (mode === "slow") await sleep(7000); // медленный подбор не упирается в лимит частоты
  }
}

async function stuffing() {
  const s = session("stuffing");
  for (let i = 1; i <= 12; i++) {
    const email = `victim${i}@example.com`;
    const { status, data } = await s("POST", "/auth/login", { email, password: "Password#2024" });
    console.log(`${email}: ${status} ${data.error ?? ""}`);
    await sleep(6500); // медленная атака: укладывается в лимит 10 запросов в минуту
  }
}

async function fraud(email, password) {
  const s = session("fraud-device");
  const login = await s("POST", "/auth/login", { email, password });
  if (login.status !== 200 || login.data.mfaRequired) {
    console.log("Вход не выполнен (для сценария отключите 2FA у тестовой учётной записи):", login.status, login.data);
    return;
  }
  const steps = [
    ["обычный перевод", "4276000011112222", 1500],
    ["обычный перевод", "4276000011112222", 1700],
    ["обычный перевод", "4276000011112222", 1300],
    ["повышенная сумма знакомому получателю", "4276000011112222", 5000],
    ["крупная сумма новому получателю", "5469000033334444", 25000],
    ["вывод почти всего баланса", "5469000055556666", 90000],
    ["повторная попытка вывода", "5469000077778888", 80000],
    ["попытка после заморозки", "4276000011112222", 100],
  ];
  for (const [title, recipient, amount] of steps) {
    const { status, data } = await s("POST", "/transfers", { recipient, amount });
    const rules = data.risk?.reasons.map((r) => `${r.rule}+${r.points}`).join(", ") || "—";
    console.log(`${title} (${amount} ₽): HTTP ${status}, статус ${data.status ?? data.error}, риск ${data.risk?.score ?? "-"} [${rules}]`);
  }
}

async function spoof() {
  const s = session("spoof");
  for (let i = 1; i <= 3; i++) {
    const { status } = await s("POST", "/auth/login", { email: "spoof@example.com", password: "x" },
      { "X-Forwarded-For": `203.0.113.${i}` });
    console.log(`X-Forwarded-For: 203.0.113.${i} -> ${status}`);
  }
  console.log("Проверьте в журнале событий: IP должен быть реальным, а не 203.0.113.x");
}

const scenarios = { bruteforce, stuffing, fraud, spoof };
if (!scenarios[scenario]) {
  console.log("Сценарии: bruteforce <email> [slow] | stuffing | fraud <email> <password> | spoof");
  process.exit(1);
}
await scenarios[scenario](...args);
