"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ShlokaForm from "../components/ShlokaForm";

const NewShlokaPage: React.FC = () => {
  const router = useRouter();
  return (
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
  );
};

export default NewShlokaPage;
