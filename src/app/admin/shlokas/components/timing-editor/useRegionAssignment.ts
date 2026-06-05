"use client";

import { useCallback, useMemo, useState } from "react";

export interface Region {
  id: string;
  start: number;
  end: number;
  /** Optional caption derived from line sanskrit (admin-set later) or empty. */
  text?: string;
}

interface State {
  /** All regions marked on the waveform, keyed by id. */
  regions: Record<string, Region>;
  /** assignment[regionId] === lineIndex (>=0) OR undefined (unassigned). */
  assignment: Record<string, number>;
}

export interface UseRegionAssignment {
  regions: Region[];
  unassigned: Region[];
  byLine: (lineIndex: number) => Region[];
  addRegion: (r: Omit<Region, "id">) => string;
  updateRegion: (id: string, r: Partial<Omit<Region, "id">>) => void;
  removeRegion: (id: string) => void;
  assign: (regionId: string, lineIndex: number) => void;
  unassign: (regionId: string) => void;
  /** Build the lines[] shape expected by ShlokaInput from current assignments. */
  buildLines: (lineSanskritList: string[]) => Array<{
    sanskrit: string;
    fullTimings: Array<{ text: string; start: number; end: number }>;
  }>;
}

let nextId = 0;

export function useRegionAssignment(
  initialRegions: Region[] = [],
  initialAssignment: Record<string, number> = {},
): UseRegionAssignment {
  const [state, setState] = useState<State>(() => ({
    regions: Object.fromEntries(initialRegions.map((r) => [r.id, r])),
    assignment: { ...initialAssignment },
  }));

  const addRegion = useCallback((r: Omit<Region, "id">): string => {
    const id = `r${++nextId}_${Date.now()}`;
    setState((s) => ({
      regions: { ...s.regions, [id]: { ...r, id } },
      assignment: s.assignment,
    }));
    return id;
  }, []);

  const updateRegion = useCallback((id: string, patch: Partial<Omit<Region, "id">>) => {
    setState((s) => {
      if (!s.regions[id]) return s;
      return {
        regions: { ...s.regions, [id]: { ...s.regions[id], ...patch } },
        assignment: s.assignment,
      };
    });
  }, []);

  const removeRegion = useCallback((id: string) => {
    setState((s) => {
      const regions = { ...s.regions };
      const assignment = { ...s.assignment };
      delete regions[id];
      delete assignment[id];
      return { regions, assignment };
    });
  }, []);

  const assign = useCallback((regionId: string, lineIndex: number) => {
    setState((s) => ({
      regions: s.regions,
      assignment: { ...s.assignment, [regionId]: lineIndex },
    }));
  }, []);

  const unassign = useCallback((regionId: string) => {
    setState((s) => {
      const assignment = { ...s.assignment };
      delete assignment[regionId];
      return { regions: s.regions, assignment };
    });
  }, []);

  const regions = useMemo(
    () => Object.values(state.regions).sort((a, b) => a.start - b.start),
    [state.regions],
  );

  const unassigned = useMemo(
    () => regions.filter((r) => state.assignment[r.id] === undefined),
    [regions, state.assignment],
  );

  const byLine = useCallback(
    (lineIndex: number): Region[] =>
      regions.filter((r) => state.assignment[r.id] === lineIndex),
    [regions, state.assignment],
  );

  const buildLines = useCallback(
    (lineSanskritList: string[]) => {
      return lineSanskritList.map((sanskrit, lineIndex) => {
        const sanskritWords = sanskrit.split(/\s+/).filter(Boolean);
        const regs = regions.filter((r) => state.assignment[r.id] === lineIndex);
        return {
          sanskrit,
          fullTimings: regs.map((r, k) => ({
            text: sanskritWords[k] ?? r.text ?? "",
            start: r.start,
            end: r.end,
          })),
        };
      });
    },
    [regions, state.assignment],
  );

  return {
    regions,
    unassigned,
    byLine,
    addRegion,
    updateRegion,
    removeRegion,
    assign,
    unassign,
    buildLines,
  };
}
