import { getMerchantAccessToken, hasMerchantCredentials, merchantSlotsToTry, normalizeMerchantAccountSlot } from "./merchantCenterAuth";
import { isMerchantAccessDeniedError } from "./merchantCenterAccounts";

const REPORTS_BASE = "https://merchantapi.googleapis.com/reports/v1";
const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGES = 25;

/**
 * @param {unknown} price
 * @returns {{ amount: number, currencyCode: string } | null}
 */
export function parseMerchantPrice(price) {
    if (!price || typeof price !== "object") return null;
    const micros = Number(
        /** @type {{ amountMicros?: string | number }} */ (price).amountMicros
    );
    if (!Number.isFinite(micros)) return null;
    return {
        amount: micros / 1_000_000,
        currencyCode: String(
            /** @type {{ currencyCode?: string }} */ (price).currencyCode || ""
        ),
    };
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} viewKey
 * @returns {Record<string, unknown> | null}
 */
function extractReportView(row, viewKey) {
    if (!row || typeof row !== "object") return null;
    const direct = row[viewKey];
    if (direct && typeof direct === "object") return /** @type {Record<string, unknown>} */ (direct);

    const camel =
        viewKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase());
    const camelAlt = camel.charAt(0).toLowerCase() + camel.slice(1);
    for (const key of [camelAlt, camel]) {
        const val = row[key];
        if (val && typeof val === "object") return /** @type {Record<string, unknown>} */ (val);
    }
    return null;
}

/**
 * @param {1 | 2} slot
 * @param {string} merchantAccountId
 * @param {string} query
 * @param {{ pageSize?: number, maxPages?: number }} [opts]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function searchMerchantReports(slot, merchantAccountId, query, opts = {}) {
    const accountId = String(merchantAccountId || "").trim();
    if (!accountId) {
        throw new Error("Merchant Center account ID is required");
    }

    const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
    const maxPages = opts.maxPages ?? MAX_PAGES;
    const token = await getMerchantAccessToken(normalizeMerchantAccountSlot(slot));
    const url = `${REPORTS_BASE}/accounts/${encodeURIComponent(accountId)}/reports:search`;

    /** @type {Record<string, unknown>[]} */
    const allRows = [];
    let pageToken = "";

    for (let page = 0; page < maxPages; page += 1) {
        /** @type {{ query: string, pageSize: number, pageToken?: string }} */
        const body = { query, pageSize };
        if (pageToken) body.pageToken = pageToken;

        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg =
                data?.error?.message ||
                data?.error?.status ||
                (Array.isArray(data?.error?.details)
                    ? data.error.details.map((d) => d?.message).filter(Boolean).join("; ")
                    : "") ||
                res.statusText;
            throw new Error(`Merchant Center reports search failed: ${msg}`);
        }

        const results = Array.isArray(data.results) ? data.results : [];
        allRows.push(...results);

        pageToken = String(data.nextPageToken || "");
        if (!pageToken) break;
    }

    return allRows;
}

/**
 * Try the preferred OAuth slot first; on access denied, retry the other slots.
 * @param {import("./merchantCenterAuth").MerchantOAuthSlot} preferredSlot
 * @param {string} merchantAccountId
 * @param {string} query
 * @param {{ pageSize?: number, maxPages?: number }} [opts]
 * @returns {Promise<{ slot: import("./merchantCenterAuth").MerchantOAuthSlot, rows: Record<string, unknown>[] }>}
 */
export async function searchMerchantReportsWithSlotFallback(
    preferredSlot,
    merchantAccountId,
    query,
    opts = {}
) {
    /** @type {Error | null} */
    let lastAccessError = null;

    for (const slot of merchantSlotsToTry(preferredSlot)) {
        if (!hasMerchantCredentials(slot)) continue;
        try {
            const rows = await searchMerchantReports(slot, merchantAccountId, query, opts);
            return { slot, rows };
        } catch (err) {
            if (isMerchantAccessDeniedError(err)) {
                lastAccessError = err instanceof Error ? err : new Error(String(err));
                continue;
            }
            throw err;
        }
    }

    throw (
        lastAccessError ||
        new Error(`Merchant Center reports search failed: no OAuth credentials configured`)
    );
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string} viewKey
 * @returns {Record<string, unknown>[]}
 */
export function mapReportRows(rows, viewKey) {
    return rows
        .map((row) => extractReportView(row, viewKey))
        .filter((row) => row != null);
}
