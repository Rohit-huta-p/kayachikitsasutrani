"use client";

import React from "react";
import AudioUploadField from "./AudioUploadField";
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
  onChange: (next: LineDraft) => void;
  onRemove: () => void;
  selectedWordId?: string;
  onSelectWord?: (wordId: string | undefined) => void;
}

const LineEditor: React.FC<Props> = ({
  index,
  line,
  onChange,
  onRemove,
  selectedWordId,
  onSelectWord,
}) => {
  const update = <K extends keyof LineDraft>(key: K, val: LineDraft[K]) =>
    onChange({ ...line, [key]: val });

  return (
    <div className="border border-gray-300 rounded p-4 space-y-3 bg-white/40">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-brown">Line {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 underline"
        >
          Remove line
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Sanskrit (Devanagari)</label>
        <input
          type="text"
          value={line.sanskrit}
          onChange={(e) => update("sanskrit", e.target.value)}
          className="w-full border px-2 py-1 rounded"
          placeholder="लङ्घनं स्वेदनं ..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Transliteration</label>
        <input
          type="text"
          value={line.transliteration}
          onChange={(e) => update("transliteration", e.target.value)}
          className="w-full border px-2 py-1 rounded"
          placeholder="laṅghanaṁ svēdanaṁ ..."
        />
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
  );
};

export default LineEditor;
