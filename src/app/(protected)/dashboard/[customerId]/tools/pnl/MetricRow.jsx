"use client";

import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { Tooltip } from "@/components/ui/Tooltip";
import { displayVal, percentChange } from "./pnlUtils";

export default function MetricRow({
    label,
    nested = false,
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
    const changeClass = isNeutral ? "is-neutral" : isGood ? "is-up" : "is-down";
    const Icon = pct !== null && pct > 0 ? FiTrendingUp : FiTrendingDown;
    const sign = pct !== null && pct > 0 ? "+" : "";

    const changeBadge =
        hasPrev && pct !== null ? (
            <span className={`apex-perf-change ${changeClass}`}>
                <Icon aria-hidden />
                {sign}
                {pct.toFixed(0)}%
            </span>
        ) : (
            <span />
        );

    const rowClass = [
        "apex-pnl-table__row",
        hasPrev ? "" : "is-single",
        bold ? "is-bold" : "",
        nested ? "is-nested" : "",
    ]
        .filter(Boolean)
        .join(" ");

    const labelNode = tooltip ? (
        <Tooltip content={tooltip}>
            <span className="apex-pnl-table__label">{label}</span>
        </Tooltip>
    ) : (
        <span className="apex-pnl-table__label">{label}</span>
    );

    return (
        <div className={rowClass}>
            {labelNode}
            {hasPrev && (
                <span className={`apex-pnl-table__value${bold ? "" : " is-muted"}`}>
                    {displayVal(prevVal, zeroAsDash)}
                </span>
            )}
            <span className="apex-pnl-table__value">{displayVal(currVal, zeroAsDash)}</span>
            {hasPrev ? changeBadge : null}
        </div>
    );
}
