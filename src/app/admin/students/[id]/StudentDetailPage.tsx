"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicUser, ApiError } from "@/lib/auth/types";
import AvatarCircle from "@/components/student/AvatarCircle";
import LottieLoader from "@/components/LottieLoader";

const Row: React.FC<{ k: string; v?: string | number }> = ({ k, v }) => (
  <div className="flex border-b py-2 text-sm">
    <div className="w-40 text-gray-600">{k}</div>
    <div>{v ?? "—"}</div>
  </div>
);

const MobileRow: React.FC<{ label: string; value?: string; last?: boolean }> = ({ label, value, last }) => (
  <div
    className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
  >
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value ?? "—"}</span>
  </div>
);

const StudentDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.admin.students.get(id)
      .then(({ user }) => { if (!cancelled) setUser(user); })
      .catch((e: ApiError) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="p-10 text-red-600">{error}</div>;
  if (!user) return <div className="p-10"><LottieLoader /></div>;

  return (
    <>
      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:block p-10 max-w-2xl">
        <div className="mb-4">
          <Link href="/admin/students" className="text-sm text-green underline">← Back to students</Link>
        </div>
        <h1 className="text-2xl text-brown mb-4">{user.name}</h1>
        <div className="bg-white/40 rounded p-4">
          <Row k="Email" v={user.email} />
          <Row k="Role" v={user.role} />
          <Row k="Age" v={user.age} />
          <Row k="Gender" v={user.gender} />
          <Row k="College Name" v={user.collegeName} />
          <Row k="Course" v={user.course} />
          <Row k="Joined" v={new Date(user.createdAt).toLocaleString()} />
        </div>
      </div>

      {/* ── Mobile ──────────────────────────────────────────────────── */}
      <div className="md:hidden px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
        <Link href="/admin/students" className="text-sm text-accent font-semibold inline-flex items-center">
          <ArrowLeft size={14} className="inline mr-1" />
          Back to students
        </Link>

        {/* Profile card */}
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
          <div className="flex justify-center">
            <AvatarCircle name={user.name} email={user.email} size={72} />
          </div>
          <div className="text-base font-bold text-brown mt-3">{user.name}</div>
          <div className="text-xs text-gray-500 mt-1">{user.email}</div>
          <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-accent-soft text-accent border border-accent rounded-full px-2 py-0.5">
            {user.role}
          </span>
        </div>

        {/* Info card */}
        <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
          <MobileRow label="Age" value={user.age?.toString()} />
          <MobileRow label="Gender" value={user.gender} />
          <MobileRow label="College" value={user.collegeName} />
          <MobileRow label="Course" value={user.course} />
          <MobileRow label="Joined" value={new Date(user.createdAt).toLocaleDateString()} last />
        </div>
      </div>
    </>
  );
};

export default StudentDetailPage;
