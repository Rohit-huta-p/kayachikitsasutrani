"use client";

import React from "react";
import type { WordEntry } from "./types";

interface Props {
  words: WordEntry[];
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  highlightedId?: string;
  onRowClick?: (id: string) => void;
}

function formatMs(seconds: number): string {
  return `${Math.round(seconds * 1000)} ms`;
}

const WordList: React.FC<Props> = ({ words, onTextChange, onRemove, highlightedId, onRowClick }) => {
  if (words.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic">
        Drag across the waveform to mark a word.
      </p>
    );
  }

  return (
    <ol className="space-y-1 text-sm">
      {words.map((w, i) => {
        const fullMissing = w.fullStart === null || w.fullEnd === null;
        const isHighlighted = w.id === highlightedId;
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
            <input
              type="text"
              value={w.text}
              onChange={(e) => onTextChange(w.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="word"
              className="flex-1 border px-2 py-0.5 rounded text-sm"
            />
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
              aria-label="Remove word"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default WordList;
