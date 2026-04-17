"use client";

import React, { useMemo } from "react";
import Spinner from "@/components/ui/Spinner";
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
        if (pct >= 15) return "bg-emerald-100 text-emerald-900";
        if (pct >= 5) return "bg-green-50 text-green-800";
        return "bg-green-50/60 text-green-800";
    }
    if (pct < 0) {
        if (pct <= -15) return "bg-red-100 text-red-900";
        if (pct <= -5) return "bg-red-50 text-red-800";
        return "bg-red-50/60 text-red-800";
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

export default function PerformanceInvestigatorMonthlyTables({
    currentYear,
    previousYear,
    currentYearRows = [],
    previousYearRows = [],
    diffRows: diffRowsProp,
    loading = false,
    error = null,
}) {
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
            {error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {error}
                </div>
            ) : null}

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
        </section>
    );
}
