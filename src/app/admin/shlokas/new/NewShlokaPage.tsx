"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ShlokaForm from "../components/ShlokaForm";

const NewShlokaPage: React.FC = () => {
  const router = useRouter();
  return <ShlokaForm onSaved={() => router.push("/admin/shlokas")} />;
};

export default NewShlokaPage;
