/**
 * Admin Customers table — default columns + optional value/check columns from Customer model.
 * Secret fields are never listed here (API keys, tokens, passwords).
 */

/** @typedef {'builtin' | 'check' | 'value'} AdminColumnKind */

/**
 * @typedef {object} AdminColumnDef
 * @property {string} id
 * @property {string} label
 * @property {string} [group]
 * @property {AdminColumnKind} kind
 * @property {string} [path] — dot path on customer document (value columns)
 * @property {string} [checkKey] — key in checks map (check columns)
 * @property {boolean} [defaultVisible]
 * @property {boolean} [alwaysVisible]
 */

/** Always shown; not toggleable. */
export const ADMIN_CUSTOMER_BUILTIN_COLUMNS = [
    { id: "name", label: "Name", kind: "builtin", alwaysVisible: true },
    { id: "type", label: "Type", kind: "builtin", alwaysVisible: true },
    { id: "archived", label: "Archived", kind: "builtin", alwaysVisible: true },
    { id: "actions", label: "Actions", kind: "builtin", alwaysVisible: true },
];

/** Default integration check columns (unchanged from original admin table). */
export const ADMIN_CUSTOMER_DEFAULT_CHECK_COLUMNS = [
    { id: "check_meta_id", label: "Meta ID", group: "Integrations", kind: "check", checkKey: "meta_id", defaultVisible: true },
    { id: "check_shopify_woo", label: "Shopify/WooCommerce", group: "Integrations", kind: "check", checkKey: "shopify_woo", defaultVisible: true },
    { id: "check_facebook", label: "Facebook", group: "Integrations", kind: "check", checkKey: "facebook", defaultVisible: true },
    { id: "check_google_ads", label: "Google Ads", group: "Integrations", kind: "check", checkKey: "google_ads", defaultVisible: true },
    { id: "check_search_console", label: "Search Console", group: "Integrations", kind: "check", checkKey: "search_console", defaultVisible: true },
    { id: "check_ga4", label: "GA4", group: "Integrations", kind: "check", checkKey: "ga4", defaultVisible: true },
];

/** Optional integration checks (off by default). */
export const ADMIN_CUSTOMER_OPTIONAL_CHECK_COLUMNS = [
    { id: "check_pinterest", label: "Pinterest", group: "Integrations", kind: "check", checkKey: "pinterest" },
    { id: "check_snapchat", label: "Snapchat", group: "Integrations", kind: "check", checkKey: "snapchat" },
    { id: "check_reddit", label: "Reddit", group: "Integrations", kind: "check", checkKey: "reddit" },
    { id: "check_bing", label: "Microsoft Ads", group: "Integrations", kind: "check", checkKey: "bing" },
    { id: "check_klaviyo", label: "Klaviyo", group: "Integrations", kind: "check", checkKey: "klaviyo" },
    { id: "check_clickup", label: "ClickUp ID", group: "Integrations", kind: "check", checkKey: "clickup" },
];

/** Optional value columns — IDs and config (no secrets). */
export const ADMIN_CUSTOMER_VALUE_COLUMNS = [
    { id: "val_customer_id", label: "Customer ID", group: "General", kind: "value", path: "_id" },
    { id: "val_parent_customer", label: "Parent customer ID", group: "General", kind: "value", path: "parentCustomer" },
    { id: "val_created_at", label: "Created at", group: "General", kind: "value", path: "createdAt" },
    { id: "val_updated_at", label: "Updated at", group: "General", kind: "value", path: "updatedAt" },
    { id: "val_metric_preference", label: "Metric preference", group: "General", kind: "value", path: "CustomerSettings.metricPreference" },
    { id: "val_store_currency", label: "Store currency", group: "General", kind: "value", path: "CustomerSettings.customerStoreValutaCode" },
    { id: "val_revenue_type", label: "Revenue type", group: "General", kind: "value", path: "CustomerSettings.customerRevenueType" },
    { id: "val_revenue_vat", label: "Revenue VAT display", group: "General", kind: "value", path: "CustomerSettings.revenueDisplayVat" },
    { id: "val_shopify_markets", label: "Shopify Markets enabled", group: "General", kind: "value", path: "CustomerSettings.shopifyMarketsEnabled" },
    { id: "val_shopify_online_only", label: "Shopify online store only", group: "General", kind: "value", path: "CustomerSettings.shopifyOnlineStoreOnly" },
    { id: "val_fetch_cogs", label: "Fetch COGS from store", group: "General", kind: "value", path: "CustomerSettings.fetchCogsFromStore" },
    { id: "val_change_currency", label: "Change currency", group: "General", kind: "value", path: "CustomerSettings.changeCurrency" },
    { id: "val_billing_country", label: "Billing country filter", group: "General", kind: "value", path: "CustomerSettings.changeCurrencyShopifyBillingCountryName" },
    { id: "val_billing_country_exclude", label: "Billing country exclude", group: "General", kind: "value", path: "CustomerSettings.changeCurrencyShopifyBillingCountryExclude" },
    { id: "val_clickup_id", label: "ClickUp task ID", group: "ClickUp", kind: "value", path: "CustomerSettings.customerClickupID" },
    { id: "val_meta_id", label: "Meta ID include", group: "Meta", kind: "value", path: "CustomerSettings.customerMetaID" },
    { id: "val_meta_id_exclude", label: "Meta ID exclude", group: "Meta", kind: "value", path: "CustomerSettings.customerMetaIDExclude" },
    { id: "val_shopify_url", label: "Shopify URL", group: "Shopify", kind: "value", path: "CustomerSettings.shopifyUrl" },
    { id: "val_woo_url", label: "WooCommerce URL", group: "WooCommerce", kind: "value", path: "CustomerSettings.wooCommerceApiUrl" },
    { id: "val_magento_url", label: "Magento base URL", group: "Magento", kind: "value", path: "CustomerSettings.magentoBaseUrl" },
    { id: "val_magento_store", label: "Magento store code", group: "Magento", kind: "value", path: "CustomerSettings.magentoStoreCode" },
    { id: "val_dan_domain_host", label: "DanDomain shop host", group: "DanDomain", kind: "value", path: "CustomerSettings.danDomain.shopHost" },
    { id: "val_dan_domain_client_id", label: "DanDomain client ID", group: "DanDomain", kind: "value", path: "CustomerSettings.danDomain.clientId" },
    { id: "val_dan_domain_original_url", label: "DanDomain Original admin URL", group: "DanDomain Original", kind: "value", path: "CustomerSettings.danDomainOriginal.shopAdminUrl" },
    { id: "val_facebook_ad_account", label: "Facebook ad account ID", group: "Facebook", kind: "value", path: "CustomerSettings.facebookAdAccountId" },
    { id: "val_google_ads_id", label: "Google Ads customer ID", group: "Google Ads", kind: "value", path: "CustomerSettings.googleAdsCustomerId" },
    { id: "val_google_ads_country", label: "Google Ads country filter", group: "Google Ads", kind: "value", path: "CustomerSettings.googleAdsCountryFilter" },
    { id: "val_google_ads_country_exclude", label: "Google Ads country exclude", group: "Google Ads", kind: "value", path: "CustomerSettings.googleAdsCountryExclude" },
    { id: "val_google_ads_market_mapping", label: "Google Ads market mapping", group: "Google Ads", kind: "value", path: "CustomerSettings.googleAdsMarketMapping" },
    { id: "val_pinterest_account", label: "Pinterest ad account ID", group: "Pinterest", kind: "value", path: "CustomerSettings.pinterestAdAccountId" },
    { id: "val_snapchat_org", label: "Snapchat organization ID", group: "Snapchat", kind: "value", path: "CustomerSettings.snapchat.organizationId" },
    { id: "val_snapchat_ad_account", label: "Snapchat ad account ID", group: "Snapchat", kind: "value", path: "CustomerSettings.snapchat.adAccountId" },
    { id: "val_snapchat_client_id", label: "Snapchat client ID", group: "Snapchat", kind: "value", path: "CustomerSettings.snapchat.clientId" },
    { id: "val_reddit_account", label: "Reddit ad account ID", group: "Reddit", kind: "value", path: "CustomerSettings.reddit.accountId" },
    { id: "val_reddit_app_id", label: "Reddit app ID", group: "Reddit", kind: "value", path: "CustomerSettings.reddit.appId" },
    { id: "val_reddit_username", label: "Reddit username", group: "Reddit", kind: "value", path: "CustomerSettings.reddit.redditUsername" },
    { id: "val_bing_customer", label: "Bing Ads customer ID", group: "Microsoft Ads", kind: "value", path: "CustomerSettings.bingAdsCustomerId" },
    { id: "val_bing_account", label: "Bing Ads account ID", group: "Microsoft Ads", kind: "value", path: "CustomerSettings.bingAdsAccountId" },
    { id: "val_gsc_property", label: "Search Console property", group: "SEO", kind: "value", path: "CustomerSettings.googleSearchConsoleProperty" },
    { id: "val_bing_webmaster", label: "Bing Webmaster URL", group: "SEO", kind: "value", path: "CustomerSettings.bingWebmasterSiteUrl" },
    { id: "val_ga4_property", label: "GA4 property ID", group: "Analytics", kind: "value", path: "CustomerSettings.ga4PropertyId" },
    { id: "val_team_synced", label: "ClickUp team synced at", group: "ClickUp", kind: "value", path: "customerTeam.syncedAt" },
];

export const ADMIN_CUSTOMER_ALL_TOGGLEABLE_COLUMNS = [
    ...ADMIN_CUSTOMER_OPTIONAL_CHECK_COLUMNS,
    ...ADMIN_CUSTOMER_VALUE_COLUMNS,
];

export const ADMIN_CUSTOMER_COLUMN_BY_ID = Object.fromEntries(
    [
        ...ADMIN_CUSTOMER_BUILTIN_COLUMNS,
        ...ADMIN_CUSTOMER_DEFAULT_CHECK_COLUMNS,
        ...ADMIN_CUSTOMER_ALL_TOGGLEABLE_COLUMNS,
    ].map((c) => [c.id, c])
);

export const ADMIN_CUSTOMER_DEFAULT_VISIBLE_OPTIONAL_IDS = [];

export const ADMIN_CUSTOMERS_COLUMNS_STORAGE_KEY = "searchmind.admin.customersTableColumns";

/** @param {string} raw */
export function parseAdminCustomerColumnIds(raw) {
    if (!raw || typeof raw !== "string") return [];
    return [
        ...new Set(
            raw
                .split(",")
                .map((s) => s.trim())
                .filter((id) => ADMIN_CUSTOMER_COLUMN_BY_ID[id]?.kind !== "builtin")
        ),
    ];
}

/** Columns rendered left-to-right after builtins (default checks + user picks). */
export function buildVisibleTableColumns(optionalColumnIds = []) {
    const optionalSet = new Set(optionalColumnIds);
    const defaultChecks = ADMIN_CUSTOMER_DEFAULT_CHECK_COLUMNS.filter((c) => c.defaultVisible);
    const extraChecks = ADMIN_CUSTOMER_OPTIONAL_CHECK_COLUMNS.filter((c) => optionalSet.has(c.id));
    const valueCols = ADMIN_CUSTOMER_VALUE_COLUMNS.filter((c) => optionalSet.has(c.id));
    return [...defaultChecks, ...extraChecks, ...valueCols];
}

/** @param {string[]} optionalColumnIds */
export function groupToggleableColumnsForPicker(optionalColumnIds = []) {
    const selected = new Set(optionalColumnIds);
    /** @type {Record<string, AdminColumnDef[]>} */
    const groups = {};
    for (const col of ADMIN_CUSTOMER_ALL_TOGGLEABLE_COLUMNS) {
        const g = col.group || "Other";
        if (!groups[g]) groups[g] = [];
        groups[g].push({ ...col, selected: selected.has(col.id) });
    }
    return groups;
}
