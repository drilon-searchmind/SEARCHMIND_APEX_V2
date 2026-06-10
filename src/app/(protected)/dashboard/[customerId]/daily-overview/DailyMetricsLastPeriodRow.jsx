'use client';

import { computeTotals } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsLastPeriodRow({
	rows,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
}) {
	if (!rows?.length) return null;

	const t = computeTotals(rows);

	const values = {
		orders: t.orders,
		netRevenue: t.netRevenue,
		cogs: t.cogs,
		aov: t.aov,
		ppcCost: t.ppcCost,
		psCost: t.psCost,
		pinterestCost: t.pinterestCost,
		snapchatCost: t.snapchatCost,
		bingCost: t.bingCost,
		redditCost: t.redditCost,
		roas: t.roas,
		variableExpense: t.variableExpense,
		fixedExpenses: t.fixedExpenses,
		poas: t.poas,
		netProfit: t.netProfit,
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
