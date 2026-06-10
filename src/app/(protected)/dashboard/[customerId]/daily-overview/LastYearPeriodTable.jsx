'use client';

import dayjs from 'dayjs';
import Spinner from '@/components/ui/Spinner';
import DailyMetricsTableHeader from './DailyMetricsTableHeader';
import DailyMetricsDataRow from './DailyMetricsDataRow';
import DailyMetricsTotalsRow from './DailyMetricsTotalsRow';
import { computeRowMax } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function LastYearPeriodTable({
	rowsLastYear,
	rows,
	loading,
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

	const max = rowsLastYear?.length ? computeRowMax(rowsLastYear) : {};
	const visibleCount =
		1 + metricColumns.filter((m) => visibleMetrics[m.key]).length;

	return (
		<div className="overflow-x-auto">
			<table
				className="min-w-full text-xs text-left border-collapse"
				style={{ fontSize: '12px' }}
			>
				<DailyMetricsTableHeader
					variant="lastYear"
					visibleMetrics={visibleMetrics}
					metricColumns={metricColumns}
				/>
				<tbody className="text-[12px]">
					{!rowsLastYear?.length ? (
						<tr>
							<td
								colSpan={visibleCount}
								className="text-center py-8 text-gray-400"
							>
								No data for last year period.
							</td>
						</tr>
					) : (
						<>
							<DailyMetricsTotalsRow
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
