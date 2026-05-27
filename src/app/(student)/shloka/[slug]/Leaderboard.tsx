"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LeaderboardRow, ApiError } from "@/lib/auth/types";

interface Props {
  slug: string;
  /** Current viewer's user id, to highlight their own row. */
  currentUserId?: string;
  /** Bump this number to force a refetch. */
  refreshKey?: number;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function formatMmSs(s: number): string {
  if (!isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

const Leaderboard: React.FC<Props> = ({ slug, currentUserId, refreshKey }) => {
  const [items, setItems] = useState<LeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.shlokas.leaderboard(slug)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Could not load leaderboard");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, refreshKey]);

  return (
    <div className="bg-white/60 rounded-lg p-3 md:p-4 mt-4 md:mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-brown flex items-center gap-2">
          <span aria-hidden="true">🏆</span>
          Leaderboard
          <span className="text-xs font-normal text-gray-500">({total} completed)</span>
        </h3>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <div className="text-sm">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      {!loading && !error && total === 0 && (
        <p className="text-sm text-gray-500 italic">Be the first to complete this shloka!</p>
      )}
      {!loading && !error && total > 0 && (
        <ol className="space-y-1">
          {items.map((row, idx) => {
            const isMe = row.userId === currentUserId;
            const rank = idx + 1;
            return (
              <li
                key={row.userId}
                className={
                  isMe
                    ? "flex items-center gap-3 p-1.5 md:p-2 rounded-lg bg-amber-50 border border-amber-200"
                    : "flex items-center gap-3 p-1.5 md:p-2 rounded-lg hover:bg-white/80 transition"
                }
              >
                <span className="text-xs text-gray-500 w-8 shrink-0 font-mono">#{rank}</span>
                <span
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                  style={{ background: row.avatarColor }}
                  aria-hidden="true"
                >
                  {row.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {row.name}
                    {isMe && <span className="ml-2 text-xs text-amber-700">you</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {timeAgo(row.completedAt)} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"} · {formatMmSs(row.elapsedSeconds)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default Leaderboard;
