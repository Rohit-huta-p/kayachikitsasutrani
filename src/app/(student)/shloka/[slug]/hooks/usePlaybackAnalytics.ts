"use client";

import { useEffect, useRef } from "react";
import { trackActivity } from "@/lib/analytics/activityTracker";
import type { PlayerState } from "./useSeekShlokaPlayer";

/**
 * Counts recitation plays (starting from rest) and full run-throughs
 * (reaching DONE after the line-by-line and full-audio repetitions).
 */
export function usePlaybackAnalytics(status: PlayerState["status"]): void {
  const prevRef = useRef(status);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = status;
    const fromRest = prev === "IDLE" || prev === "DONE";
    if (fromRest && (status === "PLAYING_LINE" || status === "PLAYING_FULL")) trackActivity("audioPlays");
    if (status === "DONE" && prev !== "DONE") trackActivity("audioCompletes");
  }, [status]);
}
