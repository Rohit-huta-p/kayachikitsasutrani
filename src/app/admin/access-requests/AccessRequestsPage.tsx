"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  GraduationCap,
  Inbox,
  Mail,
  RefreshCw,
  School,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AccessRequest, AcceptedAccessRequest } from "@/lib/auth/types";

/**
 * Admin page for reviewing access requests.
 *
 * Pending requests are listed with the profile details the user submitted
 * (name, age, gender, college, course, email, submission time). The admin
 * can:
 *   - "Accept" — server generates a fresh password, marks the user
 *     active, and returns a pre-built mailto link + the plaintext password
 *     once. The card flips to an "approved" panel showing the password
 *     with a Copy button and a Send Email button that opens the user's
 *     default mail client with the credentials pre-filled.
 *   - "Reject" — server deletes the request entirely.
 *
 * The plaintext password is never persisted on the client; it lives only
 * inside the per-request `accepted` state until the admin closes the
 * panel.
 */
const AccessRequestsPage = () => {
  const [items, setItems] = useState<AccessRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Map<requestId, AcceptedAccessRequest> — present once a request has
  // been accepted on this page so we can render the credential panel.
  const [accepted, setAccepted] = useState<Record<string, AcceptedAccessRequest>>({});
  // Per-row in-flight flag so the user can't double-click Accept/Reject.
  const [busy, setBusy] = useState<Record<string, "accept" | "reject" | null>>({});

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await api.admin.accessRequests.list();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load access requests");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAccept = async (req: AccessRequest) => {
    setBusy((b) => ({ ...b, [req.id]: "accept" }));
    setError(null);
    try {
      const res = await api.admin.accessRequests.accept(req.id);
      setAccepted((a) => ({ ...a, [req.id]: res }));
      // Keep the row in the list so the credential panel stays visible
      // beneath it; the row's UI switches to the approved state.
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

  const dismissAccepted = (id: string) => {
    setAccepted((a) => {
      const { [id]: _drop, ...rest } = a;
      void _drop;
      return rest;
    });
    setItems((prev) => (prev ?? []).filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-brown text-white px-4 py-4 md:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} />
            <div>
              <h1 className="font-bold text-base md:text-lg">Access requests</h1>
              <p className="text-xs text-white/75">
                Approve or reject signup requests from new students.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 transition rounded-full px-3 py-1.5 disabled:opacity-60"
            aria-label="Refresh list"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {items === null ? (
          <p className="text-sm text-brown/70 italic">Loading requests…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5DDD0] bg-white p-8 text-center">
            <Inbox size={32} className="mx-auto text-brown/40" />
            <p className="mt-3 text-sm font-semibold text-brown">No pending requests</p>
            <p className="text-xs text-gray-500 mt-1">
              When a new student signs up, their request will appear here for review.
            </p>
          </div>
        ) : (
          items.map((req) => {
            const ack = accepted[req.id];
            const rowBusy = busy[req.id];
            return (
              <article
                key={req.id}
                className="rounded-xl border border-[#E5DDD0] bg-white shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-bold text-brown text-base truncate">
                        {req.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{req.email}</div>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5">
                      {ack ? "Approved" : "Pending"}
                    </span>
                  </div>

                  {/* Details */}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <DetailRow icon={<User size={12} />} label="Age">
                      {req.age ?? "—"}
                    </DetailRow>
                    <DetailRow icon={<User size={12} />} label="Gender">
                      {req.gender ? capitalize(req.gender) : "—"}
                    </DetailRow>
                    <DetailRow icon={<School size={12} />} label="College">
                      {req.collegeName ?? "—"}
                    </DetailRow>
                    <DetailRow icon={<GraduationCap size={12} />} label="Course">
                      {req.course ?? "—"}
                    </DetailRow>
                    <DetailRow icon={<Mail size={12} />} label="Submitted" colSpan>
                      {formatDate(req.createdAt)}
                    </DetailRow>
                  </dl>
                </div>

                {/* Action row OR approval panel */}
                {!ack ? (
                  <div className="border-t border-[#E5DDD0] bg-[#FBF5E8]/60 px-4 py-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReject(req)}
                      disabled={!!rowBusy}
                      className="text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <X size={12} /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAccept(req)}
                      disabled={!!rowBusy}
                      className="text-xs font-semibold text-white bg-accent rounded-full px-3 py-1.5 hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check size={12} />
                      {rowBusy === "accept" ? "Approving…" : "Accept"}
                    </button>
                  </div>
                ) : (
                  <ApprovedPanel
                    ack={ack}
                    onDismiss={() => dismissAccepted(req.id)}
                  />
                )}
              </article>
            );
          })
        )}
      </main>
    </div>
  );
};

function DetailRow({
  icon,
  label,
  children,
  colSpan,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${colSpan ? "sm:col-span-2" : ""}`}>
      <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold flex items-center gap-1 shrink-0 w-[80px]">
        <span className="text-brown/70">{icon}</span>
        {label}
      </dt>
      <dd className="text-brown truncate">{children}</dd>
    </div>
  );
}

function ApprovedPanel({
  ack,
  onDismiss,
}: {
  ack: AcceptedAccessRequest;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ack.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback: just select the text in the readonly input via DOM.
      const input = document.getElementById(`pw-${ack.id}`) as HTMLInputElement | null;
      input?.select();
    }
  };

  return (
    <div className="border-t border-green-200 bg-gradient-to-b from-green-50/70 to-amber-50/40 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white">
          <Check size={11} strokeWidth={3} />
        </span>
        <p className="text-xs font-semibold text-green-900">
          Account approved. Share these credentials with {ack.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg bg-white border border-[#E5DDD0] px-2.5 py-2">
          <div className="text-[10px] uppercase text-gray-500 tracking-wider">Email</div>
          <div className="text-sm text-brown font-mono break-all">{ack.email}</div>
        </div>
        <div className="rounded-lg bg-white border border-[#E5DDD0] px-2.5 py-2">
          <div className="flex items-center justify-between gap-1">
            <div className="text-[10px] uppercase text-gray-500 tracking-wider">Password</div>
            <button
              type="button"
              onClick={() => void copy()}
              className="text-[10px] flex items-center gap-1 text-brown hover:bg-accent-soft px-1.5 py-0.5 rounded transition"
              aria-label="Copy password"
            >
              <Copy size={10} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <input
            id={`pw-${ack.id}`}
            readOnly
            value={ack.password}
            className="w-full text-sm text-brown font-mono bg-transparent border-0 outline-none p-0 select-all"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-gray-500 italic">
          This password is shown once. Copy it now or send the email below — you
          won&apos;t be able to retrieve it again.
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-brown bg-white border border-[#E5DDD0] rounded-full px-3 py-1.5 hover:bg-accent-soft transition"
          >
            Done
          </button>
          <a
            href={ack.mailto}
            className="text-[11px] font-semibold text-white bg-accent rounded-full px-3 py-1.5 hover:opacity-90 transition flex items-center gap-1.5"
          >
            <Mail size={12} /> Send email
          </a>
        </div>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
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
