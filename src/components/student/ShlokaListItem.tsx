"use client";

import React from "react";
import Link from "next/link";

interface Props {
  slug: string;
  title: string;
  sanskritFirstLine?: string;
  done?: boolean;
  rank?: number;
  completedAt?: string;
  lineCount?: number;
  totalCompletions?: number;
  index?: number;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ShlokaListItem: React.FC<Props> = ({
  slug, title, sanskritFirstLine, done = false, rank, completedAt, lineCount, totalCompletions, index,
}) => {
  return (
    <Link
      href={`/shloka/${encodeURIComponent(slug)}`}
      className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex gap-3 items-center hover:bg-white/80 transition"
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{
          background: done
            ? "linear-gradient(135deg,#7BA77B,#A5D6A7)"
            : "linear-gradient(135deg,#8B6F4F,#C9A878)",
        }}
        aria-hidden="true"
      >
        {done ? "✓" : (index !== undefined ? String(index) : "•")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-brown truncate">
          {sanskritFirstLine || title}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {done
            ? `Completed · ${completedAt ? timeAgo(completedAt) : ""}${rank ? ` · #${rank}${rank === 1 ? " 🏆" : ""}` : ""}`
            : `${lineCount ?? 0} lines${totalCompletions !== undefined ? ` · ${totalCompletions} completed` : ""}`}
        </div>
      </div>
      <span className="text-gray-400" aria-hidden="true">›</span>
    </Link>
  );
};

export default ShlokaListItem;
