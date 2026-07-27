import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { fetchMe, ApiError, type AuthUser, type BloodEligibility, type TrustTierInfo } from "../lib/api";
import { clearNeedsFeedCache } from "../screens/NeedsFeedScreen";
import { clearMyNeedsCache } from "../screens/MyNeedsScreen";
import { clearContributionsCache } from "../screens/MyContributionsScreen";

const TOKEN_KEY = "donationplatform_auth_token";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  // PRD §8.2 — computed server-side, refreshed alongside `user`.
  bloodEligibility: BloodEligibility | null;
  // PRD §14.1 — computed server-side, refreshed alongside `user`.
  trustTierInfo: TrustTierInfo | null;
  signIn: (token: string, user: AuthUser, bloodEligibility: BloodEligibility, trustTierInfo: TrustTierInfo) => Promise<void>;
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
  const [trustTierInfo, setTrustTierInfo] = useState<TrustTierInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        try {
          const { user: me, bloodEligibility, ...trust } = await fetchMe(stored);
          setToken(stored);
          setUser(me);
          setBloodEligibility(bloodEligibility);
          setTrustTierInfo(trust);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
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
      trustTierInfo,
      signIn: async (newToken, newUser, newEligibility, newTrustTierInfo) => {
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(newUser);
        setBloodEligibility(newEligibility);
        setTrustTierInfo(newTrustTierInfo);
      },
      signOut: async () => {
        clearNeedsFeedCache();
        clearMyNeedsCache();
        clearContributionsCache();
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setBloodEligibility(null);
        setTrustTierInfo(null);
      },
      refreshUser: async () => {
        if (!token) return;
        const { user: me, bloodEligibility, ...trust } = await fetchMe(token);
        setUser(me);
        setBloodEligibility(bloodEligibility);
        setTrustTierInfo(trust);
      },
    }),
    [user, token, isLoading, bloodEligibility, trustTierInfo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
