import {
    getMerchantAccessToken,
    hasMerchantCredentials,
    merchantSlotLabel,
    merchantSlotsToTry,
    normalizeMerchantAccountSlot,
} from "./merchantCenterAuth";

const ACCOUNTS_BASE = "https://merchantapi.googleapis.com/accounts/v1/accounts";

/**
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function normalizeMerchantAccountId(value) {
    const s = String(value ?? "").trim();
    const match = s.match(/(?:accounts\/)?(\d+)/);
    return match ? match[1] : s.replace(/\D/g, "");
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMerchantAccessDeniedError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    return (
        msg.includes("does not have access to the accounts") ||
        msg.includes("permission_denied") ||
        msg.includes("caller does not have access")
    );
}

/**
 * @param {Record<string, unknown>} account
 * @returns {{ id: string, name: string, accountName: string }}
 */
function normalizeAccountResource(account) {
    const resourceName = String(account.name || "");
    const idFromName = resourceName.match(/accounts\/(\d+)/)?.[1] || "";
    const id = String(account.accountId ?? account.account_id ?? idFromName ?? "").trim();
    const accountName = String(
        account.accountName ?? account.account_name ?? account.displayName ?? ""
    ).trim();
    return {
        id,
        name: resourceName || (id ? `accounts/${id}` : ""),
        accountName: accountName || id,
    };
}

/**
 * @param {import("./merchantCenterAuth").MerchantOAuthSlot} slot
 * @param {{ filter?: string, maxPages?: number }} [opts]
 * @returns {Promise<Array<{ id: string, name: string, accountName: string }>>}
 */
export async function listMerchantAccounts(slot, opts = {}) {
    if (!hasMerchantCredentials(slot)) {
        return [];
    }

    const token = await getMerchantAccessToken(slot);
    const maxPages = opts.maxPages ?? 5;
    const pageSize = 500;

    /** @type {Array<{ id: string, name: string, accountName: string }>} */
    const accounts = [];
    let pageToken = "";

    for (let page = 0; page < maxPages; page += 1) {
        const url = new URL(ACCOUNTS_BASE);
        url.searchParams.set("pageSize", String(pageSize));
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        if (opts.filter) url.searchParams.set("filter", opts.filter);

        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data?.error?.message || res.statusText;
            throw new Error(`Merchant Center accounts.list failed: ${msg}`);
        }

        const batch = Array.isArray(data.accounts) ? data.accounts : [];
        for (const account of batch) {
            const normalized = normalizeAccountResource(account);
            if (normalized.id) accounts.push(normalized);
        }

        pageToken = String(data.nextPageToken || "");
        if (!pageToken) break;
    }

    return accounts;
}

/**
 * @param {string} merchantAccountId
 * @param {import("./merchantCenterAuth").MerchantOAuthSlot} preferredSlot
 * @returns {Promise<{ slot: import("./merchantCenterAuth").MerchantOAuthSlot, account: { id: string, name: string, accountName: string } } | null>}
 */
export async function resolveMerchantAccountAccess(merchantAccountId, preferredSlot = 1) {
    const targetId = normalizeMerchantAccountId(merchantAccountId);
    if (!targetId) return null;

    for (const slot of merchantSlotsToTry(preferredSlot)) {
        if (!hasMerchantCredentials(slot)) continue;
        try {
            const accounts = await listMerchantAccounts(slot, {
                filter: `account_id = ${targetId}`,
                maxPages: 1,
            });
            const match = accounts.find((a) => a.id === targetId);
            if (match) {
                return { slot, account: match };
            }
        } catch {
            // Fall through and try full list / other slot.
        }

        try {
            const accounts = await listMerchantAccounts(slot);
            const match = accounts.find((a) => a.id === targetId);
            if (match) {
                return { slot, account: match };
            }
        } catch {
            // Try next slot.
        }
    }

    return null;
}

/**
 * @param {string} merchantAccountId
 * @returns {Promise<{ slot0: Array<{ id: string, accountName: string, matchesTarget?: boolean }>, slot1: Array<{ id: string, accountName: string, matchesTarget?: boolean }>, slot2: Array<{ id: string, accountName: string, matchesTarget?: boolean }> }>}
 */
export async function listAccessibleAccountsBySlot(merchantAccountId) {
    const targetId = normalizeMerchantAccountId(merchantAccountId);

    const [slot0, slot1, slot2] = await Promise.all([
        hasMerchantCredentials(0)
            ? listMerchantAccounts(0).catch(() => [])
            : Promise.resolve([]),
        hasMerchantCredentials(1)
            ? listMerchantAccounts(1).catch(() => [])
            : Promise.resolve([]),
        hasMerchantCredentials(2)
            ? listMerchantAccounts(2).catch(() => [])
            : Promise.resolve([]),
    ]);

    const mapBrief = (accounts) =>
        accounts.slice(0, 25).map((a) => ({
            id: a.id,
            accountName: a.accountName,
            matchesTarget: targetId ? a.id === targetId : false,
        }));

    return {
        slot0: mapBrief(slot0),
        slot1: mapBrief(slot1),
        slot2: mapBrief(slot2),
    };
}

export class MerchantAccessError extends Error {
    /**
     * @param {string} merchantAccountId
     * @param {import("./merchantCenterAuth").MerchantOAuthSlot} configuredSlot
     * @param {{ slot0: Array<{ id: string, accountName: string, matchesTarget?: boolean }>, slot1: Array<{ id: string, accountName: string, matchesTarget?: boolean }>, slot2: Array<{ id: string, accountName: string, matchesTarget?: boolean }> }} accessibleAccounts
     */
    constructor(merchantAccountId, configuredSlot, accessibleAccounts) {
        const targetId = normalizeMerchantAccountId(merchantAccountId);
        const slot0Match = accessibleAccounts.slot0.some((a) => a.matchesTarget);
        const slot1Match = accessibleAccounts.slot1.some((a) => a.matchesTarget);
        const slot2Match = accessibleAccounts.slot2.some((a) => a.matchesTarget);

        const matchingSlot = slot0Match ? 0 : slot1Match ? 1 : slot2Match ? 2 : null;

        let adminHint =
            "Check that the Merchant Center ID is correct and that the OAuth account slot matches the credentials that have access to this account.";
        if (matchingSlot != null && matchingSlot !== configuredSlot) {
            adminHint = `Account ${targetId} is accessible via ${merchantSlotLabel(matchingSlot)}. Update Config → Merchant Center → OAuth account slot to "${merchantSlotLabel(matchingSlot)}".`;
        } else if (!slot0Match && !slot1Match && !slot2Match) {
            adminHint = `Account ${targetId} was not found in any OAuth slot (0, 1, or 2). Verify the Merchant Center ID in Merchant Center (Settings → Account ID) and ensure the refresh token was authorized for a user with access to this account. Slot 0 uses Google Ads credentials (GOOGLE_ADS_*).`;
        }

        let userMessage;
        if (matchingSlot != null && matchingSlot !== configuredSlot) {
            userMessage =
                "Price Index cannot access this Merchant Center account because the OAuth account slot in Config does not match the credentials that have access. Please ask an administrator to update Config → Merchant Center.";
        } else if (!slot0Match && !slot1Match && !slot2Match) {
            userMessage = `Price Index cannot access Merchant Center account ${targetId}. The account ID may be incorrect, or the Merchant Center connection may not be authorized for this customer. Please ask an administrator to review the setup in Config.`;
        } else {
            userMessage = `Price Index cannot access Merchant Center account ${targetId} with the current configuration. Please ask an administrator to verify the Merchant Center account ID and connection settings in Config.`;
        }

        super(
            `Merchant Center account ${targetId} is not accessible with OAuth slot ${configuredSlot}. ${adminHint}`
        );
        this.name = "MerchantAccessError";
        this.code = "NO_MERCHANT_ACCESS";
        this.merchantAccountId = targetId;
        this.configuredSlot = configuredSlot;
        this.accessibleAccounts = accessibleAccounts;
        this.adminMessage = this.message;
        this.userMessage = userMessage;
        this.statusCode = 403;
    }
}

/**
 * @param {string} merchantAccountId
 * @param {import("./merchantCenterAuth").MerchantOAuthSlot} preferredSlot
 * @returns {Promise<{ slot: import("./merchantCenterAuth").MerchantOAuthSlot, resolvedFromPreferred: boolean }>}
 */
export async function resolveMerchantAccountSlot(merchantAccountId, preferredSlot = 1) {
    const preferred = normalizeMerchantAccountSlot(preferredSlot);
    const resolved = await resolveMerchantAccountAccess(merchantAccountId, preferred);
    if (resolved) {
        return {
            slot: resolved.slot,
            resolvedFromPreferred: resolved.slot === preferred,
        };
    }

    const accessibleAccounts = await listAccessibleAccountsBySlot(merchantAccountId);
    throw new MerchantAccessError(merchantAccountId, preferred, accessibleAccounts);
}
