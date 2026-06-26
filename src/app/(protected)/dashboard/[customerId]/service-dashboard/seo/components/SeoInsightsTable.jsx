"use client";

import React, { useMemo, useState } from "react";
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiChevronUp } from "react-icons/fi";
import SeoAppliedFilterBadges from "@/components/seo/SeoAppliedFilterBadges";

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
    const cls = improved ? "is-up" : worse ? "is-down" : "is-neutral";
    const sign = pct > 0 ? "+" : "";
    return (
        <span className={`apex-seo-yoy ml-1.5 text-[0.65rem] tabular-nums ${cls}`}>
            {sign}
            {fmtNum(pct, 1)}%
        </span>
    );
}

function PositionYoY({ delta }) {
    if (delta == null || Number.isNaN(delta) || delta === 0) return null;
    const improved = delta > 0;
    const cls = improved ? "is-up" : "is-down";
    const sign = delta > 0 ? "+" : "";
    return (
        <span className={`apex-seo-yoy ml-1.5 text-[0.65rem] font-medium tabular-nums ${cls}`}>
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
    const colorClass = spread > 10 ? "is-high" : spread > 6 ? "is-mid" : "is-low";

    return (
        <div className="flex items-center gap-2 min-w-[140px]">
            <div className="apex-seo-spread-track">
                <div
                    className={`apex-seo-spread-bar ${colorClass}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
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
                <span className="text-[0.65rem] text-[var(--color-muted)] tabular-nums">{row.position_spread_label}</span>
            </div>
        );
    }
    if (col.type === "valuePotential") {
        return (
            <div className="text-right">
                <span className="font-semibold tabular-nums">{fmtMoney(row.value_potential)}</span>
                {typeof row.value_uplift === "number" && row.value_uplift > 0 ? (
                    <span className="block apex-seo-uplift text-[0.65rem] tabular-nums">
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
            <span className="apex-seo-uplift">+{fmtNum(val)}</span>
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
                    <span className={`apex-seo-yoy ml-1.5 text-[0.65rem] ${yoyPct >= 0 ? "is-up" : "is-down"}`}>
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

export default function SeoInsightsTable({
    title,
    subtitle,
    columns,
    rows = [],
    pageSize = 10,
    expandable = false,
    expandField = "urls",
    filterSectionId,
    appliedFilters = [],
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
        <section className="apex-seo-table-panel">
            <div className="apex-seo-table-panel__head">
                <div className="apex-seo-table-panel__head-main">
                    <h3 className="apex-seo-table-panel__title">{title}</h3>
                    {subtitle ? <p className="apex-seo-table-panel__subtitle">{subtitle}</p> : null}
                    {filterSectionId ? (
                        <div className="apex-seo-table-panel__filters">
                            <SeoAppliedFilterBadges
                                sectionId={filterSectionId}
                                appliedFilters={appliedFilters}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="apex-seo-table-wrap">
                <table className="apex-seo-table">
                    <thead>
                        <tr>
                            {expandable ? <th className="w-8" /> : null}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`${col.align !== "left" ? "is-num is-sortable" : ""}`}
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
                                <td colSpan={columns.length + (expandable ? 1 : 0)} className="apex-seo-empty">
                                    No data for the selected period.
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((row, idx) => {
                                const isOpen = expanded[row.id];
                                const children = row[expandField];
                                return (
                                    <React.Fragment key={row.id || idx}>
                                        <tr>
                                            {expandable ? (
                                                <td>
                                                    {Array.isArray(children) && children.length > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpanded((e) => ({
                                                                    ...e,
                                                                    [row.id]: !e[row.id],
                                                                }))
                                                            }
                                                            className="apex-seo-icon-btn"
                                                            aria-expanded={isOpen}
                                                        >
                                                            {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            ) : null}
                                            {columns.map((col) => (
                                                <td
                                                    key={col.key}
                                                    className={col.align === "left" ? "is-left" : "is-num"}
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
                                                  <tr key={`${row.id}-${u.url}`} className="apex-seo-table__expand-row">
                                                      <td colSpan={columns.length + 1}>
                                                          <span className="pl-4">{u.url}</span>
                                                          <span className="float-right tabular-nums">
                                                              pos {fmtNum(u.position, 1)} · {fmtNum(u.clicks)} clicks
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
                <div className="apex-seo-table__pager">
                    <span>
                        Page {safePage} of {totalPages} · {sorted.length}{" "}
                        {sorted.length === 1 ? "row" : "rows"}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="apex-perf-btn"
                            aria-label="Previous page"
                        >
                            <FiChevronLeft />
                        </button>
                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="apex-perf-btn"
                            aria-label="Next page"
                        >
                            <FiChevronRight />
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
