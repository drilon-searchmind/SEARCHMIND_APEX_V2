"use client";

import { useEffect, useState } from "react";

/**
 * Loads internal (non-external) users for Apex Radar and similar UIs.
 * @returns {{
 *   internalUsers: Array<{ id: string, name: string, image?: string|null, clickupId: string }>,
 *   loading: boolean,
 *   error: string|null
 * }}
 */
export function useInternalUsers() {
    const [internalUsers, setInternalUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch("/api/users/internal");
                if (!res.ok) {
                    throw new Error("Failed to fetch internal users");
                }
                const data = await res.json();
                if (cancelled) return;
                setInternalUsers(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!cancelled) {
                    setError(e?.message || "Failed to load team");
                    console.error("useInternalUsers:", e);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return { internalUsers, loading, error };
}
