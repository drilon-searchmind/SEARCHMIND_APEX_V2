"use client";

import { useEffect, useState } from "react";
import { buildAuraSources, fetchJson } from "./auraApi";
import { elapsedDays, monthDates } from "./auraDailyLogic";

const EMPTY_SHEET = { conversions: [], otherCost: [], goals: [] };

/** Range for the finished days of a month, null when none have finished yet. */
function monthRange(year, month, elapsed) {
    if (elapsed <= 0) return null;
    const dates = monthDates(year, month);
    return { startDate: dates[0], endDate: dates[elapsed - 1] };
}

async function loadMonth(sources, year, month, elapsed, errors) {
    const range = monthRange(year, month, elapsed);
    if (!range) return { google: [], meta: [], sheet: EMPTY_SHEET, ok: true };
    const attempt = async (fn, name) => {
        try {
            return await fn();
        } catch (e) {
            errors.push(`${name} ${year}: ${e.message}`);
            return null;
        }
    };
    const [g, m, s] = await Promise.all([
        sources.google ? attempt(() => fetchJson(sources.google(range)), "Google Ads") : null,
        sources.meta ? attempt(() => fetchJson(sources.meta(range)), "Meta") : null,
        attempt(() => fetchJson(sources.sheet(range)), "Aura inputs"),
    ]);
    return {
        google: g?.metrics_by_date || [],
        meta: m?.metrics_by_date || [],
        sheet: s || EMPTY_SHEET,
        ok: (!sources.google || Boolean(g)) && (!sources.meta || Boolean(m)) && Boolean(s),
    };
}

/**
 * Daily data for one month and the same days a year earlier (Pace report, Overview day).
 * The current month stops at yesterday and last year uses the same number of days, so the comparison is like for like.
 * Results are tagged with the inputs they were loaded for, so a change shows loading again.
 */
export function useAuraMonthData({ customerId, year, month, filter, enabled = true }) {
    const key = JSON.stringify([customerId, year, month, filter]);
    const [state, setState] = useState({ key: null, data: null, error: null });

    useEffect(() => {
        if (!customerId || !enabled) return;
        let cancelled = false;
        (async () => {
            try {
                const settings = (await fetchJson(`/api/customers/${customerId}`)).CustomerSettings || {};
                const sources = buildAuraSources(customerId, settings, filter);
                const elapsed = elapsedDays(year, month, new Date());
                const errors = [];
                const [current, previous] = await Promise.all([
                    loadMonth(sources, year, month, elapsed, errors),
                    loadMonth(sources, year - 1, month, elapsed, errors),
                ]);
                if (cancelled) return;
                setState({
                    key,
                    error: null,
                    data: {
                        elapsed,
                        current,
                        previous,
                        errors,
                        configured: { google: Boolean(sources.google), meta: Boolean(sources.meta) },
                    },
                });
            } catch (e) {
                if (!cancelled) setState({ key, data: null, error: e.message });
            }
        })();
        return () => {
            cancelled = true;
        };
        // `key` already covers every input of this effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);

    const fresh = state.key === key;
    return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !fresh };
}
