'use client';

import dayjs from 'dayjs';
import { formatCurrency } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

const POPOVER_LABELS = {
	orders: 'Orders',
	netRevenue: 'Net Revenue',
	cogs: 'COGS',
	aov: 'AOV',
	ppcCost: 'Google Ads',
	psCost: 'Meta Ads',
	pinterestCost: 'Pinterest Ads',
	snapchatCost: 'Snapchat Ads',
	bingCost: 'Microsoft (Bing)',
	redditCost: 'Reddit Ads',
	roas: 'ROAS',
	variableExpense: 'Var Exp',
	fixedExpenses: 'Fixed Exp',
	poas: 'POAS',
	netProfit: 'Net Profit',
};

export default function RowComparisonPopover({
	visible,
	position,
	tableWidth,
	hoveredRowTable,
	hoveredRowIndex,
	rows,
	rowsLastYear,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
}) {
	if (!visible || !hoveredRowTable || hoveredRowIndex == null) return null;

	let comparisonRow = null;
	if (hoveredRowTable === 'current' && rows?.[hoveredRowIndex]) {
		const currentRow = rows[hoveredRowIndex];
		const lastYearDate = dayjs(currentRow.date)
			.subtract(1, 'year')
			.format('YYYY-MM-DD');
		comparisonRow = rowsLastYear?.find((r) => r.date === lastYearDate);
	} else if (hoveredRowTable === 'lastYear' && rowsLastYear?.[hoveredRowIndex]) {
		const lastYearRow = rowsLastYear[hoveredRowIndex];
		const currentDate = dayjs(lastYearRow.date).add(1, 'year').format('YYYY-MM-DD');
		comparisonRow = rows?.find((r) => r.date === currentDate);
	}

	// Net Profit = Net Revenue - COGS (matches performance-dashboard)
	const netProfit = comparisonRow
		? comparisonRow.netRevenue - (comparisonRow.cogs || 0)
		: 0;

	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);
	const getCellValue = (key) => {
		if (!comparisonRow) return null;
		switch (key) {
			case 'orders':
				return comparisonRow.orders;
			case 'netRevenue':
				return formatCurrency(comparisonRow.netRevenue ?? 0);
			case 'cogs':
				return formatCurrency(comparisonRow.cogs || 0);
			case 'aov':
				return comparisonRow.aov != null
					? formatCurrency(comparisonRow.aov)
					: '-';
			case 'ppcCost':
				return formatCurrency(comparisonRow.ppcCost);
			case 'psCost':
				return formatCurrency(comparisonRow.psCost);
			case 'pinterestCost':
			case 'snapchatCost':
			case 'bingCost':
			case 'redditCost':
				return formatCurrency(comparisonRow[key] ?? 0);
			case 'roas':
				return comparisonRow.roas != null
					? comparisonRow.roas.toFixed(2)
					: '-';
			case 'variableExpense':
				return formatCurrency(comparisonRow.variableExpense || 0);
			case 'fixedExpenses':
				return formatCurrency(comparisonRow.fixedExpense || 0);
			case 'poas':
				return comparisonRow.poas != null
					? comparisonRow.poas.toFixed(2)
					: '-';
			case 'netProfit':
				return formatCurrency(netProfit);
			default:
				return null;
		}
	};

	const colSpan = visibleCols.length + 1;

	return (
		<div
			className="fixed z-50 pointer-events-none"
			style={{
				top: `${position.top + 20}px`,
				left: `${position.left}px`,
				transform: 'translateX(-50%)',
			}}
		>
			<div
				className="bg-white border border-gray-300 rounded-lg shadow-xl p-4"
				style={{
					width: tableWidth ? `${tableWidth}px` : 'auto',
					minWidth: tableWidth ? `${tableWidth}px` : '500px',
				}}
			>
				<div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white"></div>
				<div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-300"></div>

				<div className="text-xs font-semibold text-gray-700 mb-2">
					{hoveredRowTable === 'current'
						? 'Last Year Period'
						: 'Current Period'}
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full text-xs text-left border-collapse">
						<thead>
							<tr className="bg-gray-50">
								<th className="px-2 py-1 font-semibold text-gray-700">Date</th>
								{visibleCols.map((m) => (
									<th
										key={m.key}
										className="px-2 py-1 font-semibold text-gray-700"
									>
										{POPOVER_LABELS[m.key]}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{!comparisonRow ? (
								<tr>
									<td
										colSpan={colSpan}
										className="px-2 py-2 text-center text-gray-400"
									>
										No corresponding data
									</td>
								</tr>
							) : (
								<tr className="bg-white">
									<td className="px-2 py-2 whitespace-nowrap">
										{comparisonRow.date}
									</td>
									{visibleCols.map((m) => (
										<td
											key={m.key}
											className="px-2 py-2 whitespace-nowrap"
										>
											{getCellValue(m.key)}
										</td>
									))}
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
