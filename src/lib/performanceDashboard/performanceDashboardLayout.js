/** Flatten all metric keys referenced in standard overview columns. */
export function collectSectionMetricKeys(sections) {
    const keys = new Set();
    const walk = (items) => {
        for (const item of items || []) {
            const key = item.metricKey || item.key;
            if (key) keys.add(key);
            if (item.children?.length) walk(item.children);
        }
    };
    for (const section of sections || []) {
        if (section.primaryKey) keys.add(section.primaryKey);
        walk(section.breakdown);
    }
    return keys;
}

/**
 * Metrics shown as KPI cards below the chart (not in the 4-column breakdown).
 */
export const OVERVIEW_KPI_CARD_KEYS = [
    "aov",
    "roas",
    "cac",
    "poas",
    "ebit_pct",
    "revenue",
    "net_sales",
    "additional_fees",
    "transaction_fee",
    "variable_costs",
    "total_expenses",
    "spendshare",
];

export function getOverviewKpiCardKeys(columnMetricKeys) {
    const inColumns = columnMetricKeys instanceof Set ? columnMetricKeys : new Set(columnMetricKeys);
    return OVERVIEW_KPI_CARD_KEYS.filter((k) => !inColumns.has(k));
}

/**
 * @param {{ visibleAdSpendChannels: { metricsDataKey: string, label: string }[], fixedBreakdownRows?: { key: string, metricKey: string, label: string }[] }} opts
 */
export function buildStandardOverviewSections({
    visibleAdSpendChannels = [],
    fixedBreakdownRows = [],
}) {
    const channelRows = visibleAdSpendChannels.map((c) => ({
        key: c.metricsDataKey,
        metricKey: c.metricsDataKey,
        label: `${c.label} spend`,
    }));

    const fixedChildren = (fixedBreakdownRows || []).map((row) => ({
        key: row.key,
        metricKey: row.metricKey,
        label: row.label,
        nested: true,
    }));

    return [
        {
            key: "total_sales_ex_vat",
            title: "Total sales excl. VAT",
            primaryKey: "total_sales_ex_vat",
            headerSubtitle: "orders",
            breakdown: [
                { key: "gross_sales", label: "Gross Sales" },
                {
                    key: "discounts_group",
                    metricKey: "discounts",
                    label: "Total Discounts",
                    collapsible: true,
                    children: [
                        {
                            key: "discount_codes",
                            metricKey: "discount_codes",
                            label: "Discount Codes",
                            nested: true,
                        },
                        {
                            key: "discount_pct_gross",
                            metricKey: "discount_pct_gross",
                            label: "% of gross sales",
                            nested: true,
                            valueType: "pct",
                        },
                    ],
                },
                {
                    key: "revenue_after_discounts_group",
                    metricKey: "revenue_after_discounts",
                    label: "Revenue after Discounts",
                    collapsible: true,
                    children: [
                        {
                            key: "product_sales",
                            metricKey: "product_sales",
                            label: "Product Sales",
                            nested: true,
                        },
                        {
                            key: "shipping_revenue",
                            metricKey: "shipping_revenue",
                            label: "Shipping (income)",
                            nested: true,
                        },
                    ],
                },
                {
                    key: "returns_group",
                    metricKey: "returns",
                    label: "Total Returns",
                    collapsible: true,
                    returnsSettings: true,
                    children: [
                        {
                            key: "returns_goods",
                            metricKey: "returns_goods",
                            label: "Returns (Goods)",
                            nested: true,
                        },
                        {
                            key: "returns_shipping",
                            metricKey: "returns_shipping",
                            label: "Returns (Shipping)",
                            nested: true,
                        },
                        {
                            key: "refunds_rate",
                            metricKey: "refunds_rate",
                            label: "Refunds rate",
                            nested: true,
                            valueType: "pct",
                        },
                    ],
                },
                { key: "tax", label: "Taxes" },
            ],
        },
        {
            key: "gross_profit_ex_vat",
            title: "Gross Profit excl. VAT",
            primaryKey: "gross_profit",
            headerSubtitlePct: true,
            breakdown: [
                { key: "cogs", label: "COGS", cogsSettings: true },
                {
                    key: "cogs_pct_total_sales",
                    metricKey: "cogs_pct_total_sales",
                    label: "% of total sales",
                    nested: true,
                    valueType: "pct",
                },
                { key: "pick_pack", label: "Pick & Pack" },
                { key: "shipping_cost", label: "Shipping Cost" },
                {
                    key: "shipping_cost_pct_total_sales",
                    metricKey: "shipping_cost_pct_total_sales",
                    label: "% of total sales (shipping)",
                    nested: true,
                    valueType: "pct",
                },
                { key: "transaction_fee", label: "Payment" },
                { key: "returns_cost", label: "Returns cost" },
                { key: "total_order_costs", label: "Total Order Costs" },
            ],
        },
        {
            key: "gross_profit_minus_ad_spend",
            title: "Gross profit - Ad Spend",
            primaryKey: "gross_profit_minus_ad_spend",
            headerSubtitlePct: true,
            breakdown: [
                ...channelRows,
                { key: "marketing_spend", label: "Total Ad Spend" },
                {
                    key: "ad_spend_pct_total_sales",
                    metricKey: "ad_spend_pct_total_sales",
                    label: "% of total sales",
                    nested: true,
                    valueType: "pct",
                },
            ],
        },
        {
            key: "net_profit",
            title: "Net profit",
            primaryKey: "ebit",
            headerSubtitlePct: true,
            pctMetricKey: "net_profit_pct_total_sales",
            breakdown: [
                {
                    key: "fixed_costs_group",
                    metricKey: "fixed_costs",
                    label: "Fixed Expenses",
                    collapsible: true,
                    fixedExpensesSettings: true,
                    children: fixedChildren,
                },
            ],
        },
    ];
}
