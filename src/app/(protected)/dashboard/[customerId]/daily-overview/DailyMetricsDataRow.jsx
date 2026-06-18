'use client';

import { POAS_BREAK_EVEN } from '@/lib/poasMetrics';
import { formatCurrency, getCellStyles } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import {
	dailyCellClass,
	dailyRowClass,
	getGroupStartFlag,
} from './dailyTableUi';

export default function DailyMetricsDataRow({
	row,
	max,
	index,
	tableType,
	onMouseEnter,
	onMouseLeave,
	hasCorrespondingRow,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
	variant = 'default',
}) {
	const netProfit = row.netProfit ?? 0;
	const fixedExpense = row.fixedExpense ?? 0;

	const handleMouseEnter = (e) => {
		if (hasCorrespondingRow) {
			const rect = e.currentTarget.getBoundingClientRect();
			const table = e.currentTarget.closest('table');
			const tableRect = table?.getBoundingClientRect();
			onMouseEnter?.({
				index,
				tableType,
				position: {
					top: rect.top + rect.height / 2,
					left: rect.left + rect.width / 2,
				},
				tableWidth: tableRect?.width || null,
			});
		}
	};

	const handleMouseLeave = () => {
		onMouseLeave?.();
	};

	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);

	const getCellFor = (key) => {
		const borderStart = getGroupStartFlag(visibleCols, key);
		const cls = dailyCellClass(variant, borderStart);
		switch (key) {
			case 'orders':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(
							row.orders,
							max.orders,
							row.orders === max.orders
						)}
					>
						{row.orders}
					</td>
				);
			case 'netRevenue':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(
							row.netRevenue,
							max.netRevenue,
							row.netRevenue === max.netRevenue
						)}
					>
						{formatCurrency(row.netRevenue, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'cogs':
				return (
					<td key={key} className={cls}>
						{formatCurrency(row.cogs || 0, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'aov':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(row.aov, max.aov, row.aov === max.aov)}
					>
						{row.aov != null
							? formatCurrency(row.aov, { maximumFractionDigits: 0 })
							: '-'}
					</td>
				);
			case 'ppcCost':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(
							row.ppcCost,
							max.ppcCost,
							row.ppcCost === max.ppcCost
						)}
					>
						{formatCurrency(row.ppcCost, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'psCost':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(row.psCost, max.psCost, row.psCost === max.psCost)}
					>
						{formatCurrency(row.psCost, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'pinterestCost':
			case 'snapchatCost':
			case 'bingCost':
			case 'redditCost':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(
							row[key] ?? 0,
							max[key] ?? 0,
							row[key] === max[key]
						)}
					>
						{formatCurrency(row[key] ?? 0, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'roas':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(row.roas, max.roas, row.roas === max.roas)}
					>
						{row.roas != null ? row.roas.toFixed(2) : '-'}
					</td>
				);
			case 'variableExpense':
				return (
					<td key={key} className={cls}>
						{formatCurrency(row.variableExpense || 0, {
							maximumFractionDigits: 0,
						})}
					</td>
				);
			case 'fixedExpenses':
				return (
					<td key={key} className={cls}>
						{formatCurrency(fixedExpense, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'poas':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(row.poas, max.poas, row.poas === max.poas, {
							breakEven: POAS_BREAK_EVEN,
						})}
					>
						{row.poas != null ? row.poas.toFixed(2) : '-'}
					</td>
				);
			case 'netProfit':
				return (
					<td key={key} className={cls}>
						{formatCurrency(netProfit, { maximumFractionDigits: 0 })}
					</td>
				);
			default:
				return null;
		}
	};

	return (
		<tr
			className={dailyRowClass(variant, 'data', index)}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<td className={dailyCellClass(variant)}>{row.date}</td>
			{visibleCols.map((m) => getCellFor(m.key))}
		</tr>
	);
}
