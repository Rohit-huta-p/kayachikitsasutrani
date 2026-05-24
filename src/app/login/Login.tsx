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
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl mb-4">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm mt-4">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </div>
  );
};

export default Login;
