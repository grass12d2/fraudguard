import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../context/auth-context";

interface LoginResponse {
  message?: string;
  mfaRequired?: boolean;
  mfaToken?: string;
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isMfaStep = mfaToken !== null;

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname ?? "/security";

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: {
          email: email.trim(),
          password,
        },
      });

      if (response.mfaRequired && response.mfaToken) {
        setMfaToken(response.mfaToken);
        setCode("");
        return;
      }

      await refresh();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Сервер недоступен. Попробуйте позже.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyTotp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!mfaToken) {
      setError("Сессия двухфакторной аутентификации отсутствует.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api<LoginResponse>("/auth/login/totp", {
        method: "POST",
        body: {
          mfaToken,
          code,
        },
      });

      await refresh();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Сервер недоступен. Попробуйте позже.",
      );
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    setMfaToken(null);
    setCode("");
    setError(null);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        {!isMfaStep ? (
          <>
            <h1>Вход в систему</h1>

            <form onSubmit={onLogin}>
              <div>
                <label htmlFor="email">
                  Электронная почта
                </label>

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
                <label htmlFor="password">
                  Пароль
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
              >
                {loading ? "Вход..." : "Войти"}
              </button>
            </form>

            <p>
              Нет аккаунта?{" "}
              <a href="/register">Зарегистрироваться</a>
            </p>
          </>
        ) : (
          <>
            <h1>Двухфакторная аутентификация</h1>

            <p>
              Откройте приложение-аутентификатор и введите
              шестизначный код.
            </p>

            <form onSubmit={onVerifyTotp}>
              <div>
                <label htmlFor="totp-code">
                  Код подтверждения
                </label>

                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
              >
                {loading ? "Проверка..." : "Подтвердить"}
              </button>
            </form>

            <button
              type="button"
              className="secondary-button"
              onClick={backToLogin}
              disabled={loading}
            >
              Вернуться ко входу
            </button>
          </>
        )}

        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}