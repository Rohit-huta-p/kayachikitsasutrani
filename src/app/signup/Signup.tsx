"use client";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Custom_Link } from "@/components/Link";
import { ChevronRight } from 'lucide-react';
import React, { useState } from "react";

const Signup = () => {
  const [toggleDropdown, setToggleDropdown] = useState(false);
  // const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "Gender",
    universityName: "",
    course: "",
    email: "",
    password: "",
  });

  console.log(formData);
  
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
                />
            </div>
          {/* Confirm password */}
          <div className="flex flex-col space-y-2">
                <label htmlFor="email" className="font-semibold">
                   Confirm Password
                </label>
                <Input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="*********"
                />
            </div>
            <Button onClick={() => {}} className={'py-[8px] px-[64px] text-white'}>Sign Up</Button>
        </form>
      </div>
    <p className="font-thin">Already have an account? <Custom_Link href="/login" className="text-green">Login</Custom_Link></p>

    </div>
  );
};

export default Signup;
