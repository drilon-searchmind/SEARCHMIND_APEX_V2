"use client";

import React, { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";

/**
 * Sortable table card for the PPC dashboard.
 * columns: [{ key, label, left?, sortValue(row), render(row), className?(row) }]
 */
export default function PpcTable({
    title,
    subtitle,
    columns,
    rows,
    rowKey,
    initialSort,
    pageSize = 0,
    searchKey,
    searchPlaceholder = "Search",
    emptyText = "No rows for this period.",
    actions = null,
}) {
    const [sort, setSort] = useState(initialSort || { key: columns[0].key, dir: "desc" });
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q || !searchKey) return rows;
        return rows.filter((r) => String(r[searchKey] || "").toLowerCase().includes(q));
    }, [rows, query, searchKey]);

    const sorted = useMemo(() => {
        const col = columns.find((c) => c.key === sort.key) || columns[0];
        const value = col.sortValue || ((r) => r[col.key]);
        const dir = sort.dir === "asc" ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const va = value(a);
            const vb = value(b);
            if (typeof va === "string" || typeof vb === "string") return String(va ?? "").localeCompare(String(vb ?? ""), "da") * dir;
            return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir;
        });
    }, [filtered, sort, columns]);

    const pages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
    const safePage = Math.min(page, pages - 1);
    const visible = pageSize > 0 ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

    const toggleSort = (key) => {
        setPage(0);
        setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
    };

    return (
        <section className="apex-ov-card">
            <div className="apex-ov-card__head apex-sx-tblcard__head">
                <div className="apex-sx-tblcard__main">
                    <h3>{title}</h3>
                    {subtitle ? <p className="apex-sx-tblcard__sub">{subtitle}</p> : null}
                </div>
                {actions}
            </div>

            {searchKey ? (
                <label className="apex-px-search">
                    <FiSearch aria-hidden />
                    <input
                        type="search"
                        value={query}
                        placeholder={searchPlaceholder}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(0);
                        }}
                        aria-label={searchPlaceholder}
                    />
                </label>
            ) : null}

            <div className="apex-sx-tblwrap">
                <table className="apex-sx-tbl">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th
                                    key={c.key}
                                    className={`is-sortable${c.left ? " is-left" : ""}`}
                                    onClick={() => toggleSort(c.key)}
                                    aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                                >
                                    {c.label}
                                    {sort.key === c.key ? <span className="apex-sx-sort">{sort.dir === "asc" ? " ↑" : " ↓"}</span> : null}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.length === 0 ? (
                            <tr>
                                <td className="apex-sx-tbl__empty" colSpan={columns.length}>
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            visible.map((row) => (
                                <tr key={rowKey(row)}>
                                    {columns.map((c) => (
                                        <td key={c.key} className={`${c.left ? "is-left " : ""}${c.className ? c.className(row) : ""}`.trim()}>
                                            {c.render ? c.render(row) : row[c.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pageSize > 0 && sorted.length > pageSize ? (
                <div className="apex-sx-pager">
                    <span>
                        {safePage * pageSize + 1} to {Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}
                    </span>
                    <div className="apex-sx-pager__btns">
                        <button type="button" className="apex-px-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                            Previous
                        </button>
                        <button type="button" className="apex-px-btn" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
                            Next
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
