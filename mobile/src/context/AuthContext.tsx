import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { fetchMe, type AuthUser, type BloodEligibility } from "../lib/api";

const TOKEN_KEY = "donationplatform_auth_token";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  // PRD §8.2 — computed server-side, refreshed alongside `user`.
  bloodEligibility: BloodEligibility | null;
  signIn: (token: string, user: AuthUser, bloodEligibility: BloodEligibility) => Promise<void>;
  signOut: () => Promise<void>;
  // Re-fetches /me — used after a profile edit (e.g. the blood profile) so the rest of the app
  // sees the change without requiring a full app restart.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bloodEligibility, setBloodEligibility] = useState<BloodEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        try {
          const { user: me, bloodEligibility } = await fetchMe(stored);
          setToken(stored);
          setUser(me);
          setBloodEligibility(bloodEligibility);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      bloodEligibility,
      signIn: async (newToken, newUser, newEligibility) => {
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(newUser);
        setBloodEligibility(newEligibility);
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setBloodEligibility(null);
      },
      refreshUser: async () => {
        if (!token) return;
        const { user: me, bloodEligibility } = await fetchMe(token);
        setUser(me);
        setBloodEligibility(bloodEligibility);
      },
    }),
    [user, token, isLoading, bloodEligibility]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
