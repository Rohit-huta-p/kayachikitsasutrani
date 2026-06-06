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
  /** Undo/redo controls for word-timing edits. */
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Top-level error (e.g. backend submit failure). */
  error?: string | null;
  left: React.ReactNode;
  right?: React.ReactNode;
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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

          {(onUndo || onRedo) && (
            <div className="flex items-center gap-1 bg-white/60 border border-gray-200 rounded-lg px-1 py-0.5">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo || submitting}
                title="Undo (⌘Z)"
                aria-label="Undo"
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 text-brown"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 14l-4-4 4-4M5 10h11a4 4 0 014 4v0a4 4 0 01-4 4H9"/></svg>
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo || submitting}
                title="Redo (⌘⇧Z)"
                aria-label="Redo"
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 text-brown"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 14l4-4-4-4M19 10H8a4 4 0 00-4 4v0a4 4 0 004 4h6"/></svg>
              </button>
            </div>
          )}

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

      {/* Two-column grid (right column collapses if no right slot) */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className={`grid grid-cols-1 ${right ? "lg:grid-cols-12" : ""} gap-6`}>
          <div className={`${right ? "lg:col-span-7" : ""} space-y-4 stagger`}>{left}</div>
          {right && (
            <div className="lg:col-span-5 space-y-4">
              <div className="lg:sticky lg:top-20 space-y-4">{right}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditPageShell;
