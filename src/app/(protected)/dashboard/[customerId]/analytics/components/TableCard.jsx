"use client";

import React from "react";

export default function TableCard({ title, subtitle = null, columns = [], rows = [], emptyText = "No data" }) {
    return (
        <div className="apex-analytics-panel h-full">
            <h3 className="apex-analytics-panel__title">{title}</h3>
            {subtitle ? <p className="apex-analytics-panel__subtitle">{subtitle}</p> : null}
            <div className="apex-analytics-table-wrap">
                <table className="apex-analytics-table">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={c.align === "right" ? "is-right" : ""}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="apex-analytics-table__empty">
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r, idx) => (
                                <tr key={idx}>
                                    {columns.map((c) => (
                                        <td key={c.key} className={c.align === "right" ? "is-right" : ""}>
                                            {r[c.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
