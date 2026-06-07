// src/app/(student)/shloka/[slug]/hooks/useSeekShlokaPlayer.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicShloka as Shloka } from '@/lib/auth/types';

export const REPETITIONS = 3;
const PAUSE_MS = 500;

export type PlayerState =
  | { status: 'IDLE' }
  | { status: 'PLAYING_LINE'; line: number; rep: number }
  | { status: 'PLAYING_FULL'; rep: number }
  | { status: 'PAUSED'; prev: PlayerState }
  | { status: 'DONE' };

export interface ShlokaPlayerApi {
  state: PlayerState;
  currentLine: number;
  currentWordIndex: number;
  rep: number;
  totalLines: number;
  REPETITIONS: number;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentSrc: string | null;
  play: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skipNext: () => void;
  skipPrev: () => void;
}

type Mode = 'LINE' | 'FULL';

type SeekStatus = 'IDLE' | 'PLAYING_LINE' | 'PLAYING_FULL' | 'PAUSED' | 'DONE';

interface SeekState {
  status: SeekStatus;
  mode: Mode;
  line: number;
  rep: number;
  resumeMode?: Mode;
  resumeLine?: number;
  resumeRep?: number;
}

const INITIAL: SeekState = { status: 'IDLE', mode: 'LINE', line: 0, rep: 0 };

/**
 * Map our internal SeekState onto a PlayerState discriminated union so
 * consumers reading `state.status` keep working with the same shape used by
 * `useLegacyShlokaPlayer`.
 */
function toPlayerState(s: SeekState): PlayerState {
  switch (s.status) {
    case 'IDLE':
      return { status: 'IDLE' };
    case 'DONE':
      return { status: 'DONE' };
    case 'PLAYING_LINE':
      return { status: 'PLAYING_LINE', line: s.line, rep: s.rep };
    case 'PLAYING_FULL':
      return { status: 'PLAYING_FULL', rep: s.rep };
    case 'PAUSED': {
      const prev: PlayerState =
        s.resumeMode === 'FULL'
          ? { status: 'PLAYING_FULL', rep: s.resumeRep ?? 1 }
          : { status: 'PLAYING_LINE', line: s.resumeLine ?? 0, rep: s.resumeRep ?? 1 };
      return { status: 'PAUSED', prev };
    }
  }
}

export function useSeekShlokaPlayer(shloka: Shloka): ShlokaPlayerApi {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [s, setS] = useState<SeekState>(INITIAL);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  const fullUrl: string | null = shloka.audio?.full?.url ?? null;
  const totalLines = shloka.lines?.length ?? 0;

  // Clear any pending pause timer.
  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => clearPauseTimer();
  }, [clearPauseTimer]);

  // Window [start, end] for line K from its fullTimings.
  const lineWindow = useCallback(
    (k: number): [number, number] | null => {
      const t = shloka.lines?.[k]?.fullTimings ?? [];
      if (t.length === 0) return null;
      return [t[0].start, t[t.length - 1].end];
    },
    [shloka],
  );

  // Drive the audio element when status/line/rep changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (s.status === 'PLAYING_LINE') {
      const win = lineWindow(s.line);
      if (!win) {
        // No timings on this line — skip to the next line, or to FULL if last.
        clearPauseTimer();
        if (s.line + 1 < totalLines) {
          setS({ status: 'PLAYING_LINE', mode: 'LINE', line: s.line + 1, rep: 1 });
        } else {
          setS({ status: 'PLAYING_FULL', mode: 'FULL', line: 0, rep: 1 });
        }
        return;
      }
      try {
        audio.currentTime = win[0];
      } catch {
        /* ignore – seek may fail before metadata loads */
      }
      void audio.play().catch(() => {
        /* user-gesture / autoplay blocked */
      });
    } else if (s.status === 'PLAYING_FULL') {
      // Only seek-to-start when entering a fresh rep (audio is paused or near 0).
      // Otherwise s.line tracking updates during playback would constantly reset
      // the playhead and prevent any progress.
      if (audio.paused || audio.currentTime < 0.1) {
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        void audio.play().catch(() => {
          /* */
        });
      }
    } else {
      // IDLE | PAUSED | DONE → stop the element.
      audio.pause();
    }
  }, [s.status, s.line, s.rep, lineWindow, totalLines, clearPauseTimer]);

  // timeupdate: word highlight + end-of-window detection
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const t = audio.currentTime;

      if (s.status === 'PLAYING_LINE') {
        const arr = shloka.lines?.[s.line]?.fullTimings ?? [];
        const idx = arr.findIndex((w) => t >= w.start && t < w.end);
        setCurrentWordIndex(idx);

        // End-of-window detection: pause + advance.
        const win = lineWindow(s.line);
        if (win && t >= win[1] - 0.02) {
          audio.pause();
          clearPauseTimer();
          const snap = s;
          if (snap.rep < REPETITIONS) {
            pauseTimerRef.current = setTimeout(() => {
              pauseTimerRef.current = null;
              setS({
                status: 'PLAYING_LINE',
                mode: 'LINE',
                line: snap.line,
                rep: snap.rep + 1,
              });
            }, PAUSE_MS);
          } else if (snap.line + 1 < totalLines) {
            pauseTimerRef.current = setTimeout(() => {
              pauseTimerRef.current = null;
              setS({
                status: 'PLAYING_LINE',
                mode: 'LINE',
                line: snap.line + 1,
                rep: 1,
              });
            }, PAUSE_MS);
          } else {
            pauseTimerRef.current = setTimeout(() => {
              pauseTimerRef.current = null;
              setS({ status: 'PLAYING_FULL', mode: 'FULL', line: 0, rep: 1 });
            }, PAUSE_MS);
          }
        }
      } else if (s.status === 'PLAYING_FULL') {
        // Track which line we're in (for highlighting) + word within it.
        let foundLine = -1;
        let foundIdx = -1;
        const lines = shloka.lines ?? [];
        for (let i = 0; i < lines.length; i++) {
          const arr = lines[i].fullTimings ?? [];
          const k = arr.findIndex((w) => t >= w.start && t < w.end);
          if (k >= 0) {
            foundLine = i;
            foundIdx = k;
            break;
          }
        }
        setCurrentWordIndex(foundIdx);
        if (foundLine >= 0 && foundLine !== s.line) {
          setS((prev) =>
            prev.status === 'PLAYING_FULL' ? { ...prev, line: foundLine } : prev,
          );
        }
      } else {
        setCurrentWordIndex(-1);
      }
    };

    const onEnded = () => {
      if (s.status === 'PLAYING_FULL') {
        clearPauseTimer();
        const snap = s;
        if (snap.rep < REPETITIONS) {
          pauseTimerRef.current = setTimeout(() => {
            pauseTimerRef.current = null;
            setS({
              status: 'PLAYING_FULL',
              mode: 'FULL',
              line: 0,
              rep: snap.rep + 1,
            });
          }, PAUSE_MS);
        } else {
          setS({ ...INITIAL, status: 'DONE' });
          setCurrentWordIndex(-1);
        }
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [s, shloka, lineWindow, totalLines, clearPauseTimer]);

  const play = useCallback(() => {
    clearPauseTimer();
    setS((prev) => {
      if (prev.status === 'IDLE' || prev.status === 'DONE') {
        return { status: 'PLAYING_LINE', mode: 'LINE', line: 0, rep: 1 };
      }
      return prev;
    });
  }, [clearPauseTimer]);

  const pause = useCallback(() => {
    clearPauseTimer();
    setS((prev) => {
      if (prev.status !== 'PLAYING_LINE' && prev.status !== 'PLAYING_FULL') {
        return prev;
      }
      return {
        ...prev,
        status: 'PAUSED',
        resumeMode: prev.mode,
        resumeLine: prev.line,
        resumeRep: prev.rep,
      };
    });
  }, [clearPauseTimer]);

  const resume = useCallback(() => {
    setS((prev) => {
      if (prev.status !== 'PAUSED') return prev;
      const resumeMode = prev.resumeMode ?? prev.mode;
      return {
        ...prev,
        status: resumeMode === 'FULL' ? 'PLAYING_FULL' : 'PLAYING_LINE',
        mode: resumeMode,
        line: prev.resumeLine ?? prev.line,
        rep: prev.resumeRep ?? Math.max(1, prev.rep),
      };
    });
  }, []);

  const reset = useCallback(() => {
    clearPauseTimer();
    setS(INITIAL);
    setCurrentWordIndex(-1);
  }, [clearPauseTimer]);

  const skipPrev = useCallback(() => {
    clearPauseTimer();
    setS((prev) => ({
      status: 'PLAYING_LINE',
      mode: 'LINE',
      line: Math.max(0, prev.line - 1),
      rep: 1,
    }));
  }, [clearPauseTimer]);

  const skipNext = useCallback(() => {
    clearPauseTimer();
    setS((prev) => {
      const next = prev.line + 1;
      if (next >= totalLines) {
        return { status: 'PLAYING_FULL', mode: 'FULL', line: 0, rep: 1 };
      }
      return { status: 'PLAYING_LINE', mode: 'LINE', line: next, rep: 1 };
    });
  }, [totalLines, clearPauseTimer]);

  const isPlaying = s.status === 'PLAYING_LINE' || s.status === 'PLAYING_FULL';
  const reportedRep = isPlaying ? s.rep : 0;

  // currentLine: -1 unless actively playing (line index during PLAYING_LINE,
  // tracked line during PLAYING_FULL).
  const currentLine =
    s.status === 'PLAYING_LINE' || s.status === 'PLAYING_FULL' ? s.line : -1;

  return {
    state: toPlayerState(s),
    currentLine,
    currentWordIndex,
    rep: reportedRep,
    totalLines,
    REPETITIONS,
    isPlaying,
    audioRef,
    currentSrc: fullUrl,
    play,
    pause,
    resume,
    reset,
    skipNext,
    skipPrev,
  };
}
