'use client';

import { formatCurrency, getCellStyles } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsDataRow({
	row,
	max,
	index,
	tableType,
	onMouseEnter,
	onMouseLeave,
	hasCorrespondingRow,
	visibleMetrics = {},
}) {
	// Net Profit = Net Revenue - COGS (matches performance-dashboard gross_profit formula)
	const netProfit = row.netRevenue - (row.cogs || 0);
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

	const getCellFor = (key) => {
		const borderCls = getBorderLClass(key);
		switch (key) {
			case 'orders':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
						style={getCellStyles(
							row.orders,
							max.orders,
							row.orders === max.orders
						)}
					>
						{row.orders}
					</td>
				);
			case 'totalSales':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
						style={getCellStyles(
							row.totalSales,
							max.totalSales,
							row.totalSales === max.totalSales
						)}
					>
						{formatCurrency(row.totalSales, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'netRevenue':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
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
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(row.cogs || 0, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'aov':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
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
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
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
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
						style={getCellStyles(row.psCost, max.psCost, row.psCost === max.psCost)}
					>
						{formatCurrency(row.psCost, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'roas':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
						style={getCellStyles(row.roas, max.roas, row.roas === max.roas)}
					>
						{row.roas != null ? row.roas.toFixed(2) : '-'}
					</td>
				);
			case 'variableExpense':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
					>
						{formatCurrency(row.variableExpense || 0, {
							maximumFractionDigits: 0,
						})}
					</td>
				);
			case 'fixedExpenses':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(fixedExpense, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'poas':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
						style={getCellStyles(row.poas, max.poas, row.poas === max.poas)}
					>
						{row.poas != null ? row.poas.toFixed(2) : '-'}
					</td>
				);
			case 'netProfit':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(netProfit, { maximumFractionDigits: 0 })}
					</td>
				);
			default:
				return null;
		}
	};

	return (
		<tr
			className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
			{METRIC_COLUMNS.filter((m) => visibleMetrics[m.key]).map((m) =>
				getCellFor(m.key)
			)}
		</tr>
	);
}
