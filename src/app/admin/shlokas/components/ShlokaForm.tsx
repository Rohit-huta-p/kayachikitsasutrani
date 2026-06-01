"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import LineEditor, { type LineDraft, lineStripeColor } from "./LineEditor";
import ShlokaInfoCard from "./ShlokaInfoCard";
import EditPageShell from "./EditPageShell";
import { useHistory, useKeyboardShortcuts } from "./useHistory";
import FullAudioEditor, { type FullRegionInput, type FullWordRow } from "./timing-editor/FullAudioEditor";
import type { WordEntry } from "./timing-editor/types";
import { makeWordId } from "./timing-editor/types";
import { api } from "@/lib/api";
import type { PublicShloka, ShlokaInput, ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  initial?: PublicShloka;
  onSaved: (s: PublicShloka, status: "draft" | "published") => void;
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
    audio,
    words: toEntries(line),
  };
}

const emptyLine = (): LineDraft => ({
  sanskrit: "",
  audio: undefined,
  words: [],
});

function splitSanskrit(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

const ShlokaForm: React.FC<Props> = ({ initial, onSaved }) => {
  const isEdit = !!initial;

  // ── Field state ───────────────────────────────────────────────────────
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [translation, setTranslation] = useState(initial?.translation ?? "");
  const [image, setImage] = useState<ShlokaAssetInput | undefined>(
    initial?.image ? { url: initial.image.url, publicId: initial.image.publicId ?? "" } : undefined,
  );
  const [audioFull, setAudioFull] = useState<ShlokaAssetInput | undefined>(
    initial?.audio.full
      ? { url: initial.audio.full.url, publicId: initial.audio.full.publicId ?? "" }
      : undefined,
  );
  const initialLines: LineDraft[] = initial
    ? initial.lines.map((l, i) =>
        toLineDraft(
          l,
          initial.audio.lines[i]
            ? { url: initial.audio.lines[i].url, publicId: initial.audio.lines[i].publicId ?? "" }
            : undefined,
        ),
      )
    : [emptyLine()];
  const linesHistory = useHistory<LineDraft[]>(initialLines);
  const lines = linesHistory.state;
  const setLines = linesHistory.set;
  const [selectedWordId, setSelectedWordId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Dirty tracking (compare to last-saved snapshot) ──────────────────
  const initialSnapshot = useRef(JSON.stringify({
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    meaning: initial?.meaning ?? "",
    translation: initial?.translation ?? "",
    image: initial?.image,
    audioFull: initial?.audio.full,
    lines: initial?.lines,
  }));
  const currentSnapshot = JSON.stringify({ slug, title, meaning, translation, image, audioFull, lines });
  const dirty = currentSnapshot !== initialSnapshot.current;

  const refreshSnapshot = () => {
    initialSnapshot.current = JSON.stringify({ slug, title, meaning, translation, image, audioFull, lines });
  };

  // ── Lines mutators ───────────────────────────────────────────────────
  const updateLine = (i: number, next: LineDraft) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)));
  const [scrollToIndex, setScrollToIndex] = useState<number | null>(null);
  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    setScrollToIndex(lines.length); // index of the just-added line
  };
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // Scroll newly-added line into view
  useEffect(() => {
    if (scrollToIndex === null) return;
    // Wait one paint so the new card is in the DOM
    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-line-index="${scrollToIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setScrollToIndex(null);
    });
    return () => cancelAnimationFrame(id);
  }, [scrollToIndex]);

  // ── Full-audio aggregation ───────────────────────────────────────────
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

  const fullMarkedCount = fullRegions.length;

  const allWords = useMemo<FullWordRow[]>(() => {
    const out: FullWordRow[] = [];
    for (let li = 0; li < lines.length; li++) {
      const split = splitSanskrit(lines[li].sanskrit);
      lines[li].words.forEach((w, wi) => {
        out.push({
          id: w.id,
          lineIndex: li,
          wordIndex: wi,
          label: split[wi] ?? w.text ?? "?",
          fullStart: w.fullStart,
          fullEnd: w.fullEnd,
        });
      });
    }
    return out;
  }, [lines]);

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
    const flat: WordEntry[] = lines.flatMap((l) => l.words);
    const idx = flat.findIndex((w) => w.id === wordId);
    const next = flat.slice(idx + 1).find((w) => w.fullStart === null || w.fullEnd === null);
    setSelectedWordId(next?.id);
  };

  const clearFullForWord = (wordId: string) => {
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        words: l.words.map((w) =>
          w.id === wordId ? { ...w, fullStart: null, fullEnd: null } : w,
        ),
      })),
    );
  };

  // ── Validation gating ────────────────────────────────────────────────
  const disabledReason = useMemo<string | undefined>(() => {
    if (!isEdit && !slug.trim()) return "Slug is required";
    if (!title.trim()) return "Title is required";
    if (!meaning.trim()) return "Meaning is required";
    if (!translation.trim()) return "Translation is required";
    if (!audioFull) return "Full audio is required";
    if (lines.length === 0) return "At least one line is required";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.sanskrit.trim()) return `Line ${i + 1}: sanskrit is required`;
      if (!l.audio) return `Line ${i + 1}: audio is required`;
      const sw = splitSanskrit(l.sanskrit);
      if (l.words.length === 0) return `Line ${i + 1}: mark words on the waveform`;
      if (l.words.length !== sw.length) {
        return `Line ${i + 1}: ${l.words.length} regions but ${sw.length} words in sanskrit`;
      }
      for (let k = 0; k < l.words.length; k++) {
        const w = l.words[k];
        if (w.fullStart === null || w.fullEnd === null) {
          return `Line ${i + 1}: word "${sw[k]}" not marked on full audio`;
        }
      }
    }
    return undefined;
  }, [isEdit, slug, title, meaning, translation, audioFull, lines]);

  // ── Submit ───────────────────────────────────────────────────────────
  const submit = async (nextStatus: "draft" | "published") => {
    setError(null);
    if (nextStatus === "draft") {
      if (!isEdit && !slug.trim()) return setError("Slug is required");
      if (!title.trim()) return setError("Title is required");
    } else {
      if (disabledReason) return setError(disabledReason);
    }

    const builtLines = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const sanskritWords = splitSanskrit(l.sanskrit);
      if (l.words.length > 0 && l.words.length !== sanskritWords.length && nextStatus === "published") {
        return setError(`Line ${i + 1}: regions/words count mismatch`);
      }
      builtLines.push({
        sanskrit: l.sanskrit,
        words: l.words.map((w, k) => ({
          text: sanskritWords[k] ?? w.text ?? "",
          start: w.lineStart,
          end: w.lineEnd,
        })),
        fullTimings: l.words.map((w, k) => ({
          text: sanskritWords[k] ?? w.text ?? "",
          start: (w.fullStart ?? w.lineStart),
          end: (w.fullEnd ?? w.lineEnd),
        })),
      });
    }

    const body: ShlokaInput = {
      slug,
      title,
      meaning,
      translation,
      status: nextStatus,
      audio: {
        full: audioFull ?? { url: "", publicId: "" },
        lines: lines.map((l) => l.audio ?? { url: "", publicId: "" }),
      },
      image,
      lines: builtLines,
    };

    if (nextStatus === "draft" && (!body.audio.full.url || body.audio.lines.some((a) => !a.url))) {
      return setError("Upload the full audio and every line's audio before saving (draft or publish).");
    }

    setSubmitting(true);
    try {
      const saved =
        isEdit && initial
          ? await api.admin.shlokas.update(initial.id, body)
          : await api.admin.shlokas.create(body);
      refreshSnapshot();
      onSaved(saved, nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Refresh snapshot when initial prop changes (e.g. edit page finishes loading)
  useEffect(() => {
    if (initial) {
      refreshSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    undo: linesHistory.canUndo ? linesHistory.undo : undefined,
    redo: linesHistory.canRedo ? linesHistory.redo : undefined,
    saveDraft: () => void submit("draft"),
    deleteSelected: selectedWordId
      ? () => {
          const id = selectedWordId;
          setLines((prev) =>
            prev.map((l) => ({
              ...l,
              words: l.words.filter((w) => w.id !== id),
            })),
          );
          setSelectedWordId(undefined);
        }
      : undefined,
  });

  return (
    <EditPageShell
      title={title || (isEdit ? "Edit shloka" : "New shloka")}
      marked={fullMarkedCount}
      total={totalWords}
      dirty={dirty}
      submitting={submitting}
      disabledReason={disabledReason}
      onSaveDraft={() => void submit("draft")}
      onPublish={() => void submit("published")}
      error={error}
      left={
        <>
          <ShlokaInfoCard
            slug={slug}
            title={title}
            meaning={meaning}
            translation={translation}
            image={image}
            audioFull={audioFull}
            slugDisabled={isEdit}
            onSlug={setSlug}
            onTitle={setTitle}
            onMeaning={setMeaning}
            onTranslation={setTranslation}
            onImage={setImage}
            onAudioFull={setAudioFull}
          />

          <div className="soft-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-brown">Lines</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green font-medium">
                  {fullMarkedCount} / {totalWords} words timed
                </span>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="text-xs px-2 py-1 rounded bg-brown text-white hover:opacity-90 transition"
              >
                + Add line
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((l, i) => (
                <LineEditor
                  key={i}
                  index={i}
                  line={l}
                  stripeColor={lineStripeColor(i)}
                  onChange={(next) => updateLine(i, next)}
                  onRemove={() => removeLine(i)}
                  selectedWordId={selectedWordId}
                  onSelectWord={(id) => setSelectedWordId(id)}
                />
              ))}
            </div>
          </div>
        </>
      }
      right={
        <FullAudioEditor
          audioUrl={audioFull?.url}
          regions={fullRegions}
          allWords={allWords}
          totalWords={totalWords}
          selectedWordId={selectedWordId}
          selectedWordLabel={selectedMeta?.label}
          selectedWordLineIndex={selectedMeta?.lineIndex}
          onRegionAssign={(id, start, end) => setFullForWord(id, start, end)}
          onRegionUpdate={(id, start, end) => setFullForWord(id, start, end)}
          onRegionClick={(id) => setSelectedWordId(id)}
          onClearFull={clearFullForWord}
        />
      }
    />
  );
};

export default ShlokaForm;
