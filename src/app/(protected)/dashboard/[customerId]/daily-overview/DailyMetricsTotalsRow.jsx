'use client';

import { computeTotals } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import { dailyCellClass, dailyRowClass, getGroupStartFlag } from './dailyTableUi';

export default function DailyMetricsTotalsRow({
	rows,
	label = 'Total',
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
	variant = 'default',
}) {
	if (!rows?.length) return null;

	const t = computeTotals(rows);
	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);

	const getCellFor = (key) => {
		const cls = dailyCellClass(variant, getGroupStartFlag(visibleCols, key));
		switch (key) {
			case 'orders':
				return <td key={key} className={cls}>{t.orders}</td>;
			case 'netRevenue':
				return <td key={key} className={cls}>{t.netRevenue}</td>;
			case 'cogs':
				return <td key={key} className={cls}>{t.cogs}</td>;
			case 'aov':
				return <td key={key} className={cls}>{t.aov}</td>;
			case 'ppcCost':
				return <td key={key} className={cls}>{t.ppcCost}</td>;
			case 'psCost':
				return <td key={key} className={cls}>{t.psCost}</td>;
			case 'pinterestCost':
			case 'snapchatCost':
			case 'bingCost':
			case 'redditCost':
				return <td key={key} className={cls}>{t[key]}</td>;
			case 'roas':
				return <td key={key} className={cls}>{t.roas}</td>;
			case 'variableExpense':
				return <td key={key} className={cls}>{t.variableExpense}</td>;
			case 'fixedExpenses':
				return <td key={key} className={cls}>{t.fixedExpenses}</td>;
			case 'poas':
				return <td key={key} className={cls}>{t.poas}</td>;
			case 'netProfit':
				return <td key={key} className={cls}>{t.netProfit}</td>;
			default:
				return null;
		}
	};

	return (
		<tr className={dailyRowClass(variant, 'total')}>
			<td className={dailyCellClass(variant)}>{label}</td>
			{visibleCols.map((m) => getCellFor(m.key))}
		</tr>
	);
}
