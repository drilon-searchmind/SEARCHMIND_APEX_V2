'use client';

import dayjs from 'dayjs';
import { POAS_BREAK_EVEN } from '@/lib/poasMetrics';
import { formatCurrency, getCellStyles, computeRowYoYPercentMap } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import {
	dailyCellClass,
	dailyRowClass,
	getGroupStartFlag,
} from './dailyTableUi';

/** "2026-10-09" -> "Fri, 9 Oct" (DESIGN.md · Daily overview); full date stays in the title. */
function formatDayLabel(date) {
	const d = dayjs(String(date).slice(0, 10));
	return d.isValid() ? d.format('ddd, D MMM') : date;
}

function MetricCellContent({ value, yoyPercent }) {
	if (!yoyPercent) {
		return <span className="apex-daily-cell-value">{value}</span>;
	}

	const tone =
		yoyPercent.change > 0
			? 'is-up'
			: yoyPercent.change < 0
				? 'is-down'
				: 'is-neutral';

	return (
		<div className="apex-daily-cell-inner">
			<span className="apex-daily-cell-value">{value}</span>
			<span className={`apex-daily-yoy-pct ${tone}`}>{yoyPercent.formatted}</span>
		</div>
	);
}

export default function DailyMetricsDataRow({
	row,
	yoyRow = null,
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
	const yoyPercentMap = yoyRow ? computeRowYoYPercentMap(row, yoyRow) : null;

	const handleMouseEnter = (e) => {
		if (!hasCorrespondingRow) return;
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
	};

	const handleMouseLeave = () => {
		onMouseLeave?.();
	};

	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);

	const getCellFor = (key) => {
		const borderStart = getGroupStartFlag(visibleCols, key);
		const cls = dailyCellClass(variant, borderStart);
		const yoyPercent = yoyPercentMap?.[key] ?? null;

		switch (key) {
			case 'orders':
				return (
					<td
						key={key}
						className={cls}
					>
						<MetricCellContent value={row.orders} yoyPercent={yoyPercent} />
					</td>
				);
			case 'netRevenue':
				return (
					<td
						key={key}
						className={cls}
					>
						<MetricCellContent
							value={formatCurrency(row.netRevenue, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'cogs':
				return (
					<td key={key} className={cls}>
						<MetricCellContent
							value={formatCurrency(row.cogs || 0, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'aov':
				return (
					<td
						key={key}
						className={cls}
					>
						<MetricCellContent
							value={
								row.aov != null
									? formatCurrency(row.aov, { maximumFractionDigits: 0 })
									: '-'
							}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'ppcCost':
				return (
					<td
						key={key}
						className={cls}
					>
						<MetricCellContent
							value={formatCurrency(row.ppcCost, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'psCost':
				return (
					<td
						key={key}
						className={cls}
					>
						<MetricCellContent
							value={formatCurrency(row.psCost, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
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
					>
						<MetricCellContent
							value={formatCurrency(row[key] ?? 0, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'roas':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(row.roas, max.roas, row.roas === max.roas, { min: max.roasMin })}
					>
						<MetricCellContent
							value={row.roas != null ? row.roas.toFixed(2) : '-'}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'variableExpense':
				return (
					<td key={key} className={cls}>
						<MetricCellContent
							value={formatCurrency(row.variableExpense || 0, {
								maximumFractionDigits: 0,
							})}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'fixedExpenses':
				return (
					<td key={key} className={cls}>
						<MetricCellContent
							value={formatCurrency(fixedExpense, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'poas':
				return (
					<td
						key={key}
						className={cls}
						style={getCellStyles(row.poas, max.poas, row.poas === max.poas, {
							min: max.poasMin,
							breakEven: POAS_BREAK_EVEN,
						})}
					>
						<MetricCellContent
							value={row.poas != null ? row.poas.toFixed(2) : '-'}
							yoyPercent={yoyPercent}
						/>
					</td>
				);
			case 'netProfit':
				return (
					<td key={key} className={cls}>
						<MetricCellContent
							value={formatCurrency(netProfit, { maximumFractionDigits: 0 })}
							yoyPercent={yoyPercent}
						/>
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
			<td className={dailyCellClass(variant)} title={String(row.date).slice(0, 10)}>
				{formatDayLabel(row.date)}
			</td>
			{visibleCols.map((m) => getCellFor(m.key))}
		</tr>
	);
}
