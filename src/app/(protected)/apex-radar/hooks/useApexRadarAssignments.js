"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * @typedef {{ userIds: string[], paidSocialExcludedUserIds: string[] }} ApexRadarAssignmentDetail
 */

/**
 * @param {object} parsed
 * @param {unknown} parsed.assignments
 * @returns {Record<string, ApexRadarAssignmentDetail>}
 */
function normalizeAssignmentsPayload(assignmentsRaw) {
    /** @type {Record<string, ApexRadarAssignmentDetail>} */
    const next = {};
    if (!assignmentsRaw || typeof assignmentsRaw !== "object" || Array.isArray(assignmentsRaw)) {
        return next;
    }
    for (const [key, entry] of Object.entries(assignmentsRaw)) {
        const oid = String(key || "").trim();
        if (!oid) continue;

        /** @type {ApexRadarAssignmentDetail} */
        let normalized;

        if (Array.isArray(entry)) {
            normalized = {
                userIds: entry.map((x) => String(x)).filter(Boolean),
                paidSocialExcludedUserIds: [],
            };
        } else if (entry && typeof entry === "object") {
            const u = entry.userIds;
            const exPs = entry.paidSocialExcludedUserIds;
            normalized = {
                userIds: Array.isArray(u) ? u.map((x) => String(x)).filter(Boolean) : [],
                paidSocialExcludedUserIds: Array.isArray(exPs)
                    ? exPs.map((x) => String(x)).filter(Boolean)
                    : [],
            };
        } else continue;

        next[oid] = normalized;
    }
    return next;
}

/**
 * @param {string} channel
 * @returns {{
 *   assignmentDetailMap: Record<string, ApexRadarAssignmentDetail>,
 *   assignmentsLoading: boolean,
 *   assignmentsError: string | null,
 *   setAssignmentsForAccount: (accountKey: string, detail: ApexRadarAssignmentDetail) => Promise<void>,
 *   refetchAssignments: () => Promise<void>,
 * }}
 */
export function useApexRadarAssignments(channel) {
    /** @type {[Record<string, ApexRadarAssignmentDetail>, function]} */
    const [assignmentDetailMap, setAssignmentDetailMap] = useState({});
    const [assignmentsLoading, setAssignmentsLoading] = useState(true);
    const [assignmentsError, setAssignmentsError] = useState(null);

    const ch = String(channel || "").trim();

    const refetchAssignments = useCallback(async () => {
        if (!ch) {
            setAssignmentDetailMap({});
            return;
        }
        const res = await fetch(`/api/apex-radar/assignments?channel=${encodeURIComponent(ch)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || "Failed to load assignments");
        }
        setAssignmentDetailMap(normalizeAssignmentsPayload(data.assignments));
    }, [ch]);

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
                await refetchAssignments();
                if (cancelled) return;
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
    }, [ch, refetchAssignments]);

    const setAssignmentsForAccount = useCallback(
        async (accountKey, detail) => {
            const key = String(accountKey || "").trim();
            if (!key || !ch) return;
            const userIds = Array.from(
                new Set((detail?.userIds || []).map((x) => String(x)).filter(Boolean))
            );
            const paidSocialExcludedUserIds = Array.from(
                new Set((detail?.paidSocialExcludedUserIds || []).map((x) => String(x)).filter(Boolean))
            );
            try {
                const res = await fetch("/api/apex-radar/assignments", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        channel: ch,
                        customerId: key,
                        userIds,
                        paidSocialExcludedUserIds,
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
                        data.paidSocialExcludedUserIds != null &&
                        Array.isArray(data.paidSocialExcludedUserIds)
                            ? data.paidSocialExcludedUserIds.map((x) => String(x)).filter(Boolean)
                            : paidSocialExcludedUserIds;

                    const empty = savedUserIds.length === 0 && savedEx.length === 0;
                    if (empty) delete n[key];
                    else n[key] = { userIds: savedUserIds, paidSocialExcludedUserIds: savedEx };
                    return n;
                });
            } catch (e) {
                console.error("useApexRadarAssignments save:", e);
            }
        },
        [ch]
    );

    return {
        assignmentDetailMap,
        assignmentsLoading,
        assignmentsError,
        setAssignmentsForAccount,
        refetchAssignments,
    };
}
