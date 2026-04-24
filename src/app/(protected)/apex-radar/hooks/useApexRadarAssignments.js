"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * @param {string} channel
 * @returns {{
 *   assignmentMap: Record<string, string[]>,
 *   assignmentsLoading: boolean,
 *   assignmentsError: string | null,
 *   setAssignmentsForAccount: (accountKey: string, userIds: string[]) => Promise<void>,
 * }}
 */
export function useApexRadarAssignments(channel) {
    const [assignmentMap, setAssignmentMapState] = useState({});
    const [assignmentsLoading, setAssignmentsLoading] = useState(true);
    const [assignmentsError, setAssignmentsError] = useState(null);

    const ch = String(channel || "").trim();

    useEffect(() => {
        if (!ch) {
            setAssignmentMapState({});
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
                if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                    /** @type {Record<string, string[]>} */
                    const next = {};
                    for (const [k, ids] of Object.entries(raw)) {
                        if (!Array.isArray(ids)) continue;
                        next[String(k)] = ids.map((x) => String(x)).filter(Boolean);
                    }
                    setAssignmentMapState(next);
                } else {
                    setAssignmentMapState({});
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
        async (accountKey, userIds) => {
            const key = String(accountKey || "").trim();
            if (!key || !ch) return;
            const ids = Array.from(new Set((userIds || []).map((x) => String(x)).filter(Boolean)));
            try {
                const res = await fetch("/api/apex-radar/assignments", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ channel: ch, customerId: key, userIds: ids }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || "Failed to save assignments");
                }
                setAssignmentMapState((prev) => {
                    const next = { ...prev };
                    const saved = Array.isArray(data.userIds)
                        ? data.userIds.map((x) => String(x)).filter(Boolean)
                        : ids;
                    if (saved.length === 0) delete next[key];
                    else next[key] = saved;
                    return next;
                });
            } catch (e) {
                console.error("useApexRadarAssignments save:", e);
            }
        },
        [ch]
    );

    return { assignmentMap, assignmentsLoading, assignmentsError, setAssignmentsForAccount };
}
