"use client";

import { useCallback, useEffect, useState } from "react";
import { readAssignmentsForChannel, writeAssignmentsForChannel } from "../lib/apexRadarAssignmentsStorage";

/**
 * @param {string} channel
 * @returns {{ assignmentMap: Record<string, string[]>, setAssignmentsForAccount: (accountKey: string, userIds: string[]) => void }}
 */
export function useApexRadarAssignments(channel) {
    const [assignmentMap, setAssignmentMapState] = useState(() =>
        typeof window !== "undefined" ? readAssignmentsForChannel(channel) : {}
    );

    const refresh = useCallback(() => {
        setAssignmentMapState(readAssignmentsForChannel(channel));
    }, [channel]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        function onStorage(e) {
            if (e.key === "apexRadarCustomerAssignments" || e.key === null) refresh();
        }
        function onCustom() {
            refresh();
        }
        window.addEventListener("storage", onStorage);
        window.addEventListener("apex-radar-assignments-changed", onCustom);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("apex-radar-assignments-changed", onCustom);
        };
    }, [refresh]);

    const setAssignmentsForAccount = useCallback(
        (accountKey, userIds) => {
            const key = String(accountKey || "").trim();
            if (!key) return;
            const ids = Array.from(new Set((userIds || []).map((x) => String(x)).filter(Boolean)));
            setAssignmentMapState((prev) => {
                const next = { ...prev };
                if (ids.length === 0) delete next[key];
                else next[key] = ids;
                writeAssignmentsForChannel(channel, next);
                return next;
            });
        },
        [channel]
    );

    return { assignmentMap, setAssignmentsForAccount };
}
