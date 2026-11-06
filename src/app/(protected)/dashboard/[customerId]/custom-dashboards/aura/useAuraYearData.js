"use client";

import { useEffect, useState } from "react";
import { buildAuraSources, fetchJson, isoDate } from "./auraApi";

/** Date range for a calendar year. The current year ends yesterday, like the sheet. Null when empty. */
function yearRange(year, today) {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const end = year === today.getFullYear() ? yesterday : new Date(year, 11, 31);
    const start = new Date(year, 0, 1);
    return end < start ? null : { startDate: isoDate(start), endDate: isoDate(end) };
}

async function settle(fn, label, year, errors) {
    try {
        return await fn();
    } catch (e) {
        errors.push(`${label} ${year}: ${e.message}`);
        return null;
    }
}

/** Fast: daily conversions and other cost from the Aura sheet. */
async function loadSheet(sources, year, today) {
    const range = yearRange(year, today);
    const errors = [];
    const sheet = range ? await settle(() => fetchJson(sources.sheet(range)), "Aura sheet", year, errors) : null;
    return { sheet: sheet || { conversions: [], otherCost: [] }, sheetOk: !range || Boolean(sheet), errors };
}

/** Slow (a year of daily Google Ads and Meta rows). Spend is only trusted when every configured source loaded. */
async function loadSpend(sources, year, today) {
    const range = yearRange(year, today);
    const errors = [];
    if (!range) return { google: [], meta: [], spendOk: true, errors };
    const [g, m] = await Promise.all([
        sources.google ? settle(() => fetchJson(sources.google(range)), "Google Ads", year, errors) : null,
        sources.meta ? settle(() => fetchJson(sources.meta(range)), "Meta", year, errors) : null,
    ]);
    return {
        google: g?.metrics_by_date || [],
        meta: m?.metrics_by_date || [],
        spendOk: (!sources.google || Boolean(g)) && (!sources.meta || Boolean(m)),
        errors,
    };
}

/**
 * A year of data for the monthly charts: this year and last year, split into the fast sheet part (conversions,
 * other cost) and the slow ad spend part. Both charts share one fetch. Results are tagged with the inputs
 * they were loaded for, so a changed filter shows loading again without setting state inside the effect.
 */
export function useAuraYearData({ customerId, settings, filter }) {
    const key = JSON.stringify([
        customerId,
        settings?.googleAdsCustomerId,
        settings?.googleAdsCountryFilter,
        settings?.googleAdsCountryExclude,
        settings?.facebookAdAccountId,
        settings?.customerMetaID,
        settings?.customerMetaIDExclude,
        filter,
    ]);
    const [sheetState, setSheetState] = useState({ key: null, data: null });
    const [spendState, setSpendState] = useState({ key: null, data: null });

    useEffect(() => {
        if (!customerId || !settings) return;
        let cancelled = false;
        const sources = buildAuraSources(customerId, settings, filter);
        const today = new Date();
        const years = [today.getFullYear(), today.getFullYear() - 1];
        Promise.all(years.map((y) => loadSheet(sources, y, today))).then(([current, previous]) => {
            if (!cancelled) setSheetState({ key, data: { current, previous } });
        });
        Promise.all(years.map((y) => loadSpend(sources, y, today))).then(([current, previous]) => {
            if (!cancelled) setSpendState({ key, data: { current, previous } });
        });
        return () => {
            cancelled = true;
        };
        // `key` already covers customerId, the integration ids and the filter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const sheets = sheetState.key === key ? sheetState.data : null;
    const spend = spendState.key === key ? spendState.data : null;
    const errors = [
        ...(sheets ? [...sheets.current.errors, ...sheets.previous.errors] : []),
        ...(spend ? [...spend.current.errors, ...spend.previous.errors] : []),
    ];
    return { sheets, spend, errors };
}
