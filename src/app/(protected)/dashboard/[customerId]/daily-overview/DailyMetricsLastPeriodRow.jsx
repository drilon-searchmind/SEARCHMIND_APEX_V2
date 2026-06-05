'use client';

import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsLastPeriodRow({
	rows,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
}) {
	if (!rows?.length) return null;

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

	const formatCurrency = (val, decimals = 0) =>
		val.toLocaleString('da-DK', {
			style: 'currency',
			currency: 'DKK',
			maximumFractionDigits: decimals,
			minimumFractionDigits: decimals,
		});

	const values = {
		orders: totalOrders,
		netRevenue: formatCurrency(totalNetRevenue, 0),
		cogs: formatCurrency(totalCogs, 0),
		aov: totalOrders > 0 ? formatCurrency(totalNetRevenue / totalOrders, 0) : '-',
		ppcCost: formatCurrency(totalPpcCost, 0),
		psCost: formatCurrency(totalPsCost, 0),
		pinterestCost: formatCurrency(totalPinterest, 0),
		snapchatCost: formatCurrency(totalSnapchat, 0),
		bingCost: formatCurrency(totalBing, 0),
		redditCost: formatCurrency(totalReddit, 0),
		roas: totalCost > 0 ? (totalNetRevenue / totalCost).toFixed(2) : '-',
		variableExpense: formatCurrency(totalVariableExpense, 0),
		fixedExpenses: formatCurrency(totalFixedExpenses, 0),
		poas: totalCost > 0 ? (totalNetProfit / totalCost).toFixed(2) : '-',
		netProfit: formatCurrency(totalNetProfit, 0),
	};

	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);
	const getBorderLClass = (key) => {
		const idx = visibleCols.findIndex((m) => m.key === key);
		const col = visibleCols[idx];
		if (!col || idx < 0) return '';
		const prevInGroup = visibleCols
			.slice(0, idx)
			.filter((p) => p.group === col.group);
		const isFirst = idx === 0;
		const isFirstInGroup = prevInGroup.length === 0;
		if (isFirst || (isFirstInGroup && col.group !== 'sales')) {
			return ' border-l border-gray-200';
		}
		return '';
	};

	return (
		<tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
			<td className="px-3 py-2 whitespace-nowrap">Last Year Period</td>
			{visibleCols.map((m) => (
				<td
					key={m.key}
					className={`px-3 py-2 whitespace-nowrap${getBorderLClass(m.key)}`}
				>
					{values[m.key]}
				</td>
			))}
		</tr>
	);
}
