/**
 * Live FX table from DKK-based rates ([fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api)),
 * merged onto static fallback for currencies missing from the response.
 *
 * API shape: { date, dkk: { eur: 0.13, usd: 0.14, ... } } — each number is how many units of that
 * currency equal 1 DKK. Legacy code uses `DKK.value / from.value` with DKK.value = 1, so this matches.
 */
import fallbackCurrency from "./static-data/currencyApiValues.json";

const PRIMARY_URL =
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/dkk.json";
const FALLBACK_URL = "https://latest.currency-api.pages.dev/v1/currencies/dkk.json";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 12_000;

/** @type {{ data: Record<string, { code: string, value: number }>, meta: object, expires: number } | null} */
let memoryCache = null;

/**
 * @param {Record<string, number>} dkkRates — lowercase keys from API `body.dkk`
 * @returns {Record<string, { code: string, value: number }>}
 */
function buildDataFromDkkRates(dkkRates) {
    /** @type {Record<string, { code: string, value: number }>} */
    const data = {};
    data.DKK = { code: "DKK", value: 1 };
    if (!dkkRates || typeof dkkRates !== "object") return data;

    for (const [key, rate] of Object.entries(dkkRates)) {
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
        const code = String(key).toUpperCase();
        data[code] = { code, value: rate };
    }
    data.DKK = { code: "DKK", value: 1 };
    return data;
}

/**
 * @param {object} body
 * @returns {{ data: Record<string, { code: string, value: number }>, rateDate: string|null }}
 */
function parseDkkApiBody(body) {
    const dkkRates = body?.dkk;
    const rateDate = typeof body?.date === "string" ? body.date : null;
    const data = buildDataFromDkkRates(dkkRates);
    return { data, rateDate };
}

function mergeWithStatic(liveData) {
    const staticData =
        fallbackCurrency?.data && typeof fallbackCurrency.data === "object"
            ? { ...fallbackCurrency.data }
            : {};
    if (!liveData) {
        return {
            data: staticData,
            meta: {
                source: "static_only",
                rateDate: fallbackCurrency?.meta?.last_updated_at ?? null,
            },
        };
    }
    const merged = { ...staticData, ...liveData };
    return {
        data: merged,
        meta: { source: "live", rateDate: null },
    };
}

async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @returns {Promise<{ data: Record<string, { code: string, value: number }>, meta: { source: string, rateDate: string|null } }>}
 */
export async function getCurrencyConversionTable() {
    if (memoryCache && Date.now() < memoryCache.expires) {
        return { data: memoryCache.data, meta: memoryCache.meta };
    }

    let parsed = null;
    try {
        const body = await fetchJsonWithTimeout(PRIMARY_URL);
        const { data: liveData, rateDate } = parseDkkApiBody(body);
        if (Object.keys(liveData).length > 1) {
            const merged = mergeWithStatic(liveData);
            merged.meta.rateDate = rateDate;
            parsed = merged;
        }
    } catch (e) {
        console.warn("[currency] Primary DKK rates failed:", e?.message || e);
    }

    if (!parsed) {
        try {
            const body = await fetchJsonWithTimeout(FALLBACK_URL);
            const { data: liveData, rateDate } = parseDkkApiBody(body);
            if (Object.keys(liveData).length > 1) {
                const merged = mergeWithStatic(liveData);
                merged.meta.rateDate = rateDate;
                merged.meta.source = "live_fallback_cdn";
                parsed = merged;
            }
        } catch (e) {
            console.warn("[currency] Fallback DKK rates failed:", e?.message || e);
        }
    }

    if (!parsed) {
        parsed = mergeWithStatic(null);
        parsed.meta.source = "static_only";
    }

    memoryCache = {
        data: parsed.data,
        meta: parsed.meta,
        expires: Date.now() + CACHE_TTL_MS,
    };

    return { data: memoryCache.data, meta: memoryCache.meta };
}

/**
 * Same formula as existing callers: multiply source-currency amounts by this to get DKK.
 * @param {string} fromCode
 * @param {Record<string, { code: string, value: number }>} currencyData
 */
export function conversionRateToDkk(fromCode, currencyData) {
    const from = String(fromCode || "DKK").toUpperCase();
    const toCode = "DKK";
    if (from === toCode) return 1;
    const rowFrom = currencyData?.[from];
    const rowTo = currencyData?.[toCode];
    if (!rowFrom?.value || !rowTo?.value) return 1;
    return rowTo.value / rowFrom.value;
}
