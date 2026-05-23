"use client";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Custom_Link } from "@/components/Link";
import { ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

type FormData = {
  fullName: string;
  age: string;
  gender: string;
  universityName: string;
  course: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const Signup = () => {
  const { signup } = useAuth();
  const router = useRouter();
  const [toggleDropdown, setToggleDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    age: "",
    gender: "Gender",
    universityName: "",
    course: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const update = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!formData.fullName.trim()) return setError("Please enter your name.");
    if (!formData.email.trim()) return setError("Please enter your email.");
    if (formData.password.length < 8) return setError("Password must be at least 8 characters.");
    if (formData.password !== formData.confirmPassword) return setError("Passwords don't match.");

    const genderMap: Record<string, "male" | "female" | "other" | undefined> = {
      Male: "male",
      Female: "female",
      Other: "other",
    };

    setSubmitting(true);
    try {
      await signup({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.fullName.trim(),
        age: formData.age ? Number(formData.age) : undefined,
        gender: genderMap[formData.gender],
        universityName: formData.universityName.trim() || undefined,
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
    <div className=" flex flex-col justify-center items-center space-y-5 p-15">

      <div className="bg-white/40 shadow-sm rounded-lg px-[48px] py-[24px] w-4/6">
        <h1 className="text-2xl text-center text-brown">Create Your Account</h1>
        <p className="text-sm text-center">Begin your Ayurvedic learning journey</p>
        <form action="" className="space-y-4 flex flex-col ">
          {/* Full Name */}
          <div className="flex flex-col space-y-2">
            <label htmlFor="fullName" className="font-semibold">
              Full Name
            </label>
            <Input
              type="text"
              id="fullName"
              name="fullName"
              placeholder="Your name"
              className="font-thin"
              value={formData.fullName}
              onChange={update("fullName")}
            />
          </div>

          <div className="space-x-5 md:grid md:grid-cols-2">
            {/* Age */}
            <div className="flex flex-col space-y-2 ">
                <label htmlFor="age" className="font-semibold">
                    Age
                </label>
                <Input
                    type="text"
                    id="age"
                    name="age"
                    placeholder="Your age"
                    className=""
                    value={formData.age}
                    onChange={update("age")}
                />
            </div>
            {/* Gender */}
            <div className="flex flex-col space-y-2 w-full">
                <label htmlFor="gender" className="font-semibold">
                    Gender
                </label>
                <div className="relative">
                  <div className="flex justify-between items-center bg-white  rounded" onClick={() => setToggleDropdown(!toggleDropdown)}>
                    <h5 className="bg-white p-2 rounded w-full">{formData.gender}</h5>
                    {toggleDropdown ? <ChevronRight className="text-primary rotate-90" /> : <ChevronRight className="text-primary " />}
                  </div>
                  {
                    toggleDropdown && (
                      <div className="absolute bg-primary-light rounded shadow-md w-full">
                        <ul className="space-y-2 p-2">
                          <li className="p-2 hover:bg-gray-200 cursor-pointer" onClick={() => {setFormData({...formData, gender: "Male"}); setToggleDropdown(false)}}>Male</li>
                          <li className="p-2 hover:bg-gray-200 cursor-pointer" onClick={() => {setFormData({...formData, gender: "Female"}); setToggleDropdown(false)}}>Female</li>
                          <li className="p-2 hover:bg-gray-200 cursor-pointer" onClick={() => {setFormData({...formData, gender: "Other"}); setToggleDropdown(false)}}>Other</li>
                        </ul>
                      </div>
                    )
                  }
                </div>

            </div>

          </div>

          {/* University Name */}
          <div className="flex flex-col space-y-2">
                <label htmlFor="universityName" className="font-semibold">
                    University Name
                </label>
                <Input
                    type="text"
                    id="universityName"
                    name="universityName"
                    placeholder="University you have enrolled in"
                    value={formData.universityName}
                    onChange={update("universityName")}
                />
            </div>
          {/* Course / Program */}
          <div className="flex flex-col space-y-2">
                <label htmlFor="course" className="font-semibold">
                   Course / Program
                </label>
                <Input
                    type="text"
                    id="course"
                    name="course"
                    placeholder="Example: BAMS, MD Ayurveda, etc"
                    value={formData.course}
                    onChange={update("course")}
                />
            </div>
          {/* E-mail */}
          <div className="flex flex-col space-y-2">
                <label htmlFor="email" className="font-semibold">
                   Email
                </label>
                <Input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={update("email")}
                />
            </div>
          {/* Create password */}
          <div className="flex flex-col space-y-2">
                <label htmlFor="password" className="font-semibold">
                   Create Password
                </label>
                <Input
                    type="password"
                    id="password"
                    name="password"
                    placeholder="*********"
                    value={formData.password}
                    onChange={update("password")}
                />
            </div>
          {/* Confirm password */}
          <div className="flex flex-col space-y-2">
                <label htmlFor="confirmPassword" className="font-semibold">
                   Confirm Password
                </label>
                <Input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="*********"
                    value={formData.confirmPassword}
                    onChange={update("confirmPassword")}
                />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button onClick={handleSubmit} className={`py-[8px] px-[64px] text-white ${submitting ? "opacity-50 pointer-events-none" : ""}`}>{submitting ? "Signing up…" : "Sign Up"}</Button>
        </form>
      </div>
    <p className="font-thin">Already have an account? <Custom_Link href="/login" className="text-green">Login</Custom_Link></p>

    </div>
  );
};

export default Signup;
