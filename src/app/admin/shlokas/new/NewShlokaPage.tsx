"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ShlokaForm from "../components/ShlokaForm";
import UseDesktopPrompt from "@/components/admin/UseDesktopPrompt";

const NewShlokaPage: React.FC = () => {
  const router = useRouter();
  return (
    <>
      <div className="md:hidden">
        <UseDesktopPrompt
          backHref="/admin/shlokas"
          backLabel="Back to shlokas"
          body="Creating a shloka needs the waveform editor — open this page on a desktop or tablet."
        />
      </div>
      <div className="hidden md:block">
        <ShlokaForm
          onSaved={(saved, status) => {
            if (status === "published") {
              router.push("/admin/shlokas");
            } else {
              // Draft saved from /new — move to the edit URL so future saves
              // hit PATCH /:id instead of creating duplicates.
              router.replace(`/admin/shlokas/${saved.id}/edit`);
            }
          }}
        />
      </div>
    </>
  );
};

export default NewShlokaPage;
