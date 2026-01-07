"use client";

import React from "react";

export default function TableCard({ title, columns = [], rows = [], emptyText = "No data" }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={`px-4 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="text-center py-4 text-gray-400">{emptyText}</td></tr>
                        ) : rows.map((r, idx) => (
                            <tr key={idx} className="border-b last:border-b-0">
                                {columns.map((c) => (
                                    <td key={c.key} className={`px-4 py-2 ${c.align === 'right' ? 'text-right' : ''}`}>{r[c.key]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
