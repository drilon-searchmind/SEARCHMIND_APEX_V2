/** Default shape for nested `CustomerSettings.danDomainOriginal` (legacy WEBAPI). */

export const defaultDanDomainOriginalSettings = () => ({
    /** Shop admin base URL, e.g. https://ajengros.dk or http://ajengros.dk */
    shopAdminUrl: "",
    /** WEBAPI key from DanDomain admin (OrderService). */
    apiKey: "",
});

/**
 * @param {Record<string, unknown> | undefined} settings - CustomerSettings
 * @returns {ReturnType<typeof defaultDanDomainOriginalSettings>}
 */
export function normalizeDanDomainOriginalSettings(settings) {
    const s = settings || {};
    const raw =
        typeof s.danDomainOriginal === "object" && s.danDomainOriginal !== null
            ? s.danDomainOriginal
            : {};
    return {
        ...defaultDanDomainOriginalSettings(),
        ...raw,
        shopAdminUrl: normalizeDanDomainOriginalShopAdminUrl(raw.shopAdminUrl),
        apiKey: String(raw.apiKey ?? "").trim(),
    };
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeDanDomainOriginalShopAdminUrl(value) {
    let s = String(value ?? "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) {
        s = `https://${s}`;
    }
    s = s.replace(/\/+$/, "");
    return s;
}
