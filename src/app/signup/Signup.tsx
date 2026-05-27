"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

const COURSE_OPTIONS = ["3rd Prof BAMS"] as const;

type FormData = {
  fullName: string;
  age: string;
  gender: string;
  collegeName: string;
  course: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const Signup = () => {
  const { state, signup } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "authed") {
      router.replace(state.user.role === "admin" ? "/admin/shlokas" : "/dashboard");
    }
  }, [state, router]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    age: "",
    gender: "",
    collegeName: "",
    course: COURSE_OPTIONS[0],
    email: "",
    password: "",
    confirmPassword: "",
  });

  const update = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.fullName.trim()) return setError("Please enter your name.");
    if (!formData.email.trim()) return setError("Please enter your email.");
    if (formData.password.length < 8) return setError("Password must be at least 8 characters.");
    if (formData.password !== formData.confirmPassword) return setError("Passwords don't match.");

    const genderMap: Record<string, "male" | "female" | "other" | undefined> = {
      male: "male",
      female: "female",
      other: "other",
    };

    setSubmitting(true);
    try {
      await signup({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.fullName.trim(),
        age: formData.age ? Number(formData.age) : undefined,
        gender: genderMap[formData.gender],
        collegeName: formData.collegeName.trim() || undefined,
        course: formData.course.trim() || undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
        <div className="flex-1 text-center font-bold text-base">Create account</div>
        <div className="w-6" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-6 py-6 flex flex-col gap-3 max-w-md mx-auto w-full">
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
        <Field id="password" label="Password" type="password" placeholder="At least 8 characters" value={formData.password} onChange={update("password")} required autoComplete="new-password" />
        <Field id="confirmPassword" label="Confirm Password" type="password" placeholder="Repeat your password" value={formData.confirmPassword} onChange={update("confirmPassword")} required autoComplete="new-password" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-white rounded-full py-3 px-6 font-bold text-sm mt-2 shadow-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
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
