import React from "react";
import { AdminGuard } from "@/lib/auth/AdminGuard";
import AdminTabBar from "@/components/admin/AdminTabBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen pb-safe-tab md:pb-0">
        {children}
        <AdminTabBar />
      </div>
    </AdminGuard>
  );
}
