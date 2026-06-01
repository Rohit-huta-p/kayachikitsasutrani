"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  trailing?: React.ReactNode;
}

const TopBar: React.FC<Props> = ({ title, subtitle, showBack = false, trailing }) => {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-brown text-white flex items-center px-4 py-3 gap-3">
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          className="touch-target -ml-2"
          aria-label="Go back"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {subtitle && <div className="text-xs opacity-80 truncate">{subtitle}</div>}
        <div className="font-bold text-base truncate">{title}</div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  );
};

export default TopBar;
