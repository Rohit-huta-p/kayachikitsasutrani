"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const AdminIndex = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/shlokas");
  }, [router]);
  return <div className="p-10">Redirecting…</div>;
};

export default AdminIndex;
