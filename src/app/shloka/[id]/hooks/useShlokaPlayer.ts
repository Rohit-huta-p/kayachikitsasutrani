// src/app/shloka/[id]/hooks/useShlokaPlayer.ts
'use client';

import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import type { Shloka, WordTiming } from '@/lib/shloka.types';
import { findWordIndex } from './wordIndex';
import {
  playerReducer,
  initialState,
  REPETITIONS,
  type PlayerState,
  type PlayerEvent,
} from './playerReducer';

const PAUSE_MS = 500;

export interface ShlokaPlayerApi {
  state: PlayerState;
  /** Index of the line currently emphasized (-1 when none). */
  currentLine: number;
  /** Index of the word currently highlighted within currentLine (-1 when none). */
  currentWordIndex: number;
  /** Current repetition (1..REPETITIONS) when playing, else 0. */
  rep: number;
  totalLines: number;
  REPETITIONS: number;
  /** True while audio is actively playing (any line or full). */
  isPlaying: boolean;
  /** Element ref to attach to a single <audio> tag in the component. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** URL the <audio src> should currently use. */
  currentSrc: string | null;
  play: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skipNext: () => void;
  skipPrev: () => void;
}

export function useShlokaPlayer(shloka: Shloka): ShlokaPlayerApi {
  const ctx = { totalLines: shloka.lines.length };
  const reducer = useCallback(
    (s: PlayerState, e: PlayerEvent) => playerReducer(s, e, ctx),
    [ctx.totalLines],
  );
  const [state, dispatch] = useReducer(reducer, initialState);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [currentLineDuringFull, setCurrentLineDuringFull] = useState(0);

  // Derive currentLine + currentSrc from state
  const currentLine =
    state.status === 'PLAYING_LINE' || (state.status === 'PAUSING_REP' && state.mode === 'LINE')
      ? state.line
      : state.status === 'PLAYING_FULL' || (state.status === 'PAUSING_REP' && state.mode === 'FULL')
        ? currentLineDuringFull
        : state.status === 'PAUSING_LINE'
          ? state.nextLine
          : state.status === 'PAUSED'
            ? deriveCurrentLine(state.prev, currentLineDuringFull)
            : -1;

  const currentSrc =
    state.status === 'PLAYING_LINE' || (state.status === 'PAUSING_REP' && state.mode === 'LINE')
      ? shloka.audio.lines[state.line]
      : state.status === 'PLAYING_FULL' || (state.status === 'PAUSING_REP' && state.mode === 'FULL')
        ? shloka.audio.full
        : state.status === 'PAUSING_LINE'
          ? shloka.audio.lines[state.nextLine]
          : state.status === 'PAUSING_FULL'
            ? shloka.audio.full
            : null;

  const rep =
    state.status === 'PLAYING_LINE' || state.status === 'PLAYING_FULL'
      ? state.rep
      : state.status === 'PAUSING_REP'
        ? state.rep
        : 0;

  const isPlaying = state.status === 'PLAYING_LINE' || state.status === 'PLAYING_FULL';

  // Side effect: drive audio playback based on state
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (state.status === 'PLAYING_LINE' || state.status === 'PLAYING_FULL') {
      // Always restart from 0 when entering a playing state
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked or aborted */ });
    } else {
      a.pause();
    }
  }, [state.status, state.status === 'PLAYING_LINE' ? state.line : null, state.status === 'PLAYING_LINE' ? state.rep : null, state.status === 'PLAYING_FULL' ? state.rep : null]);

  // Side effect: pause timers
  useEffect(() => {
    if (
      state.status === 'PAUSING_REP' ||
      state.status === 'PAUSING_LINE' ||
      state.status === 'PAUSING_FULL'
    ) {
      timerRef.current = setTimeout(() => dispatch({ type: 'TIMER_DONE' }), PAUSE_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
      };
    }
  }, [state.status]);

  // Side effect: AUDIO_ENDED dispatch (also on error so we don't get stuck)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => dispatch({ type: 'AUDIO_ENDED' });
    const onError = () => {
      console.warn('Audio failed to load/play; advancing.');
      dispatch({ type: 'AUDIO_ENDED' });
    };
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, []);

  // Side effect: word highlight via RAF
  useEffect(() => {
    if (state.status !== 'PLAYING_LINE' && state.status !== 'PLAYING_FULL') {
      setCurrentWordIndex(-1);
      return;
    }

    let active = true;
    const tick = () => {
      if (!active) return;
      const a = audioRef.current;
      if (!a) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = a.currentTime;

      if (state.status === 'PLAYING_LINE') {
        const idx = findWordIndex(t, shloka.lines[state.line].words);
        setCurrentWordIndex(prev => (prev === idx ? prev : idx));
      } else {
        // PLAYING_FULL: find which line + which word within it
        let foundLine = -1;
        let foundWord = -1;
        for (let li = 0; li < shloka.lines.length; li++) {
          const widx = findWordIndex(t, shloka.lines[li].fullTimings);
          if (widx !== -1) {
            foundLine = li;
            foundWord = widx;
            break;
          }
        }
        if (foundLine !== -1) {
          setCurrentLineDuringFull(prev => (prev === foundLine ? prev : foundLine));
        }
        setCurrentWordIndex(prev => (prev === foundWord ? prev : foundWord));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [state.status, state.status === 'PLAYING_LINE' ? state.line : -1, shloka]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return {
    state,
    currentLine,
    currentWordIndex,
    rep,
    totalLines: shloka.lines.length,
    REPETITIONS,
    isPlaying,
    audioRef,
    currentSrc,
    play: () => dispatch({ type: 'PLAY' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'RESUME' }),
    reset: () => dispatch({ type: 'RESET' }),
    skipNext: () => dispatch({ type: 'SKIP_NEXT' }),
    skipPrev: () => dispatch({ type: 'SKIP_PREV' }),
  };
}

function deriveCurrentLine(prev: PlayerState, fallbackFullLine: number): number {
  if (prev.status === 'PLAYING_LINE' || (prev.status === 'PAUSING_REP' && prev.mode === 'LINE')) {
    return prev.line;
  }
  if (prev.status === 'PLAYING_FULL' || (prev.status === 'PAUSING_REP' && prev.mode === 'FULL')) {
    return fallbackFullLine;
  }
  if (prev.status === 'PAUSING_LINE') return prev.nextLine;
  return -1;
}
