"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Waveform from "./timing-editor/Waveform";
import type { Region } from "./timing-editor/types";

interface WordTiming {
  text: string;
  start: number;
  end: number;
}

interface Props {
  audioUrl?: string;
  meaningText: string;
  timings: WordTiming[];
  onChange: (timings: WordTiming[]) => void;
}

const MeaningTimingEditor: React.FC<Props> = ({ audioUrl, meaningText, timings, onChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<"idle" | "timing" | "done">(timings.length > 0 ? "done" : "idle");
  const [segIdx, setSegIdx] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const markRef = useRef<(() => void) | undefined>(undefined);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const meaningDisplayRef = useRef<HTMLDivElement | null>(null);

  // Segments: either derived from existing timings, or built up manually
  const [segments, setSegments] = useState<string[]>(() =>
    timings.length > 0 ? timings.map((t) => t.text) : [],
  );

  // ── Add segment from text selection ────────────────────────────────
  const addSegment = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const display = meaningDisplayRef.current;
    if (display && !display.contains(sel.anchorNode)) return;
    const text = sel.toString().trim();
    if (!text) return;
    setSegments((prev) => [...prev, text]);
    sel.removeAllRanges();
  };

  const removeSegment = (idx: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Audio element (persists across mode changes) ────────────────────
  useEffect(() => {
    if (!audioUrl) return;
    const a = new Audio(audioUrl);
    a.addEventListener("loadedmetadata", () => setDuration(a.duration));
    a.addEventListener("timeupdate", () => setCurrentTime(a.currentTime));
    a.addEventListener("ended", () => { if (audioRef.current) setCurrentTime(a.duration); });
    audioRef.current = a;
    return () => { a.pause(); a.removeAttribute("src"); a.load(); };
  }, [audioUrl]);

  // ── Tap-to-mark ────────────────────────────────────────────────────
  const markSegment = useCallback(() => {
    if (mode !== "timing" || !audioRef.current) return;
    const t = audioRef.current.currentTime;
    setMarks((prev) => {
      const next = [...prev, t];
      const nextIdx = segIdx + 1;
      if (nextIdx >= segments.length) {
        const result = segments.map((s, i) => ({
          text: s,
          start: next[i],
          end: i < segments.length - 1 ? next[i + 1] : audioRef.current!.duration || t + 0.5,
        }));
        onChange(result);
        setMode("done");
        audioRef.current!.pause();
      }
      setSegIdx(nextIdx);
      return next;
    });
  }, [mode, segIdx, segments, onChange]);

  markRef.current = markSegment;

  useEffect(() => {
    if (mode !== "timing") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        markRef.current?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  const startTiming = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play();
    setMode("timing");
    setSegIdx(0);
    setMarks([]);
    setSelectedIdx(-1);
  };

  const undoLast = () => {
    if (marks.length === 0) return;
    setMarks((prev) => prev.slice(0, -1));
    setSegIdx((prev) => Math.max(0, prev - 1));
  };

  const resetAll = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setMode("idle");
    setSegIdx(0);
    setMarks([]);
    setCurrentTime(0);
    setSelectedIdx(-1);
  };

  const clearTimings = () => {
    onChange([]);
    setSegments([]);
    resetAll();
  };

  // ── Highlight segments in meaning text display ─────────────────────
  const renderedMeaning = useMemo(() => {
    if (segments.length === 0) return null;
    const parts: { text: string; segIdx: number }[] = [];
    let searchFrom = 0;

    // Find positions of all segments in order
    const positions: { start: number; end: number; idx: number }[] = [];
    for (let i = 0; i < segments.length; i++) {
      const pos = meaningText.indexOf(segments[i], searchFrom);
      if (pos >= 0) {
        positions.push({ start: pos, end: pos + segments[i].length, idx: i });
        searchFrom = pos + segments[i].length;
      }
    }
    positions.sort((a, b) => a.start - b.start);

    let lastEnd = 0;
    for (const p of positions) {
      if (p.start > lastEnd) {
        parts.push({ text: meaningText.slice(lastEnd, p.start), segIdx: -1 });
      }
      parts.push({ text: meaningText.slice(p.start, p.end), segIdx: p.idx });
      lastEnd = p.end;
    }
    if (lastEnd < meaningText.length) {
      parts.push({ text: meaningText.slice(lastEnd), segIdx: -1 });
    }
    return parts;
  }, [meaningText, segments]);

  // ── Waveform region logic (done mode) ──────────────────────────────
  const regions: Region[] = useMemo(
    () => timings.map((t, i) => ({ id: `mt-${i}`, start: t.start, end: t.end })),
    [timings],
  );

  const handleRegionCreate = useCallback(() => null, []);

  const handleRegionUpdate = useCallback(
    (id: string, start: number, end: number) => {
      const idx = parseInt(id.replace("mt-", ""), 10);
      if (isNaN(idx) || idx < 0 || idx >= timings.length) return;
      const updated = timings.map((t) => ({ ...t }));
      updated[idx].start = start;
      updated[idx].end = end;
      if (idx > 0) updated[idx - 1].end = start;
      if (idx < updated.length - 1) updated[idx + 1].start = end;
      onChange(updated);
    },
    [timings, onChange],
  );

  const handleRegionClick = useCallback((id: string) => {
    const idx = parseInt(id.replace("mt-", ""), 10);
    if (!isNaN(idx)) setSelectedIdx(idx);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
  if (!audioUrl) {
    return <div className="text-xs text-gray-400 italic">Upload meaning audio to enable timing.</div>;
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-600">
          Meaning timing
          {mode === "done" && (
            <span className="ml-1.5 text-green-700 font-normal">({timings.length} segments timed)</span>
          )}
        </div>
        {mode === "timing" && (
          <div className="text-[10px] text-gray-400">{fmt(currentTime)} / {fmt(duration)}</div>
        )}
      </div>

      {/* ── Selectable meaning text (idle mode) ───────────────────── */}
      {mode === "idle" && (
        <>
          <div
            ref={meaningDisplayRef}
            className="text-sm text-gray-700 whitespace-pre-wrap p-2.5 bg-white border border-gray-200 rounded select-text cursor-text max-h-40 overflow-y-auto leading-relaxed"
          >
            {renderedMeaning
              ? renderedMeaning.map((part, i) => (
                  <span
                    key={i}
                    className={part.segIdx >= 0 ? "bg-amber-100 text-amber-900 rounded-sm px-0.5" : ""}
                  >
                    {part.text}
                  </span>
                ))
              : meaningText}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addSegment}
              className="text-xs px-2.5 py-1 rounded bg-brown text-white hover:opacity-90"
            >
              Mark selection
            </button>
            <span className="text-[10px] text-gray-400">Select text above, then click Mark</span>
          </div>
        </>
      )}

      {/* ── Waveform with draggable regions (done mode) ─────────── */}
      {mode === "done" && audioUrl && (
        <Waveform
          audioUrl={audioUrl}
          regions={regions}
          highlightedId={selectedIdx >= 0 ? `mt-${selectedIdx}` : undefined}
          onRegionCreate={handleRegionCreate}
          onRegionUpdate={handleRegionUpdate}
          onRegionClick={handleRegionClick}
          height={70}
        />
      )}

      {/* ── Segment chips ─────────────────────────────────────────── */}
      {(mode === "idle" || mode === "timing" || mode === "done") && segments.length > 0 && (
        <div className="flex flex-col gap-1 p-2 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
          {segments.map((seg, i) => {
            let cls = "px-2 py-1 rounded text-xs transition-colors cursor-default flex items-center gap-1.5 ";
            if (mode === "timing") {
              if (i < segIdx) cls += "bg-green-100 text-green-800";
              else if (i === segIdx) cls += "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400";
              else cls += "bg-white text-gray-400 border border-gray-200";
            } else if (mode === "done") {
              cls += i === selectedIdx
                ? "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400 cursor-pointer"
                : "bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer";
            } else {
              cls += "bg-white text-gray-600 border border-gray-200";
            }
            return (
              <span
                key={i}
                className={cls}
                onClick={() => mode === "done" && setSelectedIdx(i === selectedIdx ? -1 : i)}
              >
                <span className="text-gray-400 shrink-0">{i + 1}.</span>
                <span className="truncate">{seg}</span>
                {mode === "idle" && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSegment(i); }}
                    className="ml-auto text-red-400 hover:text-red-600 shrink-0"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {mode === "idle" && segments.length > 0 && (
          <button type="button" onClick={startTiming} className="text-xs px-3 py-1.5 rounded bg-brown text-white hover:opacity-90">
            Start timing ({segments.length} segments)
          </button>
        )}
        {mode === "timing" && (
          <>
            <button type="button" onClick={markSegment} className="text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:opacity-90">
              Tap / Space
            </button>
            <span className="text-[10px] text-gray-500">{segIdx}/{segments.length}</span>
            <button type="button" onClick={undoLast} disabled={marks.length === 0} className="text-xs px-2 py-1 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-30">
              Undo
            </button>
            <button type="button" onClick={resetAll} className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50">
              Reset
            </button>
          </>
        )}
        {mode === "done" && (
          <>
            <button type="button" onClick={() => { setSegments(timings.map(t => t.text)); resetAll(); }} className="text-xs px-3 py-1.5 rounded bg-brown text-white hover:opacity-90">
              Redo timing
            </button>
            <button type="button" onClick={clearTimings} className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50">
              Clear all
            </button>
          </>
        )}
      </div>

      {mode === "timing" && (
        <div className="text-[10px] text-gray-400">
          Audio is playing. Tap the button or press Space each time the next segment starts.
        </div>
      )}
      {mode === "done" && (
        <div className="text-[10px] text-gray-400">
          Drag region edges on the waveform to adjust boundaries. Click a segment or region to highlight it.
        </div>
      )}
    </div>
  );
};

export default MeaningTimingEditor;
