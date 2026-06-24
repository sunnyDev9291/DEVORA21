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

import { authApi, getApiErrorMessage, isValidAuthUser } from "@/lib/auth-api";

import { fetchSessionUser, SESSION_KEEPALIVE_MS } from "@/lib/auth-session";

import { clearAuthClientStorage } from "@/lib/auth-storage";

import { isUserEmailVerified, mergeEmailVerifiedState } from "@/lib/email-verification";

import { isResumeBuilderEnabled } from "@/lib/resume-access";

import type { User } from "@/types/auth";



interface AuthContextValue {

  user: User | null;

  isLoading: boolean;

  isAuthenticated: boolean;

  isEmailVerified: boolean;

  isResumeBuilderEnabled: boolean;

  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;

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

  const userRef = useRef<User | null>(null);



  useEffect(() => {

    userRef.current = user;

  }, [user]);



  const applyUser = useCallback((next: User | null) => {

    setUser((previous) => {

      if (!next || !isValidAuthUser(next)) return null;

      return mergeEmailVerifiedState(previous, next);

    });

  }, []);



  const syncSession = useCallback(async () => {

    const result = await fetchSessionUser();

    if (result.status === "authenticated") {

      applyUser(result.user);

      return;

    }

    if (result.status === "unauthenticated") {

      setUser(null);

    }

    // offline: keep existing user — do not force sign-out on transient errors

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

        } else if (result.status === "unauthenticated") {

          setUser(null);

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



  const login = useCallback(async (email: string, password: string, rememberMe = true) => {

    const { data } = await authApi.login(email, password, rememberMe);

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

    const userId = user?.id;

    try {

      await authApi.logout();

    } finally {

      clearAuthClientStorage(userId);

      setUser(null);

    }

  }, [user?.id]);



  const value = useMemo(

    () => ({

      user,

      isLoading,

      isAuthenticated: isValidAuthUser(user),

      isEmailVerified: isUserEmailVerified(user),

      isResumeBuilderEnabled: isResumeBuilderEnabled(user),

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


