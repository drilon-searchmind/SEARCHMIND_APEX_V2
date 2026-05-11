"use client";

import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { Tooltip } from "@/components/ui/Tooltip";
import { displayVal, percentChange } from "./pnlUtils";

export default function MetricRow({
    label,
    labelClassName,
    tooltip,
    prevVal,
    currVal,
    bold = false,
    zeroAsDash = true,
    higherIsBetter = true,
    hasPrev,
}) {
    const pct = percentChange(prevVal, currVal);
    const isGood = higherIsBetter ? pct > 0 : pct < 0;
    const isNeutral = pct !== null && Math.abs(pct) < 0.01;
    const colorClass = isNeutral ? "text-gray-500 bg-gray-50" : isGood ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50";
    const Icon = pct !== null && pct > 0 ? FiTrendingUp : FiTrendingDown;
    const sign = pct !== null && pct > 0 ? "+" : "";

    const changeBadge =
        hasPrev && pct !== null ? (
            <span
                className={`inline-flex items-center gap-1 rounded-sm font-medium text-xs px-2 py-0.5 ${colorClass}`}
            >
                <Icon className="text-sm" />
                {sign}
                {pct.toFixed(0)}%
            </span>
        ) : null;

    const textSizeClass = bold ? "" : "text-sm";

    return (
        <div
            className={`flex justify-between items-center gap-4 border-b py-1 ${bold ? "border-b-2 font-bold" : ""} ${textSizeClass}`}
        >
            {tooltip ? (
                <Tooltip content={tooltip}>
                    <span className={`flex-1 min-w-0 ${labelClassName || ""}`}>{label}</span>
                </Tooltip>
            ) : (
                <span className={`flex-1 min-w-0 ${labelClassName || ""}`}>{label}</span>
            )}
            <span
                className={hasPrev ? "flex items-center gap-3" : ""}
                style={
                    hasPrev
                        ? {
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr auto",
                              minWidth: "280px",
                              justifyContent: "end",
                          }
                        : undefined
                }
            >
                {hasPrev && (
                    <span
                        className={`text-right ${bold ? "" : "text-gray-500"}`}
                    >
                        {displayVal(prevVal, zeroAsDash)}
                    </span>
                )}
                <span className="text-right">
                    {displayVal(currVal, zeroAsDash)}
                </span>
                {hasPrev && <span className="flex justify-end">{changeBadge}</span>}
            </span>
        </div>
    );
}
