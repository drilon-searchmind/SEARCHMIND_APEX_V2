/** Standard overview metrics a custom KPI can replace (Net Revenue section). */
export const REPLACEABLE_STANDARD_METRICS = [
    { key: "revenue", label: "Net Revenue" },
    { key: "orders", label: "Orders" },
    { key: "aov", label: "NET AOV" },
    { key: "gross_sales", label: "Gross Sales" },
    { key: "discounts", label: "Discount" },
    { key: "returns", label: "Returns" },
    { key: "shipping_revenue", label: "Shipping Charges" },
    { key: "transaction_fee", label: "Transactions Fee" },
    { key: "tax", label: "Taxes" },
];

export const REPLACEABLE_STANDARD_METRIC_KEYS = new Set(
    REPLACEABLE_STANDARD_METRICS.map((m) => m.key)
);

export function getReturnsOverrideSettings(customerSettings = {}) {
    const pd = customerSettings?.performanceDashboard || {};
    const enabled = pd.returnsOverrideEnabled === true;
    const percent = Number(pd.returnsOverridePercent);
    return {
        enabled,
        percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 45,
    };
}
