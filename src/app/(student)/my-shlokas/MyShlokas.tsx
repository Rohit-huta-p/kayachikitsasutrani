"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useCompletions } from "@/lib/completions/CompletionsContext";
import TopBar from "@/components/student/TopBar";
import LottieLoader from "@/components/LottieLoader";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function mmss(s: number): string {
  if (!isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

type Filter = "all" | "top5" | "recent";

export default function MyShlokas() {
  const { items, loading, error } = useCompletions();
  const [filter, setFilter] = useState<Filter>("all");

  const best = useMemo(() => {
    if (items.length === 0) return null;
    return [...items].sort((a, b) => a.rank - b.rank)[0];
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "top5") return items.filter((i) => i.rank <= 5);
    if (filter === "recent") {
      const sevenDays = 86400 * 7 * 1000;
      return items.filter((i) => Date.now() - new Date(i.completedAt).getTime() < sevenDays);
    }
    return items;
  }, [items, filter]);

  const chip = (k: Filter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setFilter(k)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        filter === k
          ? "bg-accent text-white"
          : "bg-white border border-[#E5DDD0] text-brown"
      }`}
    >
      {label} ({count})
    </button>
  );

  const allCount = items.length;
  const top5Count = items.filter((i) => i.rank <= 5).length;
  const recentCount = items.filter(
    (i) => Date.now() - new Date(i.completedAt).getTime() < 86400 * 7 * 1000
  ).length;

  return (
    <div>
      <TopBar
        subtitle="Your library"
        title="My Shlokas"
      />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto md:max-w-2xl">
        <div className="flex gap-2 flex-wrap">
          {chip("all", "All", allCount)}
          {chip("top5", "Top 5", top5Count)}
          {chip("recent", "Recent", recentCount)}
        </div>

        {best && (
          <div className="bg-accent-soft border border-accent rounded-xl p-3 flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🏆</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500">Your best rank</div>
              <div className="text-sm font-bold text-brown truncate">#{best.rank} on {best.title}</div>
            </div>
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
          Completed shlokas
        </div>

        {loading && <LottieLoader />}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="text-center text-xs text-gray-500 italic p-4 bg-white border border-dashed border-[#E5DDD0] rounded-lg">
            📚 Complete shlokas to fill your library
          </div>
        )}

        {!loading && !error && items.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic">No shlokas match this filter.</p>
        )}

        {!loading && !error && filtered.map((row, i) => (
          <Link
            key={row.shlokaId}
            href={`/shloka/${encodeURIComponent(row.slug)}`}
            className="relative bg-[#F1F8F3] border-[1.5px] border-[#CFE6D3] rounded-2xl p-3.5 flex gap-3 items-center hover:bg-white/85 transition overflow-hidden"
          >
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 bottom-0 w-1 bg-[#5FAE69]"
            />
            <div
              className="w-9 h-9 rounded-[10px] bg-white border border-[#CFE6D3] flex items-center justify-center text-[#2E7D32] font-bold text-[13px] shrink-0"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 pr-16">
              <div className="text-[14px] font-bold text-[#2A1F12] truncate">{row.title}</div>
              <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{row.attempts} attempt{row.attempts === 1 ? "" : "s"}</span>
                <span className="w-[3px] h-[3px] bg-[#C9B89A] rounded-full" />
                <span>{mmss(row.elapsedSeconds)}</span>
                <span className="w-[3px] h-[3px] bg-[#C9B89A] rounded-full" />
                <span>{timeAgo(row.completedAt)}</span>
              </div>
            </div>
            <div className="absolute top-3 right-3.5 flex items-center gap-1">
              {row.rank > 0 && (
                <span className="bg-[#F4C95D] text-[#2A1F12] text-[10px] font-extrabold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  {row.rank === 1 && <Star size={10} className="fill-current" />}
                  #{row.rank}
                </span>
              )}
              <span className="bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-[#CFE6D3]">
                Done
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
