"use client";

import React from "react";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";

export const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
export const nf2 = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percent change vs the comparison period, null when it cannot be computed. */
export function pctChange(current, prev) {
    if (current == null || prev == null || prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

/**
 * One KPI cell. `lowerIsBetter` flips the colour (cost and CAC falling is good).
 * `value === null` renders the "Not connected" state.
 */
export default function HeroKpi({ label, value, change, lowerIsBetter = false, note }) {
    const hasChange = change != null && Number.isFinite(change);
    const good = hasChange && (lowerIsBetter ? change < 0 : change > 0);
    const bad = hasChange && (lowerIsBetter ? change > 0 : change < 0);
    return (
        <div className="aura-hero__kpi">
            <span className="aura-hero__label">{label}</span>
            {value == null ? (
                <>
                    <span className="aura-hero__value aura-hero__value--empty">Not connected</span>
                    {note ? <span className="aura-hero__note">{note}</span> : null}
                </>
            ) : (
                <>
                    <span className="aura-hero__value">{value}</span>
                    {hasChange ? (
                        <span className={`aura-hero__change${good ? " is-good" : ""}${bad ? " is-bad" : ""}`}>
                            {change < 0 ? <FiArrowDown aria-hidden="true" /> : <FiArrowUp aria-hidden="true" />}
                            {`${nf2.format(change)}%`}
                        </span>
                    ) : (
                        <span className="aura-hero__change">No comparison</span>
                    )}
                </>
            )}
        </div>
    );
}
