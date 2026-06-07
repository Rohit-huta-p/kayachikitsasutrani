"use client";

import React from "react";
import { SkipBack, SkipForward, Play, Pause, Eye, EyeOff } from "lucide-react";

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
  /** Current playback speed multiplier (e.g. 1, 1.25) */
  speed?: number;
  onPlayPause: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onToggleHide?: () => void;
  /** Tap-to-cycle through speed options. */
  onCycleSpeed?: () => void;
  /** Fractional positions (0..1) along the bar where each line ends. */
  lineBoundaries?: number[];
}

function mmss(s?: number): string {
  if (s === undefined || !isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function fmtSpeed(s: number): string {
  // 1 → "1x", 1.25 → "1.25x", 0.5 → "0.5x"
  return `${Number.isInteger(s) ? s : s.toFixed(2).replace(/0$/, "")}x`;
}

const MiniPlayer: React.FC<Props> = ({
  currentLine, totalLines, rep, maxReps, status, progress, elapsedSec, totalSec, hidden,
  speed, onPlayPause, onSkipPrev, onSkipNext, onToggleHide, onCycleSpeed, lineBoundaries,
}) => {
  const mainLabel = status === "playing" ? "Pause" : status === "paused" ? "Resume" : status === "done" ? "Replay" : "Play";

  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 bg-accent-soft border-t border-accent z-30 anim-player-slide-up">
      <div className="max-w-md mx-auto px-3 py-2">
        <div className="flex items-center justify-between text-[10px] font-semibold text-brown mb-1.5">
          <span>Line {currentLine} · Rep {rep}/{maxReps}</span>
          <div className="flex items-center gap-2">
            {onCycleSpeed && speed !== undefined && (
              <button
                type="button"
                onClick={onCycleSpeed}
                aria-label={`Playback speed ${fmtSpeed(speed)} — tap to change`}
                title="Tap to change playback speed"
                className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                  speed === 1
                    ? "bg-white border-[#E5DDD0] text-brown"
                    : "bg-accent text-white border-accent"
                }`}
              >
                {fmtSpeed(speed)}
              </button>
            )}
            <span className="text-gray-500">{mmss(elapsedSec)} / {mmss(totalSec)}</span>
          </div>
        </div>
        <div className="relative bg-[#E5DDD0] rounded h-1.5 overflow-visible mb-2">
          <div
            className="bg-accent h-full rounded transition-all"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
          {lineBoundaries?.map((frac, i) => {
            const pct = Math.max(0, Math.min(1, frac)) * 100;
            return (
              <span
                key={i}
                aria-hidden="true"
                className="absolute"
                style={{
                  left: `${pct}%`,
                  top: -3,
                  bottom: -3,
                  width: 2,
                  background: "#5C4A33",
                  borderRadius: 1,
                  transform: "translateX(-1px)",
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={onSkipPrev} className="touch-target rounded-full bg-white border border-[#E5DDD0] text-brown" aria-label="Skip previous line">
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={onPlayPause} className="touch-target rounded-full bg-accent text-white text-lg" aria-label={mainLabel} title={mainLabel}>
            {status === "playing" ? (
              <Pause size={20} aria-hidden="true" />
            ) : (
              <Play size={20} aria-hidden="true" />
            )}
          </button>
          <button type="button" onClick={onSkipNext} className="touch-target rounded-full bg-white border border-[#E5DDD0] text-brown" aria-label="Skip next line">
            <SkipForward size={18} aria-hidden="true" />
          </button>
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className={`touch-target rounded-full border text-brown ${hidden ? "bg-accent text-white border-accent" : "bg-white border-[#E5DDD0]"}`}
              aria-label={hidden ? "Show Sanskrit" : "Hide Sanskrit"}
              title={hidden ? "Show Sanskrit" : "Hide Sanskrit"}
            >
              {hidden ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
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
