/**
 * Admin Missing Customers table — default columns + optional enrichment fields.
 */

/** @typedef {object} MissingCustomerColumnDef
 * @property {string} id — CSV field key
 * @property {string} label
 * @property {string} [group]
 * @property {boolean} [defaultVisible]
 * @property {boolean} [alwaysVisible]
 * @property {'text' | 'url' | 'status' | 'long'} [cellType]
 */

/** Always shown in the missing-customers table. */
export const ADMIN_MISSING_CUSTOMER_DEFAULT_COLUMNS = [
    { id: "clickup_id", label: "ClickUp ID", alwaysVisible: true, defaultVisible: true, cellType: "text" },
    { id: "clickup_name", label: "ClickUp Name", alwaysVisible: true, defaultVisible: true, cellType: "text" },
    { id: "website_url", label: "Website", alwaysVisible: true, defaultVisible: true, cellType: "url" },
    {
        id: "suggested_customer_name",
        label: "Suggested name",
        alwaysVisible: true,
        defaultVisible: true,
        cellType: "text",
    },
    {
        id: "business_category",
        label: "Business category",
        alwaysVisible: true,
        defaultVisible: true,
        cellType: "text",
    },
    { id: "customer_type", label: "Customer type", alwaysVisible: true, defaultVisible: true, cellType: "text" },
];

/** Optional enrichment columns (toggle via column picker). */
export const ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS = [
    { id: "shopify_url", label: "Shopify URL", group: "Platform", cellType: "url" },
    { id: "woo_commerce_api_url", label: "WooCommerce URL", group: "Platform", cellType: "url" },
    { id: "magento_base_url", label: "Magento URL", group: "Platform", cellType: "url" },
    { id: "dan_domain_shop_host", label: "DanDomain host", group: "Platform", cellType: "text" },
    { id: "ga4_property_id", label: "GA4 property ID", group: "Analytics", cellType: "text" },
    { id: "ga4_measurement_id", label: "GA4 measurement ID", group: "Analytics", cellType: "text" },
    { id: "google_tag_manager_id", label: "GTM ID", group: "Analytics", cellType: "text" },
    {
        id: "google_search_console_property",
        label: "Search Console property",
        group: "SEO",
        cellType: "url",
    },
    { id: "bing_webmaster_site_url", label: "Bing Webmaster URL", group: "SEO", cellType: "url" },
    { id: "customer_store_valuta_code", label: "Currency", group: "General", cellType: "text" },
    { id: "company_description", label: "Description", group: "General", cellType: "long" },
    { id: "industry", label: "Industry", group: "General", cellType: "text" },
    { id: "sells_products_online", label: "Sells online", group: "Signals", cellType: "text" },
    { id: "sells_to_businesses_only", label: "B2B only", group: "Signals", cellType: "text" },
    { id: "platform_signals", label: "Platform signals", group: "Signals", cellType: "long" },
    { id: "enrichment_confidence", label: "Confidence", group: "Enrichment", cellType: "text" },
    { id: "enrichment_notes", label: "Notes", group: "Enrichment", cellType: "long" },
    { id: "context_urls_analyzed", label: "URLs analyzed", group: "Enrichment", cellType: "long" },
    { id: "enrichment_status", label: "Status", group: "Enrichment", cellType: "status" },
    { id: "enrichment_error", label: "Error", group: "Enrichment", cellType: "long" },
    { id: "enriched_at", label: "Enriched at", group: "Enrichment", cellType: "text" },
];

export const ADMIN_MISSING_CUSTOMER_ALL_COLUMNS = [
    ...ADMIN_MISSING_CUSTOMER_DEFAULT_COLUMNS,
    ...ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS,
];

export const ADMIN_MISSING_CUSTOMER_COLUMN_BY_ID = Object.fromEntries(
    ADMIN_MISSING_CUSTOMER_ALL_COLUMNS.map((c) => [c.id, c])
);

export const ADMIN_MISSING_CUSTOMERS_COLUMNS_STORAGE_KEY =
    "searchmind.admin.missingCustomersTableColumns";

/** @param {string[]} optionalColumnIds */
export function buildVisibleMissingCustomerColumns(optionalColumnIds = []) {
    const optionalSet = new Set(optionalColumnIds);
    const extras = ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS.filter((c) => optionalSet.has(c.id));
    return [...ADMIN_MISSING_CUSTOMER_DEFAULT_COLUMNS, ...extras];
}

/** Fields used for search filtering. */
export const ADMIN_MISSING_CUSTOMER_SEARCH_FIELDS = [
    "clickup_id",
    "clickup_name",
    "website_url",
    "suggested_customer_name",
    "business_category",
    "customer_type",
    "industry",
    "company_description",
];
