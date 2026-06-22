'use client';

import { formatCurrency } from '../daily-overview/utils';
import { MARKETS_METRIC_COLUMNS } from './marketsMetricConfig';
import { marketRowLabel } from './MarketsMetricsDataRow';
import {
    getGroupStartFlag,
    isCobaltMarkets,
    marketsCellClass,
    marketsRowClass,
} from './marketsTableUi';

export default function MarketsMetricsTotalsRow({
    storeTotalRow,
    label = 'Store total',
    visibleMetrics = {},
    metricColumns = MARKETS_METRIC_COLUMNS,
    variant = 'default',
}) {
    if (!storeTotalRow) return null;

    const isCobalt = isCobaltMarkets(variant);
    const t = storeTotalRow;
    const fixedExpense = t.fixedExpense ?? 0;
    const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);

    const getBorderLClass = (key) => {
        if (isCobalt) {
            return getGroupStartFlag(visibleCols, key, 'sales');
        }
        const idx = visibleCols.findIndex((m) => m.key === key);
        const col = visibleCols[idx];
        if (!col || idx < 0) return false;
        const prevInGroup = visibleCols.slice(0, idx).filter((p) => p.group === col.group);
        const isFirst = idx === 0;
        const isFirstInGroup = prevInGroup.length === 0;
        return isFirst || (isFirstInGroup && col.group !== 'sales');
    };

    const legacyBorderCls = (key) => (getBorderLClass(key) ? ' border-l border-gray-200' : '');

    const getCellFor = (key) => {
        const groupStart = getBorderLClass(key);
        const borderCls = isCobalt ? groupStart : legacyBorderCls(key);
        const cellClass = isCobalt ? marketsCellClass(variant, groupStart) : `px-3 py-2 whitespace-nowrap${borderCls}`;

        switch (key) {
            case 'orders':
                return (
                    <td key={key} className={cellClass}>
                        {t.orders}
                    </td>
                );
            case 'netRevenue':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(t.netRevenue, { maximumFractionDigits: 0 })}
                    </td>
                );
            case 'cogs':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(t.cogs || 0, { maximumFractionDigits: 0 })}
                    </td>
                );
            case 'discounts':
            case 'returns':
            case 'taxes':
            case 'shippingCharges':
            case 'transactionFee':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(t[key] || 0, { maximumFractionDigits: 0 })}
                    </td>
                );
            case 'aov':
                return (
                    <td key={key} className={cellClass}>
                        {t.aov != null
                            ? formatCurrency(t.aov, { maximumFractionDigits: 0 })
                            : '—'}
                    </td>
                );
            case 'ppcCost':
            case 'psCost':
            case 'pinterestCost':
            case 'snapchatCost':
            case 'bingCost':
            case 'redditCost':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(t[key] ?? 0, { maximumFractionDigits: 0 })}
                    </td>
                );
            case 'roas':
                return (
                    <td key={key} className={cellClass}>
                        {t.roas != null ? t.roas.toFixed(2) : '—'}
                    </td>
                );
            case 'variableExpense':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(t.variableExpense || 0, { maximumFractionDigits: 0 })}
                    </td>
                );
            case 'fixedExpenses':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(fixedExpense, { maximumFractionDigits: 0 })}
                    </td>
                );
            case 'poas':
                return (
                    <td key={key} className={cellClass}>
                        {t.poas != null ? t.poas.toFixed(2) : '—'}
                    </td>
                );
            case 'netProfit':
                return (
                    <td key={key} className={cellClass}>
                        {formatCurrency(t.netProfit ?? 0, { maximumFractionDigits: 0 })}
                    </td>
                );
            default:
                return null;
        }
    };

    return (
        <tr className={isCobalt ? marketsRowClass(variant, 'total') : 'bg-gray-100 font-semibold border-t-2 border-gray-300'}>
            <td className={isCobalt ? 'apex-markets-table__cell-include' : 'px-2 py-2'} />
            <td className={isCobalt ? 'apex-markets-table__cell-market' : 'px-3 py-2 whitespace-nowrap'}>
                {marketRowLabel(t) || label}
            </td>
            {visibleCols.map((m) => getCellFor(m.key))}
        </tr>
    );
}
