"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ShlokaInfoCard from "./ShlokaInfoCard";
import EditPageShell from "./EditPageShell";
import { useKeyboardShortcuts } from "./useHistory";
import RegionBucketEditor from "./timing-editor/RegionBucketEditor";
import { api } from "@/lib/api";
import type { PublicShloka, ShlokaInput, ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  initial?: PublicShloka;
  onSaved: (s: PublicShloka, status: "draft" | "published") => void;
}

type ModelLine = {
  sanskrit: string;
  fullTimings: Array<{ text: string; start: number; end: number }>;
};

const ShlokaForm: React.FC<Props> = ({ initial, onSaved }) => {
  const isEdit = !!initial;

  // ── Field state ───────────────────────────────────────────────────────
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [fullText, setFullText] = useState(initial?.fullText ?? "");
  const [highlightWords, setHighlightWords] = useState<string[]>(initial?.highlightWords ?? []);
  const [caseStudy, setCaseStudy] = useState(initial?.caseStudy ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [image, setImage] = useState<ShlokaAssetInput | undefined>(
    initial?.image ? { url: initial.image.url, publicId: initial.image.publicId ?? "" } : undefined,
  );
  const [audioFull, setAudioFull] = useState<ShlokaAssetInput | undefined>(
    initial?.audio.full
      ? { url: initial.audio.full.url, publicId: initial.audio.full.publicId ?? "" }
      : undefined,
  );

  const [modelLines, setModelLines] = useState<ModelLine[]>(
    initial
      ? initial.lines.map((l) => ({
          sanskrit: l.sanskrit,
          fullTimings: (l.fullTimings ?? []).map((t) => ({
            text: t.text,
            start: t.start,
            end: t.end,
          })),
        }))
      : [{ sanskrit: "", fullTimings: [] }],
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Dirty tracking (compare to last-saved snapshot) ──────────────────
  const initialSnapshot = useRef(
    JSON.stringify({
      slug: initial?.slug ?? "",
      title: initial?.title ?? "",
      meaning: initial?.meaning ?? "",
      fullText: initial?.fullText ?? "",
      highlightWords: initial?.highlightWords ?? [],
      caseStudy: initial?.caseStudy ?? "",
      reference: initial?.reference ?? "",
      image: initial?.image,
      audioFull: initial?.audio.full,
      lines: initial?.lines,
    }),
  );
  const currentSnapshot = JSON.stringify({
    slug,
    title,
    meaning,
    fullText,
    highlightWords,
    caseStudy,
    reference,
    image,
    audioFull,
    modelLines,
  });
  const dirty = currentSnapshot !== initialSnapshot.current;

  const refreshSnapshot = () => {
    initialSnapshot.current = JSON.stringify({
      slug,
      title,
      meaning,
      fullText,
      highlightWords,
      caseStudy,
      image,
      audioFull,
      modelLines,
    });
  };

  // ── Region counts for progress display ───────────────────────────────
  const totalExpectedWords = useMemo(
    () =>
      modelLines.reduce((sum, l) => {
        const split = l.sanskrit.split(/\s+/).filter(Boolean);
        return sum + split.length;
      }, 0),
    [modelLines],
  );
  const totalMarkedWords = useMemo(
    () => modelLines.reduce((sum, l) => sum + l.fullTimings.length, 0),
    [modelLines],
  );

  // ── Publish-ready validation ─────────────────────────────────────────
  const disabledReason: string | undefined = useMemo(() => {
    if (!isEdit && !slug.trim()) return "Slug is required";
    if (!title.trim()) return "Title is required";
    if (!meaning.trim()) return "Meaning is required";
    if (!audioFull) return "Full audio is required";
    if (modelLines.length === 0) return "At least one line is required";
    for (let i = 0; i < modelLines.length; i++) {
      const l = modelLines[i];
      if (!l.sanskrit.trim()) return `Line ${i + 1}: sanskrit is required`;
      const expected = l.sanskrit.split(/\s+/).filter(Boolean).length;
      if (l.fullTimings.length !== expected) {
        return `Line ${i + 1}: ${l.fullTimings.length} regions assigned but ${expected} word(s) in sanskrit`;
      }
    }
    return undefined;
  }, [isEdit, slug, title, meaning, audioFull, modelLines]);

  // ── Submit ───────────────────────────────────────────────────────────
  const submit = async (nextStatus: "draft" | "published") => {
    setError(null);
    if (nextStatus === "draft") {
      if (!isEdit && !slug.trim()) return setError("Slug is required");
      if (!title.trim()) return setError("Title is required");
    } else {
      if (disabledReason) return setError(disabledReason);
    }

    const body: ShlokaInput = {
      slug,
      title,
      meaning,
      fullText: fullText.trim() || undefined,
      highlightWords,
      caseStudy: caseStudy.trim() || undefined,
      reference: reference.trim() || undefined,
      status: nextStatus,
      audio: {
        full: audioFull ?? { url: "", publicId: "" },
        lines: [],
      },
      image,
      lines: modelLines,
    };

    if (nextStatus === "draft" && !body.audio.full.url) {
      return setError("Upload the full audio before saving.");
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

  // Refresh snapshot when initial prop changes (edit page finishes loading).
  useEffect(() => {
    if (initial) {
      refreshSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  // Keyboard shortcut: Cmd/Ctrl+S to save draft
  useKeyboardShortcuts({
    saveDraft: () => void submit("draft"),
  });

  return (
    <EditPageShell
      title={title || (isEdit ? "Edit shloka" : "New shloka")}
      marked={totalMarkedWords}
      total={totalExpectedWords}
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
            fullText={fullText}
            highlightWords={highlightWords}
            caseStudy={caseStudy}
            reference={reference}
            image={image}
            audioFull={audioFull}
            slugDisabled={isEdit}
            onSlug={setSlug}
            onTitle={setTitle}
            onMeaning={setMeaning}
            onFullText={setFullText}
            onHighlightWords={setHighlightWords}
            onCaseStudy={setCaseStudy}
            onReference={setReference}
            onImage={setImage}
            onAudioFull={setAudioFull}
          />
          <div className="soft-card p-5 space-y-3">
            <div className="text-sm font-semibold text-brown">Audio + line buckets</div>
            <RegionBucketEditor
              fullAudioUrl={audioFull?.url}
              initialLines={
                initial?.lines.map((l) => ({
                  sanskrit: l.sanskrit,
                  fullTimings: l.fullTimings ?? [],
                })) ?? [{ sanskrit: "" }]
              }
              onChange={(nextLines) => setModelLines(nextLines)}
            />
          </div>
        </>
      }
    />
  );
};

export default ShlokaForm;
