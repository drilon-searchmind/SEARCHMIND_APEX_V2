/**
 * List Meta pixels via FACEBOOK_APP_TOKEN + unique Facebook Ad Account IDs from customer Mongo config.
 */

import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { fetchAdAccountPixels, normalizeFacebookPixelId } from "@/lib/apexRadarFacebookPixelStats";

/**
 * @typedef {{ _id: string, customerName: string }} TokenPixelCustomerRef
 * @typedef {{ id: string, name?: string, customers: TokenPixelCustomerRef[] }} TokenPixelAdAccountRef
 * @typedef {{
 *   id: string,
 *   name: string,
 *   last_fired_time?: string | null,
 *   adAccounts: TokenPixelAdAccountRef[],
 *   customers: TokenPixelCustomerRef[],
 *   sources: string[],
 * }} TokenPixelRecord
 */

/** @param {string} raw */
function normalizeAdAccountId(raw) {
    const s = String(raw || "")
        .trim()
        .replace(/^act_/i, "");
    return /^\d+$/.test(s) ? s : "";
}

/**
 * Unique Facebook ad account IDs from `CustomerSettings.facebookAdAccountId`.
 * @returns {Promise<{ adAccounts: TokenPixelAdAccountRef[], customerCount: number }>}
 */
export async function fetchCustomerFacebookAdAccountsFromMongo() {
    await connectToDatabase();

    const docs = await Customer.find({
        "CustomerSettings.facebookAdAccountId": { $exists: true, $nin: [null, ""] },
        isArchived: { $ne: true },
    })
        .select("_id customerName CustomerSettings.facebookAdAccountId")
        .lean();

    /** @type {Map<string, TokenPixelAdAccountRef>} */
    const byAdAccount = new Map();
    let customerCount = 0;

    for (const doc of docs) {
        const accountId = normalizeAdAccountId(doc.CustomerSettings?.facebookAdAccountId);
        if (!accountId) continue;

        customerCount += 1;
        const customerRef = {
            _id: String(doc._id),
            customerName: doc.customerName || String(doc._id),
        };

        let entry = byAdAccount.get(accountId);
        if (!entry) {
            entry = { id: accountId, name: accountId, customers: [] };
            byAdAccount.set(accountId, entry);
        }
        if (!entry.customers.some((c) => c._id === customerRef._id)) {
            entry.customers.push(customerRef);
        }
    }

    const adAccounts = [...byAdAccount.values()].sort((a, b) =>
        (a.customers[0]?.customerName || a.id).localeCompare(b.customers[0]?.customerName || b.id)
    );

    return { adAccounts, customerCount };
}

/**
 * @param {Map<string, TokenPixelRecord>} map
 * @param {object} pixel
 * @param {{ adAccount: TokenPixelAdAccountRef }} ctx
 */
function mergePixelRecord(map, pixel, ctx) {
    const id = normalizeFacebookPixelId(pixel?.id);
    if (!id) return;

    const existing = map.get(id);
    if (existing) {
        if (!existing.sources.includes("customer_ad_account")) {
            existing.sources.push("customer_ad_account");
        }
        if (!existing.adAccounts.some((a) => a.id === ctx.adAccount.id)) {
            existing.adAccounts.push(ctx.adAccount);
        }
        for (const customer of ctx.adAccount.customers) {
            if (!existing.customers.some((c) => c._id === customer._id)) {
                existing.customers.push(customer);
            }
        }
        if (!existing.last_fired_time && pixel.last_fired_time) {
            existing.last_fired_time = pixel.last_fired_time;
        }
        if (!existing.name && pixel.name) existing.name = pixel.name;
        return;
    }

    map.set(id, {
        id,
        name: pixel.name || id,
        last_fired_time: pixel.last_fired_time || null,
        adAccounts: [ctx.adAccount],
        customers: [...ctx.adAccount.customers],
        sources: ["customer_ad_account"],
    });
}

/**
 * Pixels reachable by token for each unique `facebookAdAccountId` in customer config.
 * @param {string} accessToken
 */
export async function fetchAllTokenAccessiblePixels(accessToken) {
    if (!accessToken) {
        throw new Error("Missing Facebook access token");
    }

    const { adAccounts, customerCount } = await fetchCustomerFacebookAdAccountsFromMongo();

    /** @type {Array<{ context: string, message: string }>} */
    const errors = [];
    /** @type {Map<string, TokenPixelRecord>} */
    const pixelMap = new Map();

    for (const adAccount of adAccounts) {
        try {
            const pixels = await fetchAdAccountPixels(accessToken, adAccount.id);
            for (const pixel of pixels) {
                mergePixelRecord(pixelMap, pixel, { adAccount });
            }
        } catch (e) {
            errors.push({
                context: `act_${adAccount.id}/adspixels`,
                message: e?.message || String(e),
            });
        }
    }

    const pixels = [...pixelMap.values()].sort((a, b) => {
        const ta = a.last_fired_time ? Date.parse(a.last_fired_time) : 0;
        const tb = b.last_fired_time ? Date.parse(b.last_fired_time) : 0;
        return tb - ta || a.name.localeCompare(b.name);
    });

    return {
        adAccounts,
        customerCount,
        pixels,
        errors,
        source: "customer_facebook_ad_account_ids",
    };
}
