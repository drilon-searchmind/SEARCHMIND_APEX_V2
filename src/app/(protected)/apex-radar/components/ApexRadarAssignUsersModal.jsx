"use client";

import React, { useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import {
    getEffectiveApexRadarAssignmentUserIds,
    listMatchedPaidSocialUserIds,
} from "@/lib/apexRadarPaidSocialAssignments";

export default function ApexRadarAssignUsersModal({
    row,
    customer,
    assignment,
    onSave,
    onClose,
    assignableUsers = [],
}) {
    const matchedIds = useMemo(
        () => new Set(listMatchedPaidSocialUserIds(customer, assignableUsers)),
        [customer, assignableUsers]
    );

    const initialCheckedIds = useMemo(
        () => getEffectiveApexRadarAssignmentUserIds(assignment || {}, customer, assignableUsers),
        [assignment, customer, assignableUsers]
    );

    const [checked, setChecked] = useState(() => new Set(initialCheckedIds));

    const sortedUsers = useMemo(() => {
        const list = Array.isArray(assignableUsers) ? [...assignableUsers] : [];
        return list.sort((a, b) => {
            const ma = matchedIds.has(a.id) ? 0 : 1;
            const mb = matchedIds.has(b.id) ? 0 : 1;
            if (ma !== mb) return ma - mb;
            return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
                sensitivity: "base",
            });
        });
    }, [assignableUsers, matchedIds]);

    const syncedHint = useMemo(() => {
        const t = customer?.customerTeam?.syncedAt;
        if (t == null) return null;
        const raw = typeof t === "object" && t != null && "$date" in t ? t.$date : t;
        const d = new Date(raw ?? "");
        if (Number.isNaN(d.getTime())) return null;
        return `Synced ${d.toISOString().slice(0, 10)}`;
    }, [customer]);

    if (!row) return null;

    const toggleUser = (userId) => {
        const id = String(userId);
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        const matchedArr = [...matchedIds];
        const paidSocialExcludedUserIds = matchedArr.filter((id) => !checked.has(id));
        const userIds = [...checked];
        await Promise.resolve(onSave(row.id, { userIds, paidSocialExcludedUserIds }));
        onClose();
    };

    const handleClearAll = () => {
        setChecked(new Set());
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-assign-title"
        >
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xl">
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

                <div className="px-5 py-4 max-h-[62vh] overflow-y-auto space-y-4">
                    <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Team (Apex users)
                        </h3>
                        {syncedHint ? (
                            <span className="text-[0.65rem] text-gray-400 whitespace-nowrap">{syncedHint}</span>
                        ) : null}
                    </div>
                    <p className="text-xs text-gray-500">
                        Defaults use your ClickUp user id on each Apex account matched to this customer’s Paid Social
                        roster. Re-sync ClickUp teams to refresh matches. Uncheck someone to leave them off this
                        property; you can still add anyone else below.
                    </p>
                    {sortedUsers.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">No internal users available.</p>
                    ) : (
                        <ul className="space-y-1">
                            {sortedUsers.map((u) => {
                                const isPs = matchedIds.has(u.id);
                                const hasCu = Boolean(String(u.clickupId || "").trim());
                                return (
                                    <li key={u.id}>
                                        <label className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={checked.has(u.id)}
                                                onChange={() => toggleUser(u.id)}
                                                className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                            />
                                            <span className="text-sm text-gray-900 flex-1 min-w-0">{u.name}</span>
                                            {isPs ? (
                                                <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-primary-searchmind)]">
                                                    PS roster
                                                </span>
                                            ) : !hasCu ? (
                                                <span className="shrink-0 text-[0.65rem] text-amber-700">No CU id</span>
                                            ) : null}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        type="button"
                        onClick={handleClearAll}
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
