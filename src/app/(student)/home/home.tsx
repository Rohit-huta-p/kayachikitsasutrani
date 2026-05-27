"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
import ShlokaListItem from "@/components/student/ShlokaListItem";
import StatsBanner from "@/components/student/StatsBanner";
import type { PublicShloka, MyCompletionRow, ApiError } from "@/lib/auth/types";

export default function Home() {
  const { state: authState } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const [shlokas, setShlokas] = useState<PublicShloka[]>([]);
  const [completions, setCompletions] = useState<MyCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.shlokas.list(), api.me.completions()])
      .then(([listRes, meRes]) => {
        if (cancelled) return;
        setShlokas(listRes.items);
        setCompletions(meRes.items);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  return (
    <div>
      <TopBar
        subtitle="Welcome back"
        title={firstName || "Shloka Sutra"}
        trailing={
          me ? <AvatarCircle name={me.name} email={me.email} size={34} /> : null
        }
      />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
        <StatsBanner
          stats={[
            { value: completedCount, label: "Completed" },
            { value: total, label: "Available" },
            { value: `${progressPct}%`, label: "Progress" },
          ]}
        />

        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-2">
          All Shlokas
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search shlokas…"
          className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-2.5 text-sm text-brown outline-none focus:border-accent"
        />

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic mt-2">No shlokas match your search.</p>
        )}

        {!loading && !error && filtered.map((sh, i) => {
          const c = completionsBySlug.get(sh.slug);
          return (
            <ShlokaListItem
              key={sh.slug}
              slug={sh.slug}
              title={sh.title}
              sanskritFirstLine={sh.lines?.[0]?.sanskrit}
              done={!!c}
              rank={c?.rank}
              completedAt={c?.completedAt}
              lineCount={sh.lines?.length}
              index={i + 1}
            />
          );
        })}
      </div>
    </div>
  );
}
