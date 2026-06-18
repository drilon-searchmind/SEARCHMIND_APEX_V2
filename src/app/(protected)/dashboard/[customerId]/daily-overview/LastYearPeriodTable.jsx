'use client';

import dayjs from 'dayjs';
import CobaltLoader from '@/components/ui/CobaltLoader';
import DailyMetricsTableHeader from './DailyMetricsTableHeader';
import DailyMetricsDataRow from './DailyMetricsDataRow';
import DailyMetricsTotalsRow from './DailyMetricsTotalsRow';
import { computeRowMax } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import {
	dailyEmptyCellClass,
	dailyTableClass,
	dailyTableStyle,
	dailyTableWrapClass,
	isCobaltDaily,
} from './dailyTableUi';

export default function LastYearPeriodTable({
	rowsLastYear,
	rows,
	loading,
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
					title="Loading last year period"
					request="GET /api/merged-sources?source=daily-overview"
				/>
			</div>
		) : (
			<div className="flex justify-center items-center min-h-[200px]">
				<div className="text-sm text-gray-500">Loading…</div>
			</div>
		);
	}

	const max = rowsLastYear?.length ? computeRowMax(rowsLastYear) : {};
	const visibleCount =
		1 + metricColumns.filter((m) => visibleMetrics[m.key]).length;

	return (
		<div className={dailyTableWrapClass(variant)}>
			<table className={dailyTableClass(variant)} style={dailyTableStyle(variant)}>
				<DailyMetricsTableHeader
					variant={variant === 'cobalt' ? 'cobalt' : 'lastYear'}
					visibleMetrics={visibleMetrics}
					metricColumns={metricColumns}
				/>
				<tbody className={isCobaltDaily(variant) ? undefined : 'text-[12px]'}>
					{!rowsLastYear?.length ? (
						<tr>
							<td colSpan={visibleCount} className={dailyEmptyCellClass(variant)}>
								No data for last year period.
							</td>
						</tr>
					) : (
						<>
							<DailyMetricsTotalsRow
								variant={variant}
								rows={rowsLastYear}
								label="Total"
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							{rowsLastYear.map((row, idx) => {
								const currentDate = dayjs(row.date)
									.add(1, 'year')
									.format('YYYY-MM-DD');
								const correspondingCurrentRow = rows?.find(
									(r) => r.date === currentDate
								);

								return (
									<DailyMetricsDataRow
										key={idx}
										variant={variant}
										row={row}
										max={max}
										index={idx}
										tableType="lastYear"
										hasCorrespondingRow={!!correspondingCurrentRow}
										visibleMetrics={visibleMetrics}
										metricColumns={metricColumns}
										onMouseEnter={onRowHover}
										onMouseLeave={onRowHoverLeave}
									/>
								);
							})}
						</>
					)}
				</tbody>
			</table>
		</div>
	);
}
