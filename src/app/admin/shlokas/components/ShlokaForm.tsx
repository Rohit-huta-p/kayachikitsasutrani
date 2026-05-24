"use client";

import React, { useMemo, useState } from "react";
import AudioUploadField from "./AudioUploadField";
import ImageUploadField from "./ImageUploadField";
import LineEditor, { type LineDraft } from "./LineEditor";
import FullAudioEditor, { type FullRegionInput } from "./timing-editor/FullAudioEditor";
import type { WordEntry } from "./timing-editor/types";
import { makeWordId } from "./timing-editor/types";
import { api } from "@/lib/api";
import type { PublicShloka, ShlokaInput, ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  initial?: PublicShloka;
  onSaved: (s: PublicShloka) => void;
}

function toEntries(line: PublicShloka["lines"][number]): WordEntry[] {
  return line.words.map((w, k) => {
    const f = line.fullTimings[k];
    return {
      id: makeWordId(),
      text: w.text,
      lineStart: w.start,
      lineEnd: w.end,
      fullStart: f?.start ?? null,
      fullEnd: f?.end ?? null,
    };
  });
}

function toLineDraft(line: PublicShloka["lines"][number], audio?: ShlokaAssetInput): LineDraft {
  return {
    sanskrit: line.sanskrit,
    transliteration: line.transliteration,
    audio,
    words: toEntries(line),
  };
}

const emptyLine = (): LineDraft => ({
  sanskrit: "",
  transliteration: "",
  audio: undefined,
  words: [],
});

function splitSanskrit(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

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
    initial?.audio.full
      ? { url: initial.audio.full.url, publicId: initial.audio.full.publicId ?? "" }
      : undefined,
  );
  const [lines, setLines] = useState<LineDraft[]>(
    initial
      ? initial.lines.map((l, i) =>
          toLineDraft(
            l,
            initial.audio.lines[i]
              ? {
                  url: initial.audio.lines[i].url,
                  publicId: initial.audio.lines[i].publicId ?? "",
                }
              : undefined,
          ),
        )
      : [emptyLine()],
  );
  const [selectedWordId, setSelectedWordId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (i: number, next: LineDraft) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // ── Full audio aggregation ────────────────────────────────────────────
  // Build the regions for the full-audio waveform from all lines' words
  // that have fullStart/fullEnd set. Also build a lookup of selected word
  // metadata for the editor's "Next: ..." banner.
  const fullRegions = useMemo<FullRegionInput[]>(() => {
    const out: FullRegionInput[] = [];
    for (let li = 0; li < lines.length; li++) {
      const split = splitSanskrit(lines[li].sanskrit);
      lines[li].words.forEach((w, wi) => {
        if (w.fullStart !== null && w.fullEnd !== null) {
          out.push({
            id: w.id,
            start: w.fullStart,
            end: w.fullEnd,
            lineIndex: li,
            label: split[wi] ?? w.text ?? "?",
          });
        }
      });
    }
    return out;
  }, [lines]);

  const totalWords = useMemo(
    () => lines.reduce((sum, l) => sum + l.words.length, 0),
    [lines],
  );

  // Selected word metadata for the banner
  const selectedMeta = useMemo(() => {
    if (!selectedWordId) return undefined;
    for (let li = 0; li < lines.length; li++) {
      const wi = lines[li].words.findIndex((w) => w.id === selectedWordId);
      if (wi !== -1) {
        const split = splitSanskrit(lines[li].sanskrit);
        return { lineIndex: li, wordIndex: wi, label: split[wi] ?? "?" };
      }
    }
    return undefined;
  }, [selectedWordId, lines]);

  const setFullForWord = (wordId: string, start: number, end: number) => {
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        words: l.words.map((w) =>
          w.id === wordId ? { ...w, fullStart: start, fullEnd: end } : w,
        ),
      })),
    );
    // After assignment, auto-advance to the next unmarked word in document order.
    const flat: WordEntry[] = lines.flatMap((l) => l.words);
    const idx = flat.findIndex((w) => w.id === wordId);
    const next = flat
      .slice(idx + 1)
      .find((w) => w.fullStart === null || w.fullEnd === null);
    setSelectedWordId(next?.id);
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const submit = async (nextStatus?: "draft" | "published") => {
    setError(null);
    const finalStatus = nextStatus ?? status;
    if (!slug.trim() && !isEdit) return setError("Slug is required");
    if (!title.trim()) return setError("Title is required");
    if (!meaning.trim()) return setError("Meaning is required");
    if (!translation.trim()) return setError("Translation is required");
    if (!audioFull) return setError("Full audio is required");
    if (lines.length === 0) return setError("At least one line is required");

    const builtLines = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.sanskrit.trim()) return setError(`Line ${i + 1}: sanskrit is required`);
      if (!l.audio) return setError(`Line ${i + 1}: audio is required`);
      const sanskritWords = splitSanskrit(l.sanskrit);
      if (l.words.length === 0) return setError(`Line ${i + 1}: needs at least one region`);
      if (l.words.length !== sanskritWords.length) {
        return setError(
          `Line ${i + 1}: ${l.words.length} regions marked but sanskrit has ${sanskritWords.length} words. They must match.`,
        );
      }
      for (let k = 0; k < l.words.length; k++) {
        const w = l.words[k];
        if (w.lineStart >= w.lineEnd) return setError(`Line ${i + 1} region #${k + 1}: invalid line range`);
        if (w.fullStart === null || w.fullEnd === null) {
          return setError(`Line ${i + 1} region #${k + 1} (${sanskritWords[k]}): not yet marked on full audio`);
        }
        if (w.fullStart >= w.fullEnd) return setError(`Line ${i + 1} region #${k + 1}: invalid full range`);
      }
      builtLines.push({
        sanskrit: l.sanskrit,
        transliteration: l.transliteration,
        words: l.words.map((w, k) => ({ text: sanskritWords[k], start: w.lineStart, end: w.lineEnd })),
        fullTimings: l.words.map((w, k) => ({
          text: sanskritWords[k],
          start: w.fullStart as number,
          end: w.fullEnd as number,
        })),
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
      image,
      lines: builtLines,
    };

    setSubmitting(true);
    try {
      const saved =
        isEdit && initial
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

      {/* Single full-audio editor at the top — drives positions for all lines' words */}
      <div className="bg-white/40 rounded p-4 border border-gray-200">
        <FullAudioEditor
          audioUrl={audioFull?.url}
          regions={fullRegions}
          totalWords={totalWords}
          selectedWordId={selectedWordId}
          selectedWordLabel={selectedMeta?.label}
          selectedWordLineIndex={selectedMeta?.lineIndex}
          onRegionAssign={(id, start, end) => setFullForWord(id, start, end)}
          onRegionUpdate={(id, start, end) => setFullForWord(id, start, end)}
          onRegionClick={(id) => setSelectedWordId(id)}
        />
      </div>

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
              selectedWordId={selectedWordId}
              onSelectWord={(id) => setSelectedWordId(id)}
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
