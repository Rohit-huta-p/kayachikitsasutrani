"use client"
import React, { useState } from 'react'
import ShlokaCard from './ShlokaCard'

const ShlokaList = () => {
    const [shlokas, setShlokas] = useState([
      {
        title: "Nava Jwara or Taruna Jwara Chikitsa",
        pronounciation: "नव ज्वर / तरुण ज्वर चिकित्सा",
        meaning: "Guiding the Early Healing of Fever through Detox and Lightness",
      }])
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {shlokas.map((shloka, index) => (
            <div key={index} className=''>
                <ShlokaCard key={index} shloka={shloka}/>
            </div>
        ))}
    </div>
  )
}

export default ShlokaList