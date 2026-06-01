/** Standard overview metrics a custom KPI can replace (Net Revenue section). */
export const REPLACEABLE_STANDARD_METRICS = [
    { key: "revenue", label: "Net Revenue" },
    { key: "net_sales", label: "Net Sales" },
    { key: "orders", label: "Orders" },
    { key: "aov", label: "NET AOV" },
    { key: "gross_sales", label: "Gross Sales" },
    { key: "discounts", label: "Discount" },
    { key: "returns", label: "Returns (refunds)" },
    { key: "total_sales", label: "Total Sales" },
    { key: "shipping_revenue", label: "Shipping Charges" },
    { key: "duties", label: "Duties" },
    { key: "additional_fees", label: "Additional Fees" },
    { key: "transaction_fee", label: "Transactions Fee" },
    { key: "tax", label: "Taxes" },
];

export const REPLACEABLE_STANDARD_METRIC_KEYS = new Set(
    REPLACEABLE_STANDARD_METRICS.map((m) => m.key)
);

/** Shopify revenue fields from ShopifyQL (labels only; icons assigned in AddKpiModal). */
export const SHOPIFY_REVENUE_FORMULA_METRIC_DEFS = [
    { key: "net_sales", label: "Net Sales" },
    { key: "revenue", label: "Net Revenue" },
    { key: "total_sales", label: "Total Sales" },
    { key: "gross_sales", label: "Gross Sales" },
    { key: "discounts", label: "Discounts" },
    { key: "returns", label: "Returns (refunds)" },
    { key: "shipping_revenue", label: "Shipping Charges" },
    { key: "duties", label: "Duties" },
    { key: "additional_fees", label: "Additional Fees" },
    { key: "tax", label: "Taxes" },
];

/** Other formula metrics (costs, ratios, spend) — labels only. */
export const CUSTOM_KPI_OTHER_METRIC_DEFS = [
    { key: "gross_profit", label: "Net Profit" },
    { key: "orders", label: "Orders" },
    { key: "shipping_cost", label: "Shipping Cost" },
    { key: "transaction_fee", label: "Transaction Fee" },
    { key: "cogs", label: "COGS" },
    { key: "cost", label: "Spend (paid media)" },
    { key: "meta_spend", label: "Meta spend" },
    { key: "google_spend", label: "Google Ads spend" },
    { key: "pinterest_spend", label: "Pinterest spend" },
    { key: "snapchat_spend", label: "Snapchat spend" },
    { key: "bing_spend", label: "Bing Ads spend" },
    { key: "reddit_spend", label: "Reddit spend" },
    { key: "roas", label: "Blended ROAS" },
    { key: "poas", label: "Blended POAS" },
    { key: "aov", label: "Net AOV" },
    { key: "cac", label: "Blended CAC" },
    { key: "spendshare", label: "Spendshare" },
];

export function getReturnsOverrideSettings(customerSettings = {}) {
    const pd = customerSettings?.performanceDashboard || {};
    const enabled = pd.returnsOverrideEnabled === true;
    const percent = Number(pd.returnsOverridePercent);
    return {
        enabled,
        percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 45,
    };
}
