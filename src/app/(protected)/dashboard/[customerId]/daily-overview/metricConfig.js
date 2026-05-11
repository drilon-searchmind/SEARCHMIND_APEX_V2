/**
 * Metric column configuration for Daily Overview tables.
 * Keys match the data properties.
 */
export const METRIC_COLUMNS = [
	{ key: 'orders', label: 'Orders', group: 'sales' },
	{ key: 'netRevenue', label: 'Net Revenue', group: 'sales' },
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
	{ key: 'poas', label: 'Blended POAS', group: 'result' },
	{ key: 'netProfit', label: 'Net Profit', group: 'result' },
];

export const DEFAULT_VISIBLE_METRICS = Object.fromEntries(
	METRIC_COLUMNS.map((m) => [m.key, true])
);

/** Parent group view only: rename Net Revenue column when showing gross-sales basis */
export function mapMetricColumnsForRevenueBasis(shopifyRevenueField = 'net_sales') {
	if (shopifyRevenueField !== 'gross_sales') return METRIC_COLUMNS;
	return METRIC_COLUMNS.map((c) =>
		c.key === 'netRevenue' ? { ...c, label: 'Gross Sales' } : c
	);
}
