"use client";

import { useEffect, useState } from "react";

/**
 * Animate a number from 0 to `target`. Restarts when target changes.
 * @param {number | null | undefined} target
 * @param {{ duration?: number, enabled?: boolean }} [options]
 */
export function useCountUp(target, { duration = 400, enabled = true } = {}) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!enabled || target == null || Number.isNaN(Number(target))) {
            setValue(0);
            return;
        }

        const end = Number(target);

        if (
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            setValue(end);
            return;
        }

        let raf;
        const startTime = performance.now();

        const tick = (now) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - (1 - progress) ** 3;
            setValue(end * eased);
            if (progress < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                setValue(end);
            }
        };

        setValue(0);
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration, enabled]);

    return value;
}
