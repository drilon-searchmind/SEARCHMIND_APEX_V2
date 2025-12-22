import React from 'react'
import { Button } from '@/components/ui/button'

const FormButton = ({ children, buttonSize, borderType }) => {
    const buttonSizeClass = buttonSize === 'small' ? 'h-auto text-xs' : 'h-12 text-base w-full';
    const borderClass = borderType === 'outline' ? 'shadow-none border border-gray-200 text-gray-500 bg-white hover:bg-white hover:text-[var(--color-primary-searchmind)]' : 'text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)]';

    return (
        <Button type="submit" className={`w-full rounded-lg ${buttonSizeClass} ${borderClass}`}>
            {children}
        </Button>
    )
}

export default FormButton