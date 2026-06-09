"use client";

import React, { useEffect, useRef, useState } from "react";
import Sanscript from "@indic-transliteration/sanscript";
import { Keyboard, Pencil, Eraser, Trash2, CheckCircle2, RotateCcw } from "lucide-react";

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
 * - Type tab: live Latin → Devanagari transliteration (IAST / ITRANS / HK).
 *   "Check" button compares user's Devanagari output against the target
 *   shloka word-by-word and shows a green/red diff with score.
 * - Draw tab: HTML <canvas> whiteboard for finger / stylus practice (iPad,
 *   touch laptops). Pen + eraser + clear. No OCR — visual practice only.
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
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const [tool, setTool] = useState("pen");

  // Set up canvas backing store on tab switch / mount.
  useEffect(() => {
    if (tab !== "draw") return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [tab]);

  const getPos = (e) => {
    const c = canvasRef.current;
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
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : "#5C4A33";
    ctx.lineWidth = tool === "eraser" ? 18 : 3;
    ctx.stroke();
    lastRef.current = p;
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  };

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
        <>
          {/* Draw toolbar */}
          <div className="flex items-center gap-1.5">
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
              onClick={clearCanvas}
              className="text-[11px] px-2 py-1 rounded-full border bg-white text-red-600 border-[#E5DDD0] flex items-center gap-1 ml-auto"
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>

          {/* Canvas */}
          <div className="rounded-lg border border-dashed border-[#E5DDD0] bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
              className="block w-full h-48 sm:h-56 touch-none cursor-crosshair"
            />
          </div>

          <p className="text-[10px] text-gray-500 italic">
            Use finger or stylus. Best on iPad / touch screen. No auto-check —
            for muscle-memory practice.
          </p>
        </>
      )}
    </div>
  );
};

export default PracticeCard;
