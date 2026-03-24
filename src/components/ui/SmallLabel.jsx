import React from 'react'

const SmallLabel = ({ children }) => {
    return (
        <span id="smallLabel" className="text-[0.5rem] text-[var(--color-primary-searchmind)] bg-gray-200 rounded px-3 py-1">{children}</span>
    )
}

export default SmallLabel