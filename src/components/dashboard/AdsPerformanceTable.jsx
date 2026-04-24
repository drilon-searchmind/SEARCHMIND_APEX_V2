"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import Spinner from "@/components/ui/Spinner";

const dkMoney = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? `${n.toLocaleString("da-DK", { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr.`
        : "—";

const dkNum = (n) =>
    typeof n === "number" && !Number.isNaN(n) ? n.toLocaleString("da-DK", { maximumFractionDigits: 0 }) : "—";

const xMult = (n) =>
    typeof n === "number" && !Number.isNaN(n) ? `${n.toLocaleString("da-DK", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} X` : "—";

const pct = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? `${n.toLocaleString("da-DK", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`
        : "—";

function PlatformBadge({ platform }) {
    if (platform === "facebook") {
        return (
            <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-[10px] font-bold text-white"
                title="Meta / Facebook"
            >
                f
            </span>
        );
    }
    return (
        <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4285F4] text-[10px] font-bold text-white"
            title="Google Ads"
        >
            G
        </span>
    );
}

/**
 * @param {object} props
 * @param {Array} props.rows — normalized ad rows from API
 * @param {boolean} props.loading
 * @param {string[]} props.errors — optional error messages
 * @param {'google'|'facebook'} props.platform
 */
export default function AdsPerformanceTable({
    rows = [],
    loading = false,
    errors = [],
    platform = "google",
    /** Pre-fills the search box (e.g. from ?adSearch= campaign planner deep link) */
    initialSearch = "",
}) {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("revenue");
    const [sortDir, setSortDir] = useState("desc");
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        let list = Array.isArray(rows) ? [...rows] : [];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((r) => (r.ad_name || "").toLowerCase().includes(q));
        }
        const mult = sortDir === "desc" ? -1 : 1;
        list.sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
            return String(va || "").localeCompare(String(vb || "")) * mult;
        });
        return list;
    }, [rows, search, sortKey, sortDir]);

    const totalCount = filtered.length;
    /** At most two pages: page size = ceil(n/2) for n ≥ 1 */
    const pageSize = totalCount <= 0 ? 1 : Math.max(1, Math.ceil(totalCount / 2));
    const totalPages = totalCount <= 0 ? 1 : Math.ceil(totalCount / pageSize);

    useEffect(() => {
        if (typeof initialSearch === "string" && initialSearch.trim()) {
            setSearch(initialSearch);
        }
    }, [initialSearch]);

    useEffect(() => {
        setPage(1);
    }, [search, sortKey, sortDir]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
        if (page < 1) setPage(1);
    }, [page, totalPages]);

    const pagedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    const rangeLabel = () => {
        if (totalCount === 0) return "0 ads";
        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, totalCount);
        return `${start}–${end} of ${totalCount} ads`;
    };

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const errMsg = errors.filter(Boolean).join(" ");

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-w-0 max-w-full">
            <div className="px-4 py-4 space-y-3 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 shrink-0">Ads performance</h3>
                        {!loading ? (
                            <span className="text-sm text-gray-600 tabular-nums">
                                {totalCount} {totalCount === 1 ? "ad" : "ads"}
                            </span>
                        ) : null}
                    </div>
                    <div className="relative max-w-xs w-full">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="search"
                            placeholder="Filter by ad name…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]/25"
                        />
                    </div>
                </div>
                {errMsg ? <p className="text-xs text-amber-700">{errMsg}</p> : null}
            </div>

            {/* min-w-0 + max-w-full so flex layouts shrink this region; overflow-x-auto keeps wide tables inside the viewport */}
            <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
                {loading ? (
                    <div className="flex justify-center items-center min-h-[200px]">
                        <Spinner size={40} color="#406969" />
                    </div>
                ) : (
                    <table className="w-full min-w-[1000px] text-sm border-collapse">
                        <thead>
                            <tr className="text-left text-gray-500 font-semibold text-xs uppercase tracking-wide border-b border-gray-100">
                                <th className="px-4 py-3 whitespace-nowrap">Ad name</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("revenue")}>
                                    Revenue incl. VAT
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("roas")}>
                                    ROAS
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("poas")}>
                                    POAS
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("ad_spend")}>
                                    Ad spend
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("impressions")}>
                                    Impressions
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("clicks")}>
                                    Paid clicks
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("ctr")}>
                                    CTR
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("conv_rate_clicks")}>
                                    Conv. rate (clicks)
                                </th>
                                <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-gray-800" onClick={() => toggleSort("conv_rate_impressions")}>
                                    Conv. rate (impressions)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500 text-sm">
                                        No ad rows for this period or filter.
                                    </td>
                                </tr>
                            ) : (
                                pagedRows.map((r, idx) => (
                                    <tr key={`${r.ad_id}-${idx}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80">
                                        <td className="px-4 py-2.5 text-gray-900 align-middle whitespace-nowrap max-w-none">
                                            <div className="flex items-center gap-2">
                                                <PlatformBadge platform={r.platform || platform} />
                                                <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap" title={r.ad_name}>
                                                    {r.ad_name || "—"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{dkMoney(r.revenue)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{xMult(r.roas)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{xMult(r.poas)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{dkMoney(r.ad_spend)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{dkNum(r.impressions)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{dkNum(r.clicks)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{pct((r.ctr || 0) * 100)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{pct((r.conv_rate_clicks || 0) * 100)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{pct((r.conv_rate_impressions || 0) * 100)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {!loading && totalCount > 0 && totalPages > 1 ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-sm text-gray-700">
                    <span className="tabular-nums text-gray-600">{rangeLabel()}</span>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
