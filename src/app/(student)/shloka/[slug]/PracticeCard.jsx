"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Sanscript from "@indic-transliteration/sanscript";
import {
  Keyboard,
  Pencil,
  Eraser,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

const SCHEMES = [
  { id: "iast", label: "IAST", hint: "ā ī ū ṛ ṣ ṅ ñ" },
  { id: "itrans", label: "ITRANS", hint: "aa ii uu Ri sh ng" },
  { id: "hk", label: "HK", hint: "A I U R S G" },
];

function tokenize(s) {
  return (s || "").normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

/**
 * Practice surface for memorizing a shloka.
 *
 * Type tab — live Latin → Devanagari transliteration (IAST / ITRANS / HK).
 * A "Check" button compares the rendered Devanagari to shloka.fullText
 * word-by-word and shows a green/red diff with a score.
 *
 * Draw tab — HTML <canvas> whiteboard for finger / stylus practice.
 *   • Pen / Eraser / Clear.
 *   • Infinite-scroll board: when the student's stroke reaches the bottom
 *     edge, the canvas auto-grows in 280-px steps and the container scrolls
 *     to follow. Previous strokes are preserved across resize via a dataURL
 *     save/restore step.
 *   • Full-screen toggle: the draw wrapper enters the browser Fullscreen
 *     API. On entry the canvas snaps up to fill the viewport (preserving
 *     drawing), and exiting collapses back to the inline footprint with
 *     drawing intact. Works on desktop, iPad, and Android Chrome / Edge;
 *     Safari iOS falls back to a fixed-position overlay if the API is
 *     blocked.
 */
const PracticeCard = ({ targetText }) => {
  const [tab, setTab] = useState("type");
  const [scheme, setScheme] = useState("iast");
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);

  // Live Devanagari preview.
  const devanagari = (() => {
    if (!input) return "";
    try {
      return Sanscript.t(input, scheme, "devanagari");
    } catch {
      return "";
    }
  })();

  const handleCheck = () => {
    const userWords = tokenize(devanagari);
    const targetWords = tokenize(targetText);
    const max = Math.max(userWords.length, targetWords.length);
    const words = [];
    let score = 0;
    for (let i = 0; i < max; i++) {
      const u = userWords[i] || "";
      const t = targetWords[i] || "";
      const ok = u !== "" && u === t;
      if (ok) score++;
      words.push({ user: u, target: t, ok });
    }
    setResult({ score, total: targetWords.length, words });
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
  };

  // ───────────────────────── Draw tab (canvas) ─────────────────────────
  const GROW_TRIGGER_PX = 70;
  const GROW_STEP_PX = 280;
  const INITIAL_HEIGHT = 320;

  const drawWrapRef = useRef(null);
  const scrollRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const pendingRestoreRef = useRef(null);
  const lastGrowAtRef = useRef(0);

  const [tool, setTool] = useState("pen");
  const [canvasHeight, setCanvasHeight] = useState(INITIAL_HEIGHT);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // For browsers/contexts where Fullscreen API is blocked, we render a
  // fixed-position overlay instead. Tracked separately from isFullscreen
  // so we can pick the right exit path.
  const [overlayFs, setOverlayFs] = useState(false);

  const inFullView = isFullscreen || overlayFs;

  // (Re)initialise the canvas backing store at the current size. If a
  // pendingRestoreRef snapshot exists (data URL from before a resize), the
  // previous drawing is painted back onto the new canvas at its original
  // logical dimensions.
  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;

    // White background so the eraser (which paints white) visually erases.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (pendingRestoreRef.current) {
      const { url, width: prevW, height: prevH } = pendingRestoreRef.current;
      const img = new Image();
      img.onload = () => {
        // Draw at original CSS dimensions, top-left aligned.
        ctx.drawImage(img, 0, 0, prevW, prevH);
      };
      img.src = url;
      pendingRestoreRef.current = null;
    }
  }, []);

  // Snapshot the current canvas as a CSS-pixel-dimensioned data URL so it
  // can be restored after the next resize.
  const snapshotCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    pendingRestoreRef.current = {
      url: c.toDataURL("image/png"),
      width: rect.width,
      height: rect.height,
    };
  };

  // Initial / tab-switch setup.
  useEffect(() => {
    if (tab !== "draw") return;
    setupCanvas();
  }, [tab, setupCanvas]);

  // Re-setup whenever the canvas needs to change size.
  useEffect(() => {
    if (tab !== "draw") return;
    setupCanvas();
  }, [canvasHeight, isFullscreen, overlayFs, tab, setupCanvas]);

  // Wire Fullscreen API events.
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      if (fs !== isFullscreen) {
        snapshotCanvas();
        setIsFullscreen(fs);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [isFullscreen]);

  // On entering full view, expand canvas to at least the visible scroll
  // area so the student gets a big drawing surface immediately.
  useEffect(() => {
    if (!inFullView) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const targetH = Math.max(canvasHeight, scroller.clientHeight - 4);
    if (targetH > canvasHeight) {
      snapshotCanvas();
      setCanvasHeight(targetH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFullView]);

  // ESC handler for the overlay fallback (the real Fullscreen API exits on
  // ESC for free).
  useEffect(() => {
    if (!overlayFs) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        snapshotCanvas();
        setOverlayFs(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayFs]);

  const toggleFullscreen = async () => {
    const el = drawWrapRef.current;
    if (!el) return;
    snapshotCanvas();
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else {
          // Older / Safari iOS — fall back to the overlay.
          setOverlayFs(true);
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // API blocked → fall back to overlay.
      setOverlayFs((v) => !v);
    }
  };

  const exitOverlay = () => {
    snapshotCanvas();
    setOverlayFs(false);
  };

  const getPos = (e) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    const t = e.touches?.[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : "#5C4A33";
    ctx.lineWidth = tool === "eraser" ? 18 : 3;
    ctx.stroke();
    lastRef.current = p;

    // Infinite-scroll growth: when the stroke nears the bottom edge of the
    // current canvas, extend it. Throttled to 500ms so a single long stroke
    // doesn't fire 60 growths in a row.
    if (p.y > canvasHeight - GROW_TRIGGER_PX) {
      const now = Date.now();
      if (now - lastGrowAtRef.current > 500) {
        lastGrowAtRef.current = now;
        snapshotCanvas();
        setCanvasHeight((h) => h + GROW_STEP_PX);
        // Auto-scroll the container after the next layout so the freshly
        // added space is visible without the student having to hunt for it.
        setTimeout(() => {
          const s = scrollRef.current;
          if (s) s.scrollTo({ top: s.scrollHeight, behavior: "smooth" });
        }, 60);
      }
    }
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    // No reset of canvasHeight — student can keep their grown surface.
    void rect;
  };

  const resetBoard = () => {
    clearCanvas();
    setCanvasHeight(INITIAL_HEIGHT);
  };

  // ─────────────────────────── Render: Draw tab ──────────────────────────
  const drawSurface = (
    <div
      ref={drawWrapRef}
      className={
        inFullView
          ? // Fixed overlay or :fullscreen-styled container — fill viewport,
            // white background, comfortable padding.
            "fixed inset-0 z-[1000] bg-white flex flex-col p-3 sm:p-4"
          : "flex flex-col gap-2"
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setTool("pen")}
          className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-1 transition ${
            tool === "pen"
              ? "bg-brown text-white border-brown"
              : "bg-white text-brown border-[#E5DDD0]"
          }`}
        >
          <Pencil size={11} /> Pen
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-1 transition ${
            tool === "eraser"
              ? "bg-brown text-white border-brown"
              : "bg-white text-brown border-[#E5DDD0]"
          }`}
        >
          <Eraser size={11} /> Eraser
        </button>
        <button
          type="button"
          onClick={resetBoard}
          className="text-[11px] px-2 py-1 rounded-full border bg-white text-red-600 border-[#E5DDD0] flex items-center gap-1"
        >
          <Trash2 size={11} /> Clear
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {!inFullView ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Expand to full screen"
              className="text-[11px] px-2 py-1 rounded-full border bg-white text-brown border-[#E5DDD0] flex items-center gap-1 hover:bg-accent-soft transition"
            >
              <Maximize2 size={11} /> Full screen
            </button>
          ) : isFullscreen ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Exit full screen"
              className="text-[11px] px-2 py-1 rounded-full border bg-white text-brown border-[#E5DDD0] flex items-center gap-1 hover:bg-accent-soft transition"
            >
              <Minimize2 size={11} /> Exit
            </button>
          ) : (
            <button
              type="button"
              onClick={exitOverlay}
              aria-label="Close"
              className="text-[11px] px-2 py-1 rounded-full border bg-white text-brown border-[#E5DDD0] flex items-center gap-1 hover:bg-accent-soft transition"
            >
              <X size={11} /> Close
            </button>
          )}
        </div>
      </div>

      {/* Scroll container — fixed height inline, flex-1 in full view */}
      <div
        ref={scrollRef}
        className={
          inFullView
            ? "flex-1 rounded-lg border border-dashed border-[#E5DDD0] bg-white overflow-y-auto"
            : "rounded-lg border border-dashed border-[#E5DDD0] bg-white overflow-y-auto h-[320px] sm:h-[360px]"
        }
      >
        <canvas
          ref={canvasRef}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          style={{ height: `${canvasHeight}px` }}
          className="block w-full touch-none cursor-crosshair"
        />
      </div>

      <p className="text-[10px] text-gray-500 italic">
        {inFullView
          ? "Draw freely. Board grows as you write — scroll to fit. Press Esc or tap Exit to return."
          : "Use finger or stylus. Board grows as you reach the bottom — tap Full screen for more room."}
      </p>
    </div>
  );

  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-3 space-y-2">
      {/* Header + tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-brown flex items-center gap-1.5">
          <Pencil size={14} /> Practice
        </div>
        <div
          role="tablist"
          aria-label="Practice mode"
          className="inline-flex rounded-full border border-[#E5DDD0] overflow-hidden text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "type"}
            onClick={() => setTab("type")}
            className={`flex items-center gap-1 px-2.5 py-1 transition ${
              tab === "type" ? "bg-accent text-white" : "bg-white text-brown"
            }`}
          >
            <Keyboard size={12} /> Type
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "draw"}
            onClick={() => setTab("draw")}
            className={`flex items-center gap-1 px-2.5 py-1 transition ${
              tab === "draw" ? "bg-accent text-white" : "bg-white text-brown"
            }`}
          >
            <Pencil size={12} /> Draw
          </button>
        </div>
      </div>

      {tab === "type" ? (
        <>
          {/* Scheme selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500">Scheme:</span>
            {SCHEMES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScheme(s.id)}
                title={s.hint}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                  scheme === s.id
                    ? "bg-brown text-white border-brown"
                    : "bg-white text-brown border-[#E5DDD0]"
                }`}
              >
                {s.label}
              </button>
            ))}
            <span className="text-[10px] text-gray-400 ml-1 italic">
              Type Latin → Devanagari live
            </span>
          </div>

          {/* Latin input */}
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (result) setResult(null);
            }}
            placeholder={
              scheme === "iast"
                ? "Type in IAST: e.g. namaste śivāya"
                : scheme === "itrans"
                  ? "Type in ITRANS: e.g. namaste shivaaya"
                  : "Type in Harvard-Kyoto: e.g. namaste zivAya"
            }
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full text-sm border border-[#E5DDD0] rounded-lg p-2 focus:outline-none focus:border-brown resize-none"
          />

          {/* Live Devanagari preview */}
          <div className="bg-accent-soft border border-[#F0E7D8] rounded-lg p-2 min-h-[44px]">
            <div className="text-[10px] text-gray-500 mb-0.5">Preview</div>
            <p
              className="text-base text-black leading-snug whitespace-pre-wrap"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {devanagari || (
                <span className="text-gray-400 italic text-xs">
                  Devanagari appears here as you type…
                </span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-brown px-2 py-1 rounded hover:bg-accent-soft transition flex items-center gap-1"
            >
              <RotateCcw size={12} /> Clear
            </button>
            <button
              type="button"
              onClick={handleCheck}
              disabled={!input.trim() || !targetText}
              className="text-xs bg-accent text-white font-semibold rounded-full px-3 py-1.5 hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1"
            >
              <CheckCircle2 size={12} /> Check
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="mt-1 p-2 rounded-lg bg-white border border-[#E5DDD0] space-y-1.5">
              <div className="text-xs font-semibold text-brown flex items-center gap-2">
                Score: {result.score} / {result.total} words
                {result.score === result.total && result.total > 0 && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    Perfect!
                  </span>
                )}
              </div>
              <div
                className="text-sm leading-relaxed flex flex-wrap gap-1"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {result.words.map((w, i) => (
                  <span
                    key={i}
                    className={
                      w.ok
                        ? "text-green-700 bg-green-50 px-1 rounded"
                        : "text-red-600 bg-red-50 px-1 rounded line-through"
                    }
                    title={w.ok ? "Correct" : `Expected: ${w.target}`}
                  >
                    {w.user || `(missed: ${w.target})`}
                  </span>
                ))}
              </div>
              {result.words.some((w) => !w.ok) && (
                <p className="text-[10px] text-gray-500 italic">
                  Hover/tap a red word to see the expected form.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        drawSurface
      )}
    </div>
  );
};

export default PracticeCard;
