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
  const [wordIdx, setWordIdx] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const markRef = useRef<(() => void) | undefined>(undefined);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const lines = useMemo(() => meaningText.split(/\n/).filter(s => s.trim()), [meaningText]);

  // ── Audio element for tap-to-mark mode ─────────────────────────────
  useEffect(() => {
    if (!audioUrl || mode === "done") return;
    const a = new Audio(audioUrl);
    a.addEventListener("loadedmetadata", () => setDuration(a.duration));
    a.addEventListener("timeupdate", () => setCurrentTime(a.currentTime));
    a.addEventListener("ended", () => { if (audioRef.current) setCurrentTime(a.duration); });
    audioRef.current = a;
    return () => { a.pause(); a.removeAttribute("src"); a.load(); };
  }, [audioUrl, mode]);

  // ── Tap-to-mark ────────────────────────────────────────────────────
  const markLine = useCallback(() => {
    if (mode !== "timing" || !audioRef.current) return;
    const t = audioRef.current.currentTime;
    setMarks((prev) => {
      const next = [...prev, t];
      const nextIdx = wordIdx + 1;
      if (nextIdx >= lines.length) {
        const result = lines.map((l, i) => ({
          text: l.trim(),
          start: next[i],
          end: i < lines.length - 1 ? next[i + 1] : audioRef.current!.duration || t + 0.5,
        }));
        onChange(result);
        setMode("done");
        audioRef.current!.pause();
      }
      setWordIdx(nextIdx);
      return next;
    });
  }, [mode, wordIdx, lines, onChange]);

  markRef.current = markLine;

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

  const lineIdx = wordIdx;

  const startTiming = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play();
    setMode("timing");
    setWordIdx(0);
    setMarks([]);
    setSelectedIdx(-1);
  };

  const undoLast = () => {
    if (marks.length === 0) return;
    setMarks((prev) => prev.slice(0, -1));
    setWordIdx((prev) => Math.max(0, prev - 1));
  };

  const resetAll = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setMode("idle");
    setWordIdx(0);
    setMarks([]);
    setCurrentTime(0);
    setSelectedIdx(-1);
  };

  const clearTimings = () => {
    onChange([]);
    resetAll();
  };

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
      // Keep neighbors contiguous
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
    return <div className="text-xs text-gray-400 italic">Upload meaning audio to enable line timing.</div>;
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
          Meaning line timing
          {mode === "done" && (
            <span className="ml-1.5 text-green-700 font-normal">({timings.length} lines timed)</span>
          )}
        </div>
        {mode === "timing" && (
          <div className="text-[10px] text-gray-400">{fmt(currentTime)} / {fmt(duration)}</div>
        )}
      </div>

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

      {/* ── Line pills ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 p-2 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
        {lines.map((l, i) => {
          let cls = "px-2 py-1 rounded text-xs transition-colors cursor-default truncate ";
          if (mode === "timing") {
            if (i < lineIdx) cls += "bg-green-100 text-green-800";
            else if (i === lineIdx) cls += "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400";
            else cls += "bg-white text-gray-400 border border-gray-200";
          } else if (mode === "done") {
            cls += i === selectedIdx
              ? "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400 cursor-pointer"
              : "bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer";
          } else {
            cls += "bg-white text-gray-500 border border-gray-200";
          }
          return (
            <span key={i} className={cls} onClick={() => mode === "done" && setSelectedIdx(i === selectedIdx ? -1 : i)}>
              <span className="text-gray-400 mr-1.5">{i + 1}.</span>{l.trim()}
            </span>
          );
        })}
      </div>

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {mode === "idle" && (
          <button type="button" onClick={startTiming} className="text-xs px-3 py-1.5 rounded bg-brown text-white hover:opacity-90">
            Start timing
          </button>
        )}
        {mode === "timing" && (
          <>
            <button type="button" onClick={markLine} className="text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:opacity-90">
              Tap / Space
            </button>
            <span className="text-[10px] text-gray-500">{lineIdx}/{lines.length}</span>
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
            <button type="button" onClick={startTiming} className="text-xs px-3 py-1.5 rounded bg-brown text-white hover:opacity-90">
              Redo
            </button>
            <button type="button" onClick={clearTimings} className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50">
              Clear
            </button>
          </>
        )}
      </div>

      {mode === "timing" && (
        <div className="text-[10px] text-gray-400">
          Audio is playing. Tap the button or press Space each time the next line starts being spoken.
        </div>
      )}
      {mode === "done" && (
        <div className="text-[10px] text-gray-400">
          Drag region edges on the waveform to adjust line boundaries. Click a line or region to highlight it.
        </div>
      )}
    </div>
  );
};

export default MeaningTimingEditor;
