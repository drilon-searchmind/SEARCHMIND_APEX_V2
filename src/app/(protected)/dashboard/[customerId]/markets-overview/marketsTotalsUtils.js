/**
 * Aggregate numeric metrics from visible market rows for the totals row.
 * Uses a single period fixed expense (not summed per market).
 */
export function aggregateIncludedMarketRows(rows, { fixedExpense = 0 } = {}) {
	const list = Array.isArray(rows) ? rows : [];
	const sum = (key) => list.reduce((s, r) => s + (Number(r[key]) || 0), 0);

	const orders = sum('orders');
	const netRevenue = sum('netRevenue');
	const cogs = sum('cogs');
	const variableExpense = sum('variableExpense');
	const transactionFee = sum('transactionFee');
	const totalMarketingSpend = sum('totalMarketingSpend');
	const fixed = Number(fixedExpense) || 0;
	const netProfit =
		netRevenue - cogs - variableExpense - transactionFee - totalMarketingSpend - fixed;

	return {
		orders,
		netRevenue,
		discounts: sum('discounts'),
		returns: sum('returns'),
		taxes: sum('taxes'),
		shippingCharges: sum('shippingCharges'),
		totalSales: sum('totalSales'),
		cogs,
		aov: orders > 0 ? netRevenue / orders : null,
		ppcCost: sum('ppcCost'),
		psCost: sum('psCost'),
		pinterestCost: sum('pinterestCost'),
		snapchatCost: sum('snapchatCost'),
		bingCost: sum('bingCost'),
		redditCost: sum('redditCost'),
		totalMarketingSpend,
		roas: totalMarketingSpend > 0 ? netRevenue / totalMarketingSpend : null,
		poas: totalMarketingSpend > 0 ? netProfit / totalMarketingSpend : null,
		variableExpense,
		fixedExpense: fixed,
		transactionFee,
		netProfit,
	};
}
