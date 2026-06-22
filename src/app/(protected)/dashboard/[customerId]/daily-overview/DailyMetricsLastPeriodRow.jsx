'use client';

import { computeTotals } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import { dailyCellClass, dailyRowClass, getGroupStartFlag } from './dailyTableUi';

export default function DailyMetricsLastPeriodRow({
	rows,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
	variant = 'default',
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

	return (
		<tr className={dailyRowClass(variant, 'lastPeriod')}>
			<td className={dailyCellClass(variant)}>Last Year Period</td>
			{visibleCols.map((m) => (
				<td
					key={m.key}
					className={dailyCellClass(variant, getGroupStartFlag(visibleCols, m.key))}
				>
					{values[m.key]}
				</td>
			))}
		</tr>
	);
}
