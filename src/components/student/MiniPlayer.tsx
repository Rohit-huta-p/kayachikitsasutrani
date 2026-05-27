"use client";

import React from "react";

interface Props {
  /** Current line number (1-indexed) */
  currentLine: number;
  /** Total lines */
  totalLines: number;
  /** Current repetition (1-indexed) */
  rep: number;
  /** Max repetitions */
  maxReps: number;
  /** "playing" | "paused" | "idle" | "done" — controls main button icon/label */
  status: "playing" | "paused" | "idle" | "done";
  /** Progress 0..1 within the current rep */
  progress: number;
  /** Elapsed seconds within current rep (for display) */
  elapsedSec?: number;
  /** Total seconds of current rep (for display) */
  totalSec?: number;
  /** Whether Sanskrit is hidden (Hide button toggle) */
  hidden?: boolean;
  onPlayPause: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onToggleHide?: () => void;
}

function mmss(s?: number): string {
  if (s === undefined || !isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

const MiniPlayer: React.FC<Props> = ({
  currentLine, totalLines, rep, maxReps, status, progress, elapsedSec, totalSec, hidden,
  onPlayPause, onSkipPrev, onSkipNext, onToggleHide,
}) => {
  const mainIcon = status === "playing" ? "⏸" : "▶";
  const mainLabel = status === "playing" ? "Pause" : status === "paused" ? "Resume" : status === "done" ? "Replay" : "Play";

  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 bg-accent-soft border-t border-accent z-30 anim-player-slide-up">
      <div className="max-w-md mx-auto px-3 py-2">
        <div className="flex items-center justify-between text-[10px] font-semibold text-brown mb-1.5">
          <span>Line {currentLine} · Rep {rep}/{maxReps}</span>
          <span className="text-gray-500">{mmss(elapsedSec)} / {mmss(totalSec)}</span>
        </div>
        <div className="bg-[#E5DDD0] rounded h-1 overflow-hidden mb-2">
          <div className="bg-accent h-full transition-all" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={onSkipPrev} className="touch-target rounded-full bg-white border border-[#E5DDD0] text-brown" aria-label="Skip previous line">
            <span aria-hidden="true">⏮</span>
          </button>
          <button type="button" onClick={onPlayPause} className="touch-target rounded-full bg-accent text-white text-lg" aria-label={mainLabel} title={mainLabel}>
            <span aria-hidden="true">{mainIcon}</span>
          </button>
          <button type="button" onClick={onSkipNext} className="touch-target rounded-full bg-white border border-[#E5DDD0] text-brown" aria-label="Skip next line">
            <span aria-hidden="true">⏭</span>
          </button>
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className={`touch-target rounded-full border text-brown ${hidden ? "bg-accent text-white border-accent" : "bg-white border-[#E5DDD0]"}`}
              aria-label={hidden ? "Show Sanskrit" : "Hide Sanskrit"}
              title={hidden ? "Show Sanskrit" : "Hide Sanskrit"}
            >
              <span aria-hidden="true">🙈</span>
            </button>
          )}
        </div>
        <div className="text-center text-[9px] text-gray-500 mt-0.5">
          {currentLine} of {totalLines}
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
