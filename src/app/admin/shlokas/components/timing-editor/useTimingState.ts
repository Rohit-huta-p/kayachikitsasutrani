"use client";

import { useCallback, useState } from "react";
import { type WordEntry, makeWordId } from "./types";

function sortByLineStart(arr: WordEntry[]): WordEntry[] {
  return [...arr].sort((a, b) => a.lineStart - b.lineStart);
}

export interface TimingStateApi {
  words: WordEntry[];
  addFromLineRegion: (start: number, end: number) => string;
  updateLineRegion: (id: string, start: number, end: number) => void;
  setFullRegion: (id: string, start: number, end: number) => void;
  setText: (id: string, text: string) => void;
  remove: (id: string) => void;
  /**
   * Split a word's line region at the given time. The original keeps
   * [start, atTime], a new entry takes [atTime, end]. Both entries have
   * fullStart/fullEnd reset to null (admin marks them again on full audio).
   * Returns the new entry's id, or null if the split is invalid (no such
   * word, time outside the region, or zero-width split).
   */
  splitAtTime: (id: string, atTime: number) => string | null;
}

export function useTimingState(
  initial: WordEntry[],
  onChange?: (next: WordEntry[]) => void,
): TimingStateApi {
  const [words, setWords] = useState<WordEntry[]>(() => sortByLineStart(initial));

  const commit = useCallback(
    (next: WordEntry[]) => {
      const sorted = sortByLineStart(next);
      setWords(sorted);
      onChange?.(sorted);
    },
    [onChange],
  );

  const addFromLineRegion = useCallback(
    (start: number, end: number): string => {
      const id = makeWordId();
      commit([
        ...words,
        { id, text: "", lineStart: start, lineEnd: end, fullStart: null, fullEnd: null },
      ]);
      return id;
    },
    [commit, words],
  );

  const updateLineRegion = useCallback(
    (id: string, start: number, end: number) => {
      commit(words.map((w) => (w.id === id ? { ...w, lineStart: start, lineEnd: end } : w)));
    },
    [commit, words],
  );

  const setFullRegion = useCallback(
    (id: string, start: number, end: number) => {
      commit(words.map((w) => (w.id === id ? { ...w, fullStart: start, fullEnd: end } : w)));
    },
    [commit, words],
  );

  const setText = useCallback(
    (id: string, text: string) => {
      commit(words.map((w) => (w.id === id ? { ...w, text } : w)));
    },
    [commit, words],
  );

  const remove = useCallback(
    (id: string) => {
      commit(words.filter((w) => w.id !== id));
    },
    [commit, words],
  );

  const splitAtTime = useCallback(
    (id: string, atTime: number): string | null => {
      const target = words.find((w) => w.id === id);
      if (!target) return null;
      const epsilon = 0.01; // 10ms minimum on each side
      if (atTime <= target.lineStart + epsilon || atTime >= target.lineEnd - epsilon) {
        return null;
      }
      const newId = makeWordId();
      const updated = words.map((w) =>
        w.id === id
          ? { ...w, lineEnd: atTime, fullStart: null, fullEnd: null }
          : w,
      );
      // Insert the new entry right after the original; commit will re-sort by lineStart.
      const next: WordEntry = {
        id: newId,
        text: "",
        lineStart: atTime,
        lineEnd: target.lineEnd,
        fullStart: null,
        fullEnd: null,
      };
      commit([...updated, next]);
      return newId;
    },
    [commit, words],
  );

  return { words, addFromLineRegion, updateLineRegion, setFullRegion, setText, remove, splitAtTime };
}
