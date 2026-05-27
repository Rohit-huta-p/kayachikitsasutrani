"use client";

import React from "react";
import TabBar from "@/components/student/TabBar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="flex-1 pb-safe-tab">
        {children}
      </div>
      <TabBar />
    </div>
  );
}
