"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PublicUser, ApiError } from "@/lib/auth/types";

const Row: React.FC<{ k: string; v?: string | number }> = ({ k, v }) => (
  <div className="flex border-b py-2 text-sm">
    <div className="w-40 text-gray-600">{k}</div>
    <div>{v ?? "—"}</div>
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
  if (!user) return <div className="p-10">Loading…</div>;

  return (
    <div className="p-10 max-w-2xl">
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
  );
};

export default StudentDetailPage;
