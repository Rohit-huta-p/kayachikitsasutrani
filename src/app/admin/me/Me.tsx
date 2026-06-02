"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Pencil, LogOut } from "lucide-react";
import AvatarCircle from "@/components/student/AvatarCircle";
import LottieLoader from "@/components/LottieLoader";
import type { ApiError } from "@/lib/auth/types";

export default function Me() {
  const router = useRouter();
  const { state: authState, logout } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;

  const [published, setPublished] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [students, setStudents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.admin.shlokas.list({ status: "published", limit: 50 }),
      api.admin.shlokas.list({ status: "draft", limit: 50 }),
      api.admin.students.list({ limit: 50 }),
    ])
      .then(([pub, drf, stu]) => {
        if (cancelled) return;
        setPublished(pub.items.length);
        setDrafts(drf.items.length);
        setStudents(stu.items.length);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Failed to load stats");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!me) {
    return <p className="p-6 text-sm text-gray-500">Not signed in.</p>;
  }

  const joined = new Date((me as { createdAt?: string }).createdAt || Date.now()).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  );

  return (
    <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto md:max-w-2xl">
      <h1 className="text-xl font-bold text-brown">Me</h1>

      {/* Avatar block */}
      <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
        <div className="flex justify-center">
          <AvatarCircle name={me.name} email={me.email} size={72} />
        </div>
        <div className="text-base font-bold text-brown mt-3">{me.name}</div>
        <div className="text-xs text-gray-500 mt-1">{me.email}</div>
        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-accent-soft text-accent border border-accent rounded-full px-2 py-0.5">
          {me.role}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
        <Row label="Email" value={me.email} />
        <Row label="Joined" value={joined} last />
      </div>

      {/* Stats card */}
      <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Catalog</div>
        {loading && <LottieLoader size={48} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && (
          <div className="flex justify-around text-center">
            <Stat label="Published" value={published} />
            <Stat label="Drafts" value={drafts} />
            <Stat label="Students" value={students} />
          </div>
        )}
      </div>

      {/* Action buttons */}
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
  );
}

function Row({ label, value, last = false }: { label: string; value?: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value ?? "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-lg font-bold text-brown">{value ?? "—"}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
