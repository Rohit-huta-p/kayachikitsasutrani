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

const STEP = 0.05;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 100);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

const MeaningTimingEditor: React.FC<Props> = ({ audioUrl, meaningText, timings, onChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<"idle" | "timing" | "done">(timings.length > 0 ? "done" : "idle");
  const [wordIdx, setWordIdx] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const markRef = useRef<(() => void) | undefined>(undefined);

  // ── Adjust mode state ──────────────────────────────────────────────
  const [selectedIdx, setSelectedIdx] = useState(-1);

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

  // ── Tap-to-mark logic ──────────────────────────────────────────────
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

  markRef.current = markWord;

  // Spacebar / Enter to mark during timing mode
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

  // ── Adjust helpers ─────────────────────────────────────────────────
  const nudge = (field: "start" | "end", delta: number) => {
    if (selectedIdx < 0 || selectedIdx >= timings.length) return;
    const updated = timings.map((t, i) => ({ ...t }));
    const w = updated[selectedIdx];

    if (field === "start") {
      const lower = selectedIdx > 0 ? updated[selectedIdx - 1].start + STEP : 0;
      w.start = Math.max(lower, +(w.start + delta).toFixed(3));
      if (w.start >= w.end) w.start = w.end - STEP;
      // Adjust previous word's end to match
      if (selectedIdx > 0) updated[selectedIdx - 1].end = w.start;
    } else {
      const upper = selectedIdx < updated.length - 1 ? updated[selectedIdx + 1].end - STEP : duration || w.end + 10;
      w.end = Math.min(upper, +(w.end + delta).toFixed(3));
      if (w.end <= w.start) w.end = w.start + STEP;
      // Adjust next word's start to match
      if (selectedIdx < updated.length - 1) updated[selectedIdx + 1].start = w.end;
    }

    onChange(updated);
  };

  const playWord = (idx: number) => {
    const a = audioRef.current;
    if (!a || idx < 0 || idx >= timings.length) return;
    a.currentTime = timings[idx].start;
    a.play();
    // Stop at end of this word
    const stopAt = timings[idx].end;
    const check = () => {
      if (a.currentTime >= stopAt) {
        a.pause();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };

  const selectWord = (i: number) => {
    if (mode !== "done") return;
    setSelectedIdx(i === selectedIdx ? -1 : i);
    if (i !== selectedIdx) playWord(i);
  };

  // Arrow keys to nudge selected word in done mode
  useEffect(() => {
    if (mode !== "done" || selectedIdx < 0) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "ArrowLeft") { e.preventDefault(); nudge(e.shiftKey ? "end" : "start", -STEP); }
      else if (e.code === "ArrowRight") { e.preventDefault(); nudge(e.shiftKey ? "end" : "start", STEP); }
      else if (e.code === "Space") { e.preventDefault(); playWord(selectedIdx); }
      else if (e.code === "Tab") {
        e.preventDefault();
        const next = e.shiftKey
          ? (selectedIdx - 1 + timings.length) % timings.length
          : (selectedIdx + 1) % timings.length;
        setSelectedIdx(next);
        playWord(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedIdx, timings, duration]);

  if (!audioUrl) {
    return (
      <div className="text-xs text-gray-400 italic">Upload meaning audio to enable word timing.</div>
    );
  }

  const sel = selectedIdx >= 0 && selectedIdx < timings.length ? timings[selectedIdx] : null;

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
          let cls = "px-1.5 py-0.5 rounded text-xs transition-colors cursor-default ";
          if (mode === "timing") {
            if (i < wordIdx) cls += "bg-green-100 text-green-800";
            else if (i === wordIdx) cls += "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400";
            else cls += "bg-white text-gray-400 border border-gray-200";
          } else if (mode === "done") {
            cls += i === selectedIdx
              ? "bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400 cursor-pointer"
              : "bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer";
          } else {
            cls += "bg-white text-gray-500 border border-gray-200";
          }
          return (
            <span
              key={i}
              className={cls}
              onClick={() => selectWord(i)}
            >
              {w}
            </span>
          );
        })}
      </div>

      {/* Adjust panel — visible when a word is selected in done mode */}
      {mode === "done" && sel && (
        <div className="flex items-center gap-3 p-2 bg-amber-50 rounded border border-amber-200 flex-wrap">
          <span className="text-xs font-semibold text-amber-900 min-w-0 truncate max-w-24">
            {sel.text}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 w-7">Start</span>
            <button type="button" onClick={() => nudge("start", -STEP)} className="w-6 h-6 rounded border text-xs hover:bg-white">-</button>
            <span className="text-[11px] font-mono w-14 text-center">{fmt(sel.start)}</span>
            <button type="button" onClick={() => nudge("start", STEP)} className="w-6 h-6 rounded border text-xs hover:bg-white">+</button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 w-7">End</span>
            <button type="button" onClick={() => nudge("end", -STEP)} className="w-6 h-6 rounded border text-xs hover:bg-white">-</button>
            <span className="text-[11px] font-mono w-14 text-center">{fmt(sel.end)}</span>
            <button type="button" onClick={() => nudge("end", STEP)} className="w-6 h-6 rounded border text-xs hover:bg-white">+</button>
          </div>
          <button
            type="button"
            onClick={() => playWord(selectedIdx)}
            className="text-xs px-2 py-1 rounded bg-amber-500 text-white hover:opacity-90"
          >
            Play
          </button>
        </div>
      )}

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
      {mode === "done" && selectedIdx < 0 && (
        <div className="text-[10px] text-gray-400">
          Click any word to adjust its timing. Arrow keys nudge start (Shift+Arrow for end). Tab moves to next word.
        </div>
      )}
    </div>
  );
};

export default MeaningTimingEditor;
