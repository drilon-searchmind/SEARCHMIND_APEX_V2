'use client';

import dayjs from 'dayjs';
import CobaltLoader from '@/components/ui/CobaltLoader';
import DailyMetricsTableHeader from './DailyMetricsTableHeader';
import DailyMetricsDataRow from './DailyMetricsDataRow';
import DailyMetricsTotalsRow from './DailyMetricsTotalsRow';
import DailyMetricsLastPeriodRow from './DailyMetricsLastPeriodRow';
import DailyMetricsDifferenceRow from './DailyMetricsDifferenceRow';
import DailyMetricsIndexRow from './DailyMetricsIndexRow';
import { alignLastYearRowsToCurrentPeriod, computeRowMax } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import {
	dailyEmptyCellClass,
	dailyTableClass,
	dailyTableStyle,
	dailyTableWrapClass,
	isCobaltDaily,
} from './dailyTableUi';

export default function DailyMetricsTable({
	rows,
	rowsPrev,
	rowsLastYear,
	loading,
	error,
	onRowHover,
	onRowHoverLeave,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
	variant = 'default',
}) {
	if (loading) {
		return isCobaltDaily(variant) ? (
			<div className="apex-daily-loading">
				<CobaltLoader
					variant="block"
					title="Loading daily metrics"
					request="GET /api/merged-sources?source=daily-overview"
				/>
			</div>
		) : (
			<div className="flex justify-center items-center min-h-[200px]">
				<div className="text-sm text-gray-500">Loading…</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={isCobaltDaily(variant) ? 'apex-daily-error' : 'text-red-500 text-center'}>
				{error}
			</div>
		);
	}

	const max = rows?.length ? computeRowMax(rows) : {};
	const rowsLastYearAligned = alignLastYearRowsToCurrentPeriod(rows, rowsLastYear);
	const visibleCount =
		1 + metricColumns.filter((m) => visibleMetrics[m.key]).length;

	return (
		<div className={dailyTableWrapClass(variant)}>
			<table className={dailyTableClass(variant)} style={dailyTableStyle(variant)}>
				<DailyMetricsTableHeader
					variant={variant}
					visibleMetrics={visibleMetrics}
					metricColumns={metricColumns}
				/>
				<tbody className={isCobaltDaily(variant) ? undefined : 'text-[12px]'}>
					{!rows?.length ? (
						<tr>
							<td colSpan={visibleCount} className={dailyEmptyCellClass(variant)}>
								No data for selected range.
							</td>
						</tr>
					) : (
						<>
							{rows.map((row, idx) => {
								const lastYearDate = dayjs(row.date)
									.subtract(1, 'year')
									.format('YYYY-MM-DD');
								const correspondingLastYearRow = rowsLastYear?.find(
									(r) => r.date === lastYearDate
								);

								return (
									<DailyMetricsDataRow
										key={idx}
										variant={variant}
										row={row}
										max={max}
										index={idx}
										tableType="current"
										hasCorrespondingRow={!!correspondingLastYearRow}
										visibleMetrics={visibleMetrics}
										metricColumns={metricColumns}
										onMouseEnter={onRowHover}
										onMouseLeave={onRowHoverLeave}
									/>
								);
							})}
							<DailyMetricsTotalsRow
								variant={variant}
								rows={rows}
								label="Total"
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							<DailyMetricsLastPeriodRow
								variant={variant}
								rows={rowsLastYearAligned}
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							<DailyMetricsIndexRow
								variant={variant}
								rows={rows}
								rowsPrev={rowsLastYearAligned}
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							<DailyMetricsDifferenceRow
								variant={variant}
								rows={rows}
								rowsPrev={rowsLastYearAligned}
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
