"use client";
import React from 'react';


import { Custom_Link } from './Link';




const Navbar = () => {
    return (
        <div className="flex justify-between items-center p-4 bg-white text-black">
            <h2 className="font-bold text-brown text-xl">Shloka Sutra</h2>
            <div className="space-x-5">
      
                <Custom_Link href="/login" className="text-green">Login</Custom_Link>
                <Custom_Link href={"/signup"} onClick={() => {}} className="bg-green text-white p-2">Signup</Custom_Link>


            </div>
        </div>
    )
};


export default Navbar;

