"use client";

import React, { useState } from "react";
import Waveform from "./Waveform";
import WordList from "./WordList";
import { useTimingState } from "./useTimingState";
import type { WordEntry } from "./types";

interface Props {
  lineAudioUrl?: string;
  /** Sanskrit line text — split into words; word labels derive from this. */
  sanskritLine: string;
  value: WordEntry[];
  onChange: (next: WordEntry[]) => void;
  /** Called when admin clicks a word row — used to focus the full-audio editor on this word. */
  onSelectWord?: (wordId: string | undefined) => void;
  /** Word id currently selected globally (e.g. for full-audio editing). */
  selectedWordId?: string;
}

function splitSanskrit(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

const TimingEditor: React.FC<Props> = ({
  lineAudioUrl,
  sanskritLine,
  value,
  onChange,
  onSelectWord,
  selectedWordId,
}) => {
  const { words, addFromLineRegion, updateLineRegion, remove, splitAtTime } = useTimingState(value, onChange);
  const sanskritWords = splitSanskrit(sanskritLine);
  const [lineError, setLineError] = useState<string | null>(null);
  const [lineTime, setLineTime] = useState(0);

  const lineRegions = words.map((w) => ({ id: w.id, start: w.lineStart, end: w.lineEnd }));

  const selectedWord = selectedWordId ? words.find((w) => w.id === selectedWordId) : undefined;
  const canSplit =
    !!selectedWord &&
    lineTime > selectedWord.lineStart + 0.01 &&
    lineTime < selectedWord.lineEnd - 0.01;

  const handleSplit = () => {
    if (selectedWordId) splitAtTime(selectedWordId, lineTime);
  };

  const handleDeleteSelected = () => {
    if (selectedWordId) {
      remove(selectedWordId);
      onSelectWord?.(undefined);
    }
  };

  const handleSelect = (id: string | undefined) => {
    onSelectWord?.(id);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Line waveform</div>
          {selectedWord && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSplit}
                disabled={!canSplit}
                title={
                  canSplit
                    ? `Split selected region at playhead (${lineTime.toFixed(2)}s)`
                    : "Move playhead INSIDE the selected region to split"
                }
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-brown text-brown bg-white/70 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>
                Split
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                title="Delete selected region (Backspace)"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-red-300 text-red-600 bg-white/70 hover:bg-red-50 transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Delete
              </button>
            </div>
          )}
        </div>
        {lineAudioUrl ? (
          <Waveform
            audioUrl={lineAudioUrl}
            regions={lineRegions}
            highlightedId={selectedWordId}
            onRegionCreate={(start, end) => {
              const id = addFromLineRegion(start, end);
              handleSelect(id);
              return id;
            }}
            onRegionUpdate={(id, start, end) => updateLineRegion(id, start, end)}
            onRegionClick={(id) => handleSelect(id)}
            onError={(msg) => setLineError(msg)}
            onTimeUpdate={setLineTime}
          />
        ) : (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
            Upload line audio to start marking words.
          </div>
        )}
        {lineError && <p className="text-xs text-red-600">Line audio: {lineError}</p>}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">
          Words ({words.length} / {sanskritWords.length})
        </div>
        <WordList
          words={words}
          sanskritWords={sanskritWords}
          onRemove={(id) => {
            remove(id);
            if (selectedWordId === id) handleSelect(undefined);
          }}
          highlightedId={selectedWordId}
          onRowClick={(id) => handleSelect(id)}
        />
      </div>
    </div>
  );
};

export default TimingEditor;
