"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import type { MyCompletionRow, ApiError } from "@/lib/auth/types";

interface CompletionsApi {
  items: MyCompletionRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CompletionsApi | null>(null);

export function CompletionsProvider({ children }: { children: React.ReactNode }) {
  const { state: authState } = useAuth();
  const [items, setItems] = useState<MyCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Only fetch when authed — anon users have no completions to fetch.
    if (authState.status !== "authed") {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.me.completions();
      setItems(res.items);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || "Failed to load completions");
    } finally {
      setLoading(false);
    }
  }, [authState.status]);

  // Fetch once when auth flips to authed (or on mount if already authed).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ items, loading, error, refresh }}>{children}</Ctx.Provider>;
}

export function useCompletions(): CompletionsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompletions must be inside <CompletionsProvider>");
  return ctx;
}
