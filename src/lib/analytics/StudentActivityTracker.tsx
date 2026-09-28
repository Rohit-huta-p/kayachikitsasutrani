"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { setActivityShloka, startActivityTracking, stopActivityTracking } from "./activityTracker";

/** Runs the engagement tracker while a student is signed in. Renders nothing. */
export default function StudentActivityTracker() {
  const { state } = useAuth();
  const pathname = usePathname();
  const studentId = state.status === "authed" && state.user.role === "student" ? state.user.id : null;

  useEffect(() => {
    if (!studentId) return;
    startActivityTracking(studentId);
    return () => stopActivityTracking();
  }, [studentId]);

  useEffect(() => {
    const match = pathname?.match(/^\/shloka\/([^/]+)/);
    setActivityShloka(match ? decodeURIComponent(match[1]) : null);
  }, [pathname]);

  return null;
}
