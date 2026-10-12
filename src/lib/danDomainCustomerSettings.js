/** Default shape for nested `CustomerSettings.danDomain` (HostedShop API). */

export const defaultDanDomainSettings = () => ({
    /** Shop tenant host, e.g. shop99999.mywebshop.io (without https://). */
    shopHost: "",
    clientId: "",
    clientSecret: "",
    accessToken: "",
    /**
     * `salgsstatistik` = DanDomain Rapporter → Salg (order created date, exclude status 0+5, ex moms).
     * `orderSent` = turnover when orders were sent (status 3 only, sentAt date).
     * @type {"salgsstatistik" | "orderSent"}
     */
    revenueReporting: "salgsstatistik",
    /**
     * HostedShop order status ids included in revenue when not using salgsstatistik preset.
     * Set to `all` or empty array to include every status (except excludeOrderStatusIds).
     */
    orderStatusIds: ["3"],
    /** Always excluded from omsætning / ordrer (DanDomain: Annulleret + Ikke modtaget). */
    excludeOrderStatusIds: ["0", "5"],
    /**
     * Which order timestamp defines the reporting period (overridden by revenueReporting preset).
     * @type {"sentAt" | "createdAt"}
     */
    revenueDateField: "createdAt",
    /**
     * Order count date field (DanDomain “Ordrer” = order created date).
     * @type {"sentAt" | "createdAt"}
     */
    orderCountDateField: "createdAt",
    /** @deprecated use excludeOrderStatusIds + salgsstatistik; kept for custom overrides */
    orderCountStatusIds: null,
});

/** @param {unknown} value @returns {"salgsstatistik" | "orderSent"} */
export function normalizeDanDomainRevenueReporting(value) {
    return value === "orderSent" ? "orderSent" : "salgsstatistik";
}

/**
 * @param {ReturnType<typeof defaultDanDomainSettings>} dan
 */
export function resolveDanDomainReportingRules(dan) {
    const exclude = normalizeDanDomainExcludeOrderStatusIds(dan.excludeOrderStatusIds);
    if (dan.revenueReporting === "orderSent") {
        return {
            revenueReporting: "orderSent",
            revenueDateField: "sentAt",
            revenueStatusIds: normalizeDanDomainOrderStatusIds(["3"]),
            excludeOrderStatusIds: [],
            orderCountDateField: "createdAt",
            orderCountStatusIds: null,
            orderCountExcludeStatusIds: exclude,
        };
    }
    return {
        revenueReporting: "salgsstatistik",
        revenueDateField: "createdAt",
        revenueStatusIds: null,
        excludeOrderStatusIds: exclude,
        orderCountDateField: "createdAt",
        orderCountStatusIds: null,
        orderCountExcludeStatusIds: exclude,
    };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeDanDomainExcludeOrderStatusIds(value) {
    if (value == null) return ["0", "5"];
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean);
    }
    return String(value)
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/** @param {unknown} value @returns {"sentAt" | "createdAt"} */
export function normalizeDanDomainRevenueDateField(value) {
    return value === "createdAt" ? "createdAt" : "sentAt";
}

/** @param {unknown} value @returns {"sentAt" | "createdAt"} */
export function normalizeDanDomainOrderCountDateField(value) {
    return value === "sentAt" ? "sentAt" : "createdAt";
}

/**
 * @param {unknown} value
 * @returns {string[]|null}
 */
export function normalizeDanDomainOrderCountStatusIds(value) {
    if (value == null) return null;
    return normalizeDanDomainOrderStatusIds(value);
}

/**
 * @param {unknown} value
 * @returns {string[]|null} null = no filter (include all statuses)
 */
export function normalizeDanDomainOrderStatusIds(value) {
    if (value == null) return ["3"];
    if (Array.isArray(value)) {
        const ids = value.map((v) => String(v).trim()).filter(Boolean);
        if (!ids.length || ids.some((id) => id.toLowerCase() === "all")) return null;
        return ids;
    }
    const s = String(value).trim();
    if (!s || s.toLowerCase() === "all") return null;
    return s
        .split(/[,;\s]+/)
        .map((id) => id.trim())
        .filter(Boolean);
}

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
        revenueReporting: normalizeDanDomainRevenueReporting(raw.revenueReporting),
        orderStatusIds: normalizeDanDomainOrderStatusIds(raw.orderStatusIds),
        excludeOrderStatusIds: normalizeDanDomainExcludeOrderStatusIds(raw.excludeOrderStatusIds),
        revenueDateField: normalizeDanDomainRevenueDateField(raw.revenueDateField),
        orderCountDateField: normalizeDanDomainOrderCountDateField(raw.orderCountDateField),
        orderCountStatusIds: normalizeDanDomainOrderCountStatusIds(raw.orderCountStatusIds),
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
