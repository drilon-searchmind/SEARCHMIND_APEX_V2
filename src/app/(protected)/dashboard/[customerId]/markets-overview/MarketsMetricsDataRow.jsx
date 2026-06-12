'use client';

import { formatCurrency, getCellStyles } from '../daily-overview/utils';
import { POAS_BREAK_EVEN } from '@/lib/poasMetrics';
import { MARKETS_METRIC_COLUMNS } from './marketsMetricConfig';

export function marketRowLabel(row) {
    if (row.isStoreTotal) return 'Store total';
    if (row.isUnassigned) return 'Unassigned';
    return row.marketName || row.marketId || '—';
}

export default function MarketsMetricsDataRow({
	row,
	max,
	index,
	visibleMetrics = {},
	metricColumns = MARKETS_METRIC_COLUMNS,
	included = true,
	onToggleIncluded,
}) {
	const fixedExpense = row.fixedExpense ?? 0;
	const netProfit = row.netProfit ?? 0;
	const isSpecial = row.isStoreTotal || row.isUnassigned;

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
			case 'discounts':
			case 'returns':
			case 'taxes':
			case 'shippingCharges':
			case 'transactionFee':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(row[key] || 0, { maximumFractionDigits: 0 })}
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
			case 'psCost':
			case 'pinterestCost':
			case 'snapchatCost':
			case 'bingCost':
			case 'redditCost':
				return (
					<td
						key={key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
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
						style={getCellStyles(row.poas, max.poas, row.poas === max.poas, {
							breakEven: POAS_BREAK_EVEN,
						})}
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
			className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
				!included ? 'opacity-40' : ''
			} ${isSpecial ? 'font-semibold' : ''}`}
		>
			<td className="px-2 py-2 w-10 text-center align-middle">
				{!isSpecial && onToggleIncluded ? (
					<input
						type="checkbox"
						className="rounded border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
						checked={included}
						onChange={(e) => onToggleIncluded(row.marketId, e.target.checked)}
						aria-label={`Include ${marketRowLabel(row)}`}
					/>
				) : null}
			</td>
			<td className="px-3 py-2 whitespace-nowrap font-medium">
				{marketRowLabel(row)}
			</td>
			{metricColumns
				.filter((m) => visibleMetrics[m.key])
				.map((m) => getCellFor(m.key))}
		</tr>
	);
}
