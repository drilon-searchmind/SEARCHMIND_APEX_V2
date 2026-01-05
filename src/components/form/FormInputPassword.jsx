import React from 'react'
import { Input } from "@/components/ui/input"

const FormInputPassword = ({ placeholder = "Enter your password", required = true, value, onChange, id }) => {
    return (
        <Input 
            id={id}
            type="password" 
            placeholder={placeholder} 
            required={required} 
            value={value}
            onChange={onChange}
            className="mt-2 shadow-none h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm  placeholder:text-gray-400 focus:outline-hidden focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20" 
        />
    )
}

export default FormInputPassword