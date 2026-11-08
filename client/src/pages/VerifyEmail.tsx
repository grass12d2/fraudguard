import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const sent = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || sent.current) return;

    sent.current = true;

    api<{ message: string }>("/auth/verify-email", {
      body: { token },
    })
      .then((res) => setMessage(res.message))
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Сервер недоступен"
        );
      });
  }, [token]);

  const displayError = !token
    ? "Ссылка недействительна"
    : error;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Подтверждение электронной почты</h1>

        {!message && !displayError && (
          <p>Проверка ссылки...</p>
        )}

        {message && <p role="status">{message}</p>}

        {displayError && (
          <p role="alert">{displayError}</p>
        )}
      </section>
    </main>
  );
}