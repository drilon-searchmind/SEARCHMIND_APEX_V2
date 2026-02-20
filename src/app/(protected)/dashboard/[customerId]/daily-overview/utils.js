/**
 * Format value as DKK currency
 */
export function formatCurrency(value, options = {}) {
	if (value == null) return '-';
	return value.toLocaleString('da-DK', {
		style: 'currency',
		currency: 'DKK',
		maximumFractionDigits: 0,
		...options,
	});
}

/**
 * Get heatmap background style for a cell value
 */
export function getHeatmapStyle(val, maxVal) {
	if (!maxVal || maxVal === 0) return {};
	const alpha = 0.15 + 0.85 * (val / maxVal);
	return { backgroundColor: `rgba(214,205,182,${alpha})` };
}

/**
 * Get cell styles (heatmap + bold for max)
 */
export function getCellStyles(val, maxVal, isMax) {
	const heatmap = val > 0 && maxVal > 0 ? getHeatmapStyle(val, maxVal) : {};
	const bold = isMax ? { fontWeight: 600 } : {};
	return { ...bold, ...heatmap };
}

/**
 * Compute max values for heatmap from rows
 */
export function computeRowMax(rows) {
	if (!rows?.length) return {};
	return {
		orders: Math.max(...rows.map((r) => r.orders)),
		revenue: Math.max(...rows.map((r) => r.revenue)),
		revenueExTax: Math.max(...rows.map((r) => r.revenueExTax)),
		ppcCost: Math.max(...rows.map((r) => r.ppcCost)),
		psCost: Math.max(...rows.map((r) => r.psCost)),
		roas: Math.max(...rows.map((r) => r.roas ?? 0)),
		spendshare: Math.max(...rows.map((r) => r.spendshare ?? 0)),
		poas: Math.max(...rows.map((r) => r.poas ?? 0)),
		aov: Math.max(...rows.map((r) => r.aov ?? 0)),
	};
}

/**
 * Compute totals from rows for display
 * @param {Object[]} rows
 * @param {'current'|'lastYear'} variant - 'lastYear' uses totalRevenue for AOV/ROAS
 */
export function computeTotals(rows, variant = 'current') {
	if (!rows?.length)
		return {
			orders: 0,
			revenue: 0,
			revenueExTax: 0,
			cogs: 0,
			ppcCost: 0,
			psCost: 0,
			variableExpense: 0,
			aov: '-',
			roas: '-',
			poas: '-',
			netProfit: formatCurrency(0),
		};

	const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);
	const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
	const totalRevenueExTax = rows.reduce((sum, r) => sum + r.revenueExTax, 0);
	const totalCogs = rows.reduce((sum, r) => sum + (r.cogs || 0), 0);
	const totalPpcCost = rows.reduce((sum, r) => sum + r.ppcCost, 0);
	const totalPsCost = rows.reduce((sum, r) => sum + r.psCost, 0);
	const totalCost = totalPpcCost + totalPsCost;
	const totalVariableExpense = rows.reduce(
		(sum, r) => sum + (r.variableExpense || 0),
		0
	);
	const grossProfit = totalRevenueExTax - totalCogs;
	const useRevenueForMetrics = variant === 'lastYear';
	const revenueForAovRoas = useRevenueForMetrics ? totalRevenue : totalRevenueExTax;

	return {
		orders: totalOrders,
		revenue: formatCurrency(totalRevenue),
		revenueExTax: formatCurrency(totalRevenueExTax),
		cogs: formatCurrency(totalCogs),
		ppcCost: formatCurrency(totalPpcCost),
		psCost: formatCurrency(totalPsCost),
		variableExpense: formatCurrency(totalVariableExpense),
		fixedExpenses: formatCurrency(0),
		aov: totalOrders > 0 ? formatCurrency(revenueForAovRoas / totalOrders) : '-',
		roas: totalCost > 0 ? (revenueForAovRoas / totalCost).toFixed(2) : '-',
		poas: totalCost > 0 ? (grossProfit / totalCost).toFixed(2) : '-',
		netProfit: formatCurrency(totalRevenueExTax - totalCogs),
		netProfitFull: formatCurrency(
			totalRevenueExTax - totalCogs - totalVariableExpense - 0
		),
	};
}
