/**
 * Ahrefs API v3 client (server-only). Uses AHREFS_API_KEY from environment.
 * @see https://docs.ahrefs.com/docs/api/reference/introduction
 */

import { buildAhrefsSelectAttemptsFromError } from "@/lib/audit/ahrefsSelectRepair";

const API_BASE = "https://api.ahrefs.com/v3";

export function isAhrefsConfigured() {
    return Boolean(process.env.AHREFS_API_KEY?.trim());
}

/**
 * Normalize Google Search Console property to an Ahrefs `target` (root domain).
 * @param {string} property — e.g. sc-domain:example.com or https://www.example.com/
 * @returns {string|null}
 */
export function ahrefsTargetFromGscProperty(property) {
    const raw = String(property || "").trim();
    if (!raw) return null;
    if (raw.startsWith("sc-domain:")) {
        const host = raw.slice("sc-domain:".length).trim().replace(/^www\./i, "");
        return host || null;
    }
    try {
        const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
        const host = url.hostname.replace(/^www\./i, "");
        return host || null;
    } catch {
        const cleaned = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
        return cleaned || null;
    }
}

/**
 * ISO country for Site Explorer (organic keywords, etc.). Override with AHREFS_DEFAULT_COUNTRY.
 * @param {string} target — domain, e.g. example.dk
 */
export function ahrefsCountryFromTarget(target) {
    const fromEnv = process.env.AHREFS_DEFAULT_COUNTRY?.trim();
    if (fromEnv && /^[a-z]{2}$/i.test(fromEnv)) return fromEnv.toLowerCase();
    const host = String(target || "").toLowerCase().split("/")[0];
    if (host.endsWith(".dk")) return "dk";
    if (host.endsWith(".se")) return "se";
    if (host.endsWith(".no")) return "no";
    if (host.endsWith(".de")) return "de";
    if (host.endsWith(".co.uk") || host.endsWith(".uk")) return "gb";
    if (host.endsWith(".com")) return "us";
    return "dk";
}

/** Ahrefs reports use YYYY-MM-DD; prefer audit end date, never future. */
export function ahrefsReportDate(endDateYmd) {
    const end = String(endDateYmd || "").slice(0, 10);
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const ymd = yesterday.toISOString().slice(0, 10);
    if (!end || end > ymd) return ymd;
    return end;
}

/**
 * @param {string} path — e.g. /site-explorer/organic-keywords
 * @param {Record<string, string|number|undefined>} params
 */
export async function ahrefsGet(path, params = {}) {
    const apiKey = process.env.AHREFS_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("AHREFS_API_KEY is not configured");
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${API_BASE}${normalizedPath}`);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
    }

    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        const msg =
            data?.error?.message ||
            data?.error ||
            data?.message ||
            res.statusText ||
            "Ahrefs API error";
        throw new Error(`Ahrefs ${res.status}: ${msg}`);
    }

    return data;
}

/**
 * @param {string} path
 * @param {Record<string, string|number|undefined>} baseParams
 * @param {Array<{ select: string, order_by?: string, date_compared?: string, [key: string]: unknown }>} selectAttempts
 */
export async function ahrefsGetWithSelectAttempts(path, baseParams, selectAttempts) {
    let lastErr;
    const tried = new Set();

    const runAttempt = async (attempt) => {
        const key = JSON.stringify(attempt);
        if (tried.has(key)) return null;
        tried.add(key);
        /** @type {Record<string, string|number>} */
        const params = { ...baseParams, select: attempt.select };
        if (attempt.order_by) params.order_by = attempt.order_by;
        if (attempt.date_compared) params.date_compared = attempt.date_compared;
        return ahrefsGet(path, params);
    };

    for (const attempt of selectAttempts) {
        try {
            const result = await runAttempt(attempt);
            if (result) return result;
        } catch (e) {
            lastErr = e;
            const fallbacks = buildAhrefsSelectAttemptsFromError(
                attempt.select,
                attempt.order_by,
                e?.message || String(e)
            );
            for (const fb of fallbacks) {
                try {
                    const merged = { ...attempt, ...fb };
                    const result = await runAttempt(merged);
                    if (result) return result;
                } catch (e2) {
                    lastErr = e2;
                }
            }
        }
    }

    throw lastErr;
}

/**
 * Compact rows from Ahrefs list endpoints for audit prompts (token control).
 * @param {unknown} payload
 * @param {number} [maxRows]
 */
export function trimAhrefsRows(payload, maxRows = 100) {
    if (!payload || typeof payload !== "object") return payload;
    const p = /** @type {Record<string, unknown>} */ (payload);
    if (Array.isArray(p.keywords)) {
        return { ...p, keywords: p.keywords.slice(0, maxRows) };
    }
    if (Array.isArray(p.pages)) {
        return { ...p, pages: p.pages.slice(0, maxRows) };
    }
    if (Array.isArray(p.backlinks)) {
        return { ...p, backlinks: p.backlinks.slice(0, maxRows) };
    }
    if (Array.isArray(p.referring_domains)) {
        return { ...p, referring_domains: p.referring_domains.slice(0, maxRows) };
    }
    return payload;
}
