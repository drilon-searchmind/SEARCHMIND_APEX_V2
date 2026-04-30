"use client";

import React, { useMemo, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import {
    PI_METRIC_HEADERS,
    PI_METRIC_KEYS,
    aggregatePiRows,
    computePiYearOverYearDiff,
} from "../lib/mockPerformanceInvestigatorData";

/** Same palette / structure as `DailyMetricsTableHeader` (daily-overview) */
const PI_GROUPS = [
    {
        key: "reach",
        label: "Reach & engagement",
        headerClass: "bg-[#1e2b2b]",
        keys: ["impr", "clicks", "ctr", "freq"],
    },
    {
        key: "spend",
        label: "Spend & efficiency",
        headerClass: "bg-[#3b5252]",
        keys: ["avgCpc", "cost"],
    },
    {
        key: "conversion",
        label: "Conversions & value",
        headerClass: "bg-[#5e8888]",
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
        if (pct >= 15) return "ml-2 bg-emerald-100 text-emerald-900";
        if (pct >= 5) return "ml-2 bg-green-50 text-green-800";
        return "ml-2 bg-green-50/60 text-green-800";
    }
    if (pct < 0) {
        if (pct <= -15) return "ml-2 bg-red-100 text-red-900";
        if (pct <= -5) return "ml-2 bg-red-50 text-red-800";
        return "ml-2 bg-red-50/60 text-red-800";
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
    if (g && gp && g.key !== gp.key) return " border-l border-gray-200";
    return "";
}

const TABLE_CLASS = "min-w-full text-xs text-left border-collapse";
const TABLE_STYLE = { fontSize: "12px" };

function PiTableHeader({ firstColumnLabel, variant = "default" }) {
    const subHeaderBg = variant === "lastYear" ? "bg-gray-100" : "bg-gray-50";
    const flatKeys = PI_METRIC_KEYS;

    return (
        <thead>
            <tr className="bg-gray-200">
                <th
                    className="px-3 py-1.5 font-semibold text-gray-200 bg-black"
                    rowSpan={2}
                >
                    {firstColumnLabel}
                </th>
                {PI_GROUPS.map((g) => (
                    <th
                        key={g.key}
                        className={`px-3 py-1.5 font-semibold text-gray-200 text-center border-l border-gray-300 ${g.headerClass}`}
                        colSpan={g.keys.length}
                    >
                        {g.label}
                    </th>
                ))}
            </tr>
            <tr className={subHeaderBg}>
                {flatKeys.map((k) => {
                    const idx = flatKeys.indexOf(k);
                    const prev = idx > 0 ? flatKeys[idx - 1] : null;
                    const showBorderL =
                        idx === 0 ||
                        (prev && groupForKey(k)?.key !== groupForKey(prev)?.key);
                    return (
                        <th
                            key={k}
                            className={`px-3 py-1.5 font-semibold text-gray-700 ${
                                showBorderL ? "border-l border-gray-300" : ""
                            }`}
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
        <tbody className="text-[12px]">
            {rows.map((row, index) => (
                <tr key={`${row.label}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 whitespace-nowrap">{row.label}</td>
                    {flatKeys.map((k) => (
                        <td
                            key={k}
                            className={`px-3 py-2 whitespace-nowrap${borderLForMetricKey(k, flatKeys)}`}
                        >
                            {formatMetricCell(k, row[k])}
                        </td>
                    ))}
                </tr>
            ))}
            {footerRows.map((fr, fi) => (
                <tr key={`foot-${fi}`} className="bg-gray-100 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2 whitespace-nowrap">{fr.label}</td>
                    {flatKeys.map((k) => (
                        <td
                            key={k}
                            className={`px-3 py-2 whitespace-nowrap${borderLForMetricKey(k, flatKeys)}`}
                        >
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
        <div className="overflow-x-auto">
            <table className={TABLE_CLASS} style={TABLE_STYLE}>
                <PiTableHeader firstColumnLabel={yearLabel} variant={variant} />
                <DataTableBody rows={rows} footerRows={footerRows} />
            </table>
        </div>
    );
}

function DiffTableBody({ rows }) {
    const flatKeys = PI_METRIC_KEYS;

    return (
        <tbody className="text-[12px]">
            {rows.map((row, index) => (
                <tr key={`${row.label}-d-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{row.label}</td>
                    {flatKeys.map((k) => {
                        const p = row.pct?.[k];
                        const show = p != null && !Number.isNaN(p);
                        const heat = show ? diffHeatClass(p) : "";
                        return (
                            <td
                                key={k}
                                className={`px-3 py-2 whitespace-nowrap${borderLForMetricKey(k, flatKeys)}${heat ? ` ${heat}` : ""}`}
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
        <div className="overflow-x-auto">
            <table className={TABLE_CLASS} style={TABLE_STYLE}>
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
                <span className="font-semibold tabular-nums text-gray-900">{main || "—"}</span>
                {showPct ? (
                    <span
                        className={`mt-0.5 inline-block max-w-full rounded px-1 py-0.5 text-[11px] font-semibold tabular-nums leading-tight${heat ? ` ${heat}` : ""}`}
                    >
                        {formatDiffCell(pct)}
                    </span>
                ) : (
                    <span className="mt-0.5 block text-[10px] text-gray-400">YoY —</span>
                )}
            </span>
        );
        return (
            <td className={`px-2 py-1.5 align-top sm:px-3 sm:py-2${borderL}`}>
                <Tooltip content={tip}>
                    <button
                        type="button"
                        className="block w-max max-w-full cursor-default text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] focus-visible:ring-offset-1 rounded"
                    >
                        {inner}
                    </button>
                </Tooltip>
            </td>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
            <p className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 sm:text-xs">
                {currentYear}: primary value · <strong>YoY %</strong> below · {previousYear} on hover over any cell.
            </p>
            <table className={`${TABLE_CLASS} text-[11px] sm:text-xs`}>
                <PiTableHeader firstColumnLabel={firstColLabel} variant="default" />
                <tbody>
                    {currentYearRows.map((row, index) => {
                        const prev = previousYearRows[index];
                        const diff = diffRows[index];
                        return (
                            <tr
                                key={`c-${row.label}-${index}`}
                                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                                <td className="px-3 py-2 whitespace-nowrap font-medium">{row.label}</td>
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
                        <tr
                            key={`cf-${fi}`}
                            className="border-t-2 border-gray-300 bg-gray-100 font-semibold text-gray-900"
                        >
                            <td className="px-3 py-2 whitespace-nowrap">{fr.label}</td>
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
            <section className="rounded-xl border border-gray-200 bg-white p-12 flex flex-col items-center gap-3" aria-busy="true">
                <Spinner size={40} color="#406969" />
                <p className="text-sm text-gray-500">Loading monthly metrics…</p>
            </section>
        );
    }

    return (
        <section className="space-y-8" aria-label="Monthly performance tables">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:px-5">
                <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Monthly metrics</span>
                    <span className="hidden text-gray-500 sm:inline">
                        {" · "}
                        {currentYear} vs {previousYear}
                    </span>
                </p>
                <div
                    className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-100 p-0.5"
                    role="group"
                    aria-label="Table layout density"
                >
                    <button
                        type="button"
                        onClick={() => setMonthlyViewMode("full")}
                        aria-pressed={monthlyViewMode === "full"}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] ${
                            monthlyViewMode === "full"
                                ? "bg-white text-gray-900 ring-1 ring-gray-200"
                                : "text-gray-600 hover:text-gray-800"
                        }`}
                    >
                        Full
                    </button>
                    <button
                        type="button"
                        onClick={() => setMonthlyViewMode("compact")}
                        aria-pressed={monthlyViewMode === "compact"}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] ${
                            monthlyViewMode === "compact"
                                ? "bg-white text-gray-900 ring-1 ring-gray-200"
                                : "text-gray-600 hover:text-gray-800"
                        }`}
                    >
                        Compact
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {error}
                </div>
            ) : null}

            {monthlyViewMode === "compact" ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
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
                    <div className="rounded-xl border border-gray-200 bg-white p-6">
                        <h3 className="mb-5 text-lg font-semibold text-gray-900">Monthly metrics ({currentYear})</h3>
                        <DataTable
                            yearLabel={String(currentYear)}
                            rows={currentYearRows}
                            footerRows={currentFooter}
                            variant="default"
                        />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                        <h3 className="mb-5 text-lg font-semibold text-gray-900">Monthly metrics ({previousYear})</h3>
                        <DataTable
                            yearLabel={String(previousYear)}
                            rows={previousYearRows}
                            footerRows={prevFooters}
                            variant="lastYear"
                        />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-6">
                        <h3 className="mb-5 text-lg font-semibold text-gray-900">Difference (year over year)</h3>
                        <DiffTable rows={diffRows} />
                    </div>
                </>
            )}
        </section>
    );
}
