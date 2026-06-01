"use client";

import React from "react";
import Link from "next/link";
import { Laptop, ArrowLeft } from "lucide-react";

interface Props {
  title?: string;
  body?: string;
  backHref: string;
  backLabel: string;
}

const UseDesktopPrompt: React.FC<Props> = ({
  title = "Open on desktop",
  body = "This page needs more space than a phone can offer. Open on a desktop or tablet to continue editing.",
  backHref,
  backLabel,
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-6">
      <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-sm w-full text-center">
        <div className="flex justify-center mb-3" aria-hidden="true">
          <Laptop size={40} className="text-accent" />
        </div>
        <h2 className="text-base font-bold text-brown">{title}</h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{body}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 mt-5 bg-accent text-white rounded-full py-2.5 px-5 font-semibold text-sm hover:opacity-90 transition"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
      </div>
    </div>
  );
};

export default UseDesktopPrompt;
