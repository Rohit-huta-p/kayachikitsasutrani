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

    const onReady = () => setReady(true);
    const onErrorEvt = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      onErrorRef.current?.(msg);
    };
    ws.on("ready", onReady);
    ws.on("error", onErrorEvt);

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
      e.stopPropagation();
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

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full" />
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          className="px-2 py-0.5 border rounded"
        >
          ▶︎ / ⏸︎
        </button>
        <button
          type="button"
          onClick={() => wsRef.current?.stop()}
          disabled={!ready}
          className="px-2 py-0.5 border rounded"
        >
          ⏹
        </button>
        {!ready && <span className="text-gray-500">Loading audio…</span>}
      </div>
    </div>
  );
};

export default Waveform;
