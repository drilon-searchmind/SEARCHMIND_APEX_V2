'use client';

import { computeTotals } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsTotalsRow({
	rows,
	label = 'Total',
	visibleMetrics = {},
}) {
	if (!rows?.length) return null;

	const t = computeTotals(rows);

	const getCellFor = (key, borderCls) => {
		switch (key) {
			case 'orders':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.orders}
					</td>
				);
			case 'totalSales':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.totalSales}
					</td>
				);
			case 'netRevenue':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.netRevenue}
					</td>
				);
			case 'cogs':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.cogs}
					</td>
				);
			case 'aov':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.aov}
					</td>
				);
			case 'ppcCost':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.ppcCost}
					</td>
				);
			case 'psCost':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.psCost}
					</td>
				);
			case 'roas':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.roas}
					</td>
				);
			case 'variableExpense':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.variableExpense}
					</td>
				);
			case 'fixedExpenses':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.fixedExpenses}
					</td>
				);
			case 'poas':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.poas}
					</td>
				);
			case 'netProfit':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.netProfit}
					</td>
				);
			default:
				return null;
		}
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
		<tr className="bg-gray-100 font-semibold border-t border-b border-gray-200">
			<td className="px-3 py-2 whitespace-nowrap">{label}</td>
			{visibleCols.map((m) =>
				getCellFor(m.key, getBorderLClass(m.key))
			)}
		</tr>
	);
}
