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
  const { words, addFromLineRegion, updateLineRegion, remove } = useTimingState(value, onChange);
  const sanskritWords = splitSanskrit(sanskritLine);
  const [lineError, setLineError] = useState<string | null>(null);

  const lineRegions = words.map((w) => ({ id: w.id, start: w.lineStart, end: w.lineEnd }));

  const handleSelect = (id: string | undefined) => {
    onSelectWord?.(id);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-sm font-semibold">Line waveform</div>
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
