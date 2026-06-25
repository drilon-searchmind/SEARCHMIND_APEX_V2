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
    s = s.replace(/\/+$/, "");

    // Admin panel URL, e.g. shop83576.webshop.dandomain.dk → shop83576.mywebshop.io
    const dandomainAdmin = /^shop(\d+)\.webshop\.dandomain\.dk$/i.exec(s);
    if (dandomainAdmin) {
        return `shop${dandomainAdmin[1]}.mywebshop.io`;
    }

    // Common typo: shop83576.myshop.io → shop83576.mywebshop.io
    const myshopTypo = /^shop(\d+)\.myshop\.io$/i.exec(s);
    if (myshopTypo) {
        return `shop${myshopTypo[1]}.mywebshop.io`;
    }

    return s;
}
