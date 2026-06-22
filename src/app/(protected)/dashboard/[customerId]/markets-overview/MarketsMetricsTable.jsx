'use client';

import CobaltLoader from '@/components/ui/CobaltLoader';
import { computeRowMax } from '../daily-overview/utils';
import { MARKETS_METRIC_COLUMNS } from './marketsMetricConfig';
import MarketsMetricsTableHeader from './MarketsMetricsTableHeader';
import MarketsMetricsDataRow from './MarketsMetricsDataRow';
import MarketsMetricsTotalsRow from './MarketsMetricsTotalsRow';
import {
    isCobaltMarkets,
    marketsEmptyCellClass,
    marketsTableClass,
    marketsTableStyle,
    marketsTableWrapClass,
} from './marketsTableUi';

export default function MarketsMetricsTable({
    rows,
    storeTotalRow,
    loading,
    error,
    visibleMetrics = {},
    metricColumns = MARKETS_METRIC_COLUMNS,
    hiddenMarkets = {},
    onToggleMarket,
    variant = 'default',
}) {
    const isCobalt = isCobaltMarkets(variant);

    if (loading) {
        return isCobalt ? (
            <div className="apex-markets-loader-panel">
                <CobaltLoader variant="block" title="Loading market metrics" />
            </div>
        ) : (
            <div className="flex justify-center items-center min-h-[200px]">
                <div className="text-sm text-gray-500">Loading…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={isCobalt ? 'apex-daily-error' : 'text-red-500 text-center'} role="alert">
                {error}
            </div>
        );
    }

    const allRows = rows || [];
    const includedRows = allRows.filter((r) => hiddenMarkets[r.marketId] !== true);
    const rowsForMax = includedRows.length ? includedRows : allRows;
    const max = rowsForMax.length ? computeRowMax(rowsForMax) : {};
    const visibleCount = 2 + metricColumns.filter((m) => visibleMetrics[m.key]).length;

    return (
        <div className={marketsTableWrapClass(variant)}>
            <table className={marketsTableClass(variant)} style={marketsTableStyle(variant)}>
                <MarketsMetricsTableHeader
                    variant={variant}
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumns}
                />
                <tbody className={isCobalt ? undefined : 'text-[12px]'}>
                    {!rows?.length ? (
                        <tr>
                            <td colSpan={visibleCount} className={marketsEmptyCellClass(variant)}>
                                No markets with revenue or ad spend in the selected range.
                            </td>
                        </tr>
                    ) : (
                        <>
                            {allRows.map((row, idx) => (
                                <MarketsMetricsDataRow
                                    key={row.marketId || idx}
                                    variant={variant}
                                    row={row}
                                    max={max}
                                    index={idx}
                                    visibleMetrics={visibleMetrics}
                                    metricColumns={metricColumns}
                                    included={hiddenMarkets[row.marketId] !== true}
                                    onToggleIncluded={onToggleMarket}
                                />
                            ))}
                            <MarketsMetricsTotalsRow
                                variant={variant}
                                storeTotalRow={storeTotalRow}
                                visibleMetrics={visibleMetrics}
                                metricColumns={metricColumns}
                            />
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
}
