/** Default shape for nested `CustomerSettings.snapchat`. */

export const defaultSnapchatSettings = () => ({
    clientId: "",
    organizationId: "",
    adAccountId: "",
    conversionsApiToken: "",
    accessToken: "",
    refreshToken: "",
    clientSecret: "",
});

/**
 * @param {Record<string, unknown> | undefined} settings - CustomerSettings
 * @returns {ReturnType<typeof defaultSnapchatSettings>}
 */
export function normalizeSnapchatSettings(settings) {
    const s = settings || {};
    const raw = typeof s.snapchat === "object" && s.snapchat !== null ? s.snapchat : {};
    const out = {
        ...defaultSnapchatSettings(),
        ...raw,
        clientId: String(raw.clientId ?? "").trim(),
        organizationId: String(raw.organizationId ?? "").trim(),
        adAccountId: String(raw.adAccountId ?? "").trim(),
        conversionsApiToken: String(raw.conversionsApiToken ?? "").trim(),
        accessToken: String(raw.accessToken ?? "").trim(),
        refreshToken: String(raw.refreshToken ?? "").trim(),
        clientSecret: String(raw.clientSecret ?? "").trim(),
    };

    /** @deprecated migrated from snapchatAdAccountId */
    const legacyAd = String(s.snapchatAdAccountId ?? "").trim();
    if (legacyAd && !out.adAccountId) out.adAccountId = legacyAd;
    return out;
}
