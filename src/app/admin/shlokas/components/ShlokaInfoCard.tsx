"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import AudioUploadField from "./AudioUploadField";
import ImageUploadField from "./ImageUploadField";
import type { ShlokaAssetInput } from "@/lib/auth/types";

export interface ShlokaInfoValues {
  slug: string;
  title: string;
  meaning: string;
  fullText: string;
  highlightWords: string[];
  caseStudy: string;
  image?: ShlokaAssetInput;
  audioFull?: ShlokaAssetInput;
}

interface Props extends ShlokaInfoValues {
  /** Disable slug editing (used in edit mode). */
  slugDisabled?: boolean;
  onSlug: (v: string) => void;
  onTitle: (v: string) => void;
  onMeaning: (v: string) => void;
  onFullText: (v: string) => void;
  onHighlightWords: (next: string[]) => void;
  onCaseStudy: (v: string) => void;
  onImage: (a: ShlokaAssetInput | undefined) => void;
  onAudioFull: (a: ShlokaAssetInput | undefined) => void;
}

function isComplete(v: ShlokaInfoValues): boolean {
  // caseStudy + audioMeaning are optional — do not gate completeness on them.
  return Boolean(v.title.trim() && v.meaning.trim() && v.audioFull);
}

const ShlokaInfoCard: React.FC<Props> = (props) => {
  const complete = isComplete(props);
  // Edit mode opens by default if anything's missing; otherwise summary view.
  const [editing, setEditing] = useState(!complete);
  const fullTextRef = useRef<HTMLTextAreaElement | null>(null);

  const addSelectionAsHighlight = () => {
    const el = fullTextRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    if (s === e) return; // nothing selected
    const sel = props.fullText.slice(s, e).trim();
    if (!sel) return;
    if (props.highlightWords.includes(sel)) return;
    props.onHighlightWords([...props.highlightWords, sel]);
  };
  const removeHighlight = (w: string) => {
    props.onHighlightWords(props.highlightWords.filter((x) => x !== w));
  };

  return (
    <div className="soft-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={complete ? "status-icon status-done" : "status-icon status-warn"}
            aria-label={complete ? "complete" : "incomplete"}
          >
            {complete ? "✓" : "!"}
          </span>
          <h2 className="text-base font-semibold text-brown">Shloka Info</h2>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-green hover:underline"
          >
            ✎ Edit
          </button>
        )}
        {editing && complete && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-green hover:underline"
          >
            Done
          </button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div className="text-gray-500">Slug</div>
          <div className="col-span-2 font-mono text-xs">{props.slug || "—"}</div>
          <div className="text-gray-500">Title</div>
          <div className="col-span-2">{props.title || "—"}</div>
          <div className="text-gray-500">Meaning</div>
          <div className="col-span-2 text-gray-700">{props.meaning || "—"}</div>
          <div className="text-gray-500">Full text</div>
          <div className="col-span-2 text-gray-700 whitespace-pre-wrap">{props.fullText || "—"}</div>
          <div className="text-gray-500">Case Study</div>
          <div className="col-span-2 text-gray-700 whitespace-pre-wrap">{props.caseStudy || "—"}</div>
          <div className="text-gray-500">Image</div>
          <div className="col-span-2 flex items-center gap-2">
            {props.image ? (
              <>
                <div className="relative w-12 h-9">
                  <Image src={props.image.url} alt="" fill className="object-cover rounded" sizes="48px" />
                </div>
                <span className="text-xs text-gray-500">uploaded</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">none</span>
            )}
          </div>
          <div className="text-gray-500">Full audio</div>
          <div className="col-span-2 text-xs">
            {props.audioFull ? "uploaded" : <span className="text-amber-700">not uploaded yet</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Slug</label>
            <input
              type="text"
              value={props.slug}
              onChange={(e) => props.onSlug(e.target.value)}
              disabled={props.slugDisabled}
              className="w-full border px-2 py-1 rounded disabled:bg-gray-100"
              placeholder="taruna-jwara"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Title</label>
            <input
              type="text"
              value={props.title}
              onChange={(e) => props.onTitle(e.target.value)}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Meaning</label>
            <textarea
              value={props.meaning}
              onChange={(e) => props.onMeaning(e.target.value)}
              rows={3}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Full shloka text (Sanskrit)</label>
            <textarea
              ref={fullTextRef}
              value={props.fullText}
              onChange={(e) => props.onFullText(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Paste the entire shloka here (multi-line). Word count must equal total words across all line waveform regions for highlighting to align."
              className="w-full border px-2 py-1 rounded font-serif"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={addSelectionAsHighlight}
                disabled={!props.fullText}
                className="text-xs px-2 py-1 rounded bg-brown text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✎ Highlight selected text
              </button>
              <span className="text-[10px] text-gray-400">{props.fullText.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            {props.highlightWords.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Highlighted ({props.highlightWords.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {props.highlightWords.map((w) => (
                    <span
                      key={w}
                      className="inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded bg-brown text-white"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {w}
                      <button
                        type="button"
                        onClick={() => removeHighlight(w)}
                        aria-label={`Remove highlight ${w}`}
                        className="text-white/80 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Case Study (optional)</label>
            <textarea
              value={props.caseStudy}
              onChange={(e) => props.onCaseStudy(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="Clinical context, examples, or notes (up to 5000 characters)"
              className="w-full border px-2 py-1 rounded"
            />
            <div className="text-[10px] text-gray-400 text-right">{props.caseStudy.length} / 5000</div>
          </div>
          <ImageUploadField label="Image (optional)" value={props.image} onChange={props.onImage} />
          <AudioUploadField label="Full audio" value={props.audioFull} onChange={props.onAudioFull} />
        </div>
      )}
    </div>
  );
};

export default ShlokaInfoCard;
