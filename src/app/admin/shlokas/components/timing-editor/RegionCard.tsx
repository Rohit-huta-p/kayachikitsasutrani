"use client";

import React from "react";
import { X } from "lucide-react";
import type { Region } from "./useRegionAssignment";

interface Props {
  region: Region;
  onRemove?: () => void;
  /** Drag handler — must call e.dataTransfer.setData("text/plain", region.id). */
  onDragStart: (e: React.DragEvent) => void;
}

const RegionCard: React.FC<Props> = ({ region, onRemove, onDragStart }) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="inline-flex items-center gap-2 bg-white border border-[#E5DDD0] rounded-lg px-2 py-1 text-xs cursor-grab active:cursor-grabbing shrink-0"
    >
      <span className="font-mono text-gray-500">
        {region.start.toFixed(2)}–{region.end.toFixed(2)}s
      </span>
      {region.text && (
        <span className="text-brown font-medium truncate max-w-[100px]">{region.text}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-500 hover:text-red-700"
          aria-label="Remove region"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

export default RegionCard;
