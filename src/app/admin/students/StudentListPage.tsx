"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, RotateCcw, Search, UserPlus, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import type { ApiError, StudentRosterResponse, StudentRosterRow } from "@/lib/auth/types";
import AvatarCircle from "@/components/student/AvatarCircle";
import ActivitySparkline from "@/components/admin/analytics/ActivitySparkline";
import { VIZ } from "@/components/admin/analytics/ColumnChart";
import { formatDuration, formatRelative } from "@/components/admin/analytics/format";

type Filter = "all" | "active" | "attention";
type SortKey = "name" | "week" | "total" | "progress" | "lastActive";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

const DEFAULT_SORT: Sort = { key: "week", dir: "desc" };
const VIEW_KEY = "cs.admin.students.view";
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]";

const isActiveThisWeek = (r: StudentRosterRow) => r.last7Seconds > 0;
const progressOf = (r: StudentRosterRow) => (r.available > 0 ? r.completed / r.available : 0);
const lastActiveMs = (r: StudentRosterRow) => (r.lastActiveAt ? Date.parse(r.lastActiveAt) : 0);

const COMPARE: Record<SortKey, (a: StudentRosterRow, b: StudentRosterRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  week: (a, b) => a.last7Seconds - b.last7Seconds,
  total: (a, b) => a.totalSeconds - b.totalSeconds,
  progress: (a, b) => progressOf(a) - progressOf(b) || a.completed - b.completed,
  lastActive: (a, b) => lastActiveMs(a) - lastActiveMs(b),
};
/** Direction a column sorts in on its first click. */
const FIRST_DIR: Record<SortKey, Sort["dir"]> = {
  name: "asc",
  week: "desc",
  total: "desc",
  progress: "desc",
  lastActive: "desc",
};
const SORT_OPTIONS: { label: string; sort: Sort }[] = [
  { label: "Most active this week", sort: { key: "week", dir: "desc" } },
  { label: "Most time overall", sort: { key: "total", dir: "desc" } },
  { label: "Most progress", sort: { key: "progress", dir: "desc" } },
  { label: "Recently active", sort: { key: "lastActive", dir: "desc" } },
  { label: "Longest inactive", sort: { key: "lastActive", dir: "asc" } },
  { label: "Name (A–Z)", sort: { key: "name", dir: "asc" } },
];
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active this week" },
  { key: "attention", label: "Needs attention" },
];

// Status dots use the fixed status palette and always sit beside a text label.
const STATUS = {
  active: { label: "Active this week", dot: { background: "#0CA30C" } },
  idle: { label: "No study in the last 7 days", dot: { background: "#FAB219" } },
  never: { label: "No activity yet", dot: { boxShadow: "inset 0 0 0 1.5px #9CA3AF" } },
};
const statusOf = (r: StudentRosterRow) =>
  !r.lastActiveAt ? STATUS.never : isActiveThisWeek(r) ? STATUS.active : STATUS.idle;

interface View {
  search: string;
  filter: Filter;
  sort: Sort;
}
const DEFAULT_VIEW: View = { search: "", filter: "all", sort: DEFAULT_SORT };

function readView(): Partial<View> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
    const view: Partial<View> = {};
    if (typeof saved?.search === "string") view.search = saved.search;
    if (FILTERS.some((f) => f.key === saved?.filter)) view.filter = saved.filter;
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

// ── Pieces ────────────────────────────────────────────────────────────────

function PulseStat({
  label,
  shortLabel,
  value,
  suffix,
  sub,
}: {
  label: string;
  /** Used on phones, where a column is ~110px wide. */
  shortLabel?: string;
  value: string;
  suffix?: string;
  sub: string;
}) {
  return (
    <div className="min-w-0 px-3 py-3 md:px-5 md:py-4">
      <div className="truncate text-[11px] text-gray-500 md:text-xs">
        {shortLabel ? (
          <>
            <span className="md:hidden">{shortLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-bold leading-none text-[#1B1208] md:text-2xl">{value}</span>
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
      <div className="mt-1.5 line-clamp-2 text-[11px] text-gray-500 md:text-xs">{sub}</div>
    </div>
  );
}

/** The class this week, in three numbers. */
function ClassPulse({ students }: { students: StudentRosterRow[] }) {
  const active = students.filter(isActiveThisWeek).length;
  const weekSeconds = students.reduce((sum, r) => sum + r.last7Seconds, 0);
  const withCatalog = students.filter((r) => r.available > 0);
  const avgProgress = withCatalog.length
    ? withCatalog.reduce((sum, r) => sum + progressOf(r), 0) / withCatalog.length
    : 0;
  const completions = students.reduce((sum, r) => sum + r.completed, 0);
  return (
    <section
      aria-label="Class at a glance"
      className="grid grid-cols-3 divide-x divide-[#F0E7D8] rounded-xl border border-[#E5DDD0] bg-white"
    >
      <PulseStat
        label="Active this week"
        value={String(active)}
        suffix={`of ${students.length}`}
        sub={`${Math.round((active / students.length) * 100)}% of the class`}
      />
      <PulseStat
        label="Study time this week"
        shortLabel="Time this week"
        value={formatDuration(weekSeconds)}
        sub={active > 0 ? `${formatDuration(weekSeconds / active)} per active student` : "No study yet this week"}
      />
      <PulseStat
        label="Average progress"
        value={`${Math.round(avgProgress * 100)}%`}
        sub={`${completions} ${completions === 1 ? "shloka" : "shlokas"} completed in total`}
      />
    </section>
  );
}

function PendingBanner({ count }: { count: number }) {
  return (
    <Link
      href="/admin/access-requests"
      className={`group flex items-center gap-3 rounded-xl border border-[#F0DDC2] bg-[#FDF5E6] px-4 py-3 text-sm text-[#8A5A2B] transition hover:bg-[#FBEEDA] ${FOCUS_RING}`}
    >
      <UserPlus size={16} className="shrink-0" aria-hidden="true" />
      <span className="flex-1">
        <strong className="font-bold">{count}</strong> access {count === 1 ? "request is" : "requests are"} waiting
        for your review
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold">
        Review
        <ChevronRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function FilterChips({
  value,
  counts,
  onChange,
}: {
  value: Filter;
  counts: Record<Filter, number>;
  onChange: (f: Filter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Show students"
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
    <div className="relative md:w-80">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, email, college or course"
        aria-label="Search students"
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

function LastActive({ row, compact = false }: { row: StudentRosterRow; compact?: boolean }) {
  const status = statusOf(row);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-gray-600 ${compact ? "text-[11px]" : "text-sm"}`}
      title={status.label}
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={status.dot} />
      {row.lastActiveAt ? formatRelative(row.lastActiveAt) : "No activity yet"}
      {row.lastActiveAt && <span className="sr-only">({status.label})</span>}
    </span>
  );
}

function ProgressMeter({ row, verbose = false, className = "" }: { row: StudentRosterRow; verbose?: boolean; className?: string }) {
  const pct = progressOf(row);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="text-[#1B1208]">
          {row.completed} of {row.available}
          {verbose && <span className="text-gray-500"> shlokas completed</span>}
        </span>
        <span className="text-gray-500">{Math.round(pct * 100)}%</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ background: VIZ.track }}
        role="progressbar"
        aria-label="Shlokas completed"
        aria-valuemin={0}
        aria-valuemax={row.available}
        aria-valuenow={row.completed}
      >
        {row.completed > 0 && (
          <div className="h-full rounded-full" style={{ width: `${Math.max(4, pct * 100)}%`, background: VIZ.mark }} />
        )}
      </div>
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

function StudentTable({
  rows,
  days,
  sort,
  onSort,
  onOpen,
}: {
  rows: StudentRosterRow[];
  days: string[];
  sort: Sort;
  onSort: (k: SortKey) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-[#E5DDD0] bg-white md:block">
      <table className="w-full text-sm">
        <caption className="sr-only">Students</caption>
        <thead>
          <tr className="border-b border-[#E5DDD0] bg-[#FBF8F2] text-left text-xs text-gray-500">
            <SortHeader label="Student" column="name" sort={sort} onSort={onSort} className="pl-4" />
            <th scope="col" className="px-3 py-2.5 font-medium">
              <span title="Study time per day. A full bar is 1 hour or more.">Last 14 days</span>
            </th>
            <SortHeader label="This week" column="week" sort={sort} onSort={onSort} align="right" />
            <SortHeader label="Total" column="total" sort={sort} onSort={onSort} align="right" />
            <SortHeader label="Progress" column="progress" sort={sort} onSort={onSort} />
            <SortHeader label="Last active" column="lastActive" sort={sort} onSort={onSort} />
            <th scope="col" className="w-8">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={(e) => {
                if (!(e.target as Element).closest("a")) onOpen(r.id);
              }}
              className="group cursor-pointer border-b border-[#F0E7D8] transition-colors last:border-b-0 hover:bg-[#FBF8F2]"
            >
              <td className="py-3 pl-4 pr-3">
                <div className="flex min-w-0 max-w-[280px] items-center gap-3">
                  <AvatarCircle name={r.name} email={r.email} size={36} />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/students/${r.id}`}
                      className={`block truncate rounded font-semibold text-[#1B1208] hover:underline ${FOCUS_RING}`}
                    >
                      {r.name}
                    </Link>
                    <div className="truncate text-xs text-gray-500">{r.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <ActivitySparkline values={r.last14Days} days={days} />
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#1B1208]">{formatDuration(r.last7Seconds)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-gray-600">{formatDuration(r.totalSeconds)}</td>
              <td className="px-3 py-3">
                <ProgressMeter row={r} className="w-28" />
              </td>
              <td className="px-3 py-3">
                <LastActive row={r} />
              </td>
              <td className="pr-3">
                <ChevronRight size={16} aria-hidden="true" className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#A67C52]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentCards({ rows, days }: { rows: StudentRosterRow[]; days: string[] }) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/admin/students/${r.id}`}
            className={`block rounded-xl border border-[#E5DDD0] bg-white p-3 transition active:scale-[0.99] active:bg-[#FBF8F2] ${FOCUS_RING}`}
          >
            <div className="flex items-start gap-3">
              <AvatarCircle name={r.name} email={r.email} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#1B1208]">{r.name}</div>
                    <div className="truncate text-xs text-gray-500">{r.email}</div>
                  </div>
                  <LastActive row={r} compact />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <ActivitySparkline values={r.last14Days} days={days} width={112} height={22} />
                  <div className="text-right leading-tight">
                    <div className="text-sm font-semibold tabular-nums text-[#1B1208]">{formatDuration(r.last7Seconds)}</div>
                    <div className="text-[10px] text-gray-500">this week</div>
                  </div>
                </div>
                <ProgressMeter row={r} verbose className="mt-3" />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  const block = "rounded-xl bg-[#EFE8DC] motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading students…
      </span>
      <div className={`h-[92px] ${block}`} />
      <div className={`h-9 w-full md:w-96 ${block}`} />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`h-16 ${block}`} />
      ))}
    </div>
  );
}

const GHOST_BUTTON = `inline-flex items-center gap-1.5 rounded-full border border-[#E5DDD0] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5A2B] transition hover:bg-[#FDF5E6] active:scale-[0.97] ${FOCUS_RING}`;

// ── Page ──────────────────────────────────────────────────────────────────

const StudentListPage: React.FC = () => {
  const router = useRouter();
  const [data, setData] = useState<StudentRosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const { search, filter, sort } = view;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setData(await api.admin.analytics.students({ tz }));
    } catch (e) {
      setError((e as ApiError).message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Search, filter and sort survive a trip to a student and back (per tab).
  // Saved only when the admin changes them, never from an effect, so a
  // restore can't be overwritten by the initial defaults.
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
  const setFilter = (value: Filter) => updateView({ filter: value });

  const students = useMemo(() => (data?.items ?? []).filter((r) => r.status !== "pending"), [data]);
  const pendingCount = (data?.items.length ?? 0) - students.length;
  const activeCount = students.filter(isActiveThisWeek).length;
  const counts: Record<Filter, number> = {
    all: students.length,
    active: activeCount,
    attention: students.length - activeCount,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    return students
      .filter((r) => {
        if (filter === "active" && !isActiveThisWeek(r)) return false;
        if (filter === "attention" && isActiveThisWeek(r)) return false;
        return !q || [r.name, r.email, r.collegeName, r.course].some((v) => v?.toLowerCase().includes(q));
      })
      .sort((a, b) => dir * COMPARE[sort.key](a, b) || a.name.localeCompare(b.name));
  }, [students, search, filter, sort]);

  const onSort = (key: SortKey) =>
    updateView(({ sort: cur }) => ({
      sort: cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] },
    }));

  const sortValue = `${sort.key}:${sort.dir}`;
  const sortIsListed = SORT_OPTIONS.some((o) => `${o.sort.key}:${o.sort.dir}` === sortValue);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5 md:max-w-6xl md:px-10 md:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-brown md:text-3xl">Students</h1>
        {data && (
          <p className="mt-1 text-sm text-gray-500">
            {students.length} {students.length === 1 ? "student" : "students"}
            {pendingCount > 0 && ` · ${pendingCount} awaiting approval`}
          </p>
        )}
      </header>

      {!data && error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Couldn&apos;t load students. {error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className={`inline-flex items-center gap-1.5 self-start rounded-full border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 transition hover:bg-red-100 ${FOCUS_RING}`}
          >
            <RotateCcw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {!data && !error && <ListSkeleton />}

      {data && (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {students.length > 0 && <ClassPulse students={students} />}
          {pendingCount > 0 && <PendingBanner count={pendingCount} />}

          {students.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-[#E5DDD0] bg-white/60 px-6 py-12 text-center">
              <Users size={28} className="mx-auto text-accent" aria-hidden="true" />
              <h2 className="mt-3 text-base font-bold text-[#1B1208]">No students yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                Students appear here once you approve their access requests.
              </p>
              <Link href="/admin/access-requests" className={`mt-4 ${GHOST_BUTTON}`}>
                Go to access requests
              </Link>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterChips value={filter} counts={counts} onChange={setFilter} />
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
                    {search.trim() ? `No students match “${search.trim()}”` : "No students in this view"}
                    {search.trim() && filter !== "all" ? " in this view." : "."}
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    {search.trim() && (
                      <button type="button" onClick={() => setSearch("")} className={GHOST_BUTTON}>
                        Clear search
                      </button>
                    )}
                    {filter !== "all" && (
                      <button type="button" onClick={() => setFilter("all")} className={GHOST_BUTTON}>
                        Show all students
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <StudentTable
                    rows={visible}
                    days={data.days}
                    sort={sort}
                    onSort={onSort}
                    onOpen={(id) => router.push(`/admin/students/${id}`)}
                  />
                  <StudentCards rows={visible} days={data.days} />
                  <p className="text-xs text-gray-500">
                    Showing {visible.length} of {students.length} {students.length === 1 ? "student" : "students"}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
};

export default StudentListPage;
