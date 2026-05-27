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
      prevStatus.current = status;
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
    <div
      data-line-index={index}
      className={`line-card border ${borderClass} bg-white/60 rounded-lg overflow-hidden scroll-mt-24`}
    >
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
