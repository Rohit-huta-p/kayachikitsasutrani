"use client"
import React from 'react'

const FullText = ({shlokaData}) => {
  return (
    <div className='space-y-2 bg-white p-3 text-center place-items-center w-full'>
        {shlokaData.text.map((line, index) => (

            <h3 key={index} className='bg-primary-light-1 w-full'>{line}</h3>
        ))}
    </div>
  )
}

export default FullText