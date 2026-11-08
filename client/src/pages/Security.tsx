import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../context/auth-context";

interface SetupResponse {
  message: string;
  qrCode: string;
  secret: string;
}

interface EnableResponse {
  message: string;
}

export default function Security() {
  const navigate = useNavigate();
  const { user, refresh, logout } = useAuth();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Создание QR-кода для настройки 2FA
  async function handleSetup() {
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await api<SetupResponse>("/auth/2fa/setup", {
        method: "POST",
      });

      setQrCode(response.qrCode);
      setMessage(response.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось настроить двухфакторную аутентификацию.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Подтверждение TOTP-кода и включение 2FA
  async function handleEnable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await api<EnableResponse>("/auth/2fa/enable", {
        method: "POST",
        body: { code },
      });

      setMessage(response.message);
      setQrCode(null);
      setCode("");

      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось включить двухфакторную аутентификацию.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Выход из учётной записи
  async function handleLogout() {
    setError(null);
    setLoading(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось выйти из учётной записи.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Безопасность</h1>

        <p>
          Управление двухфакторной аутентификацией (2FA)
          вашей учётной записи FraudGuard.
        </p>

        {user?.totp_enabled ? (
          <>
            <div className="security-status">
              <strong>2FA включена</strong>
              <p>
                Ваша учётная запись защищена двухфакторной
                аутентификацией.
              </p>
            </div>

            <p>
              Для проверки работы 2FA выйдите из системы
              и выполните вход повторно.
            </p>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loading}
            >
              {loading ? "Выход..." : "Выйти из системы"}
            </button>
          </>
        ) : (
          <>
            <div className="security-status">
              <strong>2FA не включена</strong>
              <p>
                Включите двухфакторную аутентификацию,
                чтобы повысить безопасность учётной записи.
              </p>
            </div>

            {!qrCode ? (
              <button
                type="button"
                onClick={() => void handleSetup()}
                disabled={loading}
              >
                {loading ? "Подготовка..." : "Настроить 2FA"}
              </button>
            ) : (
              <>
                <p>
                  Откройте приложение-аутентификатор
                  и отсканируйте QR-код.
                </p>

                <div className="qr-code-container">
                  <img
                    src={qrCode}
                    alt="QR-код для настройки 2FA"
                  />
                </div>

                <p>
                  После сканирования введите шестизначный
                  код из приложения.
                </p>

                <form onSubmit={handleEnable}>
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
                      placeholder="000000"
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6),
                        )
                      }
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? "Проверка..." : "Подтвердить и включить 2FA"}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}