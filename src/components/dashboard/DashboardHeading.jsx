import React from "react";

export default function DashboardHeading({ title, label, right }) {
    return (
        <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-8 py-6 mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-end justify-between w-full ">
                <div>
                    {label && <span className="mb-4 inline-block text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 ">{label}</span>}
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-0">{title}</h1>
                    
                </div>
                {right && <div>{right}</div>}
            </div>
        </div>
    );
}
