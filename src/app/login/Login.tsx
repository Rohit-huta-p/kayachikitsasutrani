"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";

const Login = () => {
  const { state, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bounce if already logged in — also handles post-login redirect since
  // login() updates state to "authed".
  useEffect(() => {
    if (state.status === "authed") {
      router.replace(state.user.role === "admin" ? "/admin/shlokas" : "/dashboard");
    }
  }, [state, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      // AuthContext updates state → useEffect above routes.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-brown text-white px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="touch-target -ml-2" aria-label="Go back">
          <span className="text-xl" aria-hidden="true">←</span>
        </button>
        <div className="flex-1 text-center font-bold text-base">Sign in</div>
        <div className="w-6" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-6 py-8 flex flex-col gap-4 max-w-md mx-auto w-full">
        <div className="text-center mb-4">
          <div className="text-4xl" aria-hidden="true">📜</div>
          <h2 className="text-lg font-bold text-brown mt-2">Welcome back</h2>
          <p className="text-xs text-gray-500 mt-1">Sign in to continue learning</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-white rounded-full py-3 px-6 font-bold text-sm shadow-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="text-center text-xs text-gray-500 mt-2">
          Don&apos;t have an account? <Link href="/signup" className="text-accent font-bold">Sign up</Link>
        </div>
      </form>
    </div>
  );
};

export default Login;
