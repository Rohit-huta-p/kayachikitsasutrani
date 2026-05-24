"use client";

import React, { useEffect, useState } from "react";
import Waveform from "./Waveform";
import WordList from "./WordList";
import { useTimingState } from "./useTimingState";
import type { WordEntry } from "./types";

interface Props {
  lineAudioUrl?: string;
  fullAudioUrl?: string;
  /** Sanskrit line text — split into words; word labels derive from this. */
  sanskritLine: string;
  value: WordEntry[];
  onChange: (next: WordEntry[]) => void;
}

function splitSanskrit(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

const TimingEditor: React.FC<Props> = ({ lineAudioUrl, fullAudioUrl, sanskritLine, value, onChange }) => {
  const { words, addFromLineRegion, updateLineRegion, setFullRegion, remove } =
    useTimingState(value, onChange);
  const sanskritWords = splitSanskrit(sanskritLine);
  const [highlightedId, setHighlightedId] = useState<string | undefined>();
  const [lineError, setLineError] = useState<string | null>(null);
  const [fullError, setFullError] = useState<string | null>(null);

  const lineRegions = words.map((w) => ({ id: w.id, start: w.lineStart, end: w.lineEnd }));
  const fullRegions = words
    .filter((w) => w.fullStart !== null && w.fullEnd !== null)
    .map((w) => ({ id: w.id, start: w.fullStart as number, end: w.fullEnd as number }));

  const fullMarkedCount = fullRegions.length;
  const firstUnmarkedFull = words.find((w) => w.fullStart === null || w.fullEnd === null);

  // Auto-select first unmarked word once admin finishes marking all line regions.
  // Helps the workflow: mark all line regions → editor pre-selects first word
  // missing on full audio so the next drag goes to the right place.
  useEffect(() => {
    if (!highlightedId && firstUnmarkedFull && lineRegions.length > 0) {
      setHighlightedId(firstUnmarkedFull.id);
    }
  }, [highlightedId, firstUnmarkedFull, lineRegions.length]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-semibold">Line waveform</div>
        {lineAudioUrl ? (
          <Waveform
            audioUrl={lineAudioUrl}
            regions={lineRegions}
            highlightedId={highlightedId}
            onRegionCreate={(start, end) => addFromLineRegion(start, end)}
            onRegionUpdate={(id, start, end) => updateLineRegion(id, start, end)}
            onRegionClick={(id) => setHighlightedId(id)}
            onError={(msg) => setLineError(msg)}
          />
        ) : (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
            Upload line audio to start marking words.
          </div>
        )}
        {lineError && <p className="text-xs text-red-600">Line audio: {lineError}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold">
            Full shloka audio — mark each word ({fullMarkedCount} / {words.length} marked)
          </div>
          {fullAudioUrl ? (
            <>
              {firstUnmarkedFull && (
                <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                  <span className="font-semibold">Next:</span> drag on the waveform below where{" "}
                  <span className="font-semibold text-brown">
                    {sanskritWords[words.indexOf(firstUnmarkedFull)] ?? "this word"}
                  </span>{" "}
                  appears in the full shloka audio.
                </div>
              )}
              {!firstUnmarkedFull && words.length > 0 && (
                <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
                  ✓ All words marked on full audio. Drag a region edge to adjust.
                </div>
              )}
              <Waveform
                audioUrl={fullAudioUrl}
                regions={fullRegions}
                highlightedId={highlightedId}
                onRegionCreate={(start, end) => {
                  // Full-waveform drags set the currently-highlighted word's
                  // full range. If no word is highlighted, drop the drag and
                  // show a tip.
                  if (highlightedId) {
                    setFullRegion(highlightedId, start, end);
                    setFullError(null);
                    // Auto-advance to next unmarked word so workflow stays smooth.
                    const idx = words.findIndex((w) => w.id === highlightedId);
                    const next = words.slice(idx + 1).find((w) => w.fullStart === null || w.fullEnd === null);
                    setHighlightedId(next?.id);
                    // Return null so Waveform removes the raw drag; the regions
                    // sync effect will render the correct region on next pass.
                    return null;
                  }
                  setFullError("Select a word from the list on the right first, then drag here.");
                  return null;
                }}
                onRegionUpdate={(id, start, end) => setFullRegion(id, start, end)}
                onRegionClick={(id) => setHighlightedId(id)}
                onError={(msg) => setFullError(msg)}
              />
            </>
          ) : (
            <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
              Upload full shloka audio (above) to mark word positions in the full track.
            </div>
          )}
          {fullError && <p className="text-xs text-red-600">Full audio: {fullError}</p>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">
            Words ({words.length} / {sanskritWords.length})
          </div>
          <WordList
            words={words}
            sanskritWords={sanskritWords}
            onRemove={remove}
            highlightedId={highlightedId}
            onRowClick={(id) => setHighlightedId(id)}
          />
        </div>
      </div>
    </div>
  );
};

export default TimingEditor;
