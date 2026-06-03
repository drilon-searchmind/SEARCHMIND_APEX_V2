"use client";

import React, { useMemo, useState } from "react";
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiChevronUp } from "react-icons/fi";

const fmtNum = (n, digits = 0) =>
    typeof n === "number" && !Number.isNaN(n)
        ? n.toLocaleString("en-US", {
              maximumFractionDigits: digits,
              minimumFractionDigits: digits,
          })
        : "—";

const fmtMoney = (n) =>
    typeof n === "number" && !Number.isNaN(n) ? `${fmtNum(n)} kr.` : "—";

const fmtPct = (n, digits = 1) =>
    typeof n === "number" && !Number.isNaN(n) ? `${fmtNum(n, digits)}%` : "—";

function YoYPill({ pct, invert = false }) {
    if (pct == null || Number.isNaN(pct)) return null;
    const improved = invert ? pct < 0 : pct > 0;
    const worse = invert ? pct > 0 : pct < 0;
    const cls = improved ? "text-emerald-600" : worse ? "text-red-600" : "text-gray-500";
    const sign = pct > 0 ? "+" : "";
    return (
        <span className={`ml-1.5 text-[0.65rem] tabular-nums ${cls}`}>
            {sign}
            {fmtNum(pct, 1)}%
        </span>
    );
}

function PositionYoY({ delta }) {
    if (delta == null || Number.isNaN(delta) || delta === 0) return null;
    const improved = delta > 0;
    const cls = improved ? "text-emerald-600" : "text-red-600";
    const sign = delta > 0 ? "+" : "";
    return (
        <span className={`ml-1.5 text-[0.65rem] font-medium tabular-nums ${cls}`}>
            {sign}
            {fmtNum(delta, 0)}
        </span>
    );
}

function PositionSpreadBar({ min, max }) {
    const lo = Math.max(1, Math.min(min, 20));
    const hi = Math.max(lo, Math.min(max, 20));
    const left = ((lo - 1) / 19) * 100;
    const width = Math.max(4, ((hi - lo) / 19) * 100);
    const spread = hi - lo;
    const color = spread > 10 ? "bg-red-400" : spread > 6 ? "bg-amber-400" : "bg-emerald-500";

    return (
        <div className="flex items-center gap-2 min-w-[140px]">
            <div className="relative flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`absolute top-0 h-full rounded-full ${color}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                />
                <div
                    className="absolute top-0 w-0.5 h-full bg-gray-900"
                    style={{ left: `${left + width / 2}%` }}
                />
            </div>
        </div>
    );
}

function renderCell(col, row) {
    const val = row[col.key];
    if (col.type === "positionSpread") {
        return (
            <div className="flex flex-col items-end gap-1">
                <PositionSpreadBar min={row.position_min} max={row.position_max} />
                <span className="text-[0.65rem] text-gray-500 tabular-nums">{row.position_spread_label}</span>
            </div>
        );
    }
    if (col.type === "valuePotential") {
        return (
            <div className="text-right">
                <span className="font-semibold tabular-nums">{fmtMoney(row.value_potential)}</span>
                {typeof row.value_uplift === "number" && row.value_uplift > 0 ? (
                    <span className="block text-emerald-600 text-[0.65rem] tabular-nums">
                        +{fmtMoney(row.value_uplift)}
                    </span>
                ) : null}
            </div>
        );
    }
    if (col.type === "positionWithYoY") {
        return (
            <span className="tabular-nums">
                {fmtNum(val, 1)}
                <PositionYoY delta={row.position_yoy} />
            </span>
        );
    }
    if (col.format === "money") return fmtMoney(val);
    if (col.format === "percent") return fmtPct(val, col.pctDigits ?? 2);
    if (col.format === "number") return fmtNum(val, col.numDigits ?? 0);
    if (col.format === "uplift") {
        return typeof val === "number" ? (
            <span className="text-emerald-600 font-medium">+{fmtNum(val)}</span>
        ) : (
            "—"
        );
    }
    return val ?? "—";
}

function renderPrimaryWithYoY(col, row) {
    const val = row[col.key];
    if (col.yoyKey === "position_yoy" || col.type === "positionWithYoY") {
        return renderCell(col, row);
    }
    const yoyPct = col.yoyKey ? row[col.yoyKey] : null;
    const invert = col.yoyInvert === true;
    return (
        <span className="tabular-nums">
            {renderCell(col, row)}
            {col.yoyKey?.includes("_pp") ? (
                yoyPct != null ? (
                    <span
                        className={`ml-1.5 text-[0.65rem] ${yoyPct >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                        {yoyPct >= 0 ? "+" : ""}
                        {fmtNum(yoyPct, 1)}%
                    </span>
                ) : null
            ) : (
                <YoYPill pct={yoyPct} invert={invert} />
            )}
        </span>
    );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {Array} props.columns
 * @param {Array} props.rows
 * @param {number} [props.pageSize]
 * @param {boolean} [props.expandable]
 * @param {string} [props.expandField]
 */
export default function SeoInsightsTable({
    title,
    subtitle,
    columns,
    rows = [],
    pageSize = 10,
    expandable = false,
    expandField = "urls",
}) {
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState(columns.find((c) => c.align !== "left")?.key || columns[0]?.key);
    const [sortDir, setSortDir] = useState("desc");
    const [expanded, setExpanded] = useState({});

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

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    React.useEffect(() => {
        setPage(1);
    }, [rows, pageSize]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 min-w-0 max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {subtitle ? <p className="text-xs text-gray-500 sm:max-w-md sm:text-right">{subtitle}</p> : null}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600">
                            {expandable ? <th className="w-8 px-2 py-2" /> : null}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-3 py-2 font-semibold whitespace-nowrap ${
                                        col.align === "left"
                                            ? "text-left"
                                            : "text-right cursor-pointer hover:text-gray-900"
                                    }`}
                                    onClick={() => col.align !== "left" && toggleSort(col.key)}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (expandable ? 1 : 0)}
                                    className="text-center py-8 text-gray-400"
                                >
                                    No data for the selected period.
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((row, idx) => {
                                const isOpen = expanded[row.id];
                                const children = row[expandField];
                                return (
                                    <React.Fragment key={row.id || idx}>
                                        <tr className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            {expandable ? (
                                                <td className="px-2 py-2">
                                                    {Array.isArray(children) && children.length > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpanded((e) => ({
                                                                    ...e,
                                                                    [row.id]: !e[row.id],
                                                                }))
                                                            }
                                                            className="p-1 text-gray-500 hover:text-gray-800"
                                                            aria-expanded={isOpen}
                                                        >
                                                            {isOpen ? (
                                                                <FiChevronUp />
                                                            ) : (
                                                                <FiChevronDown />
                                                            )}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            ) : null}
                                            {columns.map((col) => (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-2 whitespace-nowrap ${
                                                        col.align === "left"
                                                            ? "text-left text-gray-900 max-w-[280px] truncate"
                                                            : "text-right text-gray-900"
                                                    }`}
                                                    title={col.align === "left" ? String(row[col.key] ?? "") : undefined}
                                                >
                                                    {col.yoyKey || col.type === "positionWithYoY"
                                                        ? renderPrimaryWithYoY(col, row)
                                                        : renderCell(col, row)}
                                                </td>
                                            ))}
                                        </tr>
                                        {expandable && isOpen && Array.isArray(children)
                                            ? children.map((u) => (
                                                  <tr key={`${row.id}-${u.url}`} className="bg-gray-50/80">
                                                      <td
                                                          colSpan={columns.length + 1}
                                                          className="px-3 py-1.5 text-gray-600"
                                                      >
                                                          <span className="pl-6">{u.url}</span>
                                                          <span className="float-right text-gray-500 tabular-nums">
                                                              pos {fmtNum(u.position, 1)} · {fmtNum(u.clicks)}{" "}
                                                              clicks
                                                          </span>
                                                      </td>
                                                  </tr>
                                              ))
                                            : null}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {sorted.length > 0 && (
                <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                    <span>
                        Page {safePage} of {totalPages} · {sorted.length}{" "}
                        {sorted.length === 1 ? "row" : "rows"}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="p-2 rounded-full border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                            aria-label="Previous page"
                        >
                            <FiChevronLeft />
                        </button>
                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="p-2 rounded-full border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                            aria-label="Next page"
                        >
                            <FiChevronRight />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
