import dayjs from "dayjs";

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
 * Get cell styles (heatmap only, no bold for max)
 */
export function getCellStyles(val, maxVal, isMax) {
	const heatmap = val > 0 && maxVal > 0 ? getHeatmapStyle(val, maxVal) : {};
	return { ...heatmap };
}

/**
 * Compute max values for heatmap from rows
 */
export function computeRowMax(rows) {
	if (!rows?.length) return {};
	return {
		orders: Math.max(...rows.map((r) => r.orders)),
		netRevenue: Math.max(...rows.map((r) => r.netRevenue ?? 0)),
		ppcCost: Math.max(...rows.map((r) => r.ppcCost)),
		psCost: Math.max(...rows.map((r) => r.psCost)),
		pinterestCost: Math.max(...rows.map((r) => r.pinterestCost ?? 0)),
		snapchatCost: Math.max(...rows.map((r) => r.snapchatCost ?? 0)),
		bingCost: Math.max(...rows.map((r) => r.bingCost ?? 0)),
		redditCost: Math.max(...rows.map((r) => r.redditCost ?? 0)),
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
			netRevenue: formatCurrency(0),
			cogs: formatCurrency(0),
			ppcCost: formatCurrency(0),
			psCost: formatCurrency(0),
			pinterestCost: formatCurrency(0),
			snapchatCost: formatCurrency(0),
			bingCost: formatCurrency(0),
			redditCost: formatCurrency(0),
			variableExpense: formatCurrency(0),
			fixedExpenses: formatCurrency(0),
			aov: '-',
			roas: '-',
			poas: '-',
			netProfit: formatCurrency(0),
		};

	const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);
	const totalNetRevenue = rows.reduce((sum, r) => sum + (r.netRevenue ?? 0), 0);
	const totalCogs = rows.reduce((sum, r) => sum + (r.cogs || 0), 0);
	const totalPpcCost = rows.reduce((sum, r) => sum + r.ppcCost, 0);
	const totalPsCost = rows.reduce((sum, r) => sum + r.psCost, 0);
	const totalPinterest = rows.reduce((sum, r) => sum + (r.pinterestCost ?? 0), 0);
	const totalSnapchat = rows.reduce((sum, r) => sum + (r.snapchatCost ?? 0), 0);
	const totalBing = rows.reduce((sum, r) => sum + (r.bingCost ?? 0), 0);
	const totalReddit = rows.reduce((sum, r) => sum + (r.redditCost ?? 0), 0);
	const totalCost = rows.reduce((sum, r) => sum + (r.totalMarketingSpend ?? 0), 0);
	const totalVariableExpense = rows.reduce(
		(sum, r) => sum + (r.variableExpense || 0),
		0
	);
	const totalFixedExpenses = rows.reduce(
		(sum, r) => sum + (r.fixedExpense || 0),
		0
	);
	const totalNetProfit = rows.reduce(
		(sum, r) => sum + (r.netProfit ?? 0),
		0
	);

	return {
		orders: totalOrders,
		netRevenue: formatCurrency(totalNetRevenue),
		cogs: formatCurrency(totalCogs),
		ppcCost: formatCurrency(totalPpcCost),
		psCost: formatCurrency(totalPsCost),
		pinterestCost: formatCurrency(totalPinterest),
		snapchatCost: formatCurrency(totalSnapchat),
		bingCost: formatCurrency(totalBing),
		redditCost: formatCurrency(totalReddit),
		variableExpense: formatCurrency(totalVariableExpense),
		fixedExpenses: formatCurrency(totalFixedExpenses),
		aov: totalOrders > 0 ? formatCurrency(totalNetRevenue / totalOrders) : '-',
		roas: totalCost > 0 ? (totalNetRevenue / totalCost).toFixed(2) : '-',
		poas: totalCost > 0 ? (totalNetProfit / totalCost).toFixed(2) : '-',
		netProfit: formatCurrency(totalNetProfit),
	};
}

/**
 * Compute raw numeric totals for difference calculations
 */
export function computeRawTotals(rows) {
	if (!rows?.length)
		return {
			orders: 0,
			netRevenue: 0,
			cogs: 0,
			ppcCost: 0,
			psCost: 0,
			pinterestCost: 0,
			snapchatCost: 0,
			bingCost: 0,
			redditCost: 0,
			variableExpense: 0,
			fixedExpenses: 0,
			aov: 0,
			roas: 0,
			poas: 0,
			netProfit: 0,
		};

	const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);
	const totalNetRevenue = rows.reduce((sum, r) => sum + (r.netRevenue ?? 0), 0);
	const totalCogs = rows.reduce((sum, r) => sum + (r.cogs || 0), 0);
	const totalPpcCost = rows.reduce((sum, r) => sum + r.ppcCost, 0);
	const totalPsCost = rows.reduce((sum, r) => sum + r.psCost, 0);
	const totalPinterest = rows.reduce((sum, r) => sum + (r.pinterestCost ?? 0), 0);
	const totalSnapchat = rows.reduce((sum, r) => sum + (r.snapchatCost ?? 0), 0);
	const totalBing = rows.reduce((sum, r) => sum + (r.bingCost ?? 0), 0);
	const totalReddit = rows.reduce((sum, r) => sum + (r.redditCost ?? 0), 0);
	const totalCost = rows.reduce((sum, r) => sum + (r.totalMarketingSpend ?? 0), 0);
	const totalVariableExpense = rows.reduce(
		(sum, r) => sum + (r.variableExpense || 0),
		0
	);
	const totalFixedExpenses = rows.reduce(
		(sum, r) => sum + (r.fixedExpense || 0),
		0
	);
	const totalNetProfit = rows.reduce(
		(sum, r) => sum + (r.netProfit ?? 0),
		0
	);

	return {
		orders: totalOrders,
		netRevenue: totalNetRevenue,
		cogs: totalCogs,
		ppcCost: totalPpcCost,
		psCost: totalPsCost,
		pinterestCost: totalPinterest,
		snapchatCost: totalSnapchat,
		bingCost: totalBing,
		redditCost: totalReddit,
		variableExpense: totalVariableExpense,
		fixedExpenses: totalFixedExpenses,
		aov: totalOrders > 0 ? totalNetRevenue / totalOrders : 0,
		roas: totalCost > 0 ? totalNetRevenue / totalCost : 0,
		poas: totalCost > 0 ? totalNetProfit / totalCost : 0,
		netProfit: totalNetProfit,
	};
}

/**
 * Match last-year daily rows to the current period (same calendar days, one year earlier).
 * Used for the summary "Last Year Period" row and Difference/Index rows in the main table.
 */
export function alignLastYearRowsToCurrentPeriod(currentRows, lastYearRows) {
	if (!currentRows?.length || !lastYearRows?.length) return [];
	const targetDates = new Set(
		currentRows.map((r) =>
			dayjs(String(r.date).slice(0, 10)).subtract(1, "year").format("YYYY-MM-DD")
		)
	);
	return lastYearRows.filter((r) =>
		targetDates.has(String(r.date).slice(0, 10))
	);
}

/** Metrics where higher is better (green up, red down) */
const HIGHER_IS_BETTER = new Set([
	'orders',
	'netRevenue',
	'aov',
	'roas',
	'poas',
	'netProfit',
]);

/**
 * Compute difference between current and last period totals
 * @returns {Object} { key: { diff, formatted, isGood } }
 */
export function computeDifference(rows, rowsPrev) {
	const curr = computeRawTotals(rows);
	const prev = computeRawTotals(rowsPrev || []);

	const result = {};
	for (const key of Object.keys(curr)) {
		const diff = curr[key] - prev[key];
		const higherIsBetter = HIGHER_IS_BETTER.has(key);
		const isGood =
			diff === 0 ? null : higherIsBetter ? diff > 0 : diff < 0;

		let formatted;
		if (key === 'orders') {
			formatted = diff >= 0 ? `+${diff}` : `${diff}`;
		} else if (['aov', 'roas', 'poas'].includes(key)) {
			formatted = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
		} else {
			formatted =
				diff >= 0
					? `+${formatCurrency(diff, { maximumFractionDigits: 0 })}`
					: formatCurrency(diff, { maximumFractionDigits: 0 });
		}
		result[key] = { diff, formatted, isGood };
	}
	return result;
}

/**
 * Compute index (current/previous)*100 for each metric
 * @returns {Object} { key: { index, formatted, isGood } }
 */
export function computeIndex(rows, rowsPrev) {
	const curr = computeRawTotals(rows);
	const prev = computeRawTotals(rowsPrev || []);

	const result = {};
	for (const key of Object.keys(curr)) {
		const p = prev[key];
		if (p === 0 || p == null) {
			result[key] = { index: null, formatted: '-', isGood: null };
			continue;
		}
		const index = (curr[key] / p) * 100;
		const higherIsBetter = HIGHER_IS_BETTER.has(key);
		const isGood =
			index === 100 ? null : higherIsBetter ? index > 100 : index < 100;

		result[key] = {
			index,
			formatted: Math.round(index).toString(),
			isGood,
		};
	}
	return result;
}
