"use client"

import SearchComponent from '@/components/SearchComponent'
import React, { useState } from 'react'
import ShlokaList from './components/ShlokaList'

const Dashboard = () => {
    
  return (
    <div className='flex flex-col items-center space-y-5'>
        <h1 className='text-brown '>Learn Ancient Sanskrit Shlokas</h1>
        <p className='text-center w-[60%]'>Discover the wisdom of ancient Sanskrit verses through an immersive
        learning experience designed to help you memorize and understand sacred shlokas.</p>
        <SearchComponent placeholder='Search for Shlokas'  className='w-full max-w-md rounded'/>
        <ShlokaList />
    </div>
  )
}

export default Dashboard