"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pencil,
  Eraser,
  Hand,
  Trash2,
  Undo2,
  Crosshair,
  Plus,
  Minus,
} from "lucide-react";

const PEN_COLOR = "#5C4A33";
const PEN_WIDTH = 2.5;       // world units
const ERASER_RADIUS = 14;    // world units (at scale=1)
const GRID_SIZE = 24;        // world units between dot centres
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

// ─── Geometry helpers ────────────────────────────────────────────────────

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distToSegmentSq(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distSq(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distSq(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function strokeHitsPoint(stroke, p, radius) {
  const r2 = radius * radius;
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return distSq(pts[0], p) <= r2;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegmentSq(p, pts[i], pts[i + 1]) <= r2) return true;
  }
  return false;
}

// ─── Rendering ───────────────────────────────────────────────────────────

function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  // Quadratic-curve smoothing: each control point is a stored point, the
  // end-point of the curve is the midpoint between this and the next stored
  // point. Gives soft, ink-like curves without an external lib.
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawGrid(ctx, vp, cssW, cssH) {
  const screenSpacing = GRID_SIZE * vp.scale;
  if (screenSpacing < 10) return; // too dense at this zoom
  const worldLeft = vp.x;
  const worldTop = vp.y;
  const worldRight = vp.x + cssW / vp.scale;
  const worldBottom = vp.y + cssH / vp.scale;
  const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
  const dotR = 0.8 / vp.scale; // ~1 screen px regardless of zoom
  ctx.fillStyle = "rgba(166, 124, 82, 0.22)";
  for (let x = startX; x <= worldRight; x += GRID_SIZE) {
    for (let y = startY; y <= worldBottom; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Excalidraw-style infinite canvas.
 *
 * The visible canvas is just a viewport over an unbounded world. Strokes
 * are stored as vector paths in world coordinates and re-rendered on each
 * RAF frame; pan, zoom in, zoom out — the strokes stay sharp because the
 * canvas is repainted at the new transform, not stretched.
 *
 * Input model
 *   - Pen tool, single pointer: paints a stroke in world space.
 *   - Eraser tool, single pointer: deletes any stroke whose polyline
 *     passes within the eraser radius (works like Excalidraw's stroke
 *     eraser, not a pixel-wipe).
 *   - Pan tool, single pointer: drags the viewport.
 *   - Two pointers (touch): pinch-zoom about the centroid + pan together,
 *     regardless of which tool is selected.
 *   - Wheel / trackpad: ctrl|cmd + wheel zooms about the cursor; plain
 *     wheel pans in both axes (deltaX, deltaY).
 *
 * Width and the eraser radius are stored in world units so a stroke drawn
 * at zoom 1× still has the right thickness when the user later zooms to
 * 2× — the ink scales with the page, exactly like Excalidraw.
 */
const InfiniteCanvas = ({ tool, setTool, inFullView }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Mutable state held in refs so high-frequency pointer events don't
  // cause React re-renders (we render through requestAnimationFrame).
  const strokesRef = useRef([]);          // committed strokes
  const currentStrokeRef = useRef(null);  // in-flight pen stroke
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const pointersRef = useRef(new Map());  // active pointers
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const cursorRef = useRef(null);         // last screen-coord cursor pos
  const rafRef = useRef(0);

  const [zoomPct, setZoomPct] = useState(100);
  const [strokeCount, setStrokeCount] = useState(0);
  // useState bump just to nudge React when we want to re-render UI (e.g.
  // tool chips reflecting new tool — handled in parent — but also for
  // when undo/clear changes strokeCount).

  // Convert a screen-relative (CSS px) point to world coords.
  const screenToWorld = (sx, sy) => {
    const vp = viewportRef.current;
    return { x: sx / vp.scale + vp.x, y: sy / vp.scale + vp.y };
  };

  const getScreenPos = (e) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Paint one frame.
  const render = useCallback(() => {
    rafRef.current = 0;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const vp = viewportRef.current;
    const cssW = c.width / dpr;
    const cssH = c.height / dpr;

    // Wipe in screen space.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);

    // Apply world transform (with DPR).
    ctx.setTransform(
      vp.scale * dpr, 0,
      0, vp.scale * dpr,
      -vp.x * vp.scale * dpr, -vp.y * vp.scale * dpr,
    );

    drawGrid(ctx, vp, cssW, cssH);

    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);

    // Pen / eraser hover ring (drawn in world coords).
    if (cursorRef.current && pointersRef.current.size === 0) {
      const w = screenToWorld(cursorRef.current.x, cursorRef.current.y);
      const r = tool === "eraser" ? ERASER_RADIUS : PEN_WIDTH * 1.6;
      ctx.beginPath();
      ctx.strokeStyle = tool === "eraser"
        ? "rgba(220, 53, 53, 0.55)"
        : "rgba(92, 74, 51, 0.55)";
      ctx.lineWidth = 1 / vp.scale;
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [tool]);

  const scheduleRender = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  // Resize the backing store to match the container's CSS box.
  const resize = useCallback(() => {
    const c = canvasRef.current;
    const container = containerRef.current;
    if (!c || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    c.style.width = `${rect.width}px`;
    c.style.height = `${rect.height}px`;
    scheduleRender();
  }, [scheduleRender]);

  // Mount: size canvas, observe resizes.
  useEffect(() => {
    resize();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [resize]);

  // Reflow on full-view enter/exit.
  useEffect(() => {
    const id = setTimeout(resize, 0);
    return () => clearTimeout(id);
  }, [inFullView, resize]);

  // Re-render whenever the tool changes (so the hover ring colour updates).
  useEffect(() => { scheduleRender(); }, [tool, scheduleRender]);

  // Cancel any RAF on unmount.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ─── Pointer event handlers ────────────────────────────────────────────

  const beginPinchPan = () => {
    const arr = Array.from(pointersRef.current.values());
    if (arr.length < 2) return;
    const mid = {
      x: (arr[0].x + arr[1].x) / 2,
      y: (arr[0].y + arr[1].y) / 2,
    };
    const dx = arr[0].x - arr[1].x;
    const dy = arr[0].y - arr[1].y;
    pinchRef.current = {
      startDist: Math.sqrt(dx * dx + dy * dy),
      startScale: viewportRef.current.scale,
      startMidScreen: mid,
      startMidWorld: screenToWorld(mid.x, mid.y),
      startVx: viewportRef.current.x,
      startVy: viewportRef.current.y,
    };
    currentStrokeRef.current = null;
    panRef.current = null;
  };

  const onPointerDown = (e) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const sp = getScreenPos(e);
    pointersRef.current.set(e.pointerId, sp);
    cursorRef.current = sp;

    if (pointersRef.current.size === 2) {
      beginPinchPan();
      scheduleRender();
      return;
    }

    if (tool === "pan") {
      panRef.current = {
        sx: sp.x, sy: sp.y,
        vx: viewportRef.current.x,
        vy: viewportRef.current.y,
      };
      return;
    }

    if (tool === "pen") {
      const wp = screenToWorld(sp.x, sp.y);
      currentStrokeRef.current = {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tool: "pen",
        color: PEN_COLOR,
        width: PEN_WIDTH,
        points: [wp],
      };
      scheduleRender();
      return;
    }

    if (tool === "eraser") {
      const wp = screenToWorld(sp.x, sp.y);
      const r = ERASER_RADIUS;
      const before = strokesRef.current.length;
      strokesRef.current = strokesRef.current.filter((s) => !strokeHitsPoint(s, wp, r));
      if (strokesRef.current.length !== before) {
        setStrokeCount(strokesRef.current.length);
      }
      // Track an eraser "stroke" path purely so we can erase on drag-through.
      currentStrokeRef.current = { tool: "eraser", points: [wp] };
      scheduleRender();
    }
  };

  const onPointerMove = (e) => {
    const sp = getScreenPos(e);
    cursorRef.current = sp;
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, sp);
    }

    // Two-pointer pinch + pan (touch).
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const arr = Array.from(pointersRef.current.values());
      const dx = arr[0].x - arr[1].x;
      const dy = arr[0].y - arr[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, pinchRef.current.startScale * (dist / pinchRef.current.startDist)),
      );
      const mid = {
        x: (arr[0].x + arr[1].x) / 2,
        y: (arr[0].y + arr[1].y) / 2,
      };
      // Keep the starting world midpoint anchored to the current screen
      // midpoint while scaling — gives a "pinch about my fingers" feel.
      const vp = viewportRef.current;
      vp.scale = newScale;
      vp.x = pinchRef.current.startMidWorld.x - mid.x / newScale;
      vp.y = pinchRef.current.startMidWorld.y - mid.y / newScale;
      setZoomPct(Math.round(newScale * 100));
      scheduleRender();
      return;
    }

    if (panRef.current) {
      const vp = viewportRef.current;
      vp.x = panRef.current.vx - (sp.x - panRef.current.sx) / vp.scale;
      vp.y = panRef.current.vy - (sp.y - panRef.current.sy) / vp.scale;
      scheduleRender();
      return;
    }

    if (currentStrokeRef.current && tool === "pen") {
      const wp = screenToWorld(sp.x, sp.y);
      const pts = currentStrokeRef.current.points;
      const last = pts[pts.length - 1];
      // Skip very small movements — keeps the stroke vector lean.
      if (distSq(wp, last) > 0.6) pts.push(wp);
      scheduleRender();
      return;
    }

    if (currentStrokeRef.current && tool === "eraser") {
      const wp = screenToWorld(sp.x, sp.y);
      const r = ERASER_RADIUS;
      const before = strokesRef.current.length;
      strokesRef.current = strokesRef.current.filter((s) => !strokeHitsPoint(s, wp, r));
      if (strokesRef.current.length !== before) setStrokeCount(strokesRef.current.length);
      currentStrokeRef.current.points.push(wp);
      scheduleRender();
      return;
    }

    // Pure hover (no buttons down) — re-render to update the hover ring.
    if (pointersRef.current.size === 0) scheduleRender();
  };

  const onPointerUp = (e) => {
    const c = canvasRef.current;
    if (c && c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      if (currentStrokeRef.current && currentStrokeRef.current.tool === "pen") {
        strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
        setStrokeCount(strokesRef.current.length);
      }
      currentStrokeRef.current = null;
      panRef.current = null;
    }
    scheduleRender();
  };

  // ─── Wheel / trackpad ──────────────────────────────────────────────────

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e) => {
      e.preventDefault();
      const vp = viewportRef.current;
      if (e.ctrlKey || e.metaKey) {
        // Zoom about the cursor.
        const rect = c.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const before = screenToWorld(sx, sy);
        const factor = Math.exp(-e.deltaY * 0.01);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor));
        vp.scale = newScale;
        // Lock the cursor's world point to its screen position.
        vp.x = before.x - sx / newScale;
        vp.y = before.y - sy / newScale;
        setZoomPct(Math.round(newScale * 100));
      } else {
        // Pan.
        vp.x += e.deltaX / vp.scale;
        vp.y += e.deltaY / vp.scale;
      }
      scheduleRender();
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [scheduleRender]);

  // ─── Toolbar actions ───────────────────────────────────────────────────

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    scheduleRender();
  };

  const clearAll = () => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    setStrokeCount(0);
    scheduleRender();
  };

  const resetView = () => {
    viewportRef.current = { x: 0, y: 0, scale: 1 };
    setZoomPct(100);
    scheduleRender();
  };

  const zoomBy = (factor) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const sx = rect.width / 2;
    const sy = rect.height / 2;
    const before = screenToWorld(sx, sy);
    const vp = viewportRef.current;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor));
    vp.scale = newScale;
    vp.x = before.x - sx / newScale;
    vp.y = before.y - sy / newScale;
    setZoomPct(Math.round(newScale * 100));
    scheduleRender();
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const cursorClass =
    tool === "pan" ? "cursor-grab active:cursor-grabbing"
    : tool === "eraser" ? "cursor-cell"
    : "cursor-crosshair";

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { cursorRef.current = null; scheduleRender(); }}
        className={`block w-full h-full touch-none select-none ${cursorClass}`}
      />

      {/* Zoom dock — top-right. Lives at the opposite corner from the tool
          dock so the two never collide at any viewport width. */}
      <div className="pointer-events-none absolute right-2 top-2 flex justify-end">
        <div className="pointer-events-auto inline-flex items-center gap-1 bg-white/95 backdrop-blur border border-[#E5DDD0] rounded-full px-1.5 py-1 shadow-sm">
          <ToolBtn onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
            <Minus size={13} />
          </ToolBtn>
          <button
            type="button"
            onClick={resetView}
            className="text-[11px] text-brown font-semibold min-w-[40px] text-center px-1 py-1 hover:bg-accent-soft rounded-full transition"
            title="Reset view"
          >
            {zoomPct}%
          </button>
          <ToolBtn onClick={() => zoomBy(1.2)} title="Zoom in">
            <Plus size={13} />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-[#E5DDD0]" />
          <ToolBtn onClick={resetView} title="Reset view">
            <Crosshair size={13} />
          </ToolBtn>
        </div>
      </div>

      {/* Tool dock — bottom-centred, wraps inside the canvas frame */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
        <div className="pointer-events-auto inline-flex items-center gap-1 bg-white/95 backdrop-blur border border-[#E5DDD0] rounded-full px-1.5 py-1 shadow-sm max-w-full">
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} title="Pen (P)">
            <Pencil size={13} />
          </ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser (E)">
            <Eraser size={13} />
          </ToolBtn>
          <ToolBtn active={tool === "pan"} onClick={() => setTool("pan")} title="Pan (H)">
            <Hand size={13} />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-[#E5DDD0]" />
          <ToolBtn onClick={undo} disabled={strokeCount === 0} title="Undo (⌘Z)">
            <Undo2 size={13} />
          </ToolBtn>
          <ToolBtn onClick={clearAll} disabled={strokeCount === 0} title="Clear all">
            <Trash2 size={13} />
          </ToolBtn>
        </div>
      </div>
    </div>
  );
};

function ToolBtn({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition ${
        active
          ? "bg-brown text-white"
          : disabled
            ? "text-gray-300"
            : "text-brown hover:bg-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}

export default InfiniteCanvas;
