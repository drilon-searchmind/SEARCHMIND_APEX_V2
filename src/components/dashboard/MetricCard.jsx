import React, { useState } from "react";
import { FiTrendingUp, FiTrendingDown, FiInfo } from "react-icons/fi";

export default function MetricCard({ label, value, unit, change, changeType, icon, children, isActive, comparisonMethod, popOverContent = null }) {
    const [showPopover, setShowPopover] = useState(false);

    // changeType: "up" | "down" | undefined
    const changeColor = changeType === "up" ? "text-green-500" : changeType === "down" ? "text-red-500" : "text-gray-400";
    const changeIcon = changeType === "up" ? "▲" : changeType === "down" ? "▼" : null;

    const activeBg = isActive ? "#1E2B2B" : "";
    const activeText = isActive ? "text-white" : "text-gray-900";
    const iconBg = isActive ? "bg-[#243636]" : "bg-gray-50";
    const labelText = isActive ? "text-white" : "text-gray-400";
    const comparisonMethodValue = comparisonMethod === "Last Period" ? "LP" : comparisonMethod === "Last Year" ? "LY" : "";

    return (
        <div
            className="relative"
            onMouseEnter={() => popOverContent && setShowPopover(true)}
            onMouseLeave={() => setShowPopover(false)}
        >
            <div
                className={`flex flex-col justify-between border border-gray-200 rounded-xl px-6 py-5 min-w-[160px] min-h-[110px] ${isActive ? 'shadow-md' : 'bg-white'}`}
                style={{ background: activeBg, transition: 'background 0.2s, color 0.2s' }}
            >
                <div className="flex items-center justify-between mb-4">
                    <span className={`w-full flex flex-col items-start gap-2 text-sm font-medium ${labelText}`}>
                        <span className="flex justify-between w-full">
                            <span className="flex items-center gap-2 justify-start w-full">
                                {label}
                                {/* {popOverContent && (
                                    <span><FiInfo /></span>
                                )} */}
                            </span>
                            <div className="flex items-start gap-2 justify-end w-full">
                                <span className={`rounded-lg p-2 ${iconBg}`}>
                                    {icon}
                                </span>
                            </div>
                        </span>
                    </span>
                    {children}
                </div>
                <div className="flex justify-between items-end gap-2">
                    <span className={`text-2xl font-bold ${activeText}`}>
                        {value}
                        {unit &&
                            <span className="text-base font-normal ml-1">
                                {unit}
                            </span>
                        }
                    </span>

                    {change !== undefined && (
                        <div className="flex items-center gap-1">
                            <span className={`text-[0.65rem] rounded-sm font-medium flex items-center gap-1 px-2 py-1 ${changeType === "up" ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>
                                {changeType === "up" ? <FiTrendingUp className="text-sm" /> : <FiTrendingDown className="text-sm" />}
                                {change}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Popover */}
            {popOverContent && showPopover && (
                <div
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 animate-fadeIn min-w-[200px]"
                    style={{
                        animation: 'fadeIn 0.15s ease-in-out',
                    }}
                >
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 w-max">
                        {/* Arrow */}
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white"></div>
                        <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-200"></div>

                        {/* Content */}
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                            {popOverContent}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
