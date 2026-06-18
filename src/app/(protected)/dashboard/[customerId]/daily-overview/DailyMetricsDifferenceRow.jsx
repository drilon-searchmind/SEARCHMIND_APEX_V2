'use client';

import { computeDifference } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import {
	dailyCellClass,
	dailyMutedCellClass,
	dailyRowClass,
	getGroupStartFlag,
} from './dailyTableUi';

export default function DailyMetricsDifferenceRow({
	rows,
	rowsPrev,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
	variant = 'default',
}) {
	if (!rows?.length) return null;

	const diff = computeDifference(rows, rowsPrev);
	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);

	return (
		<tr className={dailyRowClass(variant, 'difference')}>
			<td className={dailyCellClass(variant)}>Difference</td>
			{visibleCols.map((m) => {
				const groupStart = getGroupStartFlag(visibleCols, m.key);
				const cell = diff[m.key];
				if (!cell || cell.diff === 0) {
					return (
						<td key={m.key} className={dailyMutedCellClass(variant, groupStart)}>
							—
						</td>
					);
				}
				return (
					<td key={m.key} className={dailyCellClass(variant, groupStart)}>
						{cell.formatted}
					</td>
				);
			})}
		</tr>
	);
}
