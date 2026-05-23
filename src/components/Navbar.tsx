"use client";
import React from 'react';

import { Custom_Link } from './Link';
import { useAuth } from '@/lib/auth/AuthContext';


const Navbar = () => {
    const { state, logout } = useAuth();

    return (
        <div className="flex justify-between items-center p-4 bg-white text-black">
            <h2 className="font-bold text-brown text-xl">Shloka Sutra</h2>
            <div className="space-x-5 flex items-center">
                {state.status === "authed" ? (
                    <>
                        <span className="text-sm">Hi, {state.user.name}</span>
                        <button
                            onClick={() => void logout()}
                            className="text-green text-sm underline cursor-pointer"
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <Custom_Link href="/login" className="text-green">Login</Custom_Link>
                        <Custom_Link href={"/signup"} className="bg-green text-white p-2">Signup</Custom_Link>
                    </>
                )}
            </div>
        </div>
    )
};


export default Navbar;

