"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PlayerState } from "./playerReducer";

interface Result {
  /** True after a successful POST in this session (either creation or already-completed). */
  submitted: boolean;
  /** True if backend reports this user had already completed earlier. */
  alreadyCompleted: boolean;
  /** Server-reported attempts (from completion record). */
  attempts?: number;
  /** Server-reported elapsedSeconds. */
  elapsedSeconds?: number;
  /** Triggered on successful POST so the leaderboard can refetch. */
  completionVersion: number;
}

/**
 * Watches the player state. Counts attempts (every transition into PLAYING_LINE
 * from IDLE/DONE/PAUSED). On reaching DONE for the first time this session,
 * POSTs the completion to the backend.
 */
export function useCompletionTracker(slug: string | undefined, state: PlayerState): Result {
  const [submitted, setSubmitted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [attempts, setAttempts] = useState<number | undefined>();
  const [elapsedSeconds, setElapsedSeconds] = useState<number | undefined>();
  const [completionVersion, setCompletionVersion] = useState(0);

  const attemptsRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const prevStatusRef = useRef<PlayerState["status"]>(state.status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = state.status;
    prevStatusRef.current = curr;

    // Count an attempt every time we transition from IDLE/DONE into PLAYING_LINE
    if (curr === "PLAYING_LINE" && (prev === "IDLE" || prev === "DONE" || prev === undefined)) {
      attemptsRef.current += 1;
      if (attemptsRef.current === 1) {
        startedAtRef.current = Date.now();
      }
    }

    // On reaching DONE, submit completion once
    if (curr === "DONE" && !submitted && slug && startedAtRef.current !== null) {
      const elapsed = Math.max(0, (Date.now() - startedAtRef.current) / 1000);
      const att = attemptsRef.current || 1;
      api.shlokas
        .complete(slug, { attempts: att, elapsedSeconds: elapsed })
        .then((res) => {
          setSubmitted(true);
          setAlreadyCompleted(res.alreadyCompleted);
          setAttempts(res.completion.attempts);
          setElapsedSeconds(res.completion.elapsedSeconds);
          setCompletionVersion((v) => v + 1);
        })
        .catch(() => {
          // Swallow — next DONE in this session won't retry. Could add retry later.
        });
    }
  }, [state.status, slug, submitted]);

  return { submitted, alreadyCompleted, attempts, elapsedSeconds, completionVersion };
}
