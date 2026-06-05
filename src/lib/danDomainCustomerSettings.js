/** Default shape for nested `CustomerSettings.danDomain` (HostedShop API). */

export const defaultDanDomainSettings = () => ({
    /** Shop tenant host, e.g. shop99999.mywebshop.io (without https://). */
    shopHost: "",
    clientId: "",
    clientSecret: "",
    accessToken: "",
});

/**
 * @param {Record<string, unknown> | undefined} settings - CustomerSettings
 * @returns {ReturnType<typeof defaultDanDomainSettings>}
 */
export function normalizeDanDomainSettings(settings) {
    const s = settings || {};
    const raw = typeof s.danDomain === "object" && s.danDomain !== null ? s.danDomain : {};
    return {
        ...defaultDanDomainSettings(),
        ...raw,
        shopHost: normalizeDanDomainShopHost(raw.shopHost),
        clientId: String(raw.clientId ?? "").trim(),
        clientSecret: String(raw.clientSecret ?? "").trim(),
        accessToken: String(raw.accessToken ?? "").trim(),
    };
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeDanDomainShopHost(value) {
    let s = String(value ?? "").trim();
    if (!s) return "";
    s = s.replace(/^https?:\/\//i, "");
    s = s.split("/")[0].trim();
    return s.replace(/\/+$/, "");
}
