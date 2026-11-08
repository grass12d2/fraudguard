
import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api";

const rules: [RegExp, string][] = [
  [/.{10,}/, "не менее 10 символов"],
  [/[a-z]/, "строчная буква"],
  [/[A-Z]/, "заглавная буква"],
  [/\d/, "цифра"],
  [/[^A-Za-z0-9]/, "спецсимвол"],
];

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const failed = rules
    .filter(([re]) => !re.test(password))
    .map(([, text]) => text);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const res = await api<{ message: string }>("/auth/register", {
        body: { email, password },
      });

      setMessage(res.message);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Сервер недоступен",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Регистрация</h1>

        <form onSubmit={onSubmit}>
          <div>
            <label htmlFor="email">Электронная почта</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
              required
            />
          </div>

          <div>
            <p>Требования к паролю:</p>
            <ul>
              {failed.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
              {failed.length === 0 && (
                <li>Все требования выполнены</li>
              )}
            </ul>
          </div>

          <button
            type="submit"
            disabled={failed.length > 0 || loading || !email.trim()}
          >
            {loading ? "Отправка..." : "Зарегистрироваться"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
