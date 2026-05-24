"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "anon") {
      router.replace("/login");
    }
  }, [state.status, router]);

  if (state.status === "loading" || state.status === "anon") {
    return <div className="p-10 text-center text-brown">Loading…</div>;
  }

  return <>{children}</>;
}
