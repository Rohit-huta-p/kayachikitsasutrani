"use client";

import React, { useState } from "react";
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
          <div className="text-sm font-semibold">Full audio (this line&apos;s words)</div>
          {fullAudioUrl ? (
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
                  // Return null so Waveform removes the raw drag; the regions
                  // sync effect will render the correct region on next pass.
                  return null;
                }
                setFullError("Select a word from the list first, then drag here.");
                return null;
              }}
              onRegionUpdate={(id, start, end) => setFullRegion(id, start, end)}
              onRegionClick={(id) => setHighlightedId(id)}
              onError={(msg) => setFullError(msg)}
            />
          ) : (
            <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
              Upload full shloka audio to mark word positions in the full track.
            </div>
          )}
          {fullError && <p className="text-xs text-red-600">Full audio: {fullError}</p>}
          <p className="text-xs text-gray-500 italic">
            Tip: select a word in the list, then drag on this waveform to set its full-MP3 position.
          </p>
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
