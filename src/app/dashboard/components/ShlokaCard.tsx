import React from 'react'
import Image from 'next/image';
import { Custom_Link } from '@/components/Link';

interface ShlokaCardProps {

  shloka: Object,
}
const ShlokaCard = ({shloka}: ShlokaCardProps) => {
  return (
    <div className=' rounded-lg shadow-lg hover:shadow-xl transition-shadow'>
     <div className='h-46 overflow-hidden'>
        <Image 
          src='/images/shloka_img_2.jpg'
          alt='shloka'
          width={300}
          height={120}
          className='rounded-md w-full object-cover h-full'
        />
      </div>
     
      <div className='p-3 bg-white rounded-b-lg space-y-2'>
        <h4 className='mt-2 text-lg font-semibold text-gray-800'>
          <Custom_Link href={`/shloka/${shloka.id}`}>#{shloka.title }</Custom_Link>

        </h4>
        <p className='text-sm text-gray-600'>
          {shloka.pronounciation || "नव ज्वर / तरुण ज्वर चिकित्सा"}
        </p>
        <p className='text-sm text-brown font-thin'>
          {shloka.meaning || "Guiding the Early Healing of Fever through Detox and Lightness"}
        </p>
      </div>
     
    </div>
  )
}

export default ShlokaCard