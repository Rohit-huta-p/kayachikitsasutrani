"use client";

import React, { useEffect, useRef, useState } from "react";
import Sanscript from "@indic-transliteration/sanscript";
import {
  Keyboard,
  Pencil,
  CheckCircle2,
  RotateCcw,
  Maximize2,
  Minimize2,
  Trash2,
  X,
} from "lucide-react";
import InfiniteCanvas from "./InfiniteCanvas";

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
 *
 * Draw tab — an Excalidraw-style infinite canvas (see InfiniteCanvas.jsx).
 *   Strokes are stored as vectors in world coordinates, the viewport pans
 *   and zooms freely (pinch / two-finger / wheel / trackpad), and a
 *   "Full screen" button promotes the wrapper to the browser Fullscreen
 *   API (or a fixed-position overlay if the API isn't available).
 */
const PracticeCard = ({ targetText }) => {
  const [tab, setTab] = useState("type");
  const [scheme, setScheme] = useState("iast");
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);

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

  // ───────────────────────── Draw tab plumbing ─────────────────────────
  const drawWrapRef = useRef(null);
  // Imperative handle into InfiniteCanvas — lets the top-bar Clear button
  // wipe the board without lifting all of the stroke state up.
  const canvasApiRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlayFs, setOverlayFs] = useState(false);
  const inFullView = isFullscreen || overlayFs;

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!overlayFs) return;
    const onKey = (e) => { if (e.key === "Escape") setOverlayFs(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayFs]);

  const toggleFullscreen = async () => {
    const el = drawWrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else setOverlayFs(true);
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setOverlayFs((v) => !v);
    }
  };

  // Pen / Eraser / Pan keyboard shortcuts when the draw tab is active.
  useEffect(() => {
    if (tab !== "draw") return;
    const onKey = (e) => {
      // Don't hijack while typing into the Type tab (handled by tab guard)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "p" || e.key === "P") setTool("pen");
      else if (e.key === "e" || e.key === "E") setTool("eraser");
      else if (e.key === "h" || e.key === "H") setTool("pan");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  const drawSurface = (
    <div
      ref={drawWrapRef}
      className={
        inFullView
          ? "fixed inset-0 z-[1000] bg-white flex flex-col p-2 sm:p-3"
          : "flex flex-col gap-2"
      }
    >
      {/* Top bar — full-screen toggle + label */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-500 italic">
          {inFullView
            ? "Pan with two fingers / drag, pinch or ⌘+wheel to zoom · Esc to exit"
            : "Pan with two fingers / Hand tool, pinch or ⌘+wheel to zoom"}
        </span>
        <button
          type="button"
          onClick={() => canvasApiRef.current?.clear()}
          aria-label="Clear the board"
          className="text-[11px] px-2 py-1 rounded-full border bg-white text-red-600 border-[#E5DDD0] flex items-center gap-1 hover:bg-red-50 transition shrink-0"
        >
          <Trash2 size={11} /> Clear
        </button>
        {!inFullView ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Expand to full screen"
            className="text-[11px] px-2 py-1 rounded-full border bg-white text-brown border-[#E5DDD0] flex items-center gap-1 hover:bg-accent-soft transition shrink-0"
          >
            <Maximize2 size={11} /> Full screen
          </button>
        ) : isFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Exit full screen"
            className="text-[11px] px-2 py-1 rounded-full border bg-white text-brown border-[#E5DDD0] flex items-center gap-1 hover:bg-accent-soft transition shrink-0"
          >
            <Minimize2 size={11} /> Exit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOverlayFs(false)}
            aria-label="Close"
            className="text-[11px] px-2 py-1 rounded-full border bg-white text-brown border-[#E5DDD0] flex items-center gap-1 hover:bg-accent-soft transition shrink-0"
          >
            <X size={11} /> Close
          </button>
        )}
      </div>

      {/* Canvas frame — fixed height inline, flex-1 in full view */}
      <div
        className={
          inFullView
            ? "flex-1 rounded-lg border border-dashed border-[#E5DDD0] bg-white overflow-hidden"
            : "rounded-lg border border-dashed border-[#E5DDD0] bg-white overflow-hidden h-[360px] sm:h-[420px]"
        }
      >
        <InfiniteCanvas
          ref={canvasApiRef}
          tool={tool}
          setTool={setTool}
          inFullView={inFullView}
        />
      </div>
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
