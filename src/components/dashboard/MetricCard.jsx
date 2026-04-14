import React from "react";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import ComparisonPeriodPopover from "@/components/dashboard/ComparisonPeriodPopover";
import { cn } from "@/lib/utils";

export default function MetricCard({
    label,
    value,
    unit,
    change,
    changeType,
    changeAbsolute,
    changePrevValue,
    icon,
    children,
    isActive,
    comparisonMethod,
    popOverContent = null,
    hideIconBackdrop = false,
    className = "",
    subCaption = null,
}) {
    const activeBg = isActive ? "#1E2B2B" : "";
    const activeText = isActive ? "text-white" : "text-gray-900";
    const iconBg = isActive ? "bg-[#243636]" : "bg-gray-50";
    const labelText = isActive ? "text-white" : "text-gray-400";

    return (
        <ComparisonPeriodPopover
            comparisonMethod={comparisonMethod}
            changePrevValue={changePrevValue}
            changeAbsolute={changeAbsolute}
            extraContent={popOverContent}
        >
            <div
                className={cn(
                    "flex w-full flex-col justify-between border border-gray-200 rounded-xl px-6 py-5 min-w-[160px] min-h-[110px]",
                    isActive ? "shadow-md" : "bg-white",
                    className
                )}
                style={{ background: activeBg, transition: "background 0.2s, color 0.2s" }}
            >
                <div className="flex items-center justify-between mb-4">
                    <span
                        className={`w-full flex flex-col items-start gap-2 text-sm font-medium ${labelText}`}
                    >
                        <span className="flex justify-between w-full gap-2">
                            <span className="flex items-center gap-2 justify-start min-w-0 flex-1">
                                {label}
                            </span>
                            <div className="flex items-start justify-end shrink-0">
                                {hideIconBackdrop ? (
                                    <span className="flex items-center">
                                        {React.isValidElement(icon)
                                            ? React.cloneElement(icon, {
                                                  className: cn(
                                                      "w-4 h-4 shrink-0",
                                                      isActive ? "text-white" : "text-[var(--color-primary-searchmind)]",
                                                      icon.props?.className
                                                  ),
                                              })
                                            : icon}
                                    </span>
                                ) : (
                                    <span className={`rounded-lg p-2 ${iconBg}`}>
                                        {React.isValidElement(icon)
                                            ? React.cloneElement(icon, {
                                                  className: cn(
                                                      "w-4 h-4 shrink-0",
                                                      isActive ? "text-white" : "text-[var(--color-primary-searchmind)]",
                                                      icon.props?.className
                                                  ),
                                              })
                                            : icon}
                                    </span>
                                )}
                            </div>
                        </span>
                    </span>
                    {children}
                </div>
                <div className="flex justify-between items-end gap-2">
                    <div className="flex flex-col items-start min-w-0">
                        <span className={`text-2xl font-bold ${activeText}`}>
                            {value}
                            {unit && (
                                <span className="text-base font-normal ml-1">{unit}</span>
                            )}
                        </span>
                        {subCaption != null && subCaption !== "" && (
                            <div
                                className={cn(
                                    "text-xs font-normal mt-1.5 tabular-nums w-full min-w-0",
                                    isActive ? "text-white/80" : "text-gray-500"
                                )}
                            >
                                {subCaption}
                            </div>
                        )}
                    </div>

                    {change !== undefined && (
                        <div className="flex items-center gap-1">
                            <span
                                className={`text-[0.65rem] rounded-sm font-medium flex items-center justify-end gap-1 px-2 py-1 min-w-[4rem] tabular-nums ${
                                    changeType === "up"
                                        ? "text-green-600 bg-green-50"
                                        : "text-red-600 bg-red-50"
                                }`}
                            >
                                {changeType === "up" ? (
                                    <FiTrendingUp className="text-sm" />
                                ) : (
                                    <FiTrendingDown className="text-sm" />
                                )}
                                {change}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </ComparisonPeriodPopover>
    );
}
