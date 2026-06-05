"use client";

import React, { useState } from "react";
import RegionCard from "./RegionCard";
import type { Region } from "./useRegionAssignment";

interface Props {
  lineIndex: number;
  sanskrit: string;
  regions: Region[];
  onSanskritChange: (next: string) => void;
  onDropRegion: (regionId: string) => void;
  onRemoveRegion: (regionId: string) => void;
}

const LineBucket: React.FC<Props> = ({
  lineIndex,
  sanskrit,
  regions,
  onSanskritChange,
  onDropRegion,
  onRemoveRegion,
}) => {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropRegion(id);
      }}
      className={`border-2 border-dashed rounded-lg p-3 transition ${
        over ? "border-accent bg-accent-soft" : "border-[#E5DDD0] bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-brown shrink-0">Line {lineIndex + 1}</span>
        <input
          type="text"
          value={sanskrit}
          onChange={(e) => onSanskritChange(e.target.value)}
          placeholder="Sanskrit text for this line"
          className="flex-1 text-sm border border-[#E5DDD0] rounded px-2 py-1 outline-none focus:border-accent"
        />
        <span className="text-[10px] text-gray-500 shrink-0">
          {regions.length} word{regions.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {regions.length === 0 ? (
          <span className="text-[10px] text-gray-400 italic">Drop region cards here</span>
        ) : (
          regions.map((r) => (
            <RegionCard
              key={r.id}
              region={r}
              onRemove={() => onRemoveRegion(r.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", r.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default LineBucket;
