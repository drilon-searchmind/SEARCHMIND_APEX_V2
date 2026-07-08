/**
 * List Meta pixels reachable by FACEBOOK_APP_TOKEN (Graph API only — no customer Mongo config).
 */

import { fetchAdAccountPixels, normalizeFacebookPixelId } from "@/lib/apexRadarFacebookPixelStats";

const GRAPH_VERSION = "v21.0";

/**
 * @param {string} accessToken
 * @param {string} pathWithQuery — e.g. `me/adaccounts?fields=id,name&limit=100`
 * @returns {Promise<object[]>}
 */
async function graphGetPaginated(accessToken, pathWithQuery) {
    const sep = pathWithQuery.includes("?") ? "&" : "?";
    let url = `https://graph.facebook.com/${GRAPH_VERSION}/${pathWithQuery}${sep}access_token=${encodeURIComponent(accessToken)}`;
    const all = [];
    while (url) {
        const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`Facebook Graph: bad JSON ${text.slice(0, 200)}`);
        }
        if (data.error) {
            throw new Error(`Facebook Graph: ${JSON.stringify(data.error)}`);
        }
        all.push(...(data.data || []));
        url = data.paging?.next || null;
    }
    return all;
}

/**
 * @param {string} accessToken
 * @returns {Promise<Array<{ id: string, name?: string, account_id?: string, account_status?: number, business?: { id?: string, name?: string } }>>}
 */
export async function fetchTokenAdAccounts(accessToken) {
    return graphGetPaginated(
        accessToken,
        "me/adaccounts?fields=id,name,account_id,account_status,business{id,name}&limit=100"
    );
}

/**
 * @param {string} accessToken
 * @returns {Promise<Array<{ id: string, name?: string }>>}
 */
async function fetchTokenBusinesses(accessToken) {
    return graphGetPaginated(accessToken, "me/businesses?fields=id,name&limit=100");
}

/**
 * @param {string} accessToken
 * @param {string} businessId
 * @param {"owned_pixels"|"client_pixels"} edge
 */
async function fetchBusinessPixels(accessToken, businessId, edge) {
    return graphGetPaginated(
        accessToken,
        `${businessId}/${edge}?fields=id,name,last_fired_time,owner_business{id,name}&limit=100`
    );
}

/**
 * @typedef {{ id: string, account_id?: string, name?: string }} TokenPixelAdAccountRef
 * @typedef {{
 *   id: string,
 *   name: string,
 *   last_fired_time?: string | null,
 *   owner_business?: { id?: string, name?: string } | null,
 *   adAccounts: TokenPixelAdAccountRef[],
 *   sources: string[],
 * }} TokenPixelRecord
 */

/**
 * @param {Map<string, TokenPixelRecord>} map
 * @param {object} pixel
 * @param {{ source: string, adAccount?: TokenPixelAdAccountRef, business?: { id?: string, name?: string } }} ctx
 */
function mergePixelRecord(map, pixel, ctx) {
    const id = normalizeFacebookPixelId(pixel?.id);
    if (!id) return;

    const existing = map.get(id);
    if (existing) {
        if (!existing.sources.includes(ctx.source)) existing.sources.push(ctx.source);
        if (ctx.adAccount && !existing.adAccounts.some((a) => a.id === ctx.adAccount.id)) {
            existing.adAccounts.push(ctx.adAccount);
        }
        if (!existing.last_fired_time && pixel.last_fired_time) {
            existing.last_fired_time = pixel.last_fired_time;
        }
        if (!existing.owner_business && pixel.owner_business) {
            existing.owner_business = pixel.owner_business;
        }
        if (!existing.name && pixel.name) existing.name = pixel.name;
        return;
    }

    map.set(id, {
        id,
        name: pixel.name || id,
        last_fired_time: pixel.last_fired_time || null,
        owner_business: pixel.owner_business || ctx.business || null,
        adAccounts: ctx.adAccount ? [ctx.adAccount] : [],
        sources: [ctx.source],
    });
}

/**
 * All unique pixels the token can list via ad accounts and business manager edges.
 * @param {string} accessToken
 */
export async function fetchAllTokenAccessiblePixels(accessToken) {
    if (!accessToken) {
        throw new Error("Missing Facebook access token");
    }

    /** @type {Array<{ context: string, message: string }>} */
    const errors = [];
    /** @type {Map<string, TokenPixelRecord>} */
    const pixelMap = new Map();

    let adAccounts = [];
    try {
        adAccounts = await fetchTokenAdAccounts(accessToken);
    } catch (e) {
        errors.push({ context: "me/adaccounts", message: e?.message || String(e) });
    }

    for (const acct of adAccounts) {
        const accountId = String(acct.account_id || acct.id || "").replace(/^act_/, "");
        const adAccountRef = {
            id: accountId,
            account_id: accountId,
            name: acct.name || accountId,
        };
        if (!accountId) continue;

        try {
            const pixels = await fetchAdAccountPixels(accessToken, accountId);
            for (const pixel of pixels) {
                mergePixelRecord(pixelMap, pixel, {
                    source: "ad_account",
                    adAccount: adAccountRef,
                    business: acct.business || null,
                });
            }
        } catch (e) {
            errors.push({
                context: `act_${accountId}/adspixels`,
                message: e?.message || String(e),
            });
        }
    }

    let businesses = [];
    try {
        businesses = await fetchTokenBusinesses(accessToken);
    } catch (e) {
        errors.push({ context: "me/businesses", message: e?.message || String(e) });
    }

    for (const business of businesses) {
        const businessId = String(business.id || "");
        if (!businessId) continue;
        const businessRef = { id: businessId, name: business.name || businessId };

        for (const edge of ["owned_pixels", "client_pixels"]) {
            try {
                const pixels = await fetchBusinessPixels(accessToken, businessId, edge);
                for (const pixel of pixels) {
                    mergePixelRecord(pixelMap, pixel, {
                        source: edge,
                        business: businessRef,
                    });
                }
            } catch (e) {
                errors.push({
                    context: `${businessId}/${edge}`,
                    message: e?.message || String(e),
                });
            }
        }
    }

    try {
        const directPixels = await graphGetPaginated(
            accessToken,
            "me/adspixels?fields=id,name,last_fired_time,owner_business{id,name}&limit=100"
        );
        for (const pixel of directPixels) {
            mergePixelRecord(pixelMap, pixel, { source: "me/adspixels" });
        }
    } catch (e) {
        errors.push({ context: "me/adspixels", message: e?.message || String(e) });
    }

    const pixels = [...pixelMap.values()].sort((a, b) => {
        const ta = a.last_fired_time ? Date.parse(a.last_fired_time) : 0;
        const tb = b.last_fired_time ? Date.parse(b.last_fired_time) : 0;
        return tb - ta || a.name.localeCompare(b.name);
    });

    return {
        adAccounts: adAccounts.map((a) => ({
            id: String(a.account_id || a.id || "").replace(/^act_/, ""),
            name: a.name || "",
            account_status: a.account_status ?? null,
            business: a.business || null,
        })),
        pixels,
        errors,
    };
}
