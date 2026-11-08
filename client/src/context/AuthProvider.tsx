import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../api";
import { AuthContext } from "./auth-context";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  status: string;
  balance: number | string;
  totp_enabled: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api<{ user: AuthUser }>("/auth/me");
      setUser(response.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось проверить сессию",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api<{ message: string }>("/auth/logout", {
      method: "POST",
    });

    setUser(null);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await api<{ user: AuthUser }>("/auth/me");

        if (active) {
          setUser(response.user);
        }
      } catch (err) {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось проверить сессию",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}