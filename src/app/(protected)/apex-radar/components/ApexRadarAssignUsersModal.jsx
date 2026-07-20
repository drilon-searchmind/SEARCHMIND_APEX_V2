"use client";

import React, { useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import {
    getEffectiveApexRadarAssignmentUserIds,
    listMatchedPaidSocialUserIds,
} from "@/lib/apexRadarPaidSocialAssignments";
import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";

export default function ApexRadarAssignUsersModal({
    row,
    customer,
    assignment,
    onSave,
    onClose,
    assignableUsers = [],
    channel = APEX_RADAR_CHANNEL_FACEBOOK,
}) {
    const matchedIds = useMemo(
        () => new Set(listMatchedPaidSocialUserIds(customer, assignableUsers, channel)),
        [customer, assignableUsers, channel]
    );

    const initialCheckedIds = useMemo(
        () =>
            getEffectiveApexRadarAssignmentUserIds(
                assignment || {},
                customer,
                assignableUsers,
                channel
            ),
        [assignment, customer, assignableUsers, channel]
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
        <div className="apex-radar-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apex-assign-title">
            <div className="apex-radar-modal apex-radar-modal--lg">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-assign-title" className="apex-radar-modal__title">
                            Assign team
                        </h2>
                        <p className="apex-radar-modal__subtitle">{row.entity}</p>
                    </div>
                    <button type="button" onClick={onClose} className="apex-radar-modal__close" aria-label="Close">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="apex-radar-modal__body">
                    <div className="flex items-baseline justify-between gap-2 mb-3">
                        <h3 className="apex-radar-field-label mb-0">Team (Apex users)</h3>
                        {syncedHint ? (
                            <span className="apex-radar-field-hint mb-0 whitespace-nowrap">{syncedHint}</span>
                        ) : null}
                    </div>
                    <p className="apex-radar-section__subtitle mb-4">
                        Defaults use your ClickUp user id on each Apex account matched to this customer&apos;s Paid
                        Social roster. Re-sync ClickUp teams to refresh matches. Uncheck someone to leave them off
                        this property; you can still add anyone else below.
                    </p>
                    {sortedUsers.length === 0 ? (
                        <p className="apex-radar-empty py-2">No internal users available.</p>
                    ) : (
                        <ul className="apex-radar-modal-list">
                            {sortedUsers.map((u) => {
                                const isPs = matchedIds.has(u.id);
                                const hasCu = Boolean(String(u.clickupId || "").trim());
                                return (
                                    <li key={u.id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={checked.has(u.id)}
                                                onChange={() => toggleUser(u.id)}
                                            />
                                            <span className="flex-1 min-w-0">{u.name}</span>
                                            {isPs ? (
                                                <span className="shrink-0 text-[0.65rem] font-medium text-[var(--color-muted)]">
                                                    PS roster
                                                </span>
                                            ) : !hasCu ? (
                                                <span className="shrink-0 text-[0.65rem] text-amber-700">
                                                    No CU id
                                                </span>
                                            ) : null}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="apex-radar-modal__foot">
                    <button type="button" onClick={handleClearAll} className="apex-radar-link-btn mr-auto">
                        Clear all
                    </button>
                    <button type="button" onClick={onClose} className="apex-perf-btn apex-perf-btn--secondary">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="apex-perf-btn apex-perf-btn--primary">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
