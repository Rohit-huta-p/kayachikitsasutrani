"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicUser, ApiError } from "@/lib/auth/types";
import AvatarCircle from "@/components/student/AvatarCircle";
import LottieLoader from "@/components/LottieLoader";

const StudentListPage: React.FC = () => {
  const [items, setItems] = useState<PublicUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = async (cursor?: string, replace = true) => {
    setLoading(true);
    setError(null);
    try {
      const { items: page, nextCursor: nc } = await api.admin.students.list({ cursor });
      setItems((prev) => (replace ? page : [...prev, ...page]));
      setNextCursor(nc);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });

  return (
    <>
      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:block p-10">
        <h1 className="text-2xl text-brown mb-4">Students</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="border px-2 py-1 rounded text-sm mb-3 max-w-sm w-full"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <table className="w-full text-sm bg-white/40 rounded">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-b-0">
                <td className="p-2">
                  <Link href={`/admin/students/${u.id}`} className="text-green underline">
                    {u.name}
                  </Link>
                </td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && <LottieLoader />}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic mt-3">No students match.</p>
        )}
        {nextCursor && (
          <button
            type="button"
            onClick={() => void fetchPage(nextCursor, false)}
            className="mt-3 text-xs text-green underline"
          >
            Load more
          </button>
        )}
      </div>

      {/* ── Mobile ──────────────────────────────────────────────────── */}
      <div className="md:hidden px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-brown">Students</h1>
          <span className="text-xs text-gray-500">{filtered.length}</span>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="bg-white border border-[#E5DDD0] rounded-xl pl-9 pr-3 py-2.5 text-sm text-brown outline-none focus:border-accent w-full"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <LottieLoader />}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic">No students match.</p>
        )}

        {filtered.map((u) => (
          <Link
            key={u.id}
            href={`/admin/students/${u.id}`}
            className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex gap-3 items-center hover:bg-white/80 transition"
          >
            <AvatarCircle name={u.name} email={u.email} size={40} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brown truncate">{u.name}</div>
              <div className="text-xs text-gray-500 truncate">{u.email}</div>
            </div>
            <ChevronRight size={16} className="text-gray-400" aria-hidden="true" />
          </Link>
        ))}

        {nextCursor && (
          <button
            type="button"
            onClick={() => void fetchPage(nextCursor, false)}
            className="text-center text-xs text-accent font-semibold py-2"
          >
            Load more
          </button>
        )}
      </div>
    </>
  );
};

export default StudentListPage;
