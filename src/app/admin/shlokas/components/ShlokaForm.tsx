"use client";

import React, { useState } from "react";
import AudioUploadField from "./AudioUploadField";
import ImageUploadField from "./ImageUploadField";
import LineEditor, { type LineDraft } from "./LineEditor";
import { api } from "@/lib/api";
import type { PublicShloka, ShlokaInput, ShlokaAssetInput, WordTiming } from "@/lib/auth/types";

interface Props {
  initial?: PublicShloka;
  onSaved: (s: PublicShloka) => void;
}

function toLineDraft(line: PublicShloka["lines"][number], audio?: ShlokaAssetInput): LineDraft {
  return {
    sanskrit: line.sanskrit,
    transliteration: line.transliteration,
    audio,
    wordsJson: JSON.stringify(line.words, null, 2),
    fullTimingsJson: JSON.stringify(line.fullTimings, null, 2),
  };
}

function parseTimings(json: string): WordTiming[] | { error: string } {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return { error: "Timings must be a JSON array" };
    for (const w of parsed) {
      if (typeof w?.text !== "string" || typeof w?.start !== "number" || typeof w?.end !== "number") {
        return { error: "Each timing must have text (string), start (number), end (number)" };
      }
    }
    return parsed as WordTiming[];
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

const emptyLine = (): LineDraft => ({
  sanskrit: "",
  transliteration: "",
  audio: undefined,
  wordsJson: "[]",
  fullTimingsJson: "[]",
});

const ShlokaForm: React.FC<Props> = ({ initial, onSaved }) => {
  const isEdit = !!initial;
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [translation, setTranslation] = useState(initial?.translation ?? "");
  const [status, setStatus] = useState<"draft" | "published">(initial?.status ?? "draft");
  const [image, setImage] = useState<ShlokaAssetInput | undefined>(
    initial?.image ? { url: initial.image.url, publicId: initial.image.publicId ?? "" } : undefined,
  );
  const [audioFull, setAudioFull] = useState<ShlokaAssetInput | undefined>(
    initial?.audio.full ? { url: initial.audio.full.url, publicId: initial.audio.full.publicId ?? "" } : undefined,
  );
  const [lines, setLines] = useState<LineDraft[]>(
    initial
      ? initial.lines.map((l, i) =>
          toLineDraft(l, initial.audio.lines[i] ? { url: initial.audio.lines[i].url, publicId: initial.audio.lines[i].publicId ?? "" } : undefined),
        )
      : [emptyLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (i: number, next: LineDraft) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const submit = async (nextStatus?: "draft" | "published") => {
    setError(null);
    const finalStatus = nextStatus ?? status;
    if (!slug.trim() && !isEdit) return setError("Slug is required");
    if (!title.trim()) return setError("Title is required");
    if (!meaning.trim()) return setError("Meaning is required");
    if (!translation.trim()) return setError("Translation is required");
    if (!audioFull) return setError("Full audio is required");
    if (lines.length === 0) return setError("At least one line is required");

    const parsedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.sanskrit.trim()) return setError(`Line ${i + 1}: sanskrit is required`);
      if (!l.audio) return setError(`Line ${i + 1}: audio is required`);
      const words = parseTimings(l.wordsJson);
      if ("error" in words) return setError(`Line ${i + 1} words: ${words.error}`);
      const fullTimings = parseTimings(l.fullTimingsJson);
      if ("error" in fullTimings) return setError(`Line ${i + 1} fullTimings: ${fullTimings.error}`);
      parsedLines.push({
        sanskrit: l.sanskrit,
        transliteration: l.transliteration,
        words,
        fullTimings,
      });
    }

    const body: ShlokaInput = {
      slug,
      title,
      meaning,
      translation,
      status: finalStatus,
      audio: {
        full: audioFull,
        lines: lines.map((l) => l.audio!),
      },
      image: image,
      lines: parsedLines,
    };

    setSubmitting(true);
    try {
      const saved = isEdit && initial
        ? await api.admin.shlokas.update(initial.id, body)
        : await api.admin.shlokas.create(body);
      setStatus(finalStatus);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4 max-w-3xl">
      <div className="space-y-1">
        <label className="font-semibold">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={isEdit}
          className="w-full border px-2 py-1 rounded disabled:bg-gray-100"
          placeholder="taruna-jwara"
        />
      </div>

      <div className="space-y-1">
        <label className="font-semibold">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="space-y-1">
        <label className="font-semibold">Meaning</label>
        <textarea
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          rows={3}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="space-y-1">
        <label className="font-semibold">Translation</label>
        <textarea
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          rows={3}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <ImageUploadField label="Image (optional)" value={image} onChange={setImage} />

      <AudioUploadField label="Full audio (MP3)" value={audioFull} onChange={setAudioFull} />

      <div>
        <h3 className="font-semibold text-brown mb-2">Lines</h3>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <LineEditor
              key={i}
              index={i}
              line={l}
              onChange={(next) => updateLine(i, next)}
              onRemove={() => removeLine(i)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 text-sm text-green underline"
        >
          + Add line
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void submit("draft")}
          disabled={submitting}
          className="bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => void submit("published")}
          disabled={submitting}
          className="bg-green text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Publish"}
        </button>
      </div>
    </form>
  );
};

export default ShlokaForm;
