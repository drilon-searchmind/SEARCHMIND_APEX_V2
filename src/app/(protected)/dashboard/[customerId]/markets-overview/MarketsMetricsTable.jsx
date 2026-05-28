'use client';

import Spinner from '@/components/ui/Spinner';
import { computeRowMax } from '../daily-overview/utils';
import { MARKETS_METRIC_COLUMNS } from './marketsMetricConfig';
import MarketsMetricsTableHeader from './MarketsMetricsTableHeader';
import MarketsMetricsDataRow from './MarketsMetricsDataRow';
import MarketsMetricsTotalsRow from './MarketsMetricsTotalsRow';

export default function MarketsMetricsTable({
	rows,
	storeTotalRow,
	loading,
	error,
	visibleMetrics = {},
	metricColumns = MARKETS_METRIC_COLUMNS,
	hiddenMarkets = {},
	onToggleMarket,
}) {
	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[200px]">
				<Spinner size={40} color="#406969" />
			</div>
		);
	}

	if (error) {
		return <div className="text-red-500 text-center">{error}</div>;
	}

	const allRows = rows || [];
	const includedRows = allRows.filter((r) => hiddenMarkets[r.marketId] !== true);
	const rowsForMax = includedRows.length ? includedRows : allRows;
	const max = rowsForMax.length ? computeRowMax(rowsForMax) : {};
	const visibleCount =
		2 + metricColumns.filter((m) => visibleMetrics[m.key]).length;

	return (
		<div className="overflow-x-auto">
			<table
				className="min-w-full text-xs text-left border-collapse"
				style={{ fontSize: '12px' }}
			>
				<MarketsMetricsTableHeader
					visibleMetrics={visibleMetrics}
					metricColumns={metricColumns}
				/>
				<tbody className="text-[12px]">
					{!rows?.length ? (
						<tr>
							<td
								colSpan={visibleCount}
								className="text-center py-8 text-gray-400"
							>
								No markets with revenue or ad spend in the selected range.
							</td>
						</tr>
					) : (
						<>
							{allRows.map((row, idx) => (
								<MarketsMetricsDataRow
									key={row.marketId || idx}
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
