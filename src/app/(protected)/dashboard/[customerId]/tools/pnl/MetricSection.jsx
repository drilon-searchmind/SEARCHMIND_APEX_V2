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
    const columnClass = hasPrev ? "apex-pnl-table__columns" : "apex-pnl-table__columns is-single";

    return (
        <section className="apex-perf-section">
            <div className="apex-perf-section__head">
                <div className="apex-perf-section__eyebrow">{title}</div>
            </div>
            {hasPrev && (
                <div className={columnClass}>
                    <span />
                    <span>{comparisonLabel}</span>
                    <span>Current</span>
                    <span>Δ</span>
                </div>
            )}
            <div className="apex-perf-section__rows">
                {rows.map((row, i) => (
                    <MetricRow
                        key={i}
                        label={row.label}
                        nested={Boolean(row.labelClassName)}
                        tooltip={row.tooltip}
                        prevVal={row.prevVal}
                        currVal={row.currVal}
                        bold={row.bold}
                        zeroAsDash={row.zeroAsDash}
                        higherIsBetter={row.higherIsBetter}
                        hasPrev={hasPrev}
                    />
                ))}
            </div>
            {(ctsDisplay !== undefined || dgDisplay !== undefined) && (
                <div className="apex-pnl-table__meta">
                    {ctsDisplay !== undefined && (
                        <>
                            <span>{ctsLabel || "Cost To Sales Ratio"}</span>
                            <span>{ctsDisplay}</span>
                        </>
                    )}
                </div>
            )}
            {dgDisplay !== undefined && (
                <div className="apex-pnl-table__meta">
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
        </section>
    );
}
