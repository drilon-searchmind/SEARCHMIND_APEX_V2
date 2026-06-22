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

	const netProfit = comparisonRow?.netProfit ?? 0;

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
				className="apex-daily-popover relative"
				style={{
					width: tableWidth ? `${tableWidth}px` : 'auto',
					minWidth: tableWidth ? `${tableWidth}px` : '500px',
				}}
			>
				<div className="apex-daily-popover__arrow-border" />
				<div className="apex-daily-popover__arrow" />

				<div className="apex-daily-popover__label">
					{hoveredRowTable === 'current'
						? 'Last Year Period'
						: 'Current Period'}
				</div>
				<div className="overflow-x-auto">
					<table className="apex-daily-popover__table">
						<thead>
							<tr className="apex-daily-popover__head-row">
								<th className="apex-daily-popover__head-cell">Date</th>
								{visibleCols.map((m) => (
									<th key={m.key} className="apex-daily-popover__head-cell">
										{POPOVER_LABELS[m.key]}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{!comparisonRow ? (
								<tr>
									<td colSpan={colSpan} className="apex-daily-popover__empty">
										No corresponding data
									</td>
								</tr>
							) : (
								<tr>
									<td className="apex-daily-popover__cell">
										{comparisonRow.date}
									</td>
									{visibleCols.map((m) => (
										<td key={m.key} className="apex-daily-popover__cell">
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
