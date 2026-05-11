"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import MetricRow from "./MetricRow";

export default function MetricSection({
    title,
    comparisonLabel,
    hasPrev,
    rows,
    ctsLabel,
    ctsDisplay,
    dgTooltip,
    dgDisplay,
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 transition-shadow">
            <div className="font-bold text-gray-700 mb-1 text-sm">{title}</div>
            {hasPrev && (
                <div className="flex justify-between items-center gap-4 border-b-2 border-gray-200 py-2 mb-1">
                    <span className="flex-1" />
                    <span
                        className="grid gap-3 text-right text-xs font-semibold text-gray-500 uppercase"
                        style={{
                            gridTemplateColumns: "1fr 1fr auto",
                            minWidth: "280px",
                            justifyContent: "end",
                        }}
                    >
                        <span>{comparisonLabel}</span>
                        <span>Current Period</span>
                        <span className="w-14" />
                    </span>
                </div>
            )}
            {rows.map((row, i) => (
                <MetricRow
                    key={i}
                    label={row.label}
                    labelClassName={row.labelClassName}
                    tooltip={row.tooltip}
                    prevVal={row.prevVal}
                    currVal={row.currVal}
                    bold={row.bold}
                    zeroAsDash={row.zeroAsDash}
                    higherIsBetter={row.higherIsBetter}
                    hasPrev={hasPrev}
                />
            ))}
            {ctsDisplay !== undefined && (
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>{ctsLabel || "Cost To Sales Ratio"}</span>
                    <span>{ctsDisplay}</span>
                </div>
            )}
            {dgDisplay !== undefined && (
                <div className="flex justify-between text-sm text-gray-500">
                    {dgTooltip ? (
                        <Tooltip content={dgTooltip}>
                            <span>DG-%</span>
                        </Tooltip>
                    ) : (
                        <span>DG-%</span>
                    )}
                    <span>{dgDisplay}</span>
                </div>
            )}
        </div>
    );
}
