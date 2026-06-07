"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen } from "lucide-react";

interface Tab {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  matchPrefix?: string;
}

const tabs: Tab[] = [
  { href: "/home", icon: Home, label: "Home", matchPrefix: "/home" },
  { href: "/my-shlokas", icon: BookOpen, label: "My", matchPrefix: "/my-shlokas" },
];

const TabBar: React.FC = () => {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5DDD0] flex justify-around pb-safe z-40">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.matchPrefix ? pathname.startsWith(t.matchPrefix) : false);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`touch-target flex flex-col items-center gap-0.5 px-3 py-2 text-xs ${
              active ? "text-accent font-bold" : "text-gray-500"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <t.icon size={20} aria-hidden="true" />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default TabBar;
