# Admin Shloka Edit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin shloka edit/create page to a two-column layout with a sticky top bar, collapsible line cards (status icons + color stripes), a sticky right-column full-audio editor + all-words sidebar, and CSS-only animations (pulse, fade-in, stagger, slide expand, chevron rotate, hover lift, progress meter ease).

**Architecture:** Three new presentational components (`EditPageShell`, `ShlokaInfoCard`, `LineCardHeader`) plus a refactor of `ShlokaForm` to compose them. `LineEditor` gets a collapsible body. `FullAudioEditor` adjusts styling for the sticky right column. Global CSS adds the animation keyframes and utility classes. Frontend only — no backend changes, no API contract changes.

**Tech Stack:** Existing Next.js 15 + React 19 + Tailwind 4 + TypeScript. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-25-admin-edit-redesign-design.md`
**Mockup:** `docs/superpowers/mockups/admin-shloka-edit.html`

**Working directory:** `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani/`
**Branch:** `main` (user is shipping directly to main per recent workflow)

---

## File Structure

**Create:**
- `src/app/admin/shlokas/components/EditPageShell.tsx` — sticky top bar + two-column grid wrapper
- `src/app/admin/shlokas/components/ShlokaInfoCard.tsx` — metadata read/edit card
- `src/app/admin/shlokas/components/LineCardHeader.tsx` — collapsed-state row

**Modify:**
- `src/app/globals.css` — append redesign CSS (animations + utilities)
- `src/app/admin/shlokas/components/LineEditor.tsx` — wrap body in collapsible
- `src/app/admin/shlokas/components/ShlokaForm.tsx` — compose new shell + cards, add dirty tracking, move save buttons to top bar
- `src/app/admin/shlokas/components/timing-editor/FullAudioEditor.tsx` — minor style tweaks (no logic change)
- `src/app/admin/shlokas/components/timing-editor/WordList.tsx` — selection ring / hover polish (no logic change)

**Delete:** none.

---

## Task 1: Global CSS — Animations + Utilities

**Files:**
- Modify: `src/app/globals.css` (append; do not replace)

- [ ] **Step 1: Read existing globals.css to know what's there**

```bash
cat src/app/globals.css | head -60
```

Note: keep all existing rules (Tailwind 4 + custom color vars). Append after them.

- [ ] **Step 2: Append redesign CSS**

Append this block to `src/app/globals.css`:

```css
/* ════════════════════════════════════════════════════════════════════════════
   Admin edit redesign — animations + utilities
   ════════════════════════════════════════════════════════════════════════════ */

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.3); }
}
@keyframes ring-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.5); }
  70%  { box-shadow: 0 0 0 8px rgba(217, 119, 6, 0); }
  100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
}

.anim-fade-in { animation: fade-in 280ms cubic-bezier(0.16, 1, 0.3, 1); }
.anim-pulse-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
.anim-ring-pulse { animation: ring-pulse 2.5s infinite; }

/* Card collapse / expand */
.collapsible-body {
  overflow: hidden;
  transition: max-height 360ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 240ms ease;
  max-height: 0;
  opacity: 0;
}
.collapsible-body.is-open {
  max-height: 2000px;
  opacity: 1;
}
.chev-rotate {
  transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
}
.chev-rotate.is-open {
  transform: rotate(90deg);
}

/* Cards */
.soft-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(2px);
  border: 1px solid rgba(124, 95, 60, 0.10);
  border-radius: 12px;
}
.line-card {
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}
.line-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 95, 60, 0.08);
}

/* Status icons */
.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: bold;
  transition: all 200ms ease;
  flex-shrink: 0;
}
.status-done  { background: #d1fae5; color: #047857; }
.status-warn  { background: #fef3c7; color: #92400e; }
.status-empty { background: #e5e7eb; color: #6b7280; }

/* Progress meter */
.meter-fill {
  transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Sticky top bar */
.sticky-bar {
  box-shadow: 0 1px 0 rgba(124, 95, 60, 0.08);
  backdrop-filter: blur(8px);
}

/* Stagger children entry */
.stagger > *      { animation: fade-in 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards; }
.stagger > *:nth-child(1) { animation-delay: 0ms; }
.stagger > *:nth-child(2) { animation-delay: 60ms; }
.stagger > *:nth-child(3) { animation-delay: 120ms; }
.stagger > *:nth-child(4) { animation-delay: 180ms; }
.stagger > *:nth-child(5) { animation-delay: 240ms; }

/* Word row select */
.word-row {
  transition: background 160ms ease, transform 160ms ease;
}
.word-row:hover { background: rgba(124, 95, 60, 0.06); }
.word-row.selected {
  background: #fef3c7;
  transform: translateX(2px);
}

/* Publish button glow */
.btn-publish {
  transition: all 200ms ease;
  box-shadow: 0 2px 6px rgba(74, 124, 74, 0.25);
}
.btn-publish:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(74, 124, 74, 0.35);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .anim-fade-in,
  .anim-pulse-dot,
  .anim-ring-pulse,
  .stagger > *,
  .meter-fill,
  .collapsible-body,
  .chev-rotate,
  .line-card,
  .word-row,
  .btn-publish {
    animation: none !important;
    transition-duration: 80ms !important;
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: clean (CSS-only change).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add redesign animations + utility classes (cards, status icons, progress)"
```

---

## Task 2: `LineCardHeader` Component

**Files:**
- Create: `src/app/admin/shlokas/components/LineCardHeader.tsx`

- [ ] **Step 1: Write the file**

Path: `src/app/admin/shlokas/components/LineCardHeader.tsx`:

```tsx
"use client";

import React from "react";

export type LineStatus = "done" | "warn" | "empty";

interface Props {
  index: number;
  status: LineStatus;
  /** Color stripe (line color, rgba). */
  stripeColor: string;
  /** Sanskrit preview (truncated by CSS). */
  sanskritPreview: string;
  /** Small stats — e.g. "2/2 words · full: 2/2" or "no audio yet" */
  stats: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const STATUS_GLYPH: Record<LineStatus, string> = { done: "✓", warn: "⚠", empty: "◯" };
const STATUS_CLASS: Record<LineStatus, string> = {
  done: "status-icon status-done",
  warn: "status-icon status-warn anim-ring-pulse",
  empty: "status-icon status-empty",
};
const LABEL_CLASS: Record<LineStatus, string> = {
  done: "font-semibold text-sm",
  warn: "font-semibold text-sm",
  empty: "font-semibold text-sm text-gray-500",
};
const STATS_CLASS: Record<LineStatus, string> = {
  done: "text-xs text-gray-500",
  warn: "text-xs text-amber-700",
  empty: "text-xs text-gray-400",
};

const LineCardHeader: React.FC<Props> = ({
  index,
  status,
  stripeColor,
  sanskritPreview,
  stats,
  expanded,
  onToggle,
  onRemove,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`Line ${index + 1}, ${status === "done" ? "complete" : status === "warn" ? "needs attention" : "empty"}, click to ${expanded ? "collapse" : "expand"}`}
      className="w-full flex items-center p-3 text-left"
    >
      <span className="self-stretch w-1 mr-3 rounded-sm" style={{ background: stripeColor }} aria-hidden="true" />
      <svg
        className={`chev-rotate w-4 h-4 text-gray-400 mr-2 ${expanded ? "is-open" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
      <span className={STATUS_CLASS[status]} aria-hidden="true">{STATUS_GLYPH[status]}</span>
      <div className="flex-1 min-w-0 ml-3">
        <div className="flex items-center gap-2">
          <span className={LABEL_CLASS[status]}>Line {index + 1}</span>
          <span className={STATS_CLASS[status]}>{stats}</span>
        </div>
        <div className={status === "empty" ? "text-sm text-gray-400 italic truncate" : "text-sm text-gray-700 truncate"}>
          {sanskritPreview || (status === "empty" ? "— upload line audio to start —" : "")}
        </div>
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onRemove(); } }}
        className="text-xs text-red-500 hover:text-red-700 ml-3 cursor-pointer"
      >
        Remove
      </span>
    </button>
  );
};

export default LineCardHeader;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/LineCardHeader.tsx
git commit -m "feat: LineCardHeader component (status icon, stripe, sanskrit preview, chevron)"
```

---

## Task 3: `ShlokaInfoCard` Component

**Files:**
- Create: `src/app/admin/shlokas/components/ShlokaInfoCard.tsx`

This card has two states: read-only summary (when all required fields filled) and an editable form (when "Edit" is clicked or when any required field is empty).

- [ ] **Step 1: Write the file**

Path: `src/app/admin/shlokas/components/ShlokaInfoCard.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import AudioUploadField from "./AudioUploadField";
import ImageUploadField from "./ImageUploadField";
import type { ShlokaAssetInput } from "@/lib/auth/types";

export interface ShlokaInfoValues {
  slug: string;
  title: string;
  meaning: string;
  translation: string;
  image?: ShlokaAssetInput;
  audioFull?: ShlokaAssetInput;
}

interface Props extends ShlokaInfoValues {
  /** Disable slug editing (used in edit mode). */
  slugDisabled?: boolean;
  onSlug: (v: string) => void;
  onTitle: (v: string) => void;
  onMeaning: (v: string) => void;
  onTranslation: (v: string) => void;
  onImage: (a: ShlokaAssetInput | undefined) => void;
  onAudioFull: (a: ShlokaAssetInput | undefined) => void;
}

function isComplete(v: ShlokaInfoValues): boolean {
  return Boolean(v.title.trim() && v.meaning.trim() && v.translation.trim() && v.audioFull);
}

const ShlokaInfoCard: React.FC<Props> = (props) => {
  const complete = isComplete(props);
  // Edit mode opens by default if anything's missing; otherwise summary view.
  const [editing, setEditing] = useState(!complete);

  // If parent props mutate to complete state, allow editing toggle but don't auto-collapse on edit
  // (user explicitly opened it).

  return (
    <div className="soft-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={complete ? "status-icon status-done" : "status-icon status-warn"}
            aria-label={complete ? "complete" : "incomplete"}
          >
            {complete ? "✓" : "!"}
          </span>
          <h2 className="text-base font-semibold text-brown">Shloka Info</h2>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-green hover:underline"
          >
            ✎ Edit
          </button>
        )}
        {editing && complete && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-green hover:underline"
          >
            Done
          </button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div className="text-gray-500">Slug</div>
          <div className="col-span-2 font-mono text-xs">{props.slug || "—"}</div>
          <div className="text-gray-500">Title</div>
          <div className="col-span-2">{props.title || "—"}</div>
          <div className="text-gray-500">Meaning</div>
          <div className="col-span-2 text-gray-700">{props.meaning || "—"}</div>
          <div className="text-gray-500">Translation</div>
          <div className="col-span-2 text-gray-700">{props.translation || "—"}</div>
          <div className="text-gray-500">Image</div>
          <div className="col-span-2 flex items-center gap-2">
            {props.image ? (
              <>
                <div className="relative w-12 h-9">
                  <Image src={props.image.url} alt="" fill className="object-cover rounded" sizes="48px" />
                </div>
                <span className="text-xs text-gray-500">uploaded</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">none</span>
            )}
          </div>
          <div className="text-gray-500">Full audio</div>
          <div className="col-span-2 text-xs">
            {props.audioFull ? "uploaded" : <span className="text-amber-700">not uploaded yet</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Slug</label>
            <input
              type="text"
              value={props.slug}
              onChange={(e) => props.onSlug(e.target.value)}
              disabled={props.slugDisabled}
              className="w-full border px-2 py-1 rounded disabled:bg-gray-100"
              placeholder="taruna-jwara"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Title</label>
            <input
              type="text"
              value={props.title}
              onChange={(e) => props.onTitle(e.target.value)}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Meaning</label>
            <textarea
              value={props.meaning}
              onChange={(e) => props.onMeaning(e.target.value)}
              rows={3}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Translation</label>
            <textarea
              value={props.translation}
              onChange={(e) => props.onTranslation(e.target.value)}
              rows={3}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <ImageUploadField label="Image (optional)" value={props.image} onChange={props.onImage} />
          <AudioUploadField label="Full audio (MP3)" value={props.audioFull} onChange={props.onAudioFull} />
        </div>
      )}
    </div>
  );
};

export default ShlokaInfoCard;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/ShlokaInfoCard.tsx
git commit -m "feat: ShlokaInfoCard component (read-only summary or inline edit form)"
```

---

## Task 4: `EditPageShell` Component

The sticky top bar + two-column grid wrapper. Takes children for left and right columns and exposes save buttons + progress + dirty state.

**Files:**
- Create: `src/app/admin/shlokas/components/EditPageShell.tsx`

- [ ] **Step 1: Write the file**

Path: `src/app/admin/shlokas/components/EditPageShell.tsx`:

```tsx
"use client";

import React from "react";
import Link from "next/link";

interface Props {
  title: string;
  /** Words marked on full audio. */
  marked: number;
  /** Total words across all lines. */
  total: number;
  /** True if any form change hasn't been saved yet. */
  dirty: boolean;
  /** True while submit is in-flight. */
  submitting: boolean;
  /** Reason Publish is disabled (shown as tooltip + below buttons when present). */
  disabledReason?: string;
  onSaveDraft: () => void;
  onPublish: () => void;
  /** Top-level error (e.g. backend submit failure). */
  error?: string | null;
  left: React.ReactNode;
  right: React.ReactNode;
}

const EditPageShell: React.FC<Props> = ({
  title,
  marked,
  total,
  dirty,
  submitting,
  disabledReason,
  onSaveDraft,
  onPublish,
  error,
  left,
  right,
}) => {
  const pct = total === 0 ? 0 : Math.round((marked / total) * 100);
  const publishDisabled = submitting || !!disabledReason;

  return (
    <div>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-primary-light sticky-bar">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <Link href="/admin/shlokas" className="text-sm text-green hover:underline flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Shlokas
          </Link>
          <span className="text-gray-400">/</span>
          <h1 className="text-lg font-semibold text-brown truncate max-w-[40%]">{title}</h1>

          {dirty && (
            <div className="flex items-center gap-1 ml-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 anim-pulse-dot" aria-hidden="true" />
              <span className="text-xs text-amber-700">unsaved</span>
            </div>
          )}

          <div className="flex-1" />

          {total > 0 && (
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-600">
              <span>Progress:</span>
              <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green meter-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-semibold text-green">{marked} / {total} words</span>
            </div>
          )}

          <button
            type="button"
            onClick={onSaveDraft}
            disabled={submitting}
            className="px-4 py-1.5 text-sm rounded-lg bg-white/60 border border-gray-300 hover:bg-white transition disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={publishDisabled}
            title={disabledReason}
            className="px-4 py-1.5 text-sm rounded-lg bg-green text-white btn-publish disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>

        {error && (
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4 stagger">{left}</div>
          <div className="lg:col-span-5 space-y-4">
            <div className="lg:sticky lg:top-20 space-y-4">{right}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPageShell;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/EditPageShell.tsx
git commit -m "feat: EditPageShell with sticky top bar, progress meter, two-col grid"
```

---

## Task 5: Refactor `LineEditor` to Use Collapsible Body + Header

**Files:**
- Modify: `src/app/admin/shlokas/components/LineEditor.tsx`

- [ ] **Step 1: Replace contents**

Path: `src/app/admin/shlokas/components/LineEditor.tsx`:

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import AudioUploadField from "./AudioUploadField";
import LineCardHeader, { type LineStatus } from "./LineCardHeader";
import TimingEditor from "./timing-editor/TimingEditor";
import type { WordEntry } from "./timing-editor/types";
import type { ShlokaAssetInput } from "@/lib/auth/types";

export interface LineDraft {
  sanskrit: string;
  transliteration: string;
  audio?: ShlokaAssetInput;
  words: WordEntry[];
}

interface Props {
  index: number;
  line: LineDraft;
  /** Forced open/closed state for accordion control (optional). */
  forceOpen?: boolean;
  onChange: (next: LineDraft) => void;
  onRemove: () => void;
  selectedWordId?: string;
  onSelectWord?: (wordId: string | undefined) => void;
  /** Color stripe (line-index color, rgba). */
  stripeColor: string;
}

const LINE_COLORS = [
  "rgba(124, 95, 60, 0.55)",
  "rgba(59, 130, 246, 0.55)",
  "rgba(34, 197, 94, 0.55)",
  "rgba(168, 85, 247, 0.55)",
  "rgba(234, 88, 12, 0.55)",
];

export function lineStripeColor(idx: number): string {
  return LINE_COLORS[idx % LINE_COLORS.length];
}

function deriveStatus(line: LineDraft): LineStatus {
  if (!line.audio) return "empty";
  if (line.words.length === 0) return "warn";
  const expected = line.sanskrit.split(/\s+/).filter(Boolean).length;
  if (line.words.length !== expected) return "warn";
  const allFull = line.words.every((w) => w.fullStart !== null && w.fullEnd !== null);
  if (!allFull) return "warn";
  return "done";
}

function statsText(line: LineDraft, status: LineStatus): string {
  if (status === "empty") return "no audio yet";
  const expected = line.sanskrit.split(/\s+/).filter(Boolean).length;
  const fullMarked = line.words.filter((w) => w.fullStart !== null && w.fullEnd !== null).length;
  if (status === "warn") {
    if (line.words.length === 0) return `0/${expected} words`;
    if (line.words.length !== expected) return `${line.words.length}/${expected} words`;
    return `${line.words.length}/${expected} words · full: ${fullMarked}/${line.words.length} pending`;
  }
  return `${line.words.length}/${expected} words · full: ${fullMarked}/${line.words.length}`;
}

const LineEditor: React.FC<Props> = ({
  index,
  line,
  forceOpen,
  onChange,
  onRemove,
  selectedWordId,
  onSelectWord,
  stripeColor,
}) => {
  const status = deriveStatus(line);
  // Default open if line is empty or partial; closed once done.
  const [open, setOpen] = useState<boolean>(forceOpen ?? status !== "done");
  const prevStatus = useRef<LineStatus>(status);

  // Auto-collapse 600ms after transitioning to done
  useEffect(() => {
    if (prevStatus.current !== "done" && status === "done") {
      const t = setTimeout(() => setOpen(false), 600);
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]);

  // Respect forceOpen if it changes
  useEffect(() => {
    if (typeof forceOpen === "boolean") setOpen(forceOpen);
  }, [forceOpen]);

  const update = <K extends keyof LineDraft>(key: K, val: LineDraft[K]) =>
    onChange({ ...line, [key]: val });

  const borderClass =
    status === "done" ? "border-green-300" : status === "warn" ? "border-amber-300" : "border-gray-200";

  return (
    <div className={`line-card border ${borderClass} bg-white/60 rounded-lg overflow-hidden`}>
      <LineCardHeader
        index={index}
        status={status}
        stripeColor={stripeColor}
        sanskritPreview={line.sanskrit}
        stats={statsText(line, status)}
        expanded={open}
        onToggle={() => setOpen((o) => !o)}
        onRemove={onRemove}
      />

      <div className={`collapsible-body ${open ? "is-open" : ""}`}>
        <div className="px-4 pb-4 pt-1 border-t border-gray-200 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Sanskrit (Devanagari)</label>
              <input
                type="text"
                value={line.sanskrit}
                onChange={(e) => update("sanskrit", e.target.value)}
                className="w-full border px-2 py-1 rounded"
                placeholder="लङ्घनं स्वेदनं ..."
              />
              <div className="text-xs text-gray-400">
                {line.sanskrit.split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Transliteration</label>
              <input
                type="text"
                value={line.transliteration}
                onChange={(e) => update("transliteration", e.target.value)}
                className="w-full border px-2 py-1 rounded"
                placeholder="laṅghanaṁ svēdanaṁ ..."
              />
            </div>
          </div>

          <AudioUploadField
            label="Line audio (MP3)"
            value={line.audio}
            onChange={(audio) => update("audio", audio)}
          />

          <TimingEditor
            lineAudioUrl={line.audio?.url}
            sanskritLine={line.sanskrit}
            value={line.words}
            onChange={(words) => update("words", words)}
            selectedWordId={selectedWordId}
            onSelectWord={onSelectWord}
          />
        </div>
      </div>
    </div>
  );
};

export default LineEditor;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: tsc may flag missing `stripeColor` prop calls in `ShlokaForm.tsx` (refactored in Task 7). That's expected. Do NOT fix here. Note in commit.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/LineEditor.tsx
git commit -m "refactor: LineEditor uses LineCardHeader + collapsible body + auto-collapse on done"
```

---

## Task 6: Polish `FullAudioEditor` Styling for Sticky Right Column

**Files:**
- Modify: `src/app/admin/shlokas/components/timing-editor/FullAudioEditor.tsx`

Only style changes. The component already exists; we re-skin the outer wrapper, add status icon to header, and improve the "Next:" banner styling so it matches the mockup.

- [ ] **Step 1: Read current file to know the existing structure**

```bash
cat src/app/admin/shlokas/components/timing-editor/FullAudioEditor.tsx | head -60
```

- [ ] **Step 2: Apply targeted style edits**

In the JSX, find the heading `<div className="text-sm font-semibold">` for the main title and replace it with a card-style header. Specifically, change the OUTER wrapper of the editor to be a `soft-card` and tighten the header layout.

Open the file. Find the early render block (after `if (!audioUrl)` for the empty state). Replace the section starting with `<div className="space-y-2">` (the main return block when audio exists) with:

```tsx
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-brown flex items-center gap-2">
          <span aria-hidden="true">🎵</span>
          Full shloka audio
        </h2>
        <div className="text-xs">
          <span className="font-semibold text-green">{markedCount}</span>
          <span className="text-gray-400"> / </span>
          <span className="text-gray-600">{totalWords}</span>
          <span className="text-gray-400"> marked</span>
        </div>
      </div>
```

(Continue with the rest of the existing return — the banner, the grid with waveform + sidebar — unchanged.)

Then also update the empty-state placeholder to match the styling:

Find `if (!audioUrl)` block and replace its return with:

```tsx
  if (!audioUrl) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-xs text-gray-500 bg-white/40">
        <p className="font-semibold text-brown mb-1">Full shloka audio</p>
        Upload the full shloka audio in the Info card above to mark word positions here.
      </div>
    );
  }
```

Update the "Next:" banner JSX block (the `{selectedWordId ? ... }` chain). Replace the `selectedWordId ?` arm with:

```tsx
        {selectedWordId ? (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 anim-fade-in">
            <span className="font-semibold">Next:</span> drag on the waveform where{" "}
            <span className="font-semibold text-brown">{selectedWordLabel}</span>
            {selectedWordLineIndex !== undefined && (
              <> (line {selectedWordLineIndex + 1})</>
            )}{" "}
            appears in the full audio.
          </div>
```

(`anim-fade-in` is new — comes from globals.css.)

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/shlokas/components/timing-editor/FullAudioEditor.tsx
git commit -m "style: polish FullAudioEditor for sticky right column (card header, fade-in banner)"
```

---

## Task 7: Refactor `ShlokaForm` to Use New Shell + Cards + Dirty Tracking

**Files:**
- Modify: `src/app/admin/shlokas/components/ShlokaForm.tsx`

This is the biggest task. It composes everything: the shell, the info card, the lines, the full-audio editor. Adds dirty tracking and computes the disabledReason for Publish.

- [ ] **Step 1: Replace contents**

Path: `src/app/admin/shlokas/components/ShlokaForm.tsx`:

```tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import LineEditor, { type LineDraft, lineStripeColor } from "./LineEditor";
import ShlokaInfoCard from "./ShlokaInfoCard";
import EditPageShell from "./EditPageShell";
import FullAudioEditor, { type FullRegionInput, type FullWordRow } from "./timing-editor/FullAudioEditor";
import type { WordEntry } from "./timing-editor/types";
import { makeWordId } from "./timing-editor/types";
import { api } from "@/lib/api";
import type { PublicShloka, ShlokaInput, ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  initial?: PublicShloka;
  onSaved: (s: PublicShloka) => void;
}

function toEntries(line: PublicShloka["lines"][number]): WordEntry[] {
  return line.words.map((w, k) => {
    const f = line.fullTimings[k];
    return {
      id: makeWordId(),
      text: w.text,
      lineStart: w.start,
      lineEnd: w.end,
      fullStart: f?.start ?? null,
      fullEnd: f?.end ?? null,
    };
  });
}

function toLineDraft(line: PublicShloka["lines"][number], audio?: ShlokaAssetInput): LineDraft {
  return {
    sanskrit: line.sanskrit,
    transliteration: line.transliteration,
    audio,
    words: toEntries(line),
  };
}

const emptyLine = (): LineDraft => ({
  sanskrit: "",
  transliteration: "",
  audio: undefined,
  words: [],
});

function splitSanskrit(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

const ShlokaForm: React.FC<Props> = ({ initial, onSaved }) => {
  const isEdit = !!initial;

  // ── Field state ───────────────────────────────────────────────────────
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [translation, setTranslation] = useState(initial?.translation ?? "");
  const [image, setImage] = useState<ShlokaAssetInput | undefined>(
    initial?.image ? { url: initial.image.url, publicId: initial.image.publicId ?? "" } : undefined,
  );
  const [audioFull, setAudioFull] = useState<ShlokaAssetInput | undefined>(
    initial?.audio.full
      ? { url: initial.audio.full.url, publicId: initial.audio.full.publicId ?? "" }
      : undefined,
  );
  const [lines, setLines] = useState<LineDraft[]>(
    initial
      ? initial.lines.map((l, i) =>
          toLineDraft(
            l,
            initial.audio.lines[i]
              ? { url: initial.audio.lines[i].url, publicId: initial.audio.lines[i].publicId ?? "" }
              : undefined,
          ),
        )
      : [emptyLine()],
  );
  const [selectedWordId, setSelectedWordId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Dirty tracking (compare to last-saved snapshot) ──────────────────
  const initialSnapshot = useRef(JSON.stringify({
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    meaning: initial?.meaning ?? "",
    translation: initial?.translation ?? "",
    image: initial?.image,
    audioFull: initial?.audio.full,
    lines: initial?.lines,
  }));
  const currentSnapshot = JSON.stringify({ slug, title, meaning, translation, image, audioFull, lines });
  const dirty = currentSnapshot !== initialSnapshot.current;

  const refreshSnapshot = () => {
    initialSnapshot.current = JSON.stringify({ slug, title, meaning, translation, image, audioFull, lines });
  };

  // ── Lines mutators ───────────────────────────────────────────────────
  const updateLine = (i: number, next: LineDraft) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // ── Full-audio aggregation ───────────────────────────────────────────
  const fullRegions = useMemo<FullRegionInput[]>(() => {
    const out: FullRegionInput[] = [];
    for (let li = 0; li < lines.length; li++) {
      const split = splitSanskrit(lines[li].sanskrit);
      lines[li].words.forEach((w, wi) => {
        if (w.fullStart !== null && w.fullEnd !== null) {
          out.push({
            id: w.id,
            start: w.fullStart,
            end: w.fullEnd,
            lineIndex: li,
            label: split[wi] ?? w.text ?? "?",
          });
        }
      });
    }
    return out;
  }, [lines]);

  const totalWords = useMemo(
    () => lines.reduce((sum, l) => sum + l.words.length, 0),
    [lines],
  );

  const fullMarkedCount = fullRegions.length;

  const allWords = useMemo<FullWordRow[]>(() => {
    const out: FullWordRow[] = [];
    for (let li = 0; li < lines.length; li++) {
      const split = splitSanskrit(lines[li].sanskrit);
      lines[li].words.forEach((w, wi) => {
        out.push({
          id: w.id,
          lineIndex: li,
          wordIndex: wi,
          label: split[wi] ?? w.text ?? "?",
          fullStart: w.fullStart,
          fullEnd: w.fullEnd,
        });
      });
    }
    return out;
  }, [lines]);

  const selectedMeta = useMemo(() => {
    if (!selectedWordId) return undefined;
    for (let li = 0; li < lines.length; li++) {
      const wi = lines[li].words.findIndex((w) => w.id === selectedWordId);
      if (wi !== -1) {
        const split = splitSanskrit(lines[li].sanskrit);
        return { lineIndex: li, wordIndex: wi, label: split[wi] ?? "?" };
      }
    }
    return undefined;
  }, [selectedWordId, lines]);

  const setFullForWord = (wordId: string, start: number, end: number) => {
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        words: l.words.map((w) =>
          w.id === wordId ? { ...w, fullStart: start, fullEnd: end } : w,
        ),
      })),
    );
    const flat: WordEntry[] = lines.flatMap((l) => l.words);
    const idx = flat.findIndex((w) => w.id === wordId);
    const next = flat.slice(idx + 1).find((w) => w.fullStart === null || w.fullEnd === null);
    setSelectedWordId(next?.id);
  };

  const clearFullForWord = (wordId: string) => {
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        words: l.words.map((w) =>
          w.id === wordId ? { ...w, fullStart: null, fullEnd: null } : w,
        ),
      })),
    );
  };

  // ── Validation gating ────────────────────────────────────────────────
  const disabledReason = useMemo<string | undefined>(() => {
    if (!isEdit && !slug.trim()) return "Slug is required";
    if (!title.trim()) return "Title is required";
    if (!meaning.trim()) return "Meaning is required";
    if (!translation.trim()) return "Translation is required";
    if (!audioFull) return "Full audio is required";
    if (lines.length === 0) return "At least one line is required";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.sanskrit.trim()) return `Line ${i + 1}: sanskrit is required`;
      if (!l.audio) return `Line ${i + 1}: audio is required`;
      const sw = splitSanskrit(l.sanskrit);
      if (l.words.length === 0) return `Line ${i + 1}: mark words on the waveform`;
      if (l.words.length !== sw.length) {
        return `Line ${i + 1}: ${l.words.length} regions but ${sw.length} words in sanskrit`;
      }
      for (let k = 0; k < l.words.length; k++) {
        const w = l.words[k];
        if (w.fullStart === null || w.fullEnd === null) {
          return `Line ${i + 1}: word "${sw[k]}" not marked on full audio`;
        }
      }
    }
    return undefined;
  }, [isEdit, slug, title, meaning, translation, audioFull, lines]);

  // ── Submit ───────────────────────────────────────────────────────────
  const submit = async (nextStatus: "draft" | "published") => {
    setError(null);
    // For draft: skip the full-audio + word-count validation; just need slug/title for new
    if (nextStatus === "draft") {
      if (!isEdit && !slug.trim()) return setError("Slug is required");
      if (!title.trim()) return setError("Title is required");
    } else {
      if (disabledReason) return setError(disabledReason);
    }

    const builtLines = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const sanskritWords = splitSanskrit(l.sanskrit);
      if (l.words.length > 0 && l.words.length !== sanskritWords.length && nextStatus === "published") {
        return setError(`Line ${i + 1}: regions/words count mismatch`);
      }
      builtLines.push({
        sanskrit: l.sanskrit,
        transliteration: l.transliteration,
        words: l.words.map((w, k) => ({
          text: sanskritWords[k] ?? w.text ?? "",
          start: w.lineStart,
          end: w.lineEnd,
        })),
        fullTimings: l.words.map((w, k) => ({
          text: sanskritWords[k] ?? w.text ?? "",
          start: (w.fullStart ?? w.lineStart),
          end: (w.fullEnd ?? w.lineEnd),
        })),
      });
    }

    const body: ShlokaInput = {
      slug,
      title,
      meaning,
      translation,
      status: nextStatus,
      audio: {
        full: audioFull ?? { url: "", publicId: "" },
        lines: lines.map((l) => l.audio ?? { url: "", publicId: "" }),
      },
      image,
      lines: builtLines,
    };

    // Backend will hard-fail on incomplete body if status=published. For drafts it accepts
    // partial timings. Our gating above prevents publishing incomplete data.
    if (nextStatus === "draft" && (!body.audio.full.url || body.audio.lines.some((a) => !a.url))) {
      // Backend requires audio.full.url and each line's audio. If admin tries to save draft
      // before uploading audio, surface a friendlier error.
      return setError("Upload the full audio and every line's audio before saving (draft or publish).");
    }

    setSubmitting(true);
    try {
      const saved =
        isEdit && initial
          ? await api.admin.shlokas.update(initial.id, body)
          : await api.admin.shlokas.create(body);
      refreshSnapshot();
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Refresh snapshot when initial prop changes (e.g. edit page finishes loading)
  useEffect(() => {
    if (initial) {
      refreshSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  return (
    <EditPageShell
      title={title || (isEdit ? "Edit shloka" : "New shloka")}
      marked={fullMarkedCount}
      total={totalWords}
      dirty={dirty}
      submitting={submitting}
      disabledReason={disabledReason}
      onSaveDraft={() => void submit("draft")}
      onPublish={() => void submit("published")}
      error={error}
      left={
        <>
          <ShlokaInfoCard
            slug={slug}
            title={title}
            meaning={meaning}
            translation={translation}
            image={image}
            audioFull={audioFull}
            slugDisabled={isEdit}
            onSlug={setSlug}
            onTitle={setTitle}
            onMeaning={setMeaning}
            onTranslation={setTranslation}
            onImage={setImage}
            onAudioFull={setAudioFull}
          />

          <div className="soft-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-brown">Lines</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green font-medium">
                  {fullMarkedCount} / {totalWords} words timed
                </span>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="text-xs px-2 py-1 rounded bg-brown text-white hover:opacity-90 transition"
              >
                + Add line
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((l, i) => (
                <LineEditor
                  key={i}
                  index={i}
                  line={l}
                  stripeColor={lineStripeColor(i)}
                  onChange={(next) => updateLine(i, next)}
                  onRemove={() => removeLine(i)}
                  selectedWordId={selectedWordId}
                  onSelectWord={(id) => setSelectedWordId(id)}
                />
              ))}
            </div>
          </div>
        </>
      }
      right={
        <FullAudioEditor
          audioUrl={audioFull?.url}
          regions={fullRegions}
          allWords={allWords}
          totalWords={totalWords}
          selectedWordId={selectedWordId}
          selectedWordLabel={selectedMeta?.label}
          selectedWordLineIndex={selectedMeta?.lineIndex}
          onRegionAssign={(id, start, end) => setFullForWord(id, start, end)}
          onRegionUpdate={(id, start, end) => setFullForWord(id, start, end)}
          onRegionClick={(id) => setSelectedWordId(id)}
          onClearFull={clearFullForWord}
        />
      }
    />
  );
};

export default ShlokaForm;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/ShlokaForm.tsx
git commit -m "refactor: ShlokaForm uses EditPageShell, ShlokaInfoCard, dirty tracking, publish gating"
```

---

## Task 8: Trim Container Padding on Edit / New Pages

Edit and New pages currently wrap the form with their own `<div class="p-10">`. The new shell brings its own container — remove the wrapping to avoid double padding.

**Files:**
- Modify: `src/app/admin/shlokas/new/NewShlokaPage.tsx`
- Modify: `src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx`

- [ ] **Step 1: Update `NewShlokaPage.tsx`**

Path: `src/app/admin/shlokas/new/NewShlokaPage.tsx`:

```tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ShlokaForm from "../components/ShlokaForm";

const NewShlokaPage: React.FC = () => {
  const router = useRouter();
  return <ShlokaForm onSaved={() => router.push("/admin/shlokas")} />;
};

export default NewShlokaPage;
```

- [ ] **Step 2: Update `EditShlokaPage.tsx`**

Path: `src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ShlokaForm from "../../components/ShlokaForm";
import { api } from "@/lib/api";
import type { PublicShloka, ApiError } from "@/lib/auth/types";

const EditShlokaPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [shloka, setShloka] = useState<PublicShloka | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.admin.shlokas.get(id)
      .then((s) => { if (!cancelled) setShloka(s); })
      .catch((e: ApiError) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="p-10 text-red-600">{error}</div>;
  if (!shloka) return <div className="p-10 text-brown">Loading…</div>;

  return <ShlokaForm initial={shloka} onSaved={() => router.push("/admin/shlokas")} />;
};

export default EditShlokaPage;
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/shlokas/new/NewShlokaPage.tsx "src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx"
git commit -m "refactor: drop manual page wrapper — ShlokaForm + EditPageShell own the layout"
```

---

## Task 9: Build / Lint / Tsc Verification

**Files:** none (verification step)

- [ ] **Step 1: Clear cache, run all checks**

```bash
rm -rf .next
npx tsc --noEmit
npm run lint 2>&1 | tail -20
npm run build 2>&1 | tail -25
```

Expected:
- tsc: clean
- lint: only pre-existing warnings (no new errors)
- build: succeeds

If build fails:
- "Module not found" → import path typo. Check the new component file paths in `ShlokaForm.tsx`.
- Unused import warnings → remove orphaned imports from the old `ShlokaForm.tsx` (e.g. `AudioUploadField`, `ImageUploadField` no longer imported here since `ShlokaInfoCard` uses them).

If any cleanup is needed:

```bash
git add -A
git commit -m "chore: post-build cleanup"
```

---

## Task 10: End-to-End Manual QA

Manual verification. No code changes unless a bug surfaces. Backend + frontend running.

**Prereqs:**
- Backend running (deployed Render or local on :4000)
- Frontend running (local `npm run dev` on :3000 — for fastest iteration use local)
- Admin already seeded
- At least one existing shloka in the DB

- [ ] **Step 1: Visit `/admin/shlokas/new`**

Expected: two-column layout. Left: ShlokaInfoCard (in edit mode, since fields empty) + Lines section with one empty Line 1 card. Right: empty-state for FullAudioEditor.

- [ ] **Step 2: Fill out info**

Type slug, title, meaning, translation. Upload image. Upload full audio. Click "Done" link on the info card.

Expected: card collapses to read-only summary with ✓ status icon.

- [ ] **Step 3: Open Line 1 + mark words**

Line 1 should already be expanded (since `status === 'empty'` → defaults open).

- Type Sanskrit: `लङ्घनं स्वेदनं`
- Upload line audio
- Drag two regions on line waveform → words sidebar populates with two labeled rows (`#1 लङ्घनं`, `#2 स्वेदनं`)
- Status icon changes to ⚠ (still pending full-audio)

- [ ] **Step 4: Mark on full audio (right column)**

Right column shows the full waveform. Click a word in the "All words" sidebar → drag on full waveform → that word gets a region → auto-advances to next.

Expected: progress meter in top bar grows. After all marked, status icon flips to ✓ and Line 1 auto-collapses after ~600ms.

- [ ] **Step 5: Add a Line 2**

Click "+ Add Line" → new empty card appears, expanded.

- [ ] **Step 6: Save Draft**

Click "Save Draft" in sticky top bar.

Expected: redirects to `/admin/shlokas`, new row visible with status "draft".

- [ ] **Step 7: Edit the new shloka**

Click "Edit" on the list. Expected:
- Layout loads
- Info card opens in read-only summary (since required fields filled)
- Line 1 auto-collapsed (✓ status), Line 2 expanded (still partial)
- Unsaved dot NOT present
- Progress meter shows correct ratio

- [ ] **Step 8: Make any change**

Type a character in the title.

Expected: "● unsaved" amber dot appears in top bar.

- [ ] **Step 9: Publish flow**

Complete Line 2 (sanskrit + audio + words + full timings). Click Publish.

Expected: button enables only when all conditions met. Tooltip on disabled state lists the blocker. Publish redirects to /admin/shlokas; new row shows "published".

- [ ] **Step 10: Reduced motion test**

In OS settings (macOS: System Settings → Accessibility → Display → Reduce motion), enable. Reload the edit page.

Expected: no pulsing dot, no ring pulse on warn icons, no stagger; transitions still happen but very brief (~80ms).

- [ ] **Step 11: Mobile width test**

In DevTools, switch to a narrow viewport (~375px).

Expected: columns stack — info card, lines, then full-audio editor (no longer sticky). Top bar wraps gracefully.

- [ ] **Step 12: Report**

If anything fails, file the bug here; the controller dispatches a fix subagent.

---

## Verification Checklist

After all tasks complete:

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` no new errors
- [ ] `npm run build` succeeds
- [ ] Manual QA passes Tasks 10 above
- [ ] Existing functionality preserved (word marking, audio playback, validation, delete)
