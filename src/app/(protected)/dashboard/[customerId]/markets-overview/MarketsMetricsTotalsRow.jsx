'use client';

import { formatCurrency } from '../daily-overview/utils';
import { MARKETS_METRIC_COLUMNS } from './marketsMetricConfig';
import { marketRowLabel } from './MarketsMetricsDataRow';

/**
 * Totals row for markets table — uses store-wide rollup (matches Overview / Daily).
 */
export default function MarketsMetricsTotalsRow({
	storeTotalRow,
	label = 'Store total',
	visibleMetrics = {},
	metricColumns = MARKETS_METRIC_COLUMNS,
}) {
	if (!storeTotalRow) return null;

	const t = storeTotalRow;
	const fixedExpense = t.fixedExpense ?? 0;

	const getCellFor = (key, borderCls) => {
		switch (key) {
			case 'orders':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.orders}
					</td>
				);
			case 'netRevenue':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(t.netRevenue, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'cogs':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(t.cogs || 0, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'discounts':
			case 'returns':
			case 'taxes':
			case 'shippingCharges':
			case 'transactionFee':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(t[key] || 0, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'aov':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.aov != null
							? formatCurrency(t.aov, { maximumFractionDigits: 0 })
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
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(t[key] ?? 0, { maximumFractionDigits: 0 })}
					</td>
				);
			case 'roas':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.roas != null ? t.roas.toFixed(2) : '-'}
					</td>
				);
			case 'variableExpense':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(t.variableExpense || 0, { maximumFractionDigits: 0 })}
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
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{t.poas != null ? t.poas.toFixed(2) : '-'}
					</td>
				);
			case 'netProfit':
				return (
					<td key={key} className={`px-3 py-2 whitespace-nowrap${borderCls}`}>
						{formatCurrency(t.netProfit ?? 0, { maximumFractionDigits: 0 })}
					</td>
				);
			default:
				return null;
		}
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
		<tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
			<td className="px-2 py-2" />
			<td className="px-3 py-2 whitespace-nowrap">{marketRowLabel(t) || label}</td>
			{visibleCols.map((m) => getCellFor(m.key, getBorderLClass(m.key)))}
		</tr>
	);
}
