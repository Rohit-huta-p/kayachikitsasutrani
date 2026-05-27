import React from "react";
import { AuthGuard } from "@/lib/auth/AuthGuard";

export default function ShlokaLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
