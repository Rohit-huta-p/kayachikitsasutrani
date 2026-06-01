"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ShlokaForm from "../../components/ShlokaForm";
import UseDesktopPrompt from "@/components/admin/UseDesktopPrompt";
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
  if (!shloka) return <div className="p-10 text-brown">Loading…</div>;

  return (
    <>
      <div className="md:hidden">
        <UseDesktopPrompt
          backHref="/admin/shlokas"
          backLabel="Back to shlokas"
          body="Editing a shloka needs the waveform timing editor — open this page on a desktop or tablet."
        />
      </div>
      <div className="hidden md:block">
        <ShlokaForm
          initial={shloka}
          onSaved={(saved, status) => {
            if (status === "published") {
              router.push("/admin/shlokas");
            } else {
              // Draft saved — stay on page, refresh local snapshot with server's
              // canonical version so subsequent saves reuse the same id.
              setShloka(saved);
            }
          }}
        />
      </div>
    </>
  );
};

export default EditShlokaPage;
