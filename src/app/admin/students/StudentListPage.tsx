"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PublicUser, ApiError } from "@/lib/auth/types";

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
    <div className="p-10">
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
            <tr key={u.id} className="border-b hover:bg-white/60">
              <td className="p-2">
                <Link href={`/admin/students/${u.id}`} className="text-green underline">{u.name}</Link>
              </td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-gray-500">No students.</td>
            </tr>
          )}
        </tbody>
      </table>

      {loading && <p className="text-sm mt-3">Loading…</p>}

      {nextCursor && !loading && (
        <button
          type="button"
          onClick={() => void fetchPage(nextCursor, false)}
          className="mt-3 px-3 py-1 text-sm border rounded"
        >
          Load more
        </button>
      )}
    </div>
  );
};

export default StudentListPage;
