"use client";

import React from "react";
import type { WordEntry } from "./types";

interface Props {
  words: WordEntry[];
  /** Words derived from splitting the line's Sanskrit text (source of truth). */
  sanskritWords: string[];
  onRemove: (id: string) => void;
  highlightedId?: string;
  onRowClick?: (id: string) => void;
}

function formatMs(seconds: number): string {
  return `${Math.round(seconds * 1000)} ms`;
}

const WordList: React.FC<Props> = ({ words, sanskritWords, onRemove, highlightedId, onRowClick }) => {
  const expected = sanskritWords.length;
  const marked = words.length;

  return (
    <div className="space-y-2">
      {expected === 0 && (
        <p className="text-xs text-amber-700 italic">
          Type the Sanskrit line above first — it splits into the words you&apos;ll mark.
        </p>
      )}

      {marked === 0 && expected > 0 && (
        <p className="text-xs text-gray-500 italic">
          Drag across the waveform to mark each word in order.
        </p>
      )}

      <ol className="space-y-1 text-sm">
        {words.map((w, i) => {
          const fullMissing = w.fullStart === null || w.fullEnd === null;
          const isHighlighted = w.id === highlightedId;
          const label = sanskritWords[i];
          const isExtra = label === undefined;
          return (
            <li
              key={w.id}
              onClick={() => onRowClick?.(w.id)}
              className={
                isHighlighted
                  ? "flex items-center gap-2 p-1 rounded bg-yellow-100 cursor-pointer"
                  : "flex items-center gap-2 p-1 rounded hover:bg-white/50 cursor-pointer"
              }
            >
              <span className="text-xs text-gray-500 w-6 shrink-0">#{i + 1}</span>
              <span
                className={
                  isExtra
                    ? "flex-1 px-2 py-0.5 text-sm text-red-700 italic"
                    : "flex-1 px-2 py-0.5 text-sm font-medium"
                }
              >
                {isExtra ? "(extra — no matching word in line)" : label}
              </span>
              <span className="text-xs text-gray-500 shrink-0" title="line duration">
                {formatMs(w.lineEnd - w.lineStart)}
              </span>
              {fullMissing && (
                <span title="Mark on full audio waveform" className="text-amber-600 text-sm">⚠</span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(w.id);
                }}
                className="text-red-600 text-xs"
                aria-label="Remove region"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ol>

      {marked > 0 && marked < expected && (
        <div className="text-xs text-amber-700">
          <p className="font-semibold">Still to mark ({expected - marked}):</p>
          <ol className="list-decimal list-inside">
            {sanskritWords.slice(marked).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
        </div>
      )}

      {marked > expected && expected > 0 && (
        <p className="text-xs text-red-700">
          {marked - expected} extra region(s) — remove them or add more words to the Sanskrit line above.
        </p>
      )}
    </div>
  );
};

export default WordList;
