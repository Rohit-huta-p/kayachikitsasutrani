"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { api } from "@/lib/api";

const COURSE_OPTIONS = ["3rd Prof BAMS"] as const;

type FormData = {
  fullName: string;
  age: string;
  gender: string;
  collegeName: string;
  course: string;
  email: string;
};

const Signup = () => {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "authed") {
      router.replace(state.user.role === "admin" ? "/admin/shlokas" : "/dashboard");
    }
  }, [state, router]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    age: "",
    gender: "",
    collegeName: "",
    course: COURSE_OPTIONS[0],
    email: "",
  });

  const update = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.fullName.trim()) return setError("Please enter your name.");
    if (!formData.email.trim()) return setError("Please enter your email.");

    const genderMap: Record<string, "male" | "female" | "other" | undefined> = {
      male: "male",
      female: "female",
      other: "other",
    };

    setSubmitting(true);
    try {
      await api.requestSignup({
        email: formData.email.trim(),
        name: formData.fullName.trim(),
        age: formData.age ? Number(formData.age) : undefined,
        gender: genderMap[formData.gender],
        collegeName: formData.collegeName.trim() || undefined,
        course: formData.course.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <header className="bg-brown text-white px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="touch-target -ml-2"
            aria-label="Back to login"
          >
            <span className="text-xl" aria-hidden="true">←</span>
          </button>
          <div className="flex-1 text-center font-bold text-base">Request received</div>
          <div className="w-6" />
        </header>

        <main className="flex-1 px-6 py-10 flex flex-col items-center text-center max-w-md mx-auto w-full">
          <div
            aria-hidden
            className="w-16 h-16 rounded-full bg-accent-soft border border-[#E5DDD0] flex items-center justify-center mb-4"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A67C52" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 6 12 13 2 6" />
              <rect x="2" y="4" width="20" height="16" rx="2" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-brown">Request submitted</h2>
          <p className="text-sm text-brown/80 mt-2 leading-relaxed">
            Your request to join <span className="font-semibold">Chikitsa Sutra</span> has
            been sent to the administrator. Once it&apos;s reviewed, you&apos;ll receive your login
            credentials by email at <span className="font-semibold">{formData.email}</span>.
          </p>
          <p className="text-xs text-gray-500 mt-4">
            Please allow a day or two for the administrator to respond.
          </p>
          <Link
            href="/login"
            className="mt-6 bg-accent text-white rounded-full py-3 px-6 font-bold text-sm shadow-sm hover:opacity-90 transition"
          >
            Back to sign in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-brown text-white px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="touch-target -ml-2"
          aria-label="Go back"
        >
          <span className="text-xl" aria-hidden="true">←</span>
        </button>
        <div className="flex-1 text-center font-bold text-base">Request access</div>
        <div className="w-6" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-6 py-6 flex flex-col gap-3 max-w-md mx-auto w-full">
        <p className="text-xs text-brown/80 -mt-2 mb-1 leading-relaxed">
          Submit your details below. The administrator will review your request and email
          you a login password.
        </p>

        <Field id="fullName" label="Full Name" type="text" placeholder="Your name" value={formData.fullName} onChange={update("fullName")} required autoComplete="name" />
        <Field id="age" label="Age" type="number" placeholder="Your age" value={formData.age} onChange={update("age")} />

        <div className="flex flex-col gap-1">
          <label htmlFor="gender" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={update("gender")}
            className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <Field id="collegeName" label="College Name" type="text" placeholder="College you have enrolled in" value={formData.collegeName} onChange={update("collegeName")} />

        <div className="flex flex-col gap-1">
          <label htmlFor="course" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course / Program</label>
          <select
            id="course"
            name="course"
            value={formData.course}
            onChange={update("course")}
            className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
          >
            {COURSE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <Field id="email" label="Email" type="email" placeholder="your@email.com" value={formData.email} onChange={update("email")} required autoComplete="email" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-white rounded-full py-3 px-6 font-bold text-sm mt-2 shadow-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Sending request…" : "Request"}
        </button>

        <div className="text-center text-xs text-gray-500 mt-2">
          Already have an account? <Link href="/login" className="text-accent font-bold">Sign in</Link>
        </div>
      </form>
    </div>
  );
};

function Field({
  id, label, type, placeholder, value, onChange, required, autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
      />
    </div>
  );
}

export default Signup;
