/**
 * Map Shopify Markets region / billing country names to ad-platform geo filters.
 * ShopifyQL uses `billing_country` display names; Meta uses ISO 3166-1 alpha-2; Google accepts names or ISO.
 */

import aliases from "./data/shopifyBillingCountryAliases.json";

/** @type {Map<string, { meta: string, google: string }>} */
const ALIAS_MAP = new Map(
    Object.entries(aliases)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => [
            normalizeBillingKey(k),
            {
                meta: String(v?.meta || "").trim().toUpperCase(),
                google: String(v?.google || v?.meta || "").trim(),
            },
        ])
        .filter(([, v]) => v.meta.length === 2)
);

function normalizeBillingKey(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/**
 * Resolve ISO alpha-2 from English country name via Intl (no extra dependency).
 * @param {string} billingName
 * @returns {string|null}
 */
export function isoCodeFromBillingCountryName(billingName) {
    const raw = String(billingName || "").trim();
    if (!raw) return null;
    const key = normalizeBillingKey(raw);
    const alias = ALIAS_MAP.get(key);
    if (alias?.meta?.length === 2) return alias.meta;

    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();

    try {
        const dn = new Intl.DisplayNames(["en"], { type: "region" });
        for (let i = 65; i <= 90; i++) {
            for (let j = 65; j <= 90; j++) {
                const code = String.fromCharCode(i) + String.fromCharCode(j);
                const label = dn.of(code);
                if (label && normalizeBillingKey(label) === key) {
                    return code;
                }
            }
        }
    } catch {
        /* ignore */
    }
    return null;
}

/**
 * Google Ads geo_target_constant accepts country names; prefer alias google label else billing name.
 * @param {string} billingName
 * @param {string|null} isoCode
 */
export function googleCountryNameFromBilling(billingName, isoCode) {
    const key = normalizeBillingKey(billingName);
    const alias = ALIAS_MAP.get(key);
    if (alias?.google) return alias.google;
    const raw = String(billingName || "").trim();
    if (raw) return raw;
    if (isoCode?.length === 2) {
        try {
            const dn = new Intl.DisplayNames(["en"], { type: "region" });
            return dn.of(isoCode.toUpperCase()) || isoCode;
        } catch {
            return isoCode;
        }
    }
    return "";
}

/**
 * @param {Array<{ name?: string, code?: string|null }>} regionCountries — from Shopify Markets Admin API
 * @returns {{ billingCountryNames: string[], metaCountryCodes: string[], googleCountryNames: string[] }}
 */
export function buildAdSpendCountryFiltersFromRegionCountries(regionCountries) {
    const billingSet = new Set();
    const metaSet = new Set();
    const googleSet = new Set();

    for (const row of regionCountries || []) {
        const name = String(row?.name || "").trim();
        const codeFromApi = String(row?.code || "")
            .trim()
            .toUpperCase();
        if (!name && codeFromApi.length !== 2) continue;

        if (name) billingSet.add(name);

        const iso =
            codeFromApi.length === 2
                ? codeFromApi
                : name
                  ? isoCodeFromBillingCountryName(name)
                  : null;
        if (iso?.length === 2) metaSet.add(iso);

        const googleName = googleCountryNameFromBilling(name || "", iso);
        if (googleName) googleSet.add(googleName);
    }

    const sortNames = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
    return {
        billingCountryNames: [...billingSet].sort(sortNames),
        metaCountryCodes: [...metaSet].sort(),
        googleCountryNames: [...googleSet].sort(sortNames),
    };
}
