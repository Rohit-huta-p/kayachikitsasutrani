"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
};

const MeaningTimingEditor: React.FC<Props> = ({ audioUrl, meaningText, timings, onChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<"idle" | "timing" | "done">(timings.length > 0 ? "done" : "idle");
  const [wordIdx, setWordIdx] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const markRef = useRef<(() => void) | undefined>(undefined);

  const words = useMemo(() => meaningText.split(/\s+/).filter(Boolean), [meaningText]);

  useEffect(() => {
    if (!audioUrl) return;
    const a = new Audio(audioUrl);
    a.addEventListener("loadedmetadata", () => setDuration(a.duration));
    a.addEventListener("timeupdate", () => setCurrentTime(a.currentTime));
    a.addEventListener("ended", () => {
      if (audioRef.current) setCurrentTime(a.duration);
    });
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
    };
  }, [audioUrl]);

  const markWord = useCallback(() => {
    if (mode !== "timing" || !audioRef.current) return;
    const t = audioRef.current.currentTime;

    setMarks((prev) => {
      const next = [...prev, t];
      const nextIdx = wordIdx + 1;

      if (nextIdx >= words.length) {
        const result = words.map((w, i) => ({
          text: w,
          start: next[i],
          end: i < words.length - 1 ? next[i + 1] : audioRef.current!.duration || t + 0.5,
        }));
        onChange(result);
        setMode("done");
        audioRef.current!.pause();
      }
      setWordIdx(nextIdx);
      return next;
    });
  }, [mode, wordIdx, words, onChange]);

  // Keep markRef in sync for keyboard handler
  markRef.current = markWord;

  // Spacebar / Enter to mark
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
    setWordIdx(0);
    setMarks([]);
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
  };

  const clearTimings = () => {
    onChange([]);
    resetAll();
  };

  if (!audioUrl) {
    return (
      <div className="text-xs text-gray-400 italic">Upload meaning audio to enable word timing.</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-600">
          Meaning word timing
          {mode === "done" && (
            <span className="ml-1.5 text-green-700 font-normal">({timings.length} words timed)</span>
          )}
        </div>
        <div className="text-[10px] text-gray-400">{fmt(currentTime)} / {fmt(duration)}</div>
      </div>

      {/* Word pills */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
        {words.map((w, i) => {
          let cls = "px-1.5 py-0.5 rounded text-xs transition-colors ";
          if (mode === "timing") {
            if (i < wordIdx) cls += "bg-green-100 text-green-800";
            else if (i === wordIdx) cls += "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400";
            else cls += "bg-white text-gray-400 border border-gray-200";
          } else if (mode === "done") {
            cls += "bg-green-50 text-green-800";
          } else {
            cls += "bg-white text-gray-500 border border-gray-200";
          }
          return (
            <span key={i} className={cls}>
              {w}
            </span>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {mode === "idle" && (
          <button
            type="button"
            onClick={startTiming}
            className="text-xs px-3 py-1.5 rounded bg-brown text-white hover:opacity-90"
          >
            Start timing
          </button>
        )}
        {mode === "timing" && (
          <>
            <button
              type="button"
              onClick={markWord}
              className="text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:opacity-90"
            >
              Tap / Space
            </button>
            <span className="text-[10px] text-gray-500">
              {wordIdx}/{words.length}
            </span>
            <button
              type="button"
              onClick={undoLast}
              disabled={marks.length === 0}
              className="text-xs px-2 py-1 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-30"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50"
            >
              Reset
            </button>
          </>
        )}
        {mode === "done" && (
          <>
            <button
              type="button"
              onClick={startTiming}
              className="text-xs px-3 py-1.5 rounded bg-brown text-white hover:opacity-90"
            >
              Redo
            </button>
            <button
              type="button"
              onClick={clearTimings}
              className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {mode === "timing" && (
        <div className="text-[10px] text-gray-400">
          Audio is playing. Tap the button or press Space each time the next word is spoken.
        </div>
      )}
    </div>
  );
};

export default MeaningTimingEditor;
