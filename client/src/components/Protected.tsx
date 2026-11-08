import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";

interface ProtectedProps {
  children: React.ReactNode;
}

export default function Protected({ children }: ProtectedProps) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p>Проверка сессии...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Ошибка подключения</h1>

          <p role="alert">{error}</p>

          <button
            type="button"
            onClick={() => void refresh()}
          >
            Повторить
          </button>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
}