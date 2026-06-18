import { defaultSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { defaultRedditSettings } from "@/lib/redditCustomerSettings";
import { defaultDanDomainSettings } from "@/lib/danDomainCustomerSettings";

/** Single source of truth for the create-customer form shape (admin + copy flow). */
export function getDefaultCustomerCreateFormState() {
    return {
        customerName: "",
        businessCategory: "ecommerce",
        customerType: "Shopify",
        isArchived: false,
        CustomerSettings: {
            metricPreference: "ROAS/POAS",
            customerStoreValutaCode: "DKK",
            customerClickupID: "",
            customerMetaID: "DK",
            customerMetaIDExclude: "",
            changeCurrency: true,
            changeCurrencyShopifyBillingCountryName: "",
            changeCurrencyShopifyBillingCountryExclude: "",
            shopifyMarketsEnabled: false,
            propertyObjectivesMode: "global",
            shopifyOnlineStoreOnly: false,
            customerRevenueType: "total_sales",
            revenueDisplayVat: "excl",
            shopifyUrl: "",
            shopifyApiPassword: "",
            wooCommerceApiKey: "",
            wooCommerceApiSecret: "",
            wooCommerceApiUrl: "",
            magentoBaseUrl: "",
            magentoAccessToken: "",
            magentoConsumerKey: "",
            magentoConsumerSecret: "",
            magentoAccessTokenSecret: "",
            danDomain: defaultDanDomainSettings(),
            facebookAdAccountId: "",
            googleAdsCustomerId: "",
            pinterestAdAccountId: "",
            snapchat: defaultSnapchatSettings(),
            reddit: defaultRedditSettings(),
            googleSearchConsoleProperty: "",
            bingWebmasterSiteUrl: "",
            ga4PropertyId: "",
        },
    };
}

/** @type {ReadonlySet<string>} */
let _customerSettingsKeysSet;

export function customerCreateFormCustomerSettingsKeys() {
    if (!_customerSettingsKeysSet) {
        _customerSettingsKeysSet = new Set(
            Object.keys(getDefaultCustomerCreateFormState().CustomerSettings)
        );
    }
    return _customerSettingsKeysSet;
}

function str(v) {
    if (v == null) return "";
    return String(v);
}

const CUSTOMER_TYPES = new Set(["Shopify", "WooCommerce", "Magento", "DanDomain", "Other"]);
const BUSINESS_CATEGORIES = new Set(["ecommerce", "b2b"]);

/**
 * Maps an API/database customer into the create-form state, copying only fields
 * exposed on CustomerCreateForm (not config-only integrations like googleAdsCountryFilter).
 * @param {Record<string, unknown> | null | undefined} customer
 */
export function buildCustomerCreateFormStateFromCustomer(customer) {
    const base = getDefaultCustomerCreateFormState();
    if (!customer) return base;

    const csRaw = customer.CustomerSettings;
    const cs = typeof csRaw === "object" && csRaw !== null ? csRaw : {};
    const snap = typeof cs.snapchat === "object" && cs.snapchat !== null ? cs.snapchat : {};
    const red = typeof cs.reddit === "object" && cs.reddit !== null ? cs.reddit : {};
    const dan = typeof cs.danDomain === "object" && cs.danDomain !== null ? cs.danDomain : {};

    const origName = str(customer.customerName).trim();

    const snapMerged = { ...defaultSnapchatSettings() };
    for (const k of Object.keys(snapMerged)) {
        snapMerged[k] = str(snap[k]);
    }

    const redditMerged = { ...defaultRedditSettings() };
    for (const k of Object.keys(redditMerged)) {
        redditMerged[k] = str(red[k]);
    }

    const danDomainMerged = { ...defaultDanDomainSettings() };
    for (const k of Object.keys(danDomainMerged)) {
        danDomainMerged[k] = str(dan[k]);
    }

    return {
        ...base,
        customerName: origName ? `${origName} (copy)` : "",
        businessCategory: BUSINESS_CATEGORIES.has(customer.businessCategory)
            ? customer.businessCategory
            : base.businessCategory,
        customerType: CUSTOMER_TYPES.has(customer.customerType) ? customer.customerType : base.customerType,
        isArchived: Boolean(customer.isArchived),
        CustomerSettings: {
            ...base.CustomerSettings,
            shopifyUrl: str(cs.shopifyUrl),
            shopifyApiPassword: str(cs.shopifyApiPassword),
            wooCommerceApiKey: str(cs.wooCommerceApiKey),
            wooCommerceApiSecret: str(cs.wooCommerceApiSecret),
            wooCommerceApiUrl: str(cs.wooCommerceApiUrl),
            magentoBaseUrl: str(cs.magentoBaseUrl),
            magentoConsumerKey: str(cs.magentoConsumerKey),
            magentoConsumerSecret: str(cs.magentoConsumerSecret),
            magentoAccessToken: str(cs.magentoAccessToken),
            magentoAccessTokenSecret: str(cs.magentoAccessTokenSecret),
            customerStoreValutaCode:
                str(cs.customerStoreValutaCode) || base.CustomerSettings.customerStoreValutaCode,
            customerMetaID: str(cs.customerMetaID),
            facebookAdAccountId: str(cs.facebookAdAccountId),
            googleAdsCustomerId: str(cs.googleAdsCustomerId),
            pinterestAdAccountId: str(cs.pinterestAdAccountId),
            snapchat: snapMerged,
            reddit: redditMerged,
            danDomain: danDomainMerged,
            customerClickupID: str(cs.customerClickupID),
            customerMetaIDExclude: str(cs.customerMetaIDExclude),
            changeCurrency: cs.changeCurrency !== false,
            changeCurrencyShopifyBillingCountryName: str(cs.changeCurrencyShopifyBillingCountryName),
            changeCurrencyShopifyBillingCountryExclude: str(cs.changeCurrencyShopifyBillingCountryExclude),
            shopifyMarketsEnabled: cs.shopifyMarketsEnabled === true,
            shopifyOnlineStoreOnly: cs.shopifyOnlineStoreOnly === true,
            ga4PropertyId: str(cs.ga4PropertyId),
        },
    };
}
