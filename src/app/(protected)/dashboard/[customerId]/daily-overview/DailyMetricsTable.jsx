'use client';

import dayjs from 'dayjs';
import Spinner from '@/components/ui/Spinner';
import DailyMetricsTableHeader from './DailyMetricsTableHeader';
import DailyMetricsDataRow from './DailyMetricsDataRow';
import DailyMetricsTotalsRow from './DailyMetricsTotalsRow';
import DailyMetricsLastPeriodRow from './DailyMetricsLastPeriodRow';
import DailyMetricsDifferenceRow from './DailyMetricsDifferenceRow';
import DailyMetricsIndexRow from './DailyMetricsIndexRow';
import { computeRowMax } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

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

	const max = rows?.length ? computeRowMax(rows) : {};
	const visibleCount =
		1 + metricColumns.filter((m) => visibleMetrics[m.key]).length;

	return (
		<div className="overflow-x-auto">
			<table
				className="min-w-full text-xs text-left border-collapse"
				style={{ fontSize: '12px' }}
			>
				<DailyMetricsTableHeader visibleMetrics={visibleMetrics} metricColumns={metricColumns} />
				<tbody className="text-[12px]">
					{!rows?.length ? (
						<tr>
							<td
								colSpan={visibleCount}
								className="text-center py-8 text-gray-400"
							>
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
										row={row}
										max={max}
										index={idx}
										tableType="current"
										hasCorrespondingRow={!!correspondingLastYearRow}
										visibleMetrics={visibleMetrics}
										onMouseEnter={onRowHover}
										onMouseLeave={onRowHoverLeave}
									/>
								);
							})}
							<DailyMetricsTotalsRow
								rows={rows}
								label="Total"
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							<DailyMetricsLastPeriodRow
								rows={rowsPrev}
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							<DailyMetricsIndexRow
								rows={rows}
								rowsPrev={rowsPrev}
								visibleMetrics={visibleMetrics}
								metricColumns={metricColumns}
							/>
							<DailyMetricsDifferenceRow
								rows={rows}
								rowsPrev={rowsPrev}
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
