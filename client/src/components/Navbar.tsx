import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/auth-context";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    setLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("Не удалось выйти из системы.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* Logo */}
        <NavLink to={user ? "/security" : "/register"} className="navbar-brand">
          <span className="navbar-logo">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2.5L20 5.5V11.5C20 16.5 16.5 20 12 22C7.5 20 4 16.5 4 11.5V5.5L12 2.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M8.5 12L10.8 14.3L15.8 9.3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className="navbar-brand-text">
            FraudGuard
          </span>
        </NavLink>

        {/* Navigation */}
        <nav className="navbar-navigation" aria-label="Основная навигация">

          {loading ? null : user ? (
            <>
              <NavLink
                to="/security"
                className={({ isActive }) =>
                  `navbar-link${isActive ? " active" : ""}`
                }
              >
                Безопасность
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `navbar-link${isActive ? " active" : ""}`
                }
              >
                Войти
              </NavLink>

              <NavLink
                to="/register"
                className={({ isActive }) =>
                  `navbar-link navbar-register${isActive ? " active" : ""}`
                }
              >
                Регистрация
              </NavLink>
            </>
          )}
        </nav>

        {/* User account */}
        {user && !loading && (
          <div className="navbar-account">
            <div className="navbar-user">
              <span className="navbar-avatar">
                {user.email.charAt(0).toUpperCase()}
              </span>

              <div className="navbar-user-info">
                <span className="navbar-user-email">
                  {user.email}
                </span>

                <span className="navbar-user-role">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="navbar-logout"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              title="Выйти из системы"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 17L15 12L10 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 12H3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M12 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>

              <span>
                {loggingOut ? "Выход..." : "Выйти"}
              </span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="navbar-error" role="alert">
          {error}
        </div>
      )}
    </header>
  );
}