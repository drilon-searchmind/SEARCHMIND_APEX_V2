"use client";

import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
export default function ApexRadarAssignUsersModal({ row, selectedIds, onSave, onClose, assignableUsers = [] }) {
    const [checked, setChecked] = useState(() => new Set(selectedIds || []));

    useEffect(() => {
        setChecked(new Set(selectedIds || []));
    }, [row?.id, selectedIds]);

    if (!row) return null;

    const toggle = (userId) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleSave = () => {
        onSave(row.id, Array.from(checked));
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-assign-title"
        >
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 id="apex-assign-title" className="text-lg font-semibold text-gray-900">
                            Assign team
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{row.entity}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-3">
                        Choose one or more internal users for this account. Saved only in this browser until the API is
                        available.
                    </p>
                    <ul className="space-y-2">
                        {assignableUsers.length === 0 ? (
                            <li className="text-sm text-gray-500 py-2">No internal users available.</li>
                        ) : (
                            assignableUsers.map((u) => (
                                <li key={u.id}>
                                    <label className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={checked.has(u.id)}
                                            onChange={() => toggle(u.id)}
                                            className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                        />
                                        <span className="text-sm text-gray-900">{u.name}</span>
                                    </label>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        type="button"
                        onClick={() => setChecked(new Set())}
                        className="text-xs font-semibold text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs font-semibold text-gray-700 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="text-xs font-semibold text-white px-3 py-2 rounded-lg bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-hover)] transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
