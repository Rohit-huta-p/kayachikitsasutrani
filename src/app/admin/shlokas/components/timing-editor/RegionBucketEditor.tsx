"use client";

import React, { useEffect, useState } from "react";
import { Plus, Minus } from "lucide-react";
import Waveform from "./Waveform";
import LineBucket from "./LineBucket";
import RegionCard from "./RegionCard";
import { useRegionAssignment, type Region } from "./useRegionAssignment";

interface LineSeed {
  sanskrit: string;
  fullTimings?: Array<{ text?: string; start: number; end: number }>;
}

interface Props {
  fullAudioUrl?: string;
  /** Initial line seeds; if empty, start with 1 blank line. */
  initialLines?: LineSeed[];
  /** Called whenever the structure changes — parent builds the body from this. */
  onChange: (
    lines: Array<{
      sanskrit: string;
      fullTimings: Array<{ text: string; start: number; end: number }>;
    }>,
  ) => void;
}

const RegionBucketEditor: React.FC<Props> = ({
  fullAudioUrl,
  initialLines = [{ sanskrit: "" }],
  onChange,
}) => {
  const [lineSanskrit, setLineSanskrit] = useState<string[]>(
    initialLines.map((l) => l.sanskrit ?? ""),
  );

  // Pre-seed regions + assignments from initialLines (only on first mount)
  const [seedRegions, seedAssignment] = React.useMemo(() => {
    const regions: Region[] = [];
    const assignment: Record<string, number> = {};
    let seedCounter = 0;
    initialLines.forEach((l, idx) => {
      (l.fullTimings ?? []).forEach((t) => {
        const id = `seed${seedCounter++}`;
        regions.push({ id, start: t.start, end: t.end, text: t.text });
        assignment[id] = idx;
      });
    });
    return [regions, assignment];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ra = useRegionAssignment(seedRegions, seedAssignment);

  // Sync parent on state changes
  useEffect(() => {
    onChange(ra.buildLines(lineSanskrit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ra.regions, ra.unassigned, lineSanskrit]);

  const setSanskritAt = (i: number, next: string) => {
    setLineSanskrit((prev) => prev.map((s, k) => (k === i ? next : s)));
  };

  const addLine = () => setLineSanskrit((prev) => [...prev, ""]);

  const removeLastLine = () => {
    if (lineSanskrit.length <= 1) return;
    const lastIdx = lineSanskrit.length - 1;
    // Unassign all regions in the last bucket so they don't reference a removed index.
    ra.byLine(lastIdx).forEach((r) => ra.unassign(r.id));
    setLineSanskrit((prev) => prev.slice(0, -1));
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-brown">Full-audio word regions</div>

      {fullAudioUrl ? (
        <Waveform
          audioUrl={fullAudioUrl}
          regions={ra.regions.map((r) => ({ id: r.id, start: r.start, end: r.end }))}
          onRegionCreate={(start, end) => ra.addRegion({ start, end })}
          onRegionUpdate={(id, start, end) => ra.updateRegion(id, { start, end })}
          onError={() => {}}
        />
      ) : (
        <div className="border border-dashed border-[#E5DDD0] rounded p-6 text-center text-xs text-gray-500">
          Upload the full audio first to start marking word regions.
        </div>
      )}

      {/* Unassigned pool */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="text-xs font-bold text-brown mb-2">
          Unassigned ({ra.unassigned.length})
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {ra.unassigned.length === 0 ? (
            <span className="text-[10px] text-gray-500 italic">All regions assigned ✓</span>
          ) : (
            ra.unassigned.map((r) => (
              <RegionCard
                key={r.id}
                region={r}
                onRemove={() => ra.removeRegion(r.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", r.id);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Line buckets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-brown">Lines ({lineSanskrit.length})</div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={removeLastLine}
              disabled={lineSanskrit.length <= 1}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#E5DDD0] text-brown disabled:opacity-40"
            >
              <Minus size={12} /> Remove
            </button>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-accent text-white"
            >
              <Plus size={12} /> Add line
            </button>
          </div>
        </div>
        {lineSanskrit.map((sanskrit, i) => (
          <LineBucket
            key={i}
            lineIndex={i}
            sanskrit={sanskrit}
            regions={ra.byLine(i)}
            onSanskritChange={(next) => setSanskritAt(i, next)}
            onDropRegion={(regionId) => ra.assign(regionId, i)}
            onRemoveRegion={(regionId) => ra.removeRegion(regionId)}
          />
        ))}
      </div>
    </div>
  );
};

export default RegionBucketEditor;
