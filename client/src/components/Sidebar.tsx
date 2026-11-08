import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-section-title">
          ОСНОВНОЕ
        </span>
      </div>

      <nav className="sidebar-navigation" aria-label="Навигация приложения">
        <NavLink
          to="/security"
          className={({ isActive }) =>
            `sidebar-link${isActive ? " active" : ""}`
          }
        >
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

          <span>Безопасность</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-text">
          FraudGuard
        </span>
        <span className="sidebar-version">
          Security System
        </span>
      </div>
    </aside>
  );
}