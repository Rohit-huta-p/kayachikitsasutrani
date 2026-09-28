"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookText,
  Headphones,
  ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { PublicShloka, ApiError } from "@/lib/auth/types";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import { formatRelative } from "@/components/admin/analytics/format";

type StatusFilter = "all" | "published" | "draft";
type SortKey = "updated" | "created" | "title" | "lines";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

const DEFAULT_SORT: Sort = { key: "updated", dir: "desc" };
const VIEW_KEY = "cs.admin.shlokas.view";
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]";
const GHOST_BUTTON = `inline-flex items-center gap-1.5 rounded-full border border-[#E5DDD0] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5A2B] transition hover:bg-[#FDF5E6] active:scale-[0.97] ${FOCUS_RING}`;

const lineCount = (s: PublicShloka) =>
  s.fullText ? s.fullText.split(/\r?\n/).filter((p) => p.trim().length > 0).length : s.lines?.length ?? 0;
const imageCount = (s: PublicShloka) => (s.images?.length ? s.images.length : s.image ? 1 : 0);
const thumbOf = (s: PublicShloka) => s.images?.[0]?.url ?? s.image?.url ?? null;
const updatedMs = (s: PublicShloka) => Date.parse(s.updatedAt || s.createdAt || "") || 0;
const createdMs = (s: PublicShloka) => Date.parse(s.createdAt || "") || 0;

const COMPARE: Record<SortKey, (a: PublicShloka, b: PublicShloka) => number> = {
  updated: (a, b) => updatedMs(a) - updatedMs(b),
  created: (a, b) => createdMs(a) - createdMs(b),
  title: (a, b) => a.title.localeCompare(b.title),
  lines: (a, b) => lineCount(a) - lineCount(b),
};
const FIRST_DIR: Record<SortKey, Sort["dir"]> = { updated: "desc", created: "desc", title: "asc", lines: "desc" };
const SORT_OPTIONS: { label: string; sort: Sort }[] = [
  { label: "Recently updated", sort: { key: "updated", dir: "desc" } },
  { label: "Recently created", sort: { key: "created", dir: "desc" } },
  { label: "Title (A–Z)", sort: { key: "title", dir: "asc" } },
  { label: "Most lines", sort: { key: "lines", dir: "desc" } },
];
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
];

interface View {
  search: string;
  status: StatusFilter;
  sort: Sort;
}
const DEFAULT_VIEW: View = { search: "", status: "all", sort: DEFAULT_SORT };

function readView(): Partial<View> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
    const view: Partial<View> = {};
    if (typeof saved?.search === "string") view.search = saved.search;
    if (FILTERS.some((f) => f.key === saved?.status)) view.status = saved.status;
    if (saved?.sort?.key in COMPARE && (saved.sort.dir === "asc" || saved.sort.dir === "desc")) {
      view.sort = { key: saved.sort.key, dir: saved.sort.dir };
    }
    return view;
  } catch {
    return {};
  }
}

function writeView(view: View): void {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    // Storage unavailable — the view just resets next time.
  }
}

/** Fetch the whole catalog (paginating), so search, filters and counts are exact. */
async function fetchAllShlokas(): Promise<PublicShloka[]> {
  const all: PublicShloka[] = [];
  let cursor: string | undefined;
  // Safety bound: 20 pages × 50 = 1,000 shlokas, well past any real catalog.
  for (let page = 0; page < 20; page++) {
    const { items, nextCursor } = await api.admin.shlokas.list({ status: "all", limit: 50, cursor });
    all.push(...items);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return all;
}

// ── Pieces ────────────────────────────────────────────────────────────────

/** Inline switch that flips a shloka between published and draft. */
function StatusToggle({
  shloka,
  busy,
  onToggle,
}: {
  shloka: PublicShloka;
  busy: boolean;
  onToggle: (s: PublicShloka) => void;
}) {
  const published = shloka.status === "published";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={published}
      disabled={busy}
      onClick={() => onToggle(shloka)}
      aria-label={`${shloka.title}: ${published ? "published" : "draft"}. Switch to ${published ? "draft" : "published"}.`}
      title={published ? "Published — click to make it a draft" : "Draft — click to publish"}
      className={`inline-flex items-center gap-2 rounded-full py-0.5 pr-1 text-xs transition disabled:cursor-wait disabled:opacity-70 ${FOCUS_RING}`}
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${published ? "bg-[#0CA30C]" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
            published ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      <span className={`font-medium ${published ? "text-green-800" : "text-gray-500"}`}>
        {busy ? "Saving…" : published ? "Published" : "Draft"}
      </span>
    </button>
  );
}

function Thumb({ shloka, size }: { shloka: PublicShloka; size: number }) {
  const url = thumbOf(shloka);
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-lg bg-[#F0E7D8] object-cover ring-1 ring-black/5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-lg bg-[#F0E7D8] text-[#B79B72]"
      style={{ width: size, height: size }}
    >
      <BookText size={Math.round(size * 0.42)} />
    </span>
  );
}

function ContentBadges({ shloka, className = "" }: { shloka: PublicShloka; className?: string }) {
  const images = imageCount(shloka);
  const bits: React.ReactNode[] = [];
  if (shloka.meaningAudio?.url)
    bits.push(
      <span key="ma" className="inline-flex items-center gap-1" title="Has meaning audio">
        <Headphones size={13} aria-hidden="true" /> Meaning
      </span>,
    );
  if (images > 0)
    bits.push(
      <span key="img" className="inline-flex items-center gap-1" title={`${images} image${images === 1 ? "" : "s"}`}>
        <ImageIcon size={13} aria-hidden="true" /> {images}
      </span>,
    );
  if (shloka.caseStudy)
    bits.push(
      <span key="cs" className="inline-flex items-center gap-1" title="Has a case scenario">
        <BookText size={13} aria-hidden="true" /> Case
      </span>,
    );
  if (bits.length === 0) return <span className={`text-gray-400 ${className}`}>—</span>;
  return <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500 ${className}`}>{bits}</span>;
}

/** Catalog at a glance: how much is live vs still a draft. */
function CatalogPulse({ shlokas }: { shlokas: PublicShloka[] }) {
  const published = shlokas.filter((s) => s.status === "published").length;
  const drafts = shlokas.length - published;
  const withMeaning = shlokas.filter((s) => s.meaningAudio?.url).length;
  const stats = [
    { label: "Published", value: published, sub: "Live for students" },
    { label: "Drafts", value: drafts, sub: drafts === 0 ? "Nothing pending" : "Not yet visible" },
    { label: "With meaning audio", value: `${withMeaning} of ${shlokas.length}`, sub: "Narrated meaning" },
  ];
  return (
    <section
      aria-label="Catalog at a glance"
      className="grid grid-cols-3 divide-x divide-[#F0E7D8] rounded-xl border border-[#E5DDD0] bg-white"
    >
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 px-3 py-3 md:px-5 md:py-4">
          <div className="truncate text-[11px] text-gray-500 md:text-xs">{s.label}</div>
          <div className="mt-1 text-lg font-bold leading-none text-[#1B1208] md:text-2xl">{s.value}</div>
          <div className="mt-1.5 line-clamp-2 text-[11px] text-gray-500 md:text-xs">{s.sub}</div>
        </div>
      ))}
    </section>
  );
}

function FilterChips({
  value,
  counts,
  onChange,
}: {
  value: StatusFilter;
  counts: Record<StatusFilter, number>;
  onChange: (f: StatusFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {FILTERS.map(({ key, label }) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            aria-label={`${label} (${counts[key]})`}
            onClick={() => onChange(key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition active:scale-[0.97] ${FOCUS_RING} ${
              on
                ? "border-[#8A5A2B] bg-[#8A5A2B] font-semibold text-white"
                : "border-[#E5DDD0] bg-white text-[#1B1208] hover:border-[#D4A574] hover:bg-[#FDF5E6]"
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? "bg-white/20" : "bg-[#F4EEE4] text-gray-600"}`}>
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative md:w-72">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search title or slug"
        aria-label="Search shlokas"
        className="w-full rounded-full border border-[#E5DDD0] bg-white py-2 pl-9 pr-9 text-sm text-[#1B1208] outline-none transition placeholder:text-gray-400 focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-[#FDF5E6] hover:text-[#1B1208] ${FOCUS_RING}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  column: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = active && sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group/sort inline-flex items-center gap-1 rounded transition hover:text-[#1B1208] ${FOCUS_RING} ${
          active ? "text-[#1B1208]" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon size={12} aria-hidden="true" className={active ? "" : "opacity-0 transition group-hover/sort:opacity-40"} />
      </button>
    </th>
  );
}

function ShlokaTable({
  rows,
  sort,
  onSort,
  onOpen,
  onDelete,
  busyIds,
  onToggle,
}: {
  rows: PublicShloka[];
  sort: Sort;
  onSort: (k: SortKey) => void;
  onOpen: (id: string) => void;
  onDelete: (s: PublicShloka) => void;
  busyIds: Set<string>;
  onToggle: (s: PublicShloka) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-[#E5DDD0] bg-white md:block">
      <table className="w-full text-sm">
        <caption className="sr-only">Shlokas</caption>
        <thead>
          <tr className="border-b border-[#E5DDD0] bg-[#FBF8F2] text-left text-xs text-gray-500">
            <SortHeader label="Shloka" column="title" sort={sort} onSort={onSort} className="pl-4" />
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <SortHeader label="Lines" column="lines" sort={sort} onSort={onSort} align="right" />
            <th scope="col" className="px-3 py-2.5 font-medium">Content</th>
            <SortHeader label="Updated" column="updated" sort={sort} onSort={onSort} />
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              onClick={(e) => {
                if (!(e.target as Element).closest("a,button")) onOpen(s.id);
              }}
              className="group cursor-pointer border-b border-[#F0E7D8] transition-colors last:border-b-0 hover:bg-[#FBF8F2]"
            >
              <td className="py-3 pl-4 pr-3">
                <div className="flex min-w-0 max-w-[320px] items-center gap-3">
                  <Thumb shloka={s} size={40} />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/shlokas/${s.id}/edit`}
                      className={`block truncate rounded font-semibold text-[#1B1208] hover:underline ${FOCUS_RING}`}
                    >
                      {s.title}
                    </Link>
                    <div className="truncate font-mono text-[11px] text-gray-500">{s.slug}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3"><StatusToggle shloka={s} busy={busyIds.has(s.id)} onToggle={onToggle} /></td>
              <td className="px-3 py-3 text-right tabular-nums text-gray-600">{lineCount(s)}</td>
              <td className="px-3 py-3 text-xs"><ContentBadges shloka={s} /></td>
              <td className="px-3 py-3 whitespace-nowrap text-gray-600">{formatRelative(s.updatedAt || s.createdAt)}</td>
              <td className="py-3 pr-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/admin/shlokas/${s.id}/edit`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[#8A5A2B] transition hover:bg-[#FDF5E6] ${FOCUS_RING}`}
                  >
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    aria-label={`Delete ${s.title}`}
                    className={`inline-flex items-center rounded-full p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 ${FOCUS_RING}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShlokaCards({
  rows,
  onDelete,
  busyIds,
  onToggle,
}: {
  rows: PublicShloka[];
  onDelete: (s: PublicShloka) => void;
  busyIds: Set<string>;
  onToggle: (s: PublicShloka) => void;
}) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((s) => (
        <li key={s.id} className="overflow-hidden rounded-xl border border-[#E5DDD0] bg-white">
          <Link
            href={`/admin/shlokas/${s.id}/edit`}
            className={`flex items-start gap-3 p-3 transition active:bg-[#FBF8F2] ${FOCUS_RING}`}
          >
            <Thumb shloka={s} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#1B1208]">{s.title}</div>
              <div className="truncate font-mono text-[11px] text-gray-500">{s.slug}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-500">
                <span className="tabular-nums">{lineCount(s)} lines</span>
                <span aria-hidden="true">·</span>
                <span>{formatRelative(s.updatedAt || s.createdAt)}</span>
              </div>
              <ContentBadges shloka={s} className="mt-2 text-[11px]" />
            </div>
          </Link>
          <div className="flex items-center justify-between border-t border-[#F0E7D8] bg-[#FBF8F2] px-3 py-1.5">
            <StatusToggle shloka={s} busy={busyIds.has(s.id)} onToggle={onToggle} />
            <button
              type="button"
              onClick={() => onDelete(s)}
              aria-label={`Delete ${s.title}`}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600 ${FOCUS_RING}`}
            >
              <Trash2 size={14} aria-hidden="true" /> Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  const block = "rounded-xl bg-[#EFE8DC] motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">Loading shlokas…</span>
      <div className={`h-[92px] ${block}`} />
      <div className="flex flex-col gap-3 md:flex-row md:justify-between">
        <div className={`h-9 w-56 ${block}`} />
        <div className={`h-9 w-full md:w-72 ${block}`} />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`h-16 ${block}`} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

const ShlokaListPage: React.FC = () => {
  const router = useRouter();
  const [items, setItems] = useState<PublicShloka[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const { search, status, sort } = view;
  const [toDelete, setToDelete] = useState<PublicShloka | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAllShlokas());
    } catch (e) {
      setError((e as ApiError).message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Search, filter and sort survive a trip to the editor and back (per tab).
  useEffect(() => {
    setView((cur) => ({ ...cur, ...readView() }));
  }, []);
  const updateView = useCallback((patch: Partial<View> | ((cur: View) => Partial<View>)) => {
    setView((cur) => {
      const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
      writeView(next);
      return next;
    });
  }, []);
  const setSearch = (value: string) => updateView({ search: value });
  const setStatus = (value: StatusFilter) => updateView({ status: value });
  const onSort = (key: SortKey) =>
    updateView(({ sort: cur }) => ({
      sort: cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] },
    }));

  const shlokas = useMemo(() => items ?? [], [items]);
  const counts: Record<StatusFilter, number> = {
    all: shlokas.length,
    published: shlokas.filter((s) => s.status === "published").length,
    draft: shlokas.filter((s) => s.status === "draft").length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    return shlokas
      .filter((s) => {
        if (status !== "all" && s.status !== status) return false;
        return !q || s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
      })
      .sort((a, b) => dir * COMPARE[sort.key](a, b) || a.title.localeCompare(b.title));
  }, [shlokas, search, status, sort]);

  const onConfirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.admin.shlokas.remove(toDelete.id);
      setItems((prev) => (prev ? prev.filter((s) => s.id !== toDelete.id) : prev));
      setToDelete(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchStatus = (id: string, status: "draft" | "published", updatedAt?: string) =>
    setItems((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, status, ...(updatedAt ? { updatedAt } : {}) } : s)) : prev));

  const onToggleStatus = async (s: PublicShloka) => {
    if (busyIds.has(s.id)) return;
    const next = s.status === "published" ? "draft" : "published";
    setActionError(null);
    setBusy(s.id, true);
    patchStatus(s.id, next); // optimistic
    try {
      const updated = await api.admin.shlokas.update(s.id, { status: next });
      patchStatus(s.id, updated.status, updated.updatedAt);
    } catch (e) {
      patchStatus(s.id, s.status); // revert
      const err = e as ApiError;
      setActionError(
        err.code === "INVALID_TIMINGS"
          ? `Couldn't publish “${s.title}” — its audio timings are incomplete. Open it in the editor to finish.`
          : `Couldn't update “${s.title}”.${err.message ? ` ${err.message}` : ""}`,
      );
    } finally {
      setBusy(s.id, false);
    }
  };

  const sortValue = `${sort.key}:${sort.dir}`;
  const sortIsListed = SORT_OPTIONS.some((o) => `${o.sort.key}:${o.sort.dir}` === sortValue);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5 md:max-w-6xl md:px-10 md:py-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brown md:text-3xl">Shlokas</h1>
          {items && (
            <p className="mt-1 text-sm text-gray-500">
              {shlokas.length} {shlokas.length === 1 ? "shloka" : "shlokas"}
              {counts.draft > 0 && ` · ${counts.draft} draft${counts.draft === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
        <Link
          href="/admin/shlokas/new"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.97] ${FOCUS_RING}`}
        >
          <Plus size={16} aria-hidden="true" /> New shloka
        </Link>
      </header>

      {!items && error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Couldn&apos;t load shlokas. {error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className={`inline-flex items-center gap-1.5 self-start rounded-full border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 transition hover:bg-red-100 ${FOCUS_RING}`}
          >
            <RotateCcw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {!items && !error && <ListSkeleton />}

      {items && (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {shlokas.length > 0 && <CatalogPulse shlokas={shlokas} />}
          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {actionError}
            </p>
          )}

          {shlokas.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-[#E5DDD0] bg-white/60 px-6 py-12 text-center">
              <BookText size={28} className="mx-auto text-accent" aria-hidden="true" />
              <h2 className="mt-3 text-base font-bold text-[#1B1208]">No shlokas yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                Add your first verse with audio, meaning and a case scenario.
              </p>
              <Link
                href="/admin/shlokas/new"
                className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${FOCUS_RING}`}
              >
                <Plus size={16} aria-hidden="true" /> New shloka
              </Link>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterChips value={status} counts={counts} onChange={setStatus} />
                <SearchBox value={search} onChange={setSearch} />
              </div>

              <label className="flex items-center justify-end gap-2 text-xs text-gray-500 md:hidden">
                Sort by
                <select
                  value={sortValue}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(":") as [SortKey, Sort["dir"]];
                    updateView({ sort: { key, dir } });
                  }}
                  className={`rounded-full border border-[#E5DDD0] bg-white px-3 py-1.5 text-xs text-[#1B1208] ${FOCUS_RING}`}
                >
                  {!sortIsListed && <option value={sortValue}>Custom order</option>}
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.label} value={`${o.sort.key}:${o.sort.dir}`}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E5DDD0] bg-white/60 px-6 py-10 text-center">
                  <p className="text-sm text-[#1B1208]">
                    {search.trim() ? `No shlokas match “${search.trim()}”` : "No shlokas in this view"}.
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    {search.trim() && (
                      <button type="button" onClick={() => setSearch("")} className={GHOST_BUTTON}>
                        Clear search
                      </button>
                    )}
                    {status !== "all" && (
                      <button type="button" onClick={() => setStatus("all")} className={GHOST_BUTTON}>
                        Show all
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <ShlokaTable
                    rows={visible}
                    sort={sort}
                    onSort={onSort}
                    onOpen={(id) => router.push(`/admin/shlokas/${id}/edit`)}
                    onDelete={setToDelete}
                    busyIds={busyIds}
                    onToggle={onToggleStatus}
                  />
                  <ShlokaCards rows={visible} onDelete={setToDelete} busyIds={busyIds} onToggle={onToggleStatus} />
                  <p className="text-xs text-gray-500">
                    Showing {visible.length} of {shlokas.length} {shlokas.length === 1 ? "shloka" : "shlokas"}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {toDelete && (
        <ConfirmDeleteModal
          title="Delete shloka"
          message={`Permanently delete “${toDelete.title}”? Its audio and images will be removed from Cloudinary. This can't be undone.`}
          onConfirm={onConfirmDelete}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}
    </main>
  );
};

export default ShlokaListPage;
