"use client";

import React, { useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import {
    getPaidSocialClickUpMembers,
    normClickUpMemberId,
} from "@/lib/apexRadarPaidSocialConstants";

/**
 * @typedef {{ id: string, name: string }} InternalUser
 */

export default function ApexRadarAssignUsersModal({
    row,
    customer,
    assignment,
    onSave,
    onClose,
    assignableUsers = [],
}) {
    const [apexChecked, setApexChecked] = useState(() => new Set(assignment?.userIds || []));
    const [cuExcluded, setCuExcluded] = useState(
        () => new Set((assignment?.excludedClickUpMemberIds || []).map(normClickUpMemberId))
    );

    const roster = useMemo(() => getPaidSocialClickUpMembers(customer), [customer]);

    const syncedHint = useMemo(() => {
        const t = customer?.customerTeam?.syncedAt;
        if (t == null) return null;
        const raw = typeof t === "object" && t != null && "$date" in t ? t.$date : t;
        const d = new Date(raw ?? "");
        if (Number.isNaN(d.getTime())) return null;
        return `Synced ${d.toISOString().slice(0, 10)}`;
    }, [customer]);

    if (!row) return null;

    /** PS roster member is included when not in exclusion set. */
    const toggleCu = (rawId) => {
        const id = normClickUpMemberId(rawId);
        if (!id) return;
        setCuExcluded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleApex = (userId) => {
        const id = String(userId);
        setApexChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        const excludedClickUpMemberIds = roster
            .map((m) => normClickUpMemberId(m.id))
            .filter(Boolean)
            .filter((id) => cuExcluded.has(id));

        const payload = {
            userIds: Array.from(apexChecked),
            excludedClickUpMemberIds,
        };
        await Promise.resolve(onSave(row.id, payload));
        onClose();
    };

    const handleClearAll = () => {
        setApexChecked(new Set());
        setCuExcluded(new Set());
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

                <div className="px-5 py-4 max-h-[62vh] overflow-y-auto space-y-6">
                    <section>
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Paid Social (ClickUp Meta roster)
                            </h3>
                            {syncedHint ? (
                                <span className="text-[0.65rem] text-gray-400 whitespace-nowrap">
                                    {syncedHint}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                            Defaults match ClickUp members with the Paid Social / Meta service field. Uncheck someone to
                            exclude them only here — saved roster stays unchanged until you re-sync from ClickUp.
                        </p>
                        {roster.length === 0 ? (
                            <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-200 px-3 py-4 bg-gray-50">
                                No Paid Social teammates found on this customer. Run “Re-sync ClickUp teams” once the
                                customer has a ClickUp ID and a cached team snapshot.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {roster.map((m, idx) => {
                                    const id = normClickUpMemberId(m.id);
                                    const included = id && !cuExcluded.has(id);
                                    return (
                                        <li key={id || `ps-${idx}`}>
                                            <label className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-gray-50">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(included)}
                                                    onChange={() => toggleCu(m.id)}
                                                    className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                                />
                                                {m.avatar ? (
                                                    <>
                                                        {/* eslint-disable-next-line @next/next/no-img-element -- external ClickUp CDN */}
                                                        <img
                                                            src={m.avatar}
                                                            alt=""
                                                            className="h-8 w-8 shrink-0 rounded-full object-cover bg-gray-100"
                                                        />
                                                    </>
                                                ) : (
                                                    <span className="h-8 w-8 shrink-0 rounded-full bg-gray-200" />
                                                )}
                                                <span className="text-sm text-gray-900 flex-1 min-w-0">
                                                    {m.username || id || "—"}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                            Internal Apex users
                        </h3>
                        <p className="text-xs text-gray-500 mb-3">
                            Add teammates from Apex the same way as before. Apex users and ClickUp roster are separate
                            until account linking arrives.
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
                                                checked={apexChecked.has(u.id)}
                                                onChange={() => toggleApex(u.id)}
                                                className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                            />
                                            <span className="text-sm text-gray-900">{u.name}</span>
                                        </label>
                                    </li>
                                ))
                            )}
                        </ul>
                    </section>
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
