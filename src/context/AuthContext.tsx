"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, ApiError, getApiErrorMessage, isValidAuthUser } from "@/lib/auth-api";
import { isUserEmailVerified, mergeEmailVerifiedState } from "@/lib/email-verification";
import type { User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  markEmailVerified: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isLoading = !authChecked;

  const applyUser = useCallback((next: User | null) => {
    setUser((previous) => {
      if (!next || !isValidAuthUser(next)) return null;
      return mergeEmailVerifiedState(previous, next);
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.getMe();
      applyUser(data);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error("Failed to fetch user:", getApiErrorMessage(error));
      }
      setUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data } = await authApi.getMe();
        if (!cancelled) applyUser(data);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  useEffect(() => {
    function onFocus() {
      if (authChecked) void refreshUser();
    }

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [authChecked, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    if (!isValidAuthUser(data.user)) {
      throw new Error("Login succeeded but the server returned an invalid user profile.");
    }
    applyUser(data.user);
    return data.user;
  }, [applyUser]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data } = await authApi.register(name, email, password);
    if (!isValidAuthUser(data.user)) {
      throw new Error("Registration succeeded but the server returned an invalid user profile.");
    }
    applyUser(data.user);
    return data.user;
  }, [applyUser]);

  const markEmailVerified = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: isValidAuthUser(user),
      isEmailVerified: isUserEmailVerified(user),
      login,
      register,
      logout,
      refreshUser,
      markEmailVerified,
    }),
    [user, isLoading, login, register, logout, refreshUser, markEmailVerified],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
