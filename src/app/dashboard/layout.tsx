import React from "react";
import { AuthGuard } from "@/lib/auth/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
