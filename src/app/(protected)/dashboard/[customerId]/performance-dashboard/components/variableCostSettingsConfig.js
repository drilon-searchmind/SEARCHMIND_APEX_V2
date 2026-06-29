/** CustomerStaticExpenses keys editable from the performance overview. */
export const VARIABLE_COST_SETTINGS = {
    pickNPackCostPerOrder: {
        title: "Pick & Pack settings",
        lede: "Same as customer config. Cost per order for pick & pack (fulfillment).",
        fieldLabel: "Pick & pack cost per order",
        unit: "DKK",
        inputMode: "currency",
        min: 0,
        step: 0.01,
        metricKey: "pick_pack",
    },
    shippingCostPerOrder: {
        title: "Shipping cost settings",
        lede: "Same as customer config. Outbound shipping cost per order.",
        fieldLabel: "Shipping cost per order",
        unit: "DKK",
        inputMode: "currency",
        min: 0,
        step: 0.01,
        metricKey: "shipping_cost",
    },
    transactionCostPercentage: {
        title: "Payment settings",
        lede: "Same as customer config. Transaction / payment fee as a share of net revenue.",
        fieldLabel: "Transaction cost %",
        unit: "%",
        inputMode: "percent",
        min: 0,
        max: 1,
        step: 0.01,
        metricKey: "transaction_fee",
        hint: "Enter as decimal: 0.015 = 1.5% of net revenue.",
    },
    returnsCostPercentage: {
        title: "Returns cost settings",
        lede: "Handling cost on returns as a percentage of total returns (goods) in the period.",
        fieldLabel: "Returns handling cost %",
        unit: "%",
        inputMode: "percent",
        min: 0,
        max: 1,
        step: 0.01,
        metricKey: "returns_cost",
        hint: "Enter as decimal: 0.1 = 10% of return value. Applied to absolute returns in the period.",
    },
};

export function getVariableCostSettingField(metricKey) {
    return Object.entries(VARIABLE_COST_SETTINGS).find(
        ([, cfg]) => cfg.metricKey === metricKey
    )?.[0];
}
