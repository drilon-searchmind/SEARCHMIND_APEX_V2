"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * @typedef {{ userIds: string[], excludedClickUpMemberIds: string[] }} ApexRadarAssignmentDetail
 */

/**
 * @param {string} channel
 * @returns {{
 *   assignmentDetailMap: Record<string, ApexRadarAssignmentDetail>,
 *   assignmentsLoading: boolean,
 *   assignmentsError: string | null,
 *   setAssignmentsForAccount: (accountKey: string, detail: ApexRadarAssignmentDetail) => Promise<void>,
 * }}
 */
export function useApexRadarAssignments(channel) {
    /** @type {[Record<string, ApexRadarAssignmentDetail>, function]} */
    const [assignmentDetailMap, setAssignmentDetailMap] = useState({});
    const [assignmentsLoading, setAssignmentsLoading] = useState(true);
    const [assignmentsError, setAssignmentsError] = useState(null);

    const ch = String(channel || "").trim();

    useEffect(() => {
        if (!ch) {
            setAssignmentDetailMap({});
            setAssignmentsLoading(false);
            setAssignmentsError(null);
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                setAssignmentsLoading(true);
                setAssignmentsError(null);
                const res = await fetch(`/api/apex-radar/assignments?channel=${encodeURIComponent(ch)}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load assignments");
                }
                if (cancelled) return;
                const raw = data.assignments;
                /** @type {Record<string, ApexRadarAssignmentDetail>} */
                const next = {};
                if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                    for (const [key, entry] of Object.entries(raw)) {
                        const oid = String(key || "").trim();
                        if (!oid) continue;

                        /** @type {{ userIds?: unknown, excludedClickUpMemberIds?: unknown }} */
                        const normalized = {};

                        /** Old shape Record<customerId, string[]> */
                        if (Array.isArray(entry)) {
                            normalized.userIds = entry.map((x) => String(x)).filter(Boolean);
                            normalized.excludedClickUpMemberIds = [];
                        } else if (entry && typeof entry === "object") {
                            const u = entry.userIds;
                            const ex = entry.excludedClickUpMemberIds;
                            normalized.userIds = Array.isArray(u)
                                ? u.map((x) => String(x)).filter(Boolean)
                                : [];
                            normalized.excludedClickUpMemberIds = Array.isArray(ex)
                                ? ex.map((x) => String(x)).filter(Boolean)
                                : [];
                        } else continue;

                        next[oid] = normalized;
                    }
                    setAssignmentDetailMap(next);
                } else {
                    setAssignmentDetailMap({});
                }
            } catch (e) {
                if (!cancelled) {
                    setAssignmentsError(e?.message || "Failed to load assignments");
                    console.error("useApexRadarAssignments load:", e);
                }
            } finally {
                if (!cancelled) setAssignmentsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [ch]);

    const setAssignmentsForAccount = useCallback(
        async (accountKey, detail) => {
            const key = String(accountKey || "").trim();
            if (!key || !ch) return;
            const userIds = Array.from(
                new Set((detail?.userIds || []).map((x) => String(x)).filter(Boolean))
            );
            const excludedClickUpMemberIds = Array.from(
                new Set((detail?.excludedClickUpMemberIds || []).map((x) => String(x)).filter(Boolean))
            );
            try {
                const res = await fetch("/api/apex-radar/assignments", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        channel: ch,
                        customerId: key,
                        userIds,
                        excludedClickUpMemberIds,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || "Failed to save assignments");
                }
                setAssignmentDetailMap((prev) => {
                    const n = { ...prev };
                    const savedUserIds = Array.isArray(data.userIds)
                        ? data.userIds.map((x) => String(x)).filter(Boolean)
                        : userIds;
                    const savedEx =
                        data.excludedClickUpMemberIds != null && Array.isArray(data.excludedClickUpMemberIds)
                            ? data.excludedClickUpMemberIds.map((x) => String(x)).filter(Boolean)
                            : excludedClickUpMemberIds;

                    const empty = savedUserIds.length === 0 && savedEx.length === 0;
                    if (empty) delete n[key];
                    else n[key] = { userIds: savedUserIds, excludedClickUpMemberIds: savedEx };
                    return n;
                });
            } catch (e) {
                console.error("useApexRadarAssignments save:", e);
            }
        },
        [ch]
    );

    return { assignmentDetailMap, assignmentsLoading, assignmentsError, setAssignmentsForAccount };
}
