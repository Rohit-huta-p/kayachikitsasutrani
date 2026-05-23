// src/app/shloka/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import ShlokaDesc from "./ShlokaDesc";
import { loadShloka } from "@/lib/loadShloka";
import type { Shloka } from "@/lib/shloka.types";
import { useParams } from "next/navigation";

const Page = () => {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "taruna-jwara"; // fallback while only one shloka exists
  const [shloka, setShloka] = useState<Shloka | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setShloka(null);
    loadShloka(id)
      .then((s) => {
        if (!cancelled) setShloka(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load shloka");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="p-10">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => location.reload()}
          className="mt-2 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!shloka) {
    return <div className="p-10">Loading…</div>;
  }

  return <ShlokaDesc shloka={shloka} />;
};

export default Page;