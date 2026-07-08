"use client";

import { useEffect, useState } from "react";
import { isLocalhostHostname } from "@/lib/apexRadarDevToolsAccess";

export function useApexRadarDevToolsAccess() {
    const [allowed, setAllowed] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (!isLocalhostHostname(window.location.hostname)) {
            setAllowed(false);
            setChecked(true);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/apex-radar/dev-tools/access");
                const data = await res.json().catch(() => ({}));
                if (!cancelled) {
                    setAllowed(Boolean(data.allowed));
                }
            } catch {
                if (!cancelled) setAllowed(false);
            } finally {
                if (!cancelled) setChecked(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return { allowed, checked };
}
