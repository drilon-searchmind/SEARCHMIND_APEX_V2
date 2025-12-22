import React from 'react'
import { Input } from "@/components/ui/input"

const FormInputText = ({ placeholder = "Enter text", required = true, value, onChange, id }) => {
    return (
        <Input 
            id={id}
            type="text" 
            placeholder={placeholder} 
            required={required} 
            value={value}
            onChange={onChange}
            className="mt-2 shadow-none h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm  placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90  dark:focus:border-brand-800" 
        />
    )
}

export default FormInputText