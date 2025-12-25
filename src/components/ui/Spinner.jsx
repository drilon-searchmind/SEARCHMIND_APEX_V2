import React from "react";

export default function Spinner({ size = 32, color = "#406969", className = "" }) {
    return (
        <div className={`flex items-center justify-center ${className}`}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 50 50"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="animate-spin"
            >
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    stroke={color}
                    strokeWidth="5"
                    strokeDasharray="31.4 31.4"
                    strokeLinecap="round"
                    opacity="0.2"
                />
                <path
                    d="M25 5a20 20 0 1 1-20 20"
                    stroke={color}
                    strokeWidth="5"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}
