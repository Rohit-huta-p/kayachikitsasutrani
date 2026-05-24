"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "anon") {
      router.replace("/login");
    } else if (state.status === "authed" && state.user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [state, router]);

  if (state.status === "loading" || state.status === "anon") {
    return <div className="p-10 text-center text-brown">Loading…</div>;
  }
  if (state.status === "authed" && state.user.role !== "admin") {
    return <div className="p-10 text-center text-brown">Redirecting…</div>;
  }

  return <>{children}</>;
}
