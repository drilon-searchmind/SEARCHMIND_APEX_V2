/** Default shape for nested `CustomerSettings.reddit`. */

export const defaultRedditSettings = () => ({
    /** Reddit “personal use script” / app client id (same as developer app id). */
    appId: "",
    appSecret: "",
    /** Long-lived user token from OAuth, or app token if you use client_credentials only. */
    accessToken: "",
    refreshToken: "",
    /** Reddit Ads account id, often `t2_…` (from Ads Manager or `GET /api/v3/me/ad_accounts`). */
    accountId: "",
    /** Used in `User-Agent` (Reddit requires a descriptive UA). Your Reddit username without `u/`. */
    redditUsername: "",
});

/**
 * @param {Record<string, unknown> | undefined} settings - CustomerSettings
 * @returns {ReturnType<typeof defaultRedditSettings>}
 */
export function normalizeRedditSettings(settings) {
    const s = settings || {};
    const raw = typeof s.reddit === "object" && s.reddit !== null ? s.reddit : {};
    const out = {
        ...defaultRedditSettings(),
        ...raw,
        appId: String(raw.appId ?? "").trim(),
        appSecret: String(raw.appSecret ?? "").trim(),
        accessToken: String(raw.accessToken ?? "").trim(),
        refreshToken: String(raw.refreshToken ?? "").trim(),
        accountId: String(raw.accountId ?? "").trim(),
        redditUsername: String(raw.redditUsername ?? "").trim(),
    };

    /** @deprecated flattened key if ever migrated */
    const legacyId = String(s.redditAdsAccountId ?? "").trim();
    if (legacyId && !out.accountId) out.accountId = legacyId;

    return out;
}
