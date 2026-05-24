"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ShlokaForm from "../../components/ShlokaForm";
import { api } from "@/lib/api";
import type { PublicShloka, ApiError } from "@/lib/auth/types";

const EditShlokaPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [shloka, setShloka] = useState<PublicShloka | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.admin.shlokas.get(id)
      .then((s) => { if (!cancelled) setShloka(s); })
      .catch((e: ApiError) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="p-10 text-red-600">{error}</div>;
  if (!shloka) return <div className="p-10">Loading…</div>;

  return (
    <div className="p-10">
      <div className="mb-4">
        <Link href="/admin/shlokas" className="text-sm text-green underline">← Back to shlokas</Link>
      </div>
      <h1 className="text-2xl text-brown mb-4">Edit: {shloka.title}</h1>
      <ShlokaForm initial={shloka} onSaved={() => router.push("/admin/shlokas")} />
    </div>
  );
};

export default EditShlokaPage;
