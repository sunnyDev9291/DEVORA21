"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi, getApiErrorMessage, isValidAuthUser, mergeAuthUserState, ApiError } from "@/lib/auth-api";
import { fetchSessionUser, SESSION_KEEPALIVE_MS } from "@/lib/auth-session";
import { clearAuthClientStorage } from "@/lib/auth-storage";
import { isUserEmailVerified } from "@/lib/email-verification";
import { isResumeBuilderEnabled, RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";
import {
  clearUserApiKey,
  getUserApiKey,
  setUserApiKey,
  USER_API_KEY_CHANGED_EVENT,
} from "@/lib/user-api-key";
import type { User } from "@/types/auth";

export type AuthMethod = "session" | "apiKey";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isResumeBuilderEnabled: boolean;
  /** How the current user was authenticated. */
  authMethod: AuthMethod | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  /** Authenticate with a user API key (`dv21_…`) — no email login required. */
  connectWithApiKey: (rawKey: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  markEmailVerified: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserViaApiKey(): Promise<User | null> {
  const key = getUserApiKey();
  if (!key) return null;
  try {
    const { data } = await authApi.getMe();
    return isValidAuthUser(data) ? data : null;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      clearUserApiKey();
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isLoading = !authChecked;
  const userRef = useRef<User | null>(null);
  const authMethodRef = useRef<AuthMethod | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    authMethodRef.current = authMethod;
  }, [authMethod]);

  const applyUser = useCallback((next: User | null) => {
    setUser((previous) => {
      if (!next || !isValidAuthUser(next)) return null;
      return mergeAuthUserState(previous, next);
    });
  }, []);

  const syncSession = useCallback(async () => {
    if (authMethodRef.current === "apiKey" || (!authMethodRef.current && getUserApiKey())) {
      const apiUser = await fetchUserViaApiKey();
      if (apiUser) {
        applyUser(apiUser);
        setAuthMethod("apiKey");
        return;
      }
      if (authMethodRef.current === "apiKey") {
        setUser(null);
        setAuthMethod(null);
      }
    }

    const result = await fetchSessionUser();
    if (result.status === "authenticated") {
      applyUser(result.user);
      setAuthMethod("session");
      return;
    }
    if (result.status === "unauthenticated") {
      if (authMethodRef.current !== "apiKey") {
        setUser(null);
        setAuthMethod(null);
      }
    }
    // offline: keep existing user
  }, [applyUser]);

  const refreshUser = useCallback(async () => {
    try {
      await syncSession();
    } catch (error) {
      console.error("Failed to refresh session:", getApiErrorMessage(error));
    }
  }, [syncSession]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const result = await fetchSessionUser();
        if (cancelled) return;

        if (result.status === "authenticated") {
          applyUser(result.user);
          setAuthMethod("session");
          return;
        }

        if (result.status === "unauthenticated") {
          const apiUser = await fetchUserViaApiKey();
          if (cancelled) return;
          if (apiUser) {
            applyUser(apiUser);
            setAuthMethod("apiKey");
          } else {
            setUser(null);
            setAuthMethod(null);
          }
        }
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
    if (!authChecked) return;

    function onVisible() {
      if (document.visibilityState === "visible") {
        void syncSession();
      }
    }

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authChecked, syncSession]);

  useEffect(() => {
    if (!authChecked || !userRef.current) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void syncSession();
    }, SESSION_KEEPALIVE_MS);

    return () => window.clearInterval(timer);
  }, [authChecked, syncSession, user]);

  useEffect(() => {
    function onKeyChanged() {
      void syncSession();
    }
    window.addEventListener(USER_API_KEY_CHANGED_EVENT, onKeyChanged);
    return () => window.removeEventListener(USER_API_KEY_CHANGED_EVENT, onKeyChanged);
  }, [syncSession]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      clearUserApiKey();
      const { data } = await authApi.login(email, password, rememberMe);
      if (!isValidAuthUser(data.user)) {
        throw new Error("Login succeeded but the server returned an invalid user profile.");
      }
      applyUser(data.user);
      setAuthMethod("session");
      return data.user;
    },
    [applyUser]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      clearUserApiKey();
      const { data } = await authApi.register(name, email, password);
      if (!isValidAuthUser(data.user)) {
        throw new Error("Registration succeeded but the server returned an invalid user profile.");
      }
      applyUser(data.user);
      setAuthMethod("session");
      return data.user;
    },
    [applyUser]
  );

  const connectWithApiKey = useCallback(
    async (rawKey: string) => {
      setUserApiKey(rawKey);
      try {
        const { data } = await authApi.getMe();
        if (!isValidAuthUser(data)) {
          clearUserApiKey();
          throw new Error("API key worked but the server returned an invalid user profile.");
        }
        if (!isResumeBuilderEnabled(data)) {
          clearUserApiKey();
          throw new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403, {
            message: "Resume builder access not enabled",
          });
        }
        applyUser(data);
        setAuthMethod("apiKey");
        return data;
      } catch (err) {
        clearUserApiKey();
        if (err instanceof ApiError && err.status === 403) {
          throw new ApiError(
            err.message.includes("not enabled") ? RESUME_BUILDER_ACCESS_MESSAGE : err.message,
            403,
            err.data
          );
        }
        if (err instanceof ApiError && err.status === 401) {
          throw new ApiError("Invalid or revoked API key.", 401, err.data);
        }
        throw err;
      }
    },
    [applyUser]
  );

  const markEmailVerified = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev));
  }, []);

  const logout = useCallback(async () => {
    const userId = user?.id;
    const method = authMethodRef.current;
    try {
      if (method === "session") {
        await authApi.logout();
      }
    } finally {
      clearAuthClientStorage(userId);
      setUser(null);
      setAuthMethod(null);
    }
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: isValidAuthUser(user),
      isEmailVerified: isUserEmailVerified(user),
      isResumeBuilderEnabled: isResumeBuilderEnabled(user),
      authMethod,
      login,
      register,
      connectWithApiKey,
      logout,
      refreshUser,
      markEmailVerified,
    }),
    [
      user,
      isLoading,
      authMethod,
      login,
      register,
      connectWithApiKey,
      logout,
      refreshUser,
      markEmailVerified,
    ]
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
