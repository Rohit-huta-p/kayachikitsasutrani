"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
    <div className="p-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl text-brown">Shlokas</h1>
        <Link
          href="/admin/shlokas/new"
          className="bg-green text-white px-3 py-1 rounded text-sm"
        >
          + Add Shloka
        </Link>
      </div>

      <div className="flex gap-4 items-center mb-4">
        <div className="flex gap-1">
          {(["all", "draft", "published"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={
                status === s
                  ? "px-3 py-1 text-sm rounded bg-brown text-white"
                  : "px-3 py-1 text-sm rounded bg-white/40"
              }
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
          className="border px-2 py-1 rounded text-sm flex-1 max-w-sm"
        />
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <table className="w-full text-sm bg-white/40 rounded">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Title</th>
            <th className="p-2">Slug</th>
            <th className="p-2">Status</th>
            <th className="p-2">Created</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b hover:bg-white/60">
              <td className="p-2">{s.title}</td>
              <td className="p-2 font-mono text-xs">{s.slug}</td>
              <td className="p-2"><StatusPill status={s.status} /></td>
              <td className="p-2 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
              <td className="p-2 space-x-2">
                <Link href={`/admin/shlokas/${s.id}/edit`} className="text-green underline text-xs">Edit</Link>
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
          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">No shlokas.</td>
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

      {toDelete && (
        <ConfirmDeleteModal
          title="Delete shloka"
          message={`Permanently delete "${toDelete.title}"? Associated audio + image will be removed from Cloudinary.`}
          onConfirm={onConfirmDelete}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}
    </div>
  );
};

export default ShlokaListPage;
