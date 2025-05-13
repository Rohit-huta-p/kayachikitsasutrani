"use client"
import React from 'react'

const FullTranslation = ({shlokaData}) => {
  return (
    <div>
        {shlokaData.translation.map((line, index) => (
            <h3 key={index} className='text-sm'>{line}</h3>
        ))}
    </div>
  )
}

export default FullTranslation