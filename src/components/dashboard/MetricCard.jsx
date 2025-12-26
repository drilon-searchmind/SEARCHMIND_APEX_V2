import React from "react";

export default function MetricCard({ label, value, unit, change, changeType, icon, children, isActive }) {
    // changeType: "up" | "down" | undefined
    const changeColor = changeType === "up" ? "text-green-500" : changeType === "down" ? "text-red-500" : "text-gray-400";
    const changeIcon = changeType === "up" ? "▲" : changeType === "down" ? "▼" : null;

    const activeBg = isActive ? "#1E2B2B" : "";
    const activeText = isActive ? "text-white" : "text-gray-900 dark:text-white";
    const iconBg = isActive ? "bg-[#243636]" : "bg-gray-50";
    const labelText = isActive ? "text-white" : "text-gray-400";

    return (
        <div
            className={`flex flex-col justify-between border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 min-w-[160px] min-h-[110px] ${isActive ? 'shadow-md' : 'bg-white'}`}
            style={{ background: activeBg, transition: 'background 0.2s, color 0.2s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <span className={`flex flex-col items-start gap-2 text-sm font-medium ${labelText}`}>
                    <span className={`rounded-lg p-4 ${iconBg}`}>{icon}</span>
                    {label}
                </span>
                {children}
            </div>
            <div className="flex justify-between items-end gap-2">
                <span className={`text-3xl font-bold ${activeText}`}>
                    {value}
                    {unit && 
                        <span className="text-base font-normal ml-1">
                            {unit}
                        </span>
                    }
                </span>
                {change !== undefined && (
                    <span className={`ml-2 text-xs font-semibold flex items-center gap-1 ${changeColor}`}>
                        {changeIcon && <span>{changeIcon}</span>}
                        {change}%
                    </span>
                )}
            </div>
        </div>
    );
}
