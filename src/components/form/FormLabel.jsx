import React from 'react'

const FormLabel = ({ htmlFor = "email", children, required, className = "" }) => {
    const baseClass = className || "block text-sm font-medium text-gray-700";
    return (
        <label htmlFor={htmlFor} className={baseClass}>
            {children}
            {required && <span className="ml-1 text-red-500">*</span>}
        </label>
    )
}

export default FormLabel