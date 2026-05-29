"use client";

import React from "react";
import TabBar from "@/components/student/TabBar";
import { CompletionsProvider } from "@/lib/completions/CompletionsContext";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompletionsProvider>
      <div className="min-h-screen bg-cream flex flex-col">
        <div className="flex-1 pb-safe-tab md:pb-0">
          {children}
        </div>
        <TabBar />
      </div>
    </CompletionsProvider>
  );
}
