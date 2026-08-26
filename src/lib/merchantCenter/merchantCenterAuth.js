/** @typedef {{ clientId: string, clientSecret: string, refreshToken: string }} MerchantCredentials */

/** @typedef {0 | 1 | 2} MerchantOAuthSlot */

const tokenCache = new Map();

export const MERCHANT_OAUTH_SLOTS = /** @type {const} */ ([0, 1, 2]);

/**
 * @param {unknown} value
 * @returns {MerchantOAuthSlot}
 */
export function normalizeMerchantAccountSlot(value) {
    const n = Number(value);
    if (n === 0) return 0;
    if (n === 2) return 2;
    return 1;
}

/**
 * Preferred slot first, then the remaining slots.
 * @param {unknown} preferred
 * @returns {MerchantOAuthSlot[]}
 */
export function merchantSlotsToTry(preferred) {
    const p = normalizeMerchantAccountSlot(preferred);
    return [p, ...MERCHANT_OAUTH_SLOTS.filter((slot) => slot !== p)];
}

/**
 * @param {MerchantOAuthSlot} slot
 * @returns {MerchantCredentials}
 */
export function getMerchantCredentials(slot) {
    const normalized = normalizeMerchantAccountSlot(slot);
    if (normalized === 0) {
        return {
            clientId: String(process.env.GOOGLE_ADS_CLIENT_ID || "").trim(),
            clientSecret: String(process.env.GOOGLE_ADS_CLIENT_SECRET || "").trim(),
            refreshToken: String(process.env.GOOGLE_ADS_REFRESH_TOKEN || "").trim(),
        };
    }

    return {
        clientId: String(process.env[`GOOGLE_MERCHANT_CLIENT_ID_${normalized}`] || "").trim(),
        clientSecret: String(
            process.env[`GOOGLE_MERCHANT_CLIENT_SECRET_${normalized}`] || ""
        ).trim(),
        refreshToken: String(
            process.env[`GOOGLE_MERCHANT_REFRESH_TOKEN_${normalized}`] || ""
        ).trim(),
    };
}

/**
 * @param {unknown} slot
 * @returns {boolean}
 */
export function hasMerchantCredentials(slot) {
    const creds = getMerchantCredentials(normalizeMerchantAccountSlot(slot));
    return Boolean(creds.clientId && creds.clientSecret && creds.refreshToken);
}

/**
 * @param {unknown} slot
 * @returns {string}
 */
export function merchantSlotLabel(slot) {
    const normalized = normalizeMerchantAccountSlot(slot);
    if (normalized === 0) return "Account 0 (Google Ads credentials)";
    if (normalized === 2) return "Account 2 (GOOGLE_MERCHANT_*_2)";
    return "Account 1 (GOOGLE_MERCHANT_*_1)";
}

/**
 * @param {unknown} slot
 * @returns {Promise<string>}
 */
export async function getMerchantAccessToken(slot) {
    const cacheKey = normalizeMerchantAccountSlot(slot);
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
        return cached.token;
    }

    const creds = getMerchantCredentials(cacheKey);
    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        throw new Error(
            `Merchant Center OAuth credentials are not configured for account slot ${cacheKey}`
        );
    }

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error_description || data?.error || res.statusText;
        throw new Error(`Merchant Center token refresh failed: ${msg}`);
    }

    const token = String(data.access_token || "");
    if (!token) {
        throw new Error("Merchant Center token refresh returned no access token");
    }

    const expiresIn = Number(data.expires_in) || 3600;
    tokenCache.set(cacheKey, {
        token,
        expiresAt: Date.now() + expiresIn * 1000,
    });

    return token;
}
