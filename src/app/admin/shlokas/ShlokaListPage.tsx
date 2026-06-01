"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicShloka, ApiError } from "@/lib/auth/types";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";

type StatusFilter = "all" | "draft" | "published";

const StatusPill: React.FC<{ status: "draft" | "published" }> = ({ status }) => (
  <span
    className={
      status === "published"
        ? "text-xs px-2 py-0.5 rounded bg-green/20 text-green"
        : "text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700"
    }
  >
    {status}
  </span>
);

const ShlokaListPage: React.FC = () => {
  const [items, setItems] = useState<PublicShloka[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PublicShloka | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPage = async (cursor?: string, replace = true) => {
    setError(null);
    setLoading(true);
    try {
      const { items: page, nextCursor: nc } = await api.admin.shlokas.list({
        status,
        cursor,
      });
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
    void fetchPage(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = items.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
  });

  const onConfirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.admin.shlokas.remove(toDelete.id);
      setItems((prev) => prev.filter((s) => s.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:block p-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl text-brown">Shlokas</h1>
          <Link
            href="/admin/shlokas/new"
            className="inline-flex items-center gap-1 bg-green text-white px-3 py-1.5 text-sm rounded hover:opacity-90"
          >
            <Plus size={14} />
            New
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {(["all", "draft", "published"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1 rounded border ${
                status === s ? "bg-green text-white border-green" : "border-gray-300 text-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or slug"
          className="border px-2 py-1 rounded text-sm mb-3 max-w-sm w-full"
        />

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <table className="w-full text-sm bg-white/40 rounded">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Title</th>
              <th className="p-2">Slug</th>
              <th className="p-2">Status</th>
              <th className="p-2">Lines</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="p-2">{s.title}</td>
                <td className="p-2 font-mono text-xs">{s.slug}</td>
                <td className="p-2"><StatusPill status={s.status} /></td>
                <td className="p-2">{s.lines?.length ?? 0}</td>
                <td className="p-2 space-x-2">
                  <Link
                    href={`/admin/shlokas/${s.id}/edit`}
                    className="text-green underline text-xs"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setToDelete(s)}
                    className="text-red-600 underline text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && <p className="text-sm text-gray-500 mt-3">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic mt-3">No shlokas match.</p>
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
          <h1 className="text-xl font-bold text-brown">Shlokas</h1>
          <Link
            href="/admin/shlokas/new"
            className="inline-flex items-center gap-1 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-full"
          >
            <Plus size={14} />
            New
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "draft", "published"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === s
                  ? "bg-accent text-white"
                  : "bg-white border border-[#E5DDD0] text-brown"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or slug"
            className="bg-white border border-[#E5DDD0] rounded-xl pl-9 pr-3 py-2.5 text-sm text-brown outline-none focus:border-accent w-full"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic">No shlokas match.</p>
        )}

        {filtered.map((s) => (
          <Link
            key={s.id}
            href={`/admin/shlokas/${s.id}/edit`}
            className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex flex-col gap-1.5 hover:bg-white/80 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-brown truncate flex-1">{s.title}</div>
              <StatusPill status={s.status} />
            </div>
            <div className="text-[10px] font-mono text-gray-500 truncate">{s.slug}</div>
            <div className="text-[10px] text-gray-500">{s.lines?.length ?? 0} lines</div>
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

      {/* Shared modal */}
      {toDelete && (
        <ConfirmDeleteModal
          title="Delete shloka"
          message={`Permanently delete "${toDelete.title}"? Associated audio + image will be removed from Cloudinary.`}
          onConfirm={onConfirmDelete}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}
    </>
  );
};

export default ShlokaListPage;
