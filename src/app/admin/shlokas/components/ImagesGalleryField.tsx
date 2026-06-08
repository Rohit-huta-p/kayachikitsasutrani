"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  /** Up to 5 images. */
  values: ShlokaAssetInput[];
  onChange: (next: ShlokaAssetInput[]) => void;
  max?: number;
  label?: string;
}

const ImagesGalleryField: React.FC<Props> = ({
  values,
  onChange,
  max = 5,
  label = "Images (up to 5)",
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (values.length >= max) {
      setError(`Max ${max} images`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const asset = await api.admin.uploads.image(file);
      onChange([...values, { url: asset.url, publicId: asset.publicId }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = (i: number) => {
    onChange(values.filter((_, k) => k !== i));
  };

  const moveLeft = (i: number) => {
    if (i === 0) return;
    const next = [...values];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,.jpg,.jpeg"
        onChange={handleFile}
        disabled={uploading || values.length >= max}
        className="hidden"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {values.map((img, i) => (
          <div
            key={img.url + i}
            className="relative w-20 h-16 rounded border border-[#E5DDD0] overflow-hidden bg-[#2A1F12] group"
          >
            <Image
              src={img.url}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove image"
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5"
            >
              <X size={10} />
            </button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => moveLeft(i)}
                aria-label="Move left"
                className="absolute bottom-0.5 left-0.5 bg-black/60 text-white rounded text-[9px] px-1"
                title="Move left"
              >
                ←
              </button>
            )}
            <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1 rounded">
              {i + 1}
            </span>
          </div>
        ))}
        {values.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-20 h-16 rounded border-2 border-dashed border-[#E5DDD0] flex flex-col items-center justify-center text-xs text-gray-500 hover:bg-accent-soft transition disabled:opacity-50"
          >
            <Plus size={14} />
            {uploading ? "…" : "Add"}
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <p className="text-[10px] text-gray-400">
        {values.length} / {max} · .jpg only · drag-reorder via the ← buttons
      </p>
    </div>
  );
};

export default ImagesGalleryField;
