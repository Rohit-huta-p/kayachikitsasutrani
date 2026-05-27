"use client";

import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  label: string;
  value?: ShlokaAssetInput;
  onChange: (asset: ShlokaAssetInput | undefined) => void;
}

const AudioUploadField: React.FC<Props> = ({ label, value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await api.admin.uploads.audio(file);
      onChange({ url: res.url, publicId: res.publicId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp3"
        onChange={handleFile}
        disabled={uploading}
        className="hidden"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {!value ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-dashed border-brown text-brown hover:bg-white/60 transition disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-brown border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3v9.5a3.5 3.5 0 11-1-2.45V5h8V3z"/></svg>
                Upload audio
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white/70 border border-gray-200 rounded-lg pl-2 pr-1 py-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-brown shrink-0">
              <path d="M12 3v9.5a3.5 3.5 0 11-1-2.45V5h8V3z" />
            </svg>
            <audio controls src={value.url} className="h-7 max-w-[260px]" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              title="Replace"
              className="text-xs px-2 py-0.5 rounded hover:bg-gray-100 text-gray-700"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              title="Remove"
              aria-label="Remove audio"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-red-500"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default AudioUploadField;
