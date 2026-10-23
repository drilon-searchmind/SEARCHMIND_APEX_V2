"use client";

import React from "react";
import { FiArrowUpRight, FiArrowDownRight, FiEye } from "react-icons/fi";

/** Brand vs non-brand and other two-series splits (DESIGN.md: distinct non-brand hues). */
export const SEO_COLORS = {
    nonBrand: "#2563EB",
    brand: "#EA580C",
    spend: "#121A13",
};

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const isNum = (v) => v != null && Number.isFinite(Number(v));
export const fmtInt = (v) => (isNum(v) ? Math.round(Number(v)).toLocaleString("da-DK") : "-");
export const fmtKr = (v) => (isNum(v) ? `${fmtInt(v)} kr.` : "-");
export const fmtDec = (v, dp = 1) =>
    isNum(v) ? Number(v).toLocaleString("da-DK", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "-";
/** `v` already in percent (12,3) */
export const fmtPctPoints = (v, dp = 1) => (isNum(v) ? `${fmtDec(v, dp)}%` : "-");
/** `v` as a fraction (0,123) */
export const fmtShare = (v, dp = 0) =>
    isNum(v) ? `${(Number(v) * 100).toLocaleString("da-DK", { maximumFractionDigits: dp })}%` : "-";
export const compact = (v) => {
    const n = num(v);
    const abs = Math.abs(n);
    if (abs >= 1e6) return `${(n / 1e6).toLocaleString("da-DK", { maximumFractionDigits: 1 })}m`;
    if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString("da-DK")}k`;
    return Math.round(n).toLocaleString("da-DK");
};

/** "Year over year" -> "vs last year", "Previous period" -> "vs previous period", etc. */
export function vsCaption(comparisonLabel) {
    if (!comparisonLabel) return null;
    const label = String(comparisonLabel).toLowerCase();
    if (label.includes("year")) return "vs last year";
    if (label.includes("month")) return "vs previous month";
    if (label.includes("period")) return "vs previous period";
    return "vs comparison period";
}

/**
 * Change chip. `mode="pos"` is for average position, where a lower number is better: the chip
 * shows how many positions were gained or lost instead of a percentage.
 */
export function DeltaChip({ cur, prev, goodUp = true, mode = "pct", compactSize = false, neutral = false }) {
    if (!isNum(cur) || !isNum(prev)) return null;
    let good;
    let text;
    let up;
    if (mode === "pos") {
        const gained = Number(prev) - Number(cur);
        if (Math.abs(gained) < 0.05) return null;
        good = gained > 0;
        up = good;
        text = `${gained > 0 ? "+" : "-"}${fmtDec(Math.abs(gained), 1)} pos.`;
    } else {
        if (Number(prev) === 0) return null;
        const pct = ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100;
        if (Math.abs(pct) < 0.05) return null;
        good = goodUp ? pct >= 0 : pct <= 0;
        up = pct > 0;
        text = `${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}%`;
    }
    return (
        <span className={`apex-ov-delta ${neutral ? "is-flat" : good ? "is-up" : "is-down"}${compactSize ? " is-compact" : ""}`}>
            {up ? <FiArrowUpRight aria-hidden /> : <FiArrowDownRight aria-hidden />}
            {text}
        </span>
    );
}

/** KPI card in the commerce style; the hero variant is the page's one dark card. */
export function SeoKpi({ label, icon: Icon, value, unit, cur, prev, goodUp = true, mode, caption, vs, hero = false, cost = false }) {
    return (
        <div className={`apex-ov-card apex-ov-kpi apex-sx-kpi${hero ? " is-hero" : ""}`}>
            <div className="apex-ov-kpi__label">
                {hero || !Icon ? null : (
                    <span className={`apex-ov-ic${cost ? " is-cost" : ""}`}>
                        <Icon aria-hidden />
                    </span>
                )}
                <span>{label}</span>
                {hero ? <FiEye className="apex-ov-kpi__eye" aria-hidden /> : null}
            </div>
            <div className="apex-ov-kpi__value">
                {value}
                {unit && value !== "-" ? <small>{unit}</small> : null}
            </div>
            <div className="apex-ov-kpi__row">
                <DeltaChip cur={cur} prev={prev} goodUp={goodUp} mode={mode} />
                {caption || vs ? <span className="apex-ov-vs">{isNum(prev) && vs ? vs : caption}</span> : null}
            </div>
        </div>
    );
}

/** Donut (DESIGN.md · Charts): 36px ring, 3px gaps, centre label. */
export function SeoDonut({ items, centerSmall, centerBig, active, onHover }) {
    const R = 80;
    const C = 2 * Math.PI * R;
    const total = items.reduce((s, it) => s + it.value, 0);
    const gap = items.filter((i) => i.value > 0).length > 1 ? 3 : 0;
    const lens = items.map((it) => (total > 0 ? (it.value / total) * C : 0));
    const offsets = lens.map((_, i) => lens.slice(0, i).reduce((s, l) => s + l, 0));
    return (
        <div className="apex-sx-donut">
            <svg viewBox="0 0 220 220" role="img" aria-label={centerSmall}>
                <g transform="rotate(-90 110 110)">
                    {items.map((it, i) => (
                        <circle
                            key={it.id}
                            cx="110"
                            cy="110"
                            r={R}
                            fill="none"
                            stroke={it.color}
                            strokeWidth="36"
                            strokeDasharray={`${Math.max(0, lens[i] - gap)} ${C}`}
                            strokeDashoffset={-offsets[i]}
                            opacity={active && active !== it.id ? 0.35 : 1}
                            onMouseEnter={() => onHover?.(it.id)}
                            onMouseLeave={() => onHover?.(null)}
                        />
                    ))}
                </g>
                <circle cx="110" cy="110" r="58" fill="var(--cd-sunk)" />
            </svg>
            <div className="apex-sx-donut__c">
                <small>{centerSmall}</small>
                <b>{centerBig}</b>
            </div>
        </div>
    );
}

export function SeoTag({ tone = "neutral", children }) {
    return <span className={`apex-sx-tag is-${tone}`}>{children}</span>;
}
