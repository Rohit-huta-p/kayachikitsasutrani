"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ShlokaForm from "../components/ShlokaForm";

const NewShlokaPage: React.FC = () => {
  const router = useRouter();
  return (
    <div className="p-10">
      <div className="mb-4">
        <Link href="/admin/shlokas" className="text-sm text-green underline">← Back to shlokas</Link>
      </div>
      <h1 className="text-2xl text-brown mb-4">New Shloka</h1>
      <ShlokaForm onSaved={() => router.push("/admin/shlokas")} />
    </div>
  );
};

export default NewShlokaPage;
