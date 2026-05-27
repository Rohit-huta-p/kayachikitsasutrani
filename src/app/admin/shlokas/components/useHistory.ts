"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const MAX_HISTORY = 50;
/** Debounce ms — successive updates within this window collapse into one history entry. */
const DEBOUNCE_MS = 400;

export interface HistoryApi<T> {
  state: T;
  set: (next: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Reset history to a new baseline (clears past/future). */
  reset: (next: T) => void;
}

/**
 * useHistory — wraps useState with undo/redo via a past/present/future stack.
 *
 * `set` works like setState. Successive sets within DEBOUNCE_MS collapse into
 * a single history entry so dragging a slider doesn't fill the stack.
 */
export function useHistory<T>(initial: T): HistoryApi<T> {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });
  const lastCommitRef = useRef<number>(0);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState((s) => {
      const nextValue = typeof next === "function" ? (next as (p: T) => T)(s.present) : next;
      if (Object.is(nextValue, s.present)) return s;
      const now = Date.now();
      const collapse = now - lastCommitRef.current < DEBOUNCE_MS;
      lastCommitRef.current = now;
      if (collapse) {
        // Replace present without pushing to past
        return { past: s.past, present: nextValue, future: [] };
      }
      const past = [...s.past, s.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: nextValue, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: previous,
        future: [s.present, ...s.future],
      };
    });
    // After undo, force next set to push a new history entry
    lastCommitRef.current = 0;
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: [...s.past, s.present],
        present: next,
        future: s.future.slice(1),
      };
    });
    lastCommitRef.current = 0;
  }, []);

  const reset = useCallback((next: T) => {
    setState({ past: [], present: next, future: [] });
    lastCommitRef.current = 0;
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
  };
}

/**
 * useKeyboardShortcuts — global listeners for Cmd/Ctrl-modifier shortcuts.
 * Handlers fire only when the focused element is not an editable text field
 * (otherwise typing Z would trigger undo).
 */
export function useKeyboardShortcuts(handlers: {
  undo?: () => void;
  redo?: () => void;
  saveDraft?: () => void;
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditing =
        tag === "input" || tag === "textarea" || (target?.isContentEditable ?? false);
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      // Cmd+S → save draft. Always handle (even when typing).
      if (key === "s") {
        e.preventDefault();
        handlers.saveDraft?.();
        return;
      }
      // Cmd+Z / Cmd+Shift+Z — only when not editing text
      if (isEditing) return;
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) handlers.redo?.();
        else handlers.undo?.();
      } else if (key === "y") {
        e.preventDefault();
        handlers.redo?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handlers]);
}
