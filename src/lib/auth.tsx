import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { Me, Role } from "./types";

interface AuthValue {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setTokenState] = useState(getToken());
  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: () => api<Me>("/auth/me"),
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ access_token: string; user: Me }>("/auth/login", {
        method: "POST",
        json: { email, password },
      });
      setToken(res.access_token);
      qc.setQueryData(["me", res.access_token], res.user);
      setTokenState(res.access_token);
    },
    [qc],
  );

  const me = token ? (meQuery.data ?? null) : null;
  const value = useMemo<AuthValue>(
    () => ({
      me,
      loading: !!token && meQuery.isLoading,
      login,
      logout,
      can: (...roles) => !!me && roles.includes(me.role),
    }),
    [me, meQuery.isLoading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

export const STAFF: Role[] = ["superadmin", "admin", "coordinador", "analista"];
export const ML_MANAGERS: Role[] = ["ml_engineer", "admin", "superadmin"];
