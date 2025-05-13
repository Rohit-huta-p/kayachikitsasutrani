"use client"
import React from 'react'
import { Input } from './Input'
import { Search } from 'lucide-react'
const SearchComponent = ({ placeholder, className }: { placeholder: string, className: string }) => {
  return (
    <div className='flex justify-center items-center w-full'>
        <div className='bg-white p-2 rounded'>
            <Search className='text-brown'/>
        </div>
        <Input 
            type='text'
            placeholder={placeholder}
            className={className}
            name=''
            onChange={(e) => console.log(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    // Handle search logic here
                }
            }
            }    
        />
    </div>
  )
}

export default SearchComponent