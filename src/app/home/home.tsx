"use client";

import { Button } from '@/components/Button';
import React from 'react';
import Image from 'next/image';
import { Custom_Link } from '@/components/Link';


const Home = () => {
    return (
        <main className=" ">
            <header className="bg-header text-white text-center p-32 px-8">
                {/* overlay */}
                <div className="bg-header-overlay"></div>

                <div className='relative z-10 space-y-4'>
                    <h1 className="text-5xl font-semibold text-brown mb-4  ">
                        Master Ayurvedic Shlokas with <br /> Ease and Authenticity
                    </h1>
                    <p className="text-xl text-black">
                        Join our community and start learning the sacred verses that have guided
                        Ayurvedic practice for millennia.
                    </p>
                     <Custom_Link href="/dashboard" className="px-8 py-3 bg-green text-white">Get Started</Custom_Link>
                </div>
            

            
            </header>

             
            <section className='text-brown p-[64px] flex flex-col items-center justify-center space-y-7'>
                <h4 className='text-3xl'>Discover the Power of Traditional Learning</h4>
                {/* cards */}
                <div className='grid md:grid-cols-3 gap-4 '>

                    {/* Line by Line Learning */}
                    <div className='bg-white rounded-xl p-[24px] space-y-3'>
                        <Image 
                            src="/images/line-by-line-learning.png" 
                            alt="Home Header" 
                            width={50} 
                            height={100} 
                            className=""
                            priority
                        />

                        <h3 className='text-xl font-normal'>Line-by-Line Learning</h3>
                        <p className='text-black text-xs w-full'>Master each part of the shloka before moving to the
                        next, reinforcing your understanding and memorization.</p>

                    </div>
            
                    {/* Authentic Sanskrit */}
                    <div className='bg-white rounded-xl p-[24px] space-y-3'>
                        <Image 
                            src="/images/authentic-sanskrit.png" 
                            alt="Home Header" 
                            width={50} 
                            height={100} 
                            className=""
                            priority
                        />
                        <h3 className='text-xl'>Authentic Sanskrit</h3>
                        <p className='text-black text-xs '>
                        Experience shlokas in their original Devanagari script
                        alongside accurate transliterations and translations.
                        </p>
                    </div>
                        {/* Visual Context */}
                        <div className='bg-white rounded-xl p-[24px] space-y-3'>
                        <Image 
                            src="/images/line-by-line-learning.png" 
                            alt="Home Header" 
                            width={50} 
                            height={100} 
                            className=""
                            priority
                        />
                        <h3 className='text-xl'>Visual Context</h3>
                        <p className='text-black text-xs'>Each shloka comes with relevant imagery to help you
                        connect deeply with its meaning and essence.</p>
                    </div>
                </div>
            </section>

            <section className='bg-primary-base px-[64px] py-[30px] flex flex-col justify-center items-center space-y-4'>
                <h4 className='text-3xl text-brown'>Begin Your Ayurvedic Journey Today</h4>
                <p className='text-[18px] text-center w-2/3'>Immerse yourself in the ancient wisdom of Ayurveda through our line-by-line learning approach. Perfect for students, practitioners, and enthusiasts alike.</p>
                <Button onClick={() => {}} className={'px-[32px] py-[12px]'}>Start Learning Now</Button>
            </section>


        </main>
    );
};

export default Home;
