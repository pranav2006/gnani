"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, clearToken, getMe, getToken, login as apiLogin, register as apiRegister, setToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
      // keep current state
    }
  }, []);

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
