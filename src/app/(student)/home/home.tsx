"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCompletions } from "@/lib/completions/CompletionsContext";
import ShlokaList from "./components/ShlokaList";
import LottieLoader from "@/components/LottieLoader";
import type { PublicShloka, ApiError, MyCompletionRow } from "@/lib/auth/types";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function mmss(s: number): string {
  if (!isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function prettifySlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function Home() {
  const { state: authState } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const {
    items: completions,
    loading: completionsLoading,
    error: completionsError,
  } = useCompletions();
  const [shlokas, setShlokas] = useState<PublicShloka[]>([]);
  const [shlokasLoading, setShlokasLoading] = useState(true);
  const [shlokasError, setShlokasError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.shlokas
      .list()
      .then((listRes) => {
        if (!cancelled) setShlokas(listRes.items);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setShlokasError(err.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setShlokasLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loading = shlokasLoading || completionsLoading;
  const error = shlokasError || completionsError;

  const completionsBySlug = useMemo(
    () => new Map(completions.map((c) => [c.slug, c])),
    [completions]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return shlokas;
    const q = query.trim().toLowerCase();
    return shlokas.filter((s) =>
      s.title?.toLowerCase().includes(q) ||
      (s.lines?.[0]?.sanskrit ?? "").toLowerCase().includes(q)
    );
  }, [shlokas, query]);

  const firstName = me?.name?.split(/\s+/)[0] || "";
  const completedCount = completions.length;
  const total = shlokas.length;
  const progressPct = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const totalAttempts = completions.reduce((sum, c) => sum + c.attempts, 0);

  return (
    <>
      {/* Mobile (<md) — Design C: Modern + Bold */}
      <div className="md:hidden bg-cream min-h-screen">
        {/* Dark hero with progress card */}
        <div className="bg-[#2A1F12] text-white px-5 pt-6 pb-8 rounded-b-[28px]">
          <div className="text-[11px] tracking-[1.2px] opacity-60">{greetingFor()}</div>
          <h1 className="text-[24px] font-extrabold mt-1 leading-tight tracking-[-0.5px]">
            {firstName || "Chikitsa Sutra"}
          </h1>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[28px] font-bold text-[#F4C95D]">{completedCount}</span>
                <span className="text-[12px] text-white/50 ml-0.5">/{total}</span>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-bold text-[#F4C95D] leading-none">{totalAttempts}</div>
                <div className="text-[12px] text-white/50 mt-0.5">attempts</div>
              </div>
            </div>
            <div className="text-[10px] tracking-[1px] uppercase opacity-70 mt-0.5">
              Shlokas completed · {progressPct}%
            </div>
            <div className="bg-white/10 rounded h-1.5 mt-2.5 overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg,#F4C95D,#D4A574)",
                }}
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="px-4 pt-4 pb-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[#2A1F12] tracking-[-0.3px]">Sutras</h2>
            <span className="text-[11px] text-gray-500 font-semibold">{total} total</span>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shlokas…"
            className="w-full bg-white border border-[#F0E7D8] rounded-xl px-3 py-2.5 text-sm text-brown outline-none focus:border-accent mb-3"
          />

          {loading && <LottieLoader />}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm text-gray-500 italic mt-2">No shlokas match your search.</p>
          )}

          {!loading && !error && (
            <div className="flex flex-col gap-2">
              {filtered.map((sh, i) => (
                <MobileShlokaCard
                  key={sh.slug}
                  shloka={sh}
                  index={i + 1}
                  completion={completionsBySlug.get(sh.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop (md+) — unchanged */}
      <div className="hidden md:flex md:flex-col md:items-center md:space-y-5 md:px-8 md:py-10">
        <h1 className="text-brown text-3xl font-bold">Learn Ancient Sanskrit Shlokas</h1>
        <p className="text-center w-[60%] text-sm text-gray-700">
          Discover the wisdom of ancient Sanskrit verses through an immersive
          learning experience designed to help you memorize and understand sacred
          shlokas.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for Shlokas"
          className="w-full max-w-md rounded bg-white border border-[#E5DDD0] px-3 py-2 text-sm text-brown outline-none focus:border-accent"
        />
        {loading && <LottieLoader />}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && <ShlokaList shlokas={filtered} />}
      </div>
    </>
  );
}

interface MobileShlokaCardProps {
  shloka: PublicShloka;
  index: number;
  completion?: MyCompletionRow;
}

function MobileShlokaCard({ shloka, index, completion }: MobileShlokaCardProps) {
  const done = !!completion;
  // Count visual lines as \n-separated paragraphs in fullText (what users see).
  // Falls back to bucket count when fullText is empty (older shlokas).
  const lineCount = shloka.fullText
    ? shloka.fullText.split(/\r?\n/).filter((p) => p.trim().length > 0).length
    : shloka.lines?.length ?? 0;
  return (
    <Link
      href={`/shloka/${encodeURIComponent(shloka.slug)}`}
      className={`relative border-[1.5px] rounded-2xl p-3.5 flex items-center gap-3 transition hover:bg-white/85 overflow-hidden ${
        done
          ? "bg-[#F1F8F3] border-[#CFE6D3]"
          : "bg-white border-[#F0E7D8]"
      }`}
    >
      {done && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1 bg-[#5FAE69]"
        />
      )}
      <div
        className={`w-9 h-9 rounded-[10px] flex items-center justify-center font-bold text-[13px] shrink-0 ${
          done
            ? "bg-white text-[#2E7D32] border border-[#CFE6D3]"
            : "bg-[#FAF6EE] text-[#8B6F4F]"
        }`}
        style={{ fontFamily: "Georgia, serif" }}
      >
        {index}
      </div>
      <div className="flex-1 min-w-0 pr-8">
        <div className="text-[14px] font-bold text-[#2A1F12] truncate">
          {prettifySlug(shloka.slug)}
        </div>
        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
          {done && completion ? (
            <>
              <span>{timeAgo(completion.completedAt)}</span>
              <span className="w-[3px] h-[3px] bg-[#C9B89A] rounded-full" />
              <span>{completion.attempts} attempt{completion.attempts === 1 ? "" : "s"}</span>
              <span className="w-[3px] h-[3px] bg-[#C9B89A] rounded-full" />
              <span>{mmss(completion.elapsedSeconds)}</span>
            </>
          ) : (
            <>
              <span>{lineCount} line{lineCount === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>
      {done && (
        <div className="absolute top-3 right-3.5 flex items-center gap-1">
          {completion && completion.rank > 0 && (
            <span className="bg-[#F4C95D] text-[#2A1F12] text-[10px] font-extrabold px-1.5 py-0.5 rounded-md">
              #{completion.rank}
            </span>
          )}
          <span className="bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-[#CFE6D3]">
            Done
          </span>
        </div>
      )}
    </Link>
  );
}
