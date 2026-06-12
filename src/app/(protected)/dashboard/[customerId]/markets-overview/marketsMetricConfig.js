'use client';

import { revenueVatDisplayLabelSuffix } from '@/lib/revenueVatDisplay';

export const MARKETS_METRIC_COLUMNS = [
	{ key: 'orders', label: 'Orders', group: 'sales' },
	{ key: 'netRevenue', label: 'Net Revenue', group: 'sales' },
	{ key: 'discounts', label: 'Discount', group: 'sales' },
	{ key: 'returns', label: 'Returns', group: 'sales' },
	{ key: 'taxes', label: 'Taxes', group: 'sales' },
	{ key: 'shippingCharges', label: 'Shipping Charges', group: 'sales' },
	{ key: 'cogs', label: 'COGS', group: 'sales' },
	{ key: 'aov', label: 'AOV', group: 'sales' },
	{ key: 'ppcCost', label: 'Google Ads Cost', group: 'marketing' },
	{ key: 'psCost', label: 'Meta Ads Cost', group: 'marketing' },
	{ key: 'pinterestCost', label: 'Pinterest Ads Cost', group: 'marketing' },
	{ key: 'snapchatCost', label: 'Snapchat Ads Cost', group: 'marketing' },
	{ key: 'bingCost', label: 'Microsoft (Bing) Ads Cost', group: 'marketing' },
	{ key: 'redditCost', label: 'Reddit Ads Cost', group: 'marketing' },
	{ key: 'roas', label: 'Blended ROAS', group: 'marketing' },
	{ key: 'variableExpense', label: 'Variable Expense', group: 'result' },
	{ key: 'fixedExpenses', label: 'Fixed Expenses', group: 'result' },
	{ key: 'transactionFee', label: 'Transaction Fees', group: 'result' },
	{ key: 'poas', label: 'Blended POAS', group: 'result', tooltip: 'Gross Profit / Ad Spend (break-even = 1.0)' },
	{ key: 'netProfit', label: 'Net Profit', group: 'result' },
];

export const MARKETS_DEFAULT_VISIBLE_METRICS = Object.fromEntries(
	MARKETS_METRIC_COLUMNS.map((m) => [m.key, true])
);

for (const key of ['returns', 'discounts', 'taxes', 'shippingCharges', 'transactionFee']) {
	MARKETS_DEFAULT_VISIBLE_METRICS[key] = false;
}

const MARKETS_VAT_LABELED_KEYS = new Set([
	'netRevenue',
	'discounts',
	'returns',
	'taxes',
	'shippingCharges',
	'cogs',
	'aov',
]);

/** Sales columns with incl./excl. VAT suffix from General Settings. */
export function marketsMetricColumnsWithVatLabels(customerSettings = {}) {
	const suffix = revenueVatDisplayLabelSuffix(customerSettings);
	return MARKETS_METRIC_COLUMNS.map((col) =>
		MARKETS_VAT_LABELED_KEYS.has(col.key)
			? { ...col, label: `${col.label}${suffix}` }
			: col
	);
}

