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

  return { words, addFromLineRegion, updateLineRegion, setFullRegion, setText, remove };
}
