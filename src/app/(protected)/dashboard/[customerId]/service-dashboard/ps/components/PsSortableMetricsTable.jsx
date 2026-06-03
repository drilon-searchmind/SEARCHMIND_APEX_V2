"use client";

import React, { useMemo, useState } from "react";

const dkMoney = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? `${n.toLocaleString("da-DK", { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr.`
        : "—";

const dkNum = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? n.toLocaleString("da-DK", { maximumFractionDigits: 0 })
        : "—";

const pct = (n, digits = 2) =>
    typeof n === "number" && !Number.isNaN(n)
        ? `${(n * (n <= 1 && n >= -1 ? 100 : 1)).toLocaleString("da-DK", {
              maximumFractionDigits: digits,
              minimumFractionDigits: digits,
          })}%`
        : "—";

const roasX = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? `${n.toLocaleString("da-DK", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}x`
        : "—";

const FORMATTERS = {
    text: (v) => v ?? "—",
    money: dkMoney,
    number: dkNum,
    percent: (v) => pct(v, 2),
    percentRaw: (v) =>
        typeof v === "number" && !Number.isNaN(v)
            ? `${v.toLocaleString("da-DK", { maximumFractionDigits: 2 })}%`
            : "—",
    roas: roasX,
};

function heatAlpha(value, max, invert = false) {
    if (!max || max <= 0 || value == null) return {};
    const t = Math.min(1, Math.max(0, value / max));
    const alpha = 0.15 + 0.85 * (invert ? 1 - t : t);
    return { backgroundColor: `rgba(214,205,182,${alpha})` };
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {Array<{ key: string, label: string, align?: 'left'|'right', format?: keyof FORMATTERS, heatmap?: boolean, heatmapInvert?: boolean }>} props.columns
 * @param {Array<Record<string, unknown>>} props.rows
 * @param {string} [props.rowKeyField]
 * @param {boolean} [props.highlightPositiveNegative] — color roas-like cells green/red
 */
export default function PsSortableMetricsTable({
    title,
    subtitle,
    columns,
    rows = [],
    rowKeyField = "id",
    highlightPositiveNegative = false,
}) {
    const [sortKey, setSortKey] = useState(columns.find((c) => c.align !== "left")?.key || columns[0]?.key);
    const [sortDir, setSortDir] = useState("desc");

    const sorted = useMemo(() => {
        const list = [...rows];
        const mult = sortDir === "desc" ? -1 : 1;
        list.sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
            return String(va || "").localeCompare(String(vb || "")) * mult;
        });
        return list;
    }, [rows, sortKey, sortDir]);

    const maxByCol = useMemo(() => {
        const m = {};
        for (const col of columns) {
            if (!col.heatmap) continue;
            m[col.key] = Math.max(...sorted.map((r) => Number(r[col.key]) || 0), 0);
        }
        return m;
    }, [sorted, columns]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const formatCell = (col, value, row) => {
        if (col.format === "percent" && typeof value === "number" && value <= 1) {
            return FORMATTERS.percent(value);
        }
        const fn = FORMATTERS[col.format] || FORMATTERS.text;
        return fn(value, row);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 min-w-0 max-w-full">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-3 py-2 font-semibold whitespace-nowrap ${
                                        col.align === "left" ? "text-left" : "text-right"
                                    } ${col.key !== columns[0]?.key || col.align !== "left" ? "cursor-pointer hover:text-gray-900" : ""}`}
                                    onClick={() => col.align !== "left" && toggleSort(col.key)}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-8 text-gray-400">
                                    No data for selected range.
                                </td>
                            </tr>
                        ) : (
                            sorted.map((row, idx) => (
                                <tr key={String(row[rowKeyField] ?? idx)} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                    {columns.map((col) => {
                                        const val = row[col.key];
                                        const isRoas = highlightPositiveNegative && col.key === "roas";
                                        const roasClass =
                                            isRoas && typeof val === "number"
                                                ? val >= 3
                                                    ? "text-emerald-700 font-semibold"
                                                    : val < 1.5
                                                      ? "text-red-600 font-semibold"
                                                      : ""
                                                : "";
                                        return (
                                            <td
                                                key={col.key}
                                                className={`px-3 py-2 whitespace-nowrap tabular-nums ${col.align === "left" ? "text-left text-gray-900 max-w-[280px] truncate" : `text-right text-gray-900 ${roasClass}`}`}
                                                style={
                                                    col.heatmap
                                                        ? heatAlpha(
                                                              Number(val) || 0,
                                                              maxByCol[col.key],
                                                              col.heatmapInvert
                                                          )
                                                        : undefined
                                                }
                                                title={col.align === "left" ? String(val ?? "") : undefined}
                                            >
                                                {formatCell(col, val, row)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
