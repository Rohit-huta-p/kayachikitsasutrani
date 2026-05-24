"use client";

import React from "react";
import AudioUploadField from "./AudioUploadField";
import type { ShlokaAssetInput } from "@/lib/auth/types";

export interface LineDraft {
  sanskrit: string;
  transliteration: string;
  audio?: ShlokaAssetInput;
  wordsJson: string;
  fullTimingsJson: string;
}

interface Props {
  index: number;
  line: LineDraft;
  onChange: (next: LineDraft) => void;
  onRemove: () => void;
}

const WORDS_PLACEHOLDER = `[
  { "text": "लङ्घनं", "start": 0.0, "end": 0.9 },
  { "text": "स्वेदनं", "start": 0.9, "end": 1.8 }
]`;

const LineEditor: React.FC<Props> = ({ index, line, onChange, onRemove }) => {
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

      <div className="space-y-1">
        <label className="text-sm font-semibold">Words timings (JSON, relative to line MP3)</label>
        <textarea
          value={line.wordsJson}
          onChange={(e) => update("wordsJson", e.target.value)}
          rows={6}
          className="w-full border px-2 py-1 rounded font-mono text-xs"
          placeholder={WORDS_PLACEHOLDER}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Full timings (JSON, relative to full MP3)</label>
        <textarea
          value={line.fullTimingsJson}
          onChange={(e) => update("fullTimingsJson", e.target.value)}
          rows={6}
          className="w-full border px-2 py-1 rounded font-mono text-xs"
          placeholder={WORDS_PLACEHOLDER}
        />
      </div>
    </div>
  );
};

export default LineEditor;
