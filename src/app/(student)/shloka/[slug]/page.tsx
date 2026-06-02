"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ShlokaDesc from "./ShlokaDesc";
import { api } from "@/lib/api";
import LottieLoader from "@/components/LottieLoader";
import type { PublicShloka, ApiError } from "@/lib/auth/types";

const Page = () => {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [shloka, setShloka] = useState<PublicShloka | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setError(null);
    setShloka(null);
    api.shlokas.get(slug)
      .then((s) => { if (!cancelled) setShloka(s); })
      .catch((e: ApiError) => {
        if (cancelled) return;
        setError(e.status === 404 ? "Shloka not found" : e.message);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) {
    return (
      <div className="p-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }
  if (!shloka) return <LottieLoader className="min-h-[40vh]" />;
  return <ShlokaDesc shloka={shloka} />;
};

export default Page;
