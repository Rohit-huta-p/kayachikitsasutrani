"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCompletions } from "@/lib/completions/CompletionsContext";
import { Settings, Pencil, LogOut } from "lucide-react";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
import LottieLoader from "@/components/LottieLoader";

export default function Me() {
  const router = useRouter();
  const { state: authState, logout } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const { items: completions, loading, error } = useCompletions();

  const stats = useMemo(() => {
    const totalAttempts = completions.reduce((sum, c) => sum + c.attempts, 0);
    const bestRank = completions.length === 0
      ? null
      : completions.reduce((m, c) => (m === null || c.rank < m ? c.rank : m), null as number | null);
    return {
      completed: completions.length,
      attempts: totalAttempts,
      bestRank: bestRank === null ? "—" : `#${bestRank}`,
    };
  }, [completions]);

  const joinedDate = me
    ? new Date((me as { createdAt?: string }).createdAt || Date.now()).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "—";

  if (!me) {
    return <p className="p-6 text-sm text-gray-500">Not signed in.</p>;
  }

  return (
    <div>
      <TopBar
        subtitle="Your profile"
        title="Me"
        trailing={<Settings size={20} aria-hidden="true" />}
      />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto md:max-w-2xl">
        {/* Avatar block */}
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
          <div className="flex justify-center">
            <AvatarCircle name={me.name} email={me.email} size={72} />
          </div>
          <div className="text-base font-bold text-brown mt-3">{me.name}</div>
          <div className="text-xs text-gray-500 mt-1">{me.email}</div>
        </div>

        {/* Info card */}
        <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
          <Row label="College" value={(me as { collegeName?: string }).collegeName ?? "—"} />
          <Row label="Course" value={(me as { course?: string }).course ?? "—"} />
          <Row label="Joined" value={joinedDate} last />
        </div>

        {/* Stats card */}
        <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Your stats</div>
          {loading && <LottieLoader size={48} />}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && (
            <div className="flex justify-around text-center">
              <div>
                <div className="text-lg font-bold text-brown">{stats.completed}</div>
                <div className="text-[10px] text-gray-500">Completed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-brown">{stats.attempts}</div>
                <div className="text-[10px] text-gray-500">Attempts</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">{stats.bestRank}</div>
                <div className="text-[10px] text-gray-500">Best rank</div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled
          className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm font-semibold text-brown text-left opacity-60 cursor-not-allowed"
        >
          <Pencil size={14} className="inline mr-1" />
          Edit profile <span className="text-xs text-gray-400 ml-2">(coming soon)</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="bg-white border border-red-300 text-red-600 rounded-xl px-3 py-3 text-sm font-semibold text-left hover:bg-red-50 transition"
        >
          <LogOut size={14} className="inline mr-1" />
          Log out
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value}</span>
    </div>
  );
}
