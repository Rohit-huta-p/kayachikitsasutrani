"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region as WsRegion } from "wavesurfer.js/plugins/regions";
import type { Region } from "./types";

interface Props {
  audioUrl: string;
  regions: Region[];
  /** Region fill color (rgba). */
  color?: string;
  /** Region currently highlighted (sidebar selection). */
  highlightedId?: string;
  /**
   * Called when admin drags a new region. Parent returns the canonical id
   * to bind, or null to drop the region (Waveform will remove it).
   */
  onRegionCreate: (start: number, end: number) => string | null;
  /** Called when admin drags an existing region's bounds. */
  onRegionUpdate: (id: string, start: number, end: number) => void;
  /** Called when admin clicks a region (for sidebar sync). */
  onRegionClick?: (id: string) => void;
  /** Called if audio fails to load. */
  onError?: (msg: string) => void;
  /** Called when playhead time changes (every frame during playback + on seek). */
  onTimeUpdate?: (t: number) => void;
  /** px; default 80. */
  height?: number;
}

const DEFAULT_COLOR = "rgba(124, 95, 60, 0.25)";
const HIGHLIGHT_COLOR = "rgba(124, 95, 60, 0.5)";

const Waveform: React.FC<Props> = ({
  audioUrl,
  regions,
  color,
  highlightedId,
  onRegionCreate,
  onRegionUpdate,
  onRegionClick,
  onError,
  onTimeUpdate,
  height = 80,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const wsIdToOurId = useRef<Map<string, string>>(new Map());
  const ourIdToWsRegion = useRef<Map<string, WsRegion>>(new Map());
  /** True while we're calling rp.addRegion programmatically — suppresses the region-created listener. */
  const programmaticAdd = useRef(false);
  const [ready, setReady] = useState(false);
  /** Zoom level in pixels-per-second. 0 = fit-to-container. */
  const [zoom, setZoom] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Latest callback refs (avoid re-initing WaveSurfer when handlers change)
  const onRegionCreateRef = useRef(onRegionCreate);
  const onRegionUpdateRef = useRef(onRegionUpdate);
  const onRegionClickRef = useRef(onRegionClick);
  const onErrorRef = useRef(onError);
  useEffect(() => { onRegionCreateRef.current = onRegionCreate; }, [onRegionCreate]);
  useEffect(() => { onRegionUpdateRef.current = onRegionUpdate; }, [onRegionUpdate]);
  useEffect(() => { onRegionClickRef.current = onRegionClick; }, [onRegionClick]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Init WaveSurfer once per audioUrl
  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    wsIdToOurId.current.clear();
    ourIdToWsRegion.current.clear();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#a8a29e",
      progressColor: "#7c5f3c",
      cursorColor: "#000",
      cursorWidth: 1,
      height,
      url: audioUrl,
    });
    const rp = ws.registerPlugin(RegionsPlugin.create());
    rp.enableDragSelection({ color: color ?? DEFAULT_COLOR });

    wsRef.current = ws;
    regionsPluginRef.current = rp;

    const onReady = () => {
      setReady(true);
      setDuration(ws.getDuration?.() || 0);
    };
    const onErrorEvt = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      onErrorRef.current?.(msg);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdateInternal = (t: number) => {
      setCurrentTime(t);
      onTimeUpdate?.(t);
    };
    ws.on("ready", onReady);
    ws.on("error", onErrorEvt);
    ws.on("play", onPlay);
    ws.on("pause", onPause);
    ws.on("finish", onPause);
    ws.on("timeupdate", onTimeUpdateInternal);

    rp.on("region-created", (region: WsRegion) => {
      // Skip if this region came from us (we added it programmatically via the sync effect).
      if (programmaticAdd.current) return;
      // Skip if it's already mapped (defensive).
      if (wsIdToOurId.current.has(region.id)) return;
      const id = onRegionCreateRef.current(region.start, region.end);
      if (id === null) {
        // Parent dropped it — remove from WaveSurfer.
        region.remove();
        return;
      }
      // If the parent already has a region for this id (e.g. drag on full
      // waveform when the highlighted word already had a fullStart/fullEnd),
      // the regions sync effect would duplicate. Defer to the sync.
      if (ourIdToWsRegion.current.has(id)) {
        region.remove();
        return;
      }
      wsIdToOurId.current.set(region.id, id);
      ourIdToWsRegion.current.set(id, region);
    });
    rp.on("region-updated", (region: WsRegion) => {
      const ourId = wsIdToOurId.current.get(region.id);
      if (ourId) onRegionUpdateRef.current(ourId, region.start, region.end);
    });
    rp.on("region-clicked", (region: WsRegion, e: MouseEvent) => {
      // Allow click-to-seek even when clicking inside a region. Compute the
      // seek time from the click position relative to the waveform container.
      // Note: don't stopPropagation — let parent state handle selection too.
      const wrapper = containerRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const scrollLeft = wrapper.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft;
        const dur = ws.getDuration?.() || 0;
        if (dur > 0) {
          const totalWidth = wrapper.scrollWidth || rect.width;
          const ratio = Math.max(0, Math.min(1, x / totalWidth));
          ws.setTime(ratio * dur);
        }
      }
      const ourId = wsIdToOurId.current.get(region.id);
      if (ourId) onRegionClickRef.current?.(ourId);
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsPluginRef.current = null;
    };
    // Intentionally re-init when audioUrl or height changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, height]);

  // Apply zoom when slider/buttons change or when audio becomes ready.
  // WaveSurfer throws "No audio loaded" if zoom is called before the decoded
  // audio buffer is attached — even when our `ready` flag is true (the
  // 'ready' event can fire before duration is set in some edge cases).
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    try {
      // Guard: duration must be a positive number before zoom is meaningful.
      const dur = ws.getDuration?.();
      if (!dur || dur <= 0) return;
      ws.zoom(zoom);
    } catch (err) {
      // Swallow — audio not ready yet. Next effect run (after a real change)
      // will apply the zoom correctly.
      console.warn('[Waveform] zoom skipped:', err);
    }
  }, [zoom, ready]);

  // Sync `regions` prop into the plugin once ready
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp || !ready) return;

    const incomingIds = new Set(regions.map((r) => r.id));

    // Remove regions that disappeared from props
    for (const [ourId, wsRegion] of Array.from(ourIdToWsRegion.current.entries())) {
      if (!incomingIds.has(ourId)) {
        wsRegion.remove();
        wsIdToOurId.current.delete(wsRegion.id);
        ourIdToWsRegion.current.delete(ourId);
      }
    }

    // Add or update incoming regions
    for (const r of regions) {
      const existing = ourIdToWsRegion.current.get(r.id);
      const fill = r.id === highlightedId ? HIGHLIGHT_COLOR : (color ?? DEFAULT_COLOR);
      if (!existing) {
        programmaticAdd.current = true;
        const wsRegion = rp.addRegion({
          start: r.start,
          end: r.end,
          color: fill,
          drag: true,
          resize: true,
        });
        programmaticAdd.current = false;
        wsIdToOurId.current.set(wsRegion.id, r.id);
        ourIdToWsRegion.current.set(r.id, wsRegion);
      } else {
        if (existing.start !== r.start || existing.end !== r.end) {
          existing.setOptions({ start: r.start, end: r.end });
        }
        existing.setOptions({ color: fill });
      }
    }
  }, [regions, highlightedId, color, ready]);

  const formatTime = (s: number): string => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  const stepZoom = (delta: number) =>
    setZoom((z) => {
      const cur = z === 0 ? 100 : z;
      return Math.max(0, Math.min(500, cur + delta));
    });

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full overflow-x-auto rounded-lg bg-gradient-to-b from-white/80 to-gray-50/80 border border-gray-200 px-2 py-1"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Transport group */}
        <div className="flex items-center gap-1 bg-white/70 border border-gray-200 rounded-lg px-1 py-0.5">
          <button
            type="button"
            onClick={() => wsRef.current?.playPause()}
            disabled={!ready}
            title={isPlaying ? "Pause (space)" : "Play (space)"}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 text-brown"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => wsRef.current?.stop()}
            disabled={!ready}
            title="Stop"
            aria-label="Stop"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 text-brown"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>
          </button>
          <span className="px-2 font-mono text-[11px] text-gray-700 select-none tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Zoom group */}
        <div className="flex items-center gap-1 bg-white/70 border border-gray-200 rounded-lg px-1 py-0.5">
          <button
            type="button"
            onClick={() => setZoom(0)}
            disabled={!ready}
            title="Fit to container"
            className={`px-2 h-7 rounded text-[11px] ${zoom === 0 ? "bg-brown text-white" : "hover:bg-gray-100 text-gray-700"}`}
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => stepZoom(-50)}
            disabled={!ready || zoom === 0}
            title="Zoom out"
            aria-label="Zoom out"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 text-brown"
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={!ready}
            className="w-24"
            style={{ accentColor: "#A67C52" }}
            title="Zoom level (pixels per second)"
          />
          <button
            type="button"
            onClick={() => stepZoom(50)}
            disabled={!ready}
            title="Zoom in"
            aria-label="Zoom in"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 text-brown"
          >
            +
          </button>
          <span className="text-[10px] text-gray-500 px-1 tabular-nums select-none w-12 text-right">
            {zoom === 0 ? "fit" : `${zoom}px/s`}
          </span>
        </div>

        {!ready && (
          <span className="text-gray-500 italic flex items-center gap-1">
            <span className="inline-block w-3 h-3 border-2 border-brown border-t-transparent rounded-full animate-spin" />
            Loading audio…
          </span>
        )}
      </div>
    </div>
  );
};

export default Waveform;
