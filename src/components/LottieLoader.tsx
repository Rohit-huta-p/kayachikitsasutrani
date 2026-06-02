"use client";

import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface Props {
  /** Pixel size for the square loader (width = height). Default 80. */
  size?: number;
  /** Optional label shown below the animation. */
  label?: string;
  /** Extra classes on the outer wrapper. */
  className?: string;
}

const LOTTIE_SRC =
  "https://lottie.host/f5032d3b-b2b0-44eb-81c1-ef55897c2cdb/Jpi2fLtASO.lottie";

/**
 * Centered Lottie loading animation. Drop-in replacement for "Loading…" text.
 *
 * Usage:
 *   {loading && <LottieLoader />}
 *   {loading && <LottieLoader size={120} label="Fetching shlokas" />}
 */
const LottieLoader: React.FC<Props> = ({ size = 80, label, className = "" }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div style={{ width: size, height: size }}>
        <DotLottieReact src={LOTTIE_SRC} loop autoplay />
      </div>
      {label && <p className="text-xs text-gray-500">{label}</p>}
      <span className="sr-only">Loading…</span>
    </div>
  );
};

export default LottieLoader;
