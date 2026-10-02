"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, clearToken, getMe, getToken, login as apiLogin, register as apiRegister, setToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  loading: boolean; // true until we know whether a stored token is valid
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>; // re-fetch usage after an upload
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await getMe());
    } catch {
      // A 401 already cleared the token via the "auth:logout" event.
      // Network errors keep the current state.
    }
  }, []);

  // On first load, turn a stored token back into a user (or drop it).
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const restored = getToken() ? await getMe().catch(() => null) : null;
      if (cancelled) return;
      setUser(restored);
      setLoading(false);
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any API call that gets a 401 (expired/invalid token) logs us out.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await apiRegister(email, password);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
