"use client";

import React, { useMemo, useState } from "react";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { Tooltip } from "@/components/ui/Tooltip";
import {
    PI_METRIC_HEADERS,
    PI_METRIC_KEYS,
    aggregatePiRows,
    computePiYearOverYearDiff,
} from "../lib/mockPerformanceInvestigatorData";

const PI_GROUPS = [
    {
        key: "reach",
        label: "Reach & engagement",
        groupClass: "pi-th-group--reach",
        keys: ["impr", "clicks", "ctr", "freq"],
    },
    {
        key: "spend",
        label: "Spend & efficiency",
        groupClass: "pi-th-group--spend",
        keys: ["avgCpc", "cost"],
    },
    {
        key: "conversion",
        label: "Conversions & value",
        groupClass: "pi-th-group--conv",
        keys: ["conv", "convValue", "convRate", "aov", "roas", "cpa"],
    },
];

const METRIC_LABEL = Object.fromEntries(
    PI_METRIC_KEYS.map((k, i) => [k, PI_METRIC_HEADERS[i]])
);

const intFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const dec1 = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const pctFmt = new Intl.NumberFormat("da-DK", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatMetricCell(key, value) {
    if (value == null || Number.isNaN(value)) return "";
    switch (key) {
        case "impr":
        case "clicks":
        case "conv":
            return intFmt.format(value);
        case "ctr":
        case "convRate":
            return pctFmt.format(value);
        case "freq":
        case "avgCpc":
            return dec2.format(value);
        case "cost":
        case "convValue":
        case "aov":
        case "cpa":
            return dec2.format(value);
        case "roas":
            return dec1.format(value);
        default:
            return String(value);
    }
}

function diffHeatClass(pct) {
    if (pct == null || Number.isNaN(pct)) return "";
    if (pct > 0) {
        if (pct >= 15) return "apex-radar-pi-diff-pos-strong";
        if (pct >= 5) return "apex-radar-pi-diff-pos";
        return "apex-radar-pi-diff-pos";
    }
    if (pct < 0) {
        if (pct <= -15) return "apex-radar-pi-diff-neg-strong";
        if (pct <= -5) return "apex-radar-pi-diff-neg";
        return "apex-radar-pi-diff-neg";
    }
    return "";
}

function formatDiffCell(pct) {
    if (pct == null || Number.isNaN(pct)) return "";
    const sign = pct > 0 ? "+" : "";
    return `${sign}${dec1.format(pct)}%`.replace("-", "−");
}

function groupForKey(key) {
    return PI_GROUPS.find((g) => g.keys.includes(key));
}

function borderLForMetricKey(key, flatKeys) {
    const idx = flatKeys.indexOf(key);
    if (idx <= 0) return "";
    const prev = flatKeys[idx - 1];
    const g = groupForKey(key);
    const gp = groupForKey(prev);
    if (g && gp && g.key !== gp.key) return " border-l border-[var(--color-rule)]";
    return "";
}

const TABLE_CLASS = "apex-radar-table apex-radar-pi-table min-w-full border-collapse text-left";

function PiTableHeader({ firstColumnLabel, variant = "default" }) {
    const flatKeys = PI_METRIC_KEYS;

    return (
        <thead>
            <tr>
                <th className="pi-th-first" rowSpan={2}>
                    {firstColumnLabel}
                </th>
                {PI_GROUPS.map((g) => (
                    <th
                        key={g.key}
                        className={`pi-th-group ${g.groupClass}`}
                        colSpan={g.keys.length}
                    >
                        {g.label}
                    </th>
                ))}
            </tr>
            <tr>
                {flatKeys.map((k) => {
                    const idx = flatKeys.indexOf(k);
                    const prev = idx > 0 ? flatKeys[idx - 1] : null;
                    const showBorderL =
                        idx === 0 || (prev && groupForKey(k)?.key !== groupForKey(prev)?.key);
                    return (
                        <th
                            key={k}
                            className={`pi-th-metric${showBorderL ? " border-l border-[var(--color-rule)]" : ""}`}
                        >
                            {METRIC_LABEL[k]}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
}

function DataTableBody({ rows, footerRows = [] }) {
    const flatKeys = PI_METRIC_KEYS;

    return (
        <tbody>
            {rows.map((row, index) => (
                <tr key={`${row.label}-${index}`}>
                    <td>{row.label}</td>
                    {flatKeys.map((k) => (
                        <td key={k} className={borderLForMetricKey(k, flatKeys)}>
                            {formatMetricCell(k, row[k])}
                        </td>
                    ))}
                </tr>
            ))}
            {footerRows.map((fr, fi) => (
                <tr key={`foot-${fi}`} className="pi-footer">
                    <td>{fr.label}</td>
                    {flatKeys.map((k) => (
                        <td key={k} className={borderLForMetricKey(k, flatKeys)}>
                            {formatMetricCell(k, fr[k])}
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
}

function DataTable({ yearLabel, rows, footerRows = [], variant = "default" }) {
    return (
        <div className="apex-radar-table-wrap">
            <table className={TABLE_CLASS}>
                <PiTableHeader firstColumnLabel={yearLabel} variant={variant} />
                <DataTableBody rows={rows} footerRows={footerRows} />
            </table>
        </div>
    );
}

function DiffTableBody({ rows }) {
    const flatKeys = PI_METRIC_KEYS;

    return (
        <tbody>
            {rows.map((row, index) => (
                <tr key={`${row.label}-d-${index}`}>
                    <td className="font-medium">{row.label}</td>
                    {flatKeys.map((k) => {
                        const p = row.pct?.[k];
                        const show = p != null && !Number.isNaN(p);
                        const heat = show ? diffHeatClass(p) : "";
                        return (
                            <td
                                key={k}
                                className={`${borderLForMetricKey(k, flatKeys)}${heat ? ` ${heat}` : ""}`}
                            >
                                {show ? formatDiffCell(p) : ""}
                            </td>
                        );
                    })}
                </tr>
            ))}
        </tbody>
    );
}

function DiffTable({ rows }) {
    return (
        <div className="apex-radar-table-wrap">
            <table className={TABLE_CLASS}>
                <PiTableHeader firstColumnLabel="Difference" variant="default" />
                <DiffTableBody rows={rows} />
            </table>
        </div>
    );
}

/** YoY % for footer totals — same rule as `computePiYearOverYearDiff`. */
function pctYoYPi(cur, prev, key) {
    const a = cur?.[key];
    const b = prev?.[key];
    if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b) || b === 0) return null;
    return ((a - b) / Math.abs(b)) * 100;
}

function PriorYearTooltipBody({ metricKey, previousYearLabel, prevVal }) {
    const formatted =
        prevVal == null || Number.isNaN(prevVal)
            ? "—"
            : formatMetricCell(metricKey, prevVal);
    return (
        <div className="max-w-[260px] text-left leading-snug">
            <div className="border-b border-white/25 pb-1 font-semibold">{previousYearLabel}</div>
            <div className="mt-1.5 pt-0.5 text-white/90">
                <span className="text-white/65">{METRIC_LABEL[metricKey]}:</span>{" "}
                <span className="font-medium tabular-nums">{formatted}</span>
            </div>
        </div>
    );
}

function CompactUnifiedTable({
    currentYear,
    previousYear,
    currentYearRows,
    previousYearRows,
    diffRows,
    currentFooter,
    prevYtdFooter,
}) {
    const flatKeys = PI_METRIC_KEYS;
    const firstColLabel = `${currentYear}`;

    function Cell({ metricKey, curVal, prevVal, pct }) {
        const main = formatMetricCell(metricKey, curVal);
        const showPct = pct != null && !Number.isNaN(pct);
        const heat = showPct ? diffHeatClass(pct) : "";
        const borderL = borderLForMetricKey(metricKey, flatKeys);
        const tip = (
            <PriorYearTooltipBody
                metricKey={metricKey}
                previousYearLabel={String(previousYear)}
                prevVal={prevVal}
            />
        );
        const inner = (
            <span className="block w-full min-w-[4.25rem]">
                <span className="font-semibold tabular-nums text-[var(--color-ink)]">{main || "—"}</span>
                {showPct ? (
                    <span
                        className={`mt-0.5 inline-block max-w-full rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums leading-tight${heat ? ` ${heat}` : ""}`}
                    >
                        {formatDiffCell(pct)}
                    </span>
                ) : (
                    <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">YoY —</span>
                )}
            </span>
        );
        return (
            <td className={`align-top${borderL}`}>
                <Tooltip content={tip}>
                    <button
                        type="button"
                        className="block w-max max-w-full cursor-default text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 rounded"
                    >
                        {inner}
                    </button>
                </Tooltip>
            </td>
        );
    }

    return (
        <div className="apex-radar-table-wrap">
            <p className="apex-radar-pi-compact-note">
                {currentYear}: primary value · <strong>YoY %</strong> below · {previousYear} on hover over any cell.
            </p>
            <table className={TABLE_CLASS}>
                <PiTableHeader firstColumnLabel={firstColLabel} variant="default" />
                <tbody>
                    {currentYearRows.map((row, index) => {
                        const prev = previousYearRows[index];
                        const diff = diffRows[index];
                        return (
                            <tr key={`c-${row.label}-${index}`}>
                                <td className="font-medium">{row.label}</td>
                                {flatKeys.map((k) => (
                                    <Cell
                                        key={k}
                                        metricKey={k}
                                        curVal={row[k]}
                                        prevVal={prev?.[k]}
                                        pct={diff?.pct?.[k]}
                                    />
                                ))}
                            </tr>
                        );
                    })}
                    {currentFooter.map((fr, fi) => (
                        <tr key={`cf-${fi}`} className="pi-footer">
                            <td>{fr.label}</td>
                            {flatKeys.map((k) => (
                                <Cell
                                    key={k}
                                    metricKey={k}
                                    curVal={fr[k]}
                                    prevVal={prevYtdFooter?.[k]}
                                    pct={pctYoYPi(fr, prevYtdFooter, k)}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function PerformanceInvestigatorMonthlyTables({
    currentYear,
    previousYear,
    currentYearRows = [],
    previousYearRows = [],
    diffRows: diffRowsProp,
    loading = false,
    error = null,
}) {
    const [monthlyViewMode, setMonthlyViewMode] = useState("full");
    const diffRows = useMemo(() => {
        if (diffRowsProp && diffRowsProp.length) return diffRowsProp;
        if (!currentYearRows.length || !previousYearRows.length) return [];
        return computePiYearOverYearDiff(currentYearRows, previousYearRows);
    }, [diffRowsProp, currentYearRows, previousYearRows]);

    const currentFooter = useMemo(() => {
        const rows = currentYearRows.filter((r) => r.impr != null);
        const t = aggregatePiRows(rows);
        return t ? [t] : [];
    }, [currentYearRows]);

    const monthsWithData = useMemo(
        () => currentYearRows.filter((r) => r.impr != null).length,
        [currentYearRows]
    );

    const prevYtdFooter = useMemo(() => {
        if (!monthsWithData) return null;
        return aggregatePiRows(previousYearRows.slice(0, monthsWithData));
    }, [previousYearRows, monthsWithData]);

    const prevFullFooter = useMemo(
        () => aggregatePiRows(previousYearRows.filter((r) => r.impr != null)),
        [previousYearRows]
    );

    const prevFooters = useMemo(() => {
        const out = [];
        if (prevYtdFooter) out.push({ ...prevYtdFooter, label: "Total år-til-dato" });
        if (prevFullFooter) out.push({ ...prevFullFooter, label: "Total hele år" });
        return out;
    }, [prevYtdFooter, prevFullFooter]);

    if (loading && !currentYearRows.length) {
        return (
            <div className="apex-radar-pi-loader-panel">
                <CobaltLoader variant="block" title="Loading monthly metrics" />
            </div>
        );
    }

    return (
        <section className="space-y-6" aria-label="Monthly performance tables">
            <div className="apex-radar-pi-toolbar">
                <p className="text-sm text-[var(--color-ink-2)]">
                    <span className="font-semibold text-[var(--color-ink)]">Monthly metrics</span>
                    <span className="hidden sm:inline text-[var(--color-muted)]">
                        {" · "}
                        {currentYear} vs {previousYear}
                    </span>
                </p>
                <div className="apex-radar-segmented" role="group" aria-label="Table layout density">
                    <button
                        type="button"
                        onClick={() => setMonthlyViewMode("full")}
                        aria-pressed={monthlyViewMode === "full"}
                        className={`apex-radar-segmented__btn${monthlyViewMode === "full" ? " is-active" : ""}`}
                    >
                        Full
                    </button>
                    <button
                        type="button"
                        onClick={() => setMonthlyViewMode("compact")}
                        aria-pressed={monthlyViewMode === "compact"}
                        className={`apex-radar-segmented__btn${monthlyViewMode === "compact" ? " is-active" : ""}`}
                    >
                        Compact
                    </button>
                </div>
            </div>

            {error ? <div className="apex-radar-alert">{error}</div> : null}

            {monthlyViewMode === "compact" ? (
                <div className="apex-radar-pi-section">
                    <CompactUnifiedTable
                        currentYear={currentYear}
                        previousYear={previousYear}
                        currentYearRows={currentYearRows}
                        previousYearRows={previousYearRows}
                        diffRows={diffRows}
                        currentFooter={currentFooter}
                        prevYtdFooter={prevYtdFooter}
                    />
                </div>
            ) : (
                <>
                    <div className="apex-radar-pi-section">
                        <h3 className="apex-radar-pi-section__title">Monthly metrics ({currentYear})</h3>
                        <DataTable
                            yearLabel={String(currentYear)}
                            rows={currentYearRows}
                            footerRows={currentFooter}
                            variant="default"
                        />
                    </div>

                    <div className="apex-radar-pi-section apex-radar-pi-section--muted">
                        <h3 className="apex-radar-pi-section__title">Monthly metrics ({previousYear})</h3>
                        <DataTable
                            yearLabel={String(previousYear)}
                            rows={previousYearRows}
                            footerRows={prevFooters}
                            variant="lastYear"
                        />
                    </div>

                    <div className="apex-radar-pi-section">
                        <h3 className="apex-radar-pi-section__title">Difference (year over year)</h3>
                        <DiffTable rows={diffRows} />
                    </div>
                </>
            )}
        </section>
    );
}
