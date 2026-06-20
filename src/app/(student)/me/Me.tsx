"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCompletions } from "@/lib/completions/CompletionsContext";
import { Pencil, LogOut, KeyRound, Check, X, Eye, EyeOff } from "lucide-react";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
import LottieLoader from "@/components/LottieLoader";
import { api } from "@/lib/api";

export default function Me() {
  const router = useRouter();
  const { state: authState, logout, refreshUser } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const { items: completions, loading, error } = useCompletions();

  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);

  const stats = useMemo(() => {
    const totalAttempts = completions.reduce((sum, c) => sum + c.attempts, 0);
    const bestRank = completions.length === 0
      ? null
      : completions.reduce((m, c) => (m === null || c.rank < m ? c.rank : m), null as number | null);
    return {
      completed: completions.length,
      attempts: totalAttempts,
      bestRank: bestRank === null ? "—" : `#${bestRank}`,
    };
  }, [completions]);

  const joinedDate = me
    ? new Date((me as { createdAt?: string }).createdAt || Date.now()).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "—";

  if (!me) {
    return <p className="p-6 text-sm text-gray-500">Not signed in.</p>;
  }

  return (
    <div>
      <TopBar subtitle="Your profile" title="Me" />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto md:max-w-2xl">
        {/* Avatar block */}
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
          <div className="flex justify-center">
            <AvatarCircle name={me.name} email={me.email} size={72} />
          </div>
          <div className="text-base font-bold text-brown mt-3">{me.name}</div>
          <div className="text-xs text-gray-500 mt-1">{me.email}</div>
        </div>

        {/* Info card / Edit form */}
        {editMode ? (
          <EditProfileForm
            me={me}
            onSaved={() => {
              setEditMode(false);
              refreshUser();
            }}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <>
            <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
              <Row label="College" value={(me as { collegeName?: string }).collegeName ?? "—"} />
              <Row label="Course" value={(me as { course?: string }).course ?? "—"} />
              <Row label="Joined" value={joinedDate} last />
            </div>

            {/* Stats card */}
            <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Your stats</div>
              {loading && <LottieLoader size={48} />}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!loading && !error && (
                <div className="flex justify-around text-center">
                  <div>
                    <div className="text-lg font-bold text-brown">{stats.completed}</div>
                    <div className="text-[10px] text-gray-500">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-brown">{stats.attempts}</div>
                    <div className="text-[10px] text-gray-500">Attempts</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-accent">{stats.bestRank}</div>
                    <div className="text-[10px] text-gray-500">Best rank</div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm font-semibold text-brown text-left hover:bg-[#FAF6EE] transition"
            >
              <Pencil size={14} className="inline mr-1.5" />
              Edit profile
            </button>
          </>
        )}

        {/* Change password */}
        {passwordMode ? (
          <ChangePasswordForm
            onDone={() => setPasswordMode(false)}
            onCancel={() => setPasswordMode(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPasswordMode(true)}
            className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm font-semibold text-brown text-left hover:bg-[#FAF6EE] transition"
          >
            <KeyRound size={14} className="inline mr-1.5" />
            Change password
          </button>
        )}

        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="bg-white border border-red-300 text-red-600 rounded-xl px-3 py-3 text-sm font-semibold text-left hover:bg-red-50 transition"
        >
          <LogOut size={14} className="inline mr-1.5" />
          Log out
        </button>
      </div>
    </div>
  );
}

function EditProfileForm({
  me,
  onSaved,
  onCancel,
}: {
  me: { name: string; collegeName?: string; course?: string; age?: number; gender?: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(me.name);
  const [collegeName, setCollegeName] = useState((me as { collegeName?: string }).collegeName ?? "");
  const [course, setCourse] = useState((me as { course?: string }).course ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      await api.me.updateProfile({
        name: name.trim(),
        collegeName: collegeName.trim() || undefined,
        course: course.trim() || undefined,
      });
      onSaved();
    } catch (e: unknown) {
      setErr((e as Error).message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-brown">Edit profile</div>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        <label className="text-xs text-gray-500">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-[#FAF6EE] border border-[#E5DDD0] rounded-lg px-3 py-2 text-sm text-brown outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-gray-500">
          College
          <input
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            className="mt-1 w-full bg-[#FAF6EE] border border-[#E5DDD0] rounded-lg px-3 py-2 text-sm text-brown outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-gray-500">
          Course
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="mt-1 w-full bg-[#FAF6EE] border border-[#E5DDD0] rounded-lg px-3 py-2 text-sm text-brown outline-none focus:border-accent"
          />
        </label>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-[#5C4033] text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-[#4A3728] transition disabled:opacity-50"
        >
          {saving ? "Saving…" : <><Check size={14} className="inline mr-1" /> Save</>}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-white border border-[#E5DDD0] text-sm font-semibold text-brown rounded-lg py-2.5 hover:bg-[#FAF6EE] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ChangePasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword) { setErr("Enter current password"); return; }
    if (newPassword.length < 8) { setErr("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setErr("Passwords do not match"); return; }
    setSaving(true);
    setErr("");
    try {
      await api.me.changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setTimeout(onDone, 1500);
    } catch (e: unknown) {
      setErr((e as Error).message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-brown">Change password</div>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      {success ? (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <Check size={16} className="inline mr-1" /> Password changed successfully
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            <label className="text-xs text-gray-500">
              Current password
              <div className="relative mt-1">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#FAF6EE] border border-[#E5DDD0] rounded-lg px-3 py-2 pr-10 text-sm text-brown outline-none focus:border-accent"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="text-xs text-gray-500">
              New password
              <div className="relative mt-1">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#FAF6EE] border border-[#E5DDD0] rounded-lg px-3 py-2 pr-10 text-sm text-brown outline-none focus:border-accent"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="text-xs text-gray-500">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full bg-[#FAF6EE] border border-[#E5DDD0] rounded-lg px-3 py-2 text-sm text-brown outline-none focus:border-accent"
              />
            </label>
          </div>
          {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-[#5C4033] text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-[#4A3728] transition disabled:opacity-50"
            >
              {saving ? "Changing…" : "Change password"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-white border border-[#E5DDD0] text-sm font-semibold text-brown rounded-lg py-2.5 hover:bg-[#FAF6EE] transition"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value}</span>
    </div>
  );
}
