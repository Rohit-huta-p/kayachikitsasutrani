"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Star, ChevronRight, Check } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCompletions } from "@/lib/completions/CompletionsContext";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
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
  const { state: authState } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
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
        trailing={me ? <AvatarCircle name={me.name} email={me.email} size={34} /> : null}
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

        {!loading && !error && filtered.map((row) => (
          <Link
            key={row.shlokaId}
            href={`/shloka/${encodeURIComponent(row.slug)}`}
            className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex gap-3 items-center hover:bg-white/80 transition"
          >
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "linear-gradient(135deg,#7BA77B,#A5D6A7)" }}
              aria-hidden="true"
            >
              <Check size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brown truncate">{row.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                #{row.rank} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"} · {mmss(row.elapsedSeconds)} · {timeAgo(row.completedAt)}
              </div>
            </div>
            {row.rank === 1 ? (
              <Star size={14} className="text-accent fill-accent" aria-hidden="true" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" aria-hidden="true" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
