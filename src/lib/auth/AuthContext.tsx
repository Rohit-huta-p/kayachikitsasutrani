"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";
import type { PublicUser, SignupBody, LoginBody, ApiError } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; user: PublicUser };

interface AuthApi {
  state: AuthState;
  login: (body: LoginBody) => Promise<void>;
  signup: (body: SignupBody) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setState({ status: "authed", user });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) {
        setState({ status: "anon" });
      } else {
        // network or unknown — treat as anon for now, log
        // eslint-disable-next-line no-console
        console.error("auth.me failed", err);
        setState({ status: "anon" });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (body: LoginBody) => {
    const { user } = await api.login(body);
    setState({ status: "authed", user });
  }, []);

  const signup = useCallback(async (body: SignupBody) => {
    const { user } = await api.signup(body);
    setState({ status: "authed", user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ status: "anon" });
    }
  }, []);

  return <Ctx.Provider value={{ state, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
