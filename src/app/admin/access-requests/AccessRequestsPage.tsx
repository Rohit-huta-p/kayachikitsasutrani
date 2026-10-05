"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  GraduationCap,
  Inbox,
  KeyRound,
  Mail,
  RefreshCw,
  RotateCcw,
  School,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AccessRequest, AcceptedAccessRequest, ApprovedAccount } from "@/lib/auth/types";
import AvatarCircle from "@/components/student/AvatarCircle";
import { formatRelative } from "@/components/admin/analytics/format";

/**
 * Admin page for reviewing access requests — styled to match the admin
 * "Students" page (avatars, cream cards, brown/gold accents, filter chips
 * and search).
 *
 * The list holds both pending requests and approved accounts, filtered by a
 * tab (All / Pending / Approved, each with a count) and a name/email search:
 *   - "Accept" — the server generates a fresh password, marks the user
 *     active, and returns a pre-built mailto/Gmail link plus the plaintext
 *     password *once*. The request then becomes an "Approved" card.
 *   - "Reject" — the server deletes the request entirely.
 *
 * Approved credentials are read from the server
 * (`GET /api/admin/access-requests/approved`) so they stay visible on every
 * device, survive refreshes, and never depend on this browser's storage.
 *
 * BRIDGE (temporary): until the backend `approved`/`forget`/`regenerate`
 * endpoints ship, the page silently falls back to the previous per-browser
 * localStorage cache so approvals don't lose their password in the interim.
 * On accept we still write the credential to localStorage; `load()` prunes
 * any local copy the server has taken ownership of. Once the backend is live
 * everywhere, the `StoredApproval` bridge (localStorage read/write + merge)
 * can be deleted and the Approved list sourced purely from the server.
 */

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]";
const GHOST_BUTTON = `inline-flex items-center gap-1.5 rounded-full border border-[#E5DDD0] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5A2B] transition hover:bg-[#FDF5E6] active:scale-[0.97] ${FOCUS_RING}`;
const APPROVED_KEY = "cs.admin.accessRequests.approved";
const VIEW_KEY = "cs.admin.accessRequests.view";

type Tab = "all" | "pending" | "approved";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
];
/** Sort weight so pending (actionable) cards come before approved ones in "All". */
const KIND_ORDER = { pending: 0, approved: 1 } as const;

/**
 * BRIDGE type — the one-time accept response plus a profile snapshot, cached
 * in this browser so a credential survives a refresh even before the backend
 * persists it. Superseded by the server's `ApprovedAccount` once available.
 */
interface StoredApproval extends AcceptedAccessRequest {
  approvedAt: string;
  age?: number;
  gender?: "male" | "female" | "other";
  collegeName?: string;
  course?: string;
  submittedAt?: string;
}

type Entry =
  | { kind: "pending"; id: string; name: string; email: string; ts: number; req: AccessRequest }
  | { kind: "approved"; id: string; name: string; email: string; ts: number; rec: ApprovedAccount };

interface View {
  tab: Tab;
  search: string;
}
const DEFAULT_VIEW: View = { tab: "all", search: "" };

function readApproved(): StoredApproval[] {
  try {
    const raw = JSON.parse(localStorage.getItem(APPROVED_KEY) || "null");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is StoredApproval =>
        !!r && typeof r.id === "string" && typeof r.password === "string" && typeof r.email === "string",
    );
  } catch {
    return [];
  }
}

function writeApproved(list: StoredApproval[]): void {
  try {
    localStorage.setItem(APPROVED_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable — the bridge just won't persist across reloads.
  }
}

/** Map a bridged localStorage approval into the server's shape for rendering. */
function storedToApproved(s: StoredApproval): ApprovedAccount {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    age: s.age,
    gender: s.gender,
    collegeName: s.collegeName,
    course: s.course,
    approvedAt: s.approvedAt,
    deliveredAt: null,
    password: s.password,
    loginUrl: s.loginUrl,
    mailtoSubject: s.mailtoSubject,
    mailtoBody: s.mailtoBody,
    mailto: s.mailto,
    gmailUrl: s.gmailUrl,
  };
}

function readView(): Partial<View> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
    const view: Partial<View> = {};
    if (TABS.some((t) => t.key === saved?.tab)) view.tab = saved.tab;
    if (typeof saved?.search === "string") view.search = saved.search;
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

const AccessRequestsPage = () => {
  const [items, setItems] = useState<AccessRequest[] | null>(null);
  const [serverApproved, setServerApproved] = useState<ApprovedAccount[]>([]);
  const [localApproved, setLocalApproved] = useState<StoredApproval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  // Per-row in-flight flags.
  const [busy, setBusy] = useState<Record<string, "accept" | "reject" | null>>({});
  const [regenId, setRegenId] = useState<string | null>(null);
  const { tab, search } = view;

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      // Pending uses the always-present endpoint; approved is tolerant of a
      // backend that hasn't shipped the new route yet (→ null, keep bridge).
      const [pending, appr] = await Promise.all([
        api.admin.accessRequests.list(),
        api.admin.accessRequests
          .approved()
          .then((r) => r.items)
          .catch(() => null),
      ]);
      setItems(pending.items);
      if (appr) {
        setServerApproved(appr);
        // Prune bridge entries the server now owns.
        setLocalApproved((cur) => {
          const serverIds = new Set(appr.map((a) => a.id));
          const next = cur.filter((l) => !serverIds.has(l.id));
          if (next.length !== cur.length) writeApproved(next);
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load access requests");
      setItems((cur) => cur ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Bridge cache + saved view (tab/search) live in the browser.
  useEffect(() => {
    setLocalApproved(readApproved());
    setView((cur) => ({ ...cur, ...readView() }));
  }, []);

  const updateView = useCallback((patch: Partial<View> | ((cur: View) => Partial<View>)) => {
    setView((cur) => {
      const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
      writeView(next);
      return next;
    });
  }, []);
  const setTab = (value: Tab) => updateView({ tab: value });
  const setSearch = (value: string) => updateView({ search: value });

  // Server is authoritative; bridge fills in only ids the server doesn't have.
  const approved: ApprovedAccount[] = useMemo(() => {
    const serverIds = new Set(serverApproved.map((s) => s.id));
    const extras = localApproved.filter((l) => !serverIds.has(l.id)).map(storedToApproved);
    return [...serverApproved, ...extras];
  }, [serverApproved, localApproved]);

  const handleAccept = async (req: AccessRequest) => {
    setBusy((b) => ({ ...b, [req.id]: "accept" }));
    setError(null);
    try {
      const res = await api.admin.accessRequests.accept(req.id);
      // Bridge write so the password survives even if the server can't persist
      // it yet. load() prunes this once the server reports the same account.
      const record: StoredApproval = {
        ...res,
        approvedAt: new Date().toISOString(),
        age: req.age,
        gender: req.gender,
        collegeName: req.collegeName,
        course: req.course,
        submittedAt: req.createdAt,
      };
      setLocalApproved((cur) => {
        const next = [record, ...cur.filter((r) => r.id !== record.id)];
        writeApproved(next);
        return next;
      });
      setItems((prev) => (prev ?? []).filter((p) => p.id !== req.id));
      // Keep the just-approved card (and its password) in view.
      updateView((cur) => (cur.tab === "pending" ? { tab: "all" } : {}));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept request");
    } finally {
      setBusy((b) => ({ ...b, [req.id]: null }));
    }
  };

  const handleReject = async (req: AccessRequest) => {
    if (!confirm(`Reject the access request from ${req.name}? This will delete it.`)) return;
    setBusy((b) => ({ ...b, [req.id]: "reject" }));
    setError(null);
    try {
      await api.admin.accessRequests.reject(req.id);
      setItems((prev) => (prev ?? []).filter((p) => p.id !== req.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject request");
    } finally {
      setBusy((b) => ({ ...b, [req.id]: null }));
    }
  };

  const forgetPassword = async (rec: ApprovedAccount) => {
    if (
      !confirm(
        `Forget the stored password for ${rec.name}?\n\nIt can't be recovered afterwards — use Regenerate to issue a new one. ${rec.name} stays an approved student.`,
      )
    )
      return;
    setError(null);
    try {
      await api.admin.accessRequests.forget(rec.id);
    } catch {
      // Backend may not have the endpoint yet — still drop the local bridge copy.
    }
    // Drop any bridge copy, then refetch so the card updates in place
    // (becomes "password not stored") rather than vanishing.
    setLocalApproved((cur) => {
      const next = cur.filter((r) => r.id !== rec.id);
      writeApproved(next);
      return next;
    });
    await load();
  };

  const regenerate = async (rec: ApprovedAccount) => {
    if (!confirm(`Issue a new password for ${rec.name}? Their current password will stop working.`)) return;
    setRegenId(rec.id);
    setError(null);
    try {
      await api.admin.accessRequests.regenerate(rec.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate password");
    } finally {
      setRegenId(null);
    }
  };

  const entries: Entry[] = useMemo(
    () => [
      ...(items ?? []).map(
        (req): Entry => ({
          kind: "pending",
          id: req.id,
          name: req.name,
          email: req.email,
          ts: Date.parse(req.createdAt) || 0,
          req,
        }),
      ),
      ...approved.map(
        (rec): Entry => ({
          kind: "approved",
          id: rec.id,
          name: rec.name,
          email: rec.email,
          ts: Date.parse(rec.approvedAt) || 0,
          rec,
        }),
      ),
    ],
    [items, approved],
  );

  const counts: Record<Tab, number> = {
    all: entries.length,
    pending: items?.length ?? 0,
    approved: approved.length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => tab === "all" || e.kind === tab)
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.ts - a.ts);
  }, [entries, tab, search]);

  const loadingPending = items === null && !error;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5 md:max-w-4xl md:px-10 md:py-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-brown md:text-3xl">Access requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            {items === null ? (
              "Loading…"
            ) : (
              <>
                {counts.pending} pending{counts.approved > 0 && ` · ${counts.approved} approved`}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className={`${GHOST_BUTTON} shrink-0 disabled:opacity-60`}
          aria-label="Refresh"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className={`inline-flex items-center gap-1.5 self-start rounded-full border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 transition hover:bg-red-100 ${FOCUS_RING}`}
          >
            <RotateCcw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {loadingPending ? (
        <ListSkeleton />
      ) : counts.all === 0 ? (
        error ? null : <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FilterChips value={tab} counts={counts} onChange={setTab} />
            <SearchBox value={search} onChange={setSearch} />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E5DDD0] bg-white/60 px-6 py-10 text-center">
              <p className="text-sm text-[#1B1208]">
                {search.trim() ? `No one matches “${search.trim()}”` : "Nothing in this view"}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {search.trim() && (
                  <button type="button" onClick={() => setSearch("")} className={GHOST_BUTTON}>
                    Clear search
                  </button>
                )}
                {tab !== "all" && (
                  <button type="button" onClick={() => setTab("all")} className={GHOST_BUTTON}>
                    Show all
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {visible.map((e) =>
                  e.kind === "pending" ? (
                    <PendingCard
                      key={e.id}
                      req={e.req}
                      busy={busy[e.id] ?? null}
                      onAccept={() => void handleAccept(e.req)}
                      onReject={() => void handleReject(e.req)}
                    />
                  ) : (
                    <ApprovedCard
                      key={e.id}
                      rec={e.rec}
                      regenerating={regenId === e.id}
                      onForget={() => void forgetPassword(e.rec)}
                      onRegenerate={() => void regenerate(e.rec)}
                    />
                  ),
                )}
              </div>
              <p className="text-xs text-gray-500">
                Showing {visible.length} of {counts.all}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
};

// ── Controls ──────────────────────────────────────────────────────────────

function FilterChips({
  value,
  counts,
  onChange,
}: {
  value: Tab;
  counts: Record<Tab, number>;
  onChange: (t: Tab) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter requests"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map(({ key, label }) => {
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
            <span
              className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? "bg-white/20" : "bg-[#F4EEE4] text-gray-600"}`}
            >
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
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name or email"
        aria-label="Search requests"
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

// ── Cards ───────────────────────────────────────────────────────────────────

function PersonHeader({ name, email, badge }: { name: string; email: string; badge: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <AvatarCircle name={name} email={email} size={40} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-[#1B1208]">{name}</div>
          <div className="truncate text-xs text-gray-500">{email}</div>
        </div>
      </div>
      {badge}
    </div>
  );
}

function DetailsGrid({ rows }: { rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <dt className="flex w-[84px] shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <span className="text-[#A67C52]">{r.icon}</span>
            {r.label}
          </dt>
          <dd className="truncate text-[#1B1208]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PendingCard({
  req,
  busy,
  onAccept,
  onReject,
}: {
  req: AccessRequest;
  busy: "accept" | "reject" | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#E5DDD0] bg-white shadow-sm">
      <div className="p-4">
        <PersonHeader
          name={req.name}
          email={req.email}
          badge={
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-800">
              Pending
            </span>
          }
        />
        <DetailsGrid
          rows={[
            { icon: <User size={12} />, label: "Age", value: req.age ?? "—" },
            { icon: <User size={12} />, label: "Gender", value: req.gender ? capitalize(req.gender) : "—" },
            { icon: <School size={12} />, label: "College", value: req.collegeName ?? "—" },
            { icon: <GraduationCap size={12} />, label: "Course", value: req.course ?? "—" },
            {
              icon: <Clock size={12} />,
              label: "Submitted",
              value: <span title={formatAbsolute(req.createdAt)}>{formatRelative(req.createdAt)}</span>,
            },
          ]}
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-[#E5DDD0] bg-[#FBF8F2] px-4 py-3">
        <button
          type="button"
          onClick={onReject}
          disabled={!!busy}
          className={`inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 ${FOCUS_RING}`}
        >
          <X size={13} aria-hidden="true" /> {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!!busy}
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#8A5A2B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#754B22] disabled:opacity-50 ${FOCUS_RING}`}
        >
          <Check size={13} aria-hidden="true" /> {busy === "accept" ? "Approving…" : "Accept"}
        </button>
      </div>
    </article>
  );
}

function ApprovedCard({
  rec,
  regenerating,
  onForget,
  onRegenerate,
}: {
  rec: ApprovedAccount;
  regenerating: boolean;
  onForget: () => void;
  onRegenerate: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#E5DDD0] bg-white shadow-sm">
      <div className="p-4">
        <PersonHeader
          name={rec.name}
          email={rec.email}
          badge={
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-800">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#0CA30C]" />
              Approved
            </span>
          }
        />
        <DetailsGrid
          rows={[
            { icon: <User size={12} />, label: "Age", value: rec.age ?? "—" },
            { icon: <User size={12} />, label: "Gender", value: rec.gender ? capitalize(rec.gender) : "—" },
            { icon: <School size={12} />, label: "College", value: rec.collegeName ?? "—" },
            { icon: <GraduationCap size={12} />, label: "Course", value: rec.course ?? "—" },
            {
              icon: <Check size={12} />,
              label: "Approved",
              value: <span title={formatAbsolute(rec.approvedAt)}>{formatRelative(rec.approvedAt)}</span>,
            },
          ]}
        />
      </div>

      <CredentialPanel rec={rec} regenerating={regenerating} onForget={onForget} onRegenerate={onRegenerate} />
    </article>
  );
}

function CredentialPanel({
  rec,
  regenerating,
  onForget,
  onRegenerate,
}: {
  rec: ApprovedAccount;
  regenerating: boolean;
  onForget: () => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const copy = async (field: "email" | "password", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied((c) => (c === field ? null : c)), 1600);
    } catch {
      const input = document.getElementById(`${field}-${rec.id}`) as HTMLInputElement | null;
      input?.select();
    }
  };

  return (
    <div className="space-y-3 border-t border-[#E5DDD0] bg-[#FBF8F2] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#1B1208]">
        <KeyRound size={13} className="text-[#A67C52]" aria-hidden="true" />
        Login credentials
      </div>

      {rec.password === null ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Password isn&apos;t stored for this account (approved earlier, or cleared). Issue a new one to share.
          </p>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className={`inline-flex items-center gap-1.5 rounded-full bg-[#8A5A2B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#754B22] disabled:opacity-50 ${FOCUS_RING}`}
          >
            <KeyRound size={13} aria-hidden="true" /> {regenerating ? "Issuing…" : "Regenerate"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CredentialField
              id={`email-${rec.id}`}
              label="Email"
              value={rec.email}
              copied={copied === "email"}
              onCopy={() => void copy("email", rec.email)}
            />
            <CredentialField
              id={`password-${rec.id}`}
              label="Password"
              value={rec.password}
              copied={copied === "password"}
              onCopy={() => void copy("password", rec.password as string)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {rec.mailto && (
                <a href={rec.mailto} className={GHOST_BUTTON} title="Open in your default mail app">
                  <Mail size={13} aria-hidden="true" /> Mail app
                </a>
              )}
              {rec.gmailUrl && (
                <a
                  href={rec.gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full bg-[#8A5A2B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#754B22] ${FOCUS_RING}`}
                  title="Open Gmail compose in a new tab"
                >
                  <Mail size={13} aria-hidden="true" /> Open in Gmail
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={regenerating}
                className={GHOST_BUTTON}
                title="Issue a new password (invalidates the current one)"
              >
                <KeyRound size={13} aria-hidden="true" /> {regenerating ? "Issuing…" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={onForget}
                className={`inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 ${FOCUS_RING}`}
                title="Forget the stored password (the account stays approved; can't be recovered afterwards)"
              >
                <Trash2 size={13} aria-hidden="true" /> Forget
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CredentialField({
  id,
  label,
  value,
  copied,
  onCopy,
}: {
  id: string;
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#E5DDD0] bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[#8A5A2B] transition hover:bg-[#FDF5E6] ${FOCUS_RING}`}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check size={10} aria-hidden="true" /> : <Copy size={10} aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <input
        id={id}
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full select-all border-0 bg-transparent p-0 font-mono text-sm text-[#1B1208] outline-none"
      />
    </div>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-[#E5DDD0] bg-white/60 px-6 py-12 text-center">
      <Inbox size={28} className="mx-auto text-accent" aria-hidden="true" />
      <h2 className="mt-3 text-base font-bold text-[#1B1208]">No access requests</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        When a new student signs up, their request appears here for you to review. Approved accounts stay on this page
        with their login details until you remove them.
      </p>
    </section>
  );
}

function ListSkeleton() {
  const block = "rounded-xl bg-[#EFE8DC] motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading requests…
      </span>
      <div className="flex items-center justify-between gap-3">
        <div className={`h-8 w-56 ${block}`} />
        <div className={`hidden h-9 w-72 md:block ${block}`} />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className={`h-32 ${block}`} />
      ))}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default AccessRequestsPage;
