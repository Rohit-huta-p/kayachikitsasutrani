"use client";

import React, { useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import type { ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  label: string;
  value?: ShlokaAssetInput;
  onChange: (asset: ShlokaAssetInput | undefined) => void;
}

const ImageUploadField: React.FC<Props> = ({ label, value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await api.admin.uploads.image(file);
      onChange({ url: res.url, publicId: res.publicId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <label className="font-semibold text-sm">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          disabled={uploading}
          className="text-sm"
        />
        {uploading && <span className="text-sm">Uploading…</span>}
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs text-red-600 underline"
          >
            Remove
          </button>
        )}
      </div>
      {value && (
        <div className="relative w-32 h-24">
          <Image src={value.url} alt={label} fill className="object-cover rounded" sizes="128px" />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default ImageUploadField;
