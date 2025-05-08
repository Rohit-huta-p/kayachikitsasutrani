"use client";
import React from 'react';
import {Button} from './Button';


const Navbar = () => {
    return (
        <div className="flex justify-between items-center p-4 bg-white text-black">
            <h2 className="font-bold text-brown text-xl">Shloka Sutra</h2>
            <div className="space-x-5">
      
                <button className="font-bold text-primary">Login</button>
                <Button onClick={() => {}} className="">Signup</Button>


            </div>
        </div>
    )
};


export default Navbar;

