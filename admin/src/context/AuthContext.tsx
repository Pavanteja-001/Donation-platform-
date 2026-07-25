import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMe, type AuthUser, type Role } from "../lib/api";

const TOKEN_KEY = "donationplatform_admin_token";
const CONSOLE_ROLES: Role[] = ["ADMIN", "STAFF"];

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    fetchMe(stored)
      .then(({ user: me }) => {
        if (!CONSOLE_ROLES.includes(me.role)) {
          localStorage.removeItem(TOKEN_KEY);
          return;
        }
        setToken(stored);
        setUser(me);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAdmin: user?.role === "ADMIN",
      // D-018: the admin console is for ADMIN/STAFF only. A donor or institution
      // account that completes OTP here is rejected client-side (the backend also
      // enforces this — every /api/admin/* route requires ADMIN or STAFF).
      signIn: (newToken, newUser) => {
        if (!CONSOLE_ROLES.includes(newUser.role)) {
          throw new Error("This login is for the admin console only.");
        }
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(newUser);
      },
      signOut: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
