"use client";

import React, { useState } from "react";
import Waveform from "./Waveform";

export interface FullRegionInput {
  /** WordEntry id */
  id: string;
  start: number;
  end: number;
  /** 0-based line index this word belongs to (for color grouping). */
  lineIndex: number;
  /** Display label (Sanskrit word). */
  label: string;
}

/** Every word across the shloka, with optional full-audio marker. */
export interface FullWordRow {
  id: string;
  lineIndex: number;
  wordIndex: number;
  label: string;
  fullStart: number | null;
  fullEnd: number | null;
}

interface Props {
  audioUrl?: string;
  /** Words across all lines that have full positions set (rendered as regions on waveform). */
  regions: FullRegionInput[];
  /** Every word across all lines (rendered as the sidebar list). */
  allWords: FullWordRow[];
  /** Total word count across all lines (for progress display). */
  totalWords: number;
  /** Currently selected word (the next drag will set this word's full range). */
  selectedWordId?: string;
  selectedWordLabel?: string;
  selectedWordLineIndex?: number;
  onRegionAssign: (wordId: string, start: number, end: number) => void;
  onRegionUpdate: (wordId: string, start: number, end: number) => void;
  onRegionClick: (wordId: string) => void;
  onClearFull: (wordId: string) => void;
}

// Color palette by line index (cycle through if more lines than colors)
const LINE_COLORS = [
  "rgba(124, 95, 60, 0.30)",   // brown
  "rgba(59, 130, 246, 0.30)",  // blue
  "rgba(34, 197, 94, 0.30)",   // green
  "rgba(168, 85, 247, 0.30)",  // purple
  "rgba(234, 88, 12, 0.30)",   // orange
];

function colorForLine(idx: number): string {
  return LINE_COLORS[idx % LINE_COLORS.length];
}

function formatMs(seconds: number): string {
  return `${Math.round(seconds * 1000)} ms`;
}

const FullAudioEditor: React.FC<Props> = ({
  audioUrl,
  regions,
  allWords,
  totalWords,
  selectedWordId,
  selectedWordLabel,
  selectedWordLineIndex,
  onRegionAssign,
  onRegionUpdate,
  onRegionClick,
  onClearFull,
}) => {
  const [error, setError] = useState<string | null>(null);
  const markedCount = regions.length;
  const allMarked = markedCount === totalWords && totalWords > 0;

  if (!audioUrl) {
    return (
      <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
        Upload the full shloka audio above to mark word positions across all lines here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">
        Full shloka audio — mark each word ({markedCount} / {totalWords} marked)
      </div>

      {selectedWordId ? (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
          <span className="font-semibold">Next:</span> drag on the waveform where{" "}
          <span className="font-semibold text-brown">{selectedWordLabel}</span>
          {selectedWordLineIndex !== undefined && (
            <> (line {selectedWordLineIndex + 1})</>
          )}{" "}
          appears in the full audio.
        </div>
      ) : allMarked ? (
        <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
          ✓ All words marked on full audio. Drag a region edge to adjust.
        </div>
      ) : totalWords > 0 ? (
        <div className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
          Click a word in the list (right) or in any line below to select it, then drag here to mark.
        </div>
      ) : (
        <div className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
          Mark words on each line first (waveforms below), then come back here to set their positions in the full audio.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Waveform
            audioUrl={audioUrl}
            regions={regions.map((r) => ({ id: r.id, start: r.start, end: r.end }))}
            highlightedId={selectedWordId}
            height={100}
            onRegionCreate={(start, end) => {
              if (!selectedWordId) {
                setError("Click a word from the list first, then drag here.");
                return null;
              }
              onRegionAssign(selectedWordId, start, end);
              setError(null);
              return null;
            }}
            onRegionUpdate={(id, start, end) => onRegionUpdate(id, start, end)}
            onRegionClick={(id) => onRegionClick(id)}
            onError={(msg) => setError(msg)}
          />

          {totalWords > 0 && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              {Array.from(new Set(allWords.map((w) => w.lineIndex)))
                .sort((a, b) => a - b)
                .map((li) => (
                  <span key={li} className="flex items-center gap-1">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: colorForLine(li) }}
                    />
                    Line {li + 1}
                  </span>
                ))}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">All words ({markedCount} / {totalWords})</div>
          {allWords.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              No words yet. Mark them on the line waveforms below first.
            </p>
          ) : (
            <ol className="space-y-1 text-sm max-h-96 overflow-y-auto">
              {allWords.map((w) => {
                const marked = w.fullStart !== null && w.fullEnd !== null;
                const isSelected = w.id === selectedWordId;
                return (
                  <li
                    key={w.id}
                    onClick={() => onRegionClick(w.id)}
                    className={
                      isSelected
                        ? "flex items-center gap-2 p-1 rounded bg-yellow-100 cursor-pointer"
                        : "flex items-center gap-2 p-1 rounded hover:bg-white/60 cursor-pointer"
                    }
                  >
                    <span
                      className="inline-block w-2 h-4 rounded-sm shrink-0"
                      style={{ backgroundColor: colorForLine(w.lineIndex) }}
                      title={`Line ${w.lineIndex + 1}`}
                    />
                    <span className="text-xs text-gray-500 w-10 shrink-0">
                      L{w.lineIndex + 1}#{w.wordIndex + 1}
                    </span>
                    <span className="flex-1 px-1 text-sm font-medium">{w.label}</span>
                    {marked ? (
                      <span className="text-xs text-gray-500 shrink-0" title="full-audio duration">
                        {formatMs((w.fullEnd as number) - (w.fullStart as number))}
                      </span>
                    ) : (
                      <span className="text-amber-600 text-xs italic shrink-0">not marked</span>
                    )}
                    {marked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearFull(w.id);
                        }}
                        className="text-red-600 text-xs"
                        aria-label="Clear full-audio mark"
                        title="Clear full-audio mark"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullAudioEditor;
export { colorForLine };
