'use client';

import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsLastPeriodRow({
	rows,
	visibleMetrics = {},
}) {
	if (!rows?.length) return null;

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
	const fixedExpenses = 0;
	const netProfit =
		totalRevenueExTax - totalCogs - totalVariableExpense - fixedExpenses;

	const formatCurrency = (val, decimals = 0) =>
		val.toLocaleString('da-DK', {
			style: 'currency',
			currency: 'DKK',
			maximumFractionDigits: decimals,
			minimumFractionDigits: decimals,
		});

	const values = {
		orders: totalOrders,
		totalSales: formatCurrency(totalRevenue, 0),
		netRevenue: formatCurrency(totalRevenueExTax, 0),
		cogs: formatCurrency(totalCogs, 0),
		aov: totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders, 0) : '-',
		ppcCost: formatCurrency(totalPpcCost, 0),
		psCost: formatCurrency(totalPsCost, 0),
		roas: totalCost > 0 ? (totalRevenueExTax / totalCost).toFixed(2) : '-',
		variableExpense: formatCurrency(totalVariableExpense, 0),
		fixedExpenses: formatCurrency(fixedExpenses, 0),
		poas: totalCost > 0 ? (grossProfit / totalCost).toFixed(2) : '-',
		netProfit: formatCurrency(netProfit, 0),
	};

	const visibleCols = METRIC_COLUMNS.filter((m) => visibleMetrics[m.key]);
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
		<tr className="bg-gray-50 font-semibold">
			<td className="px-3 py-2 whitespace-nowrap">Last Period</td>
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
