'use client';

import { computeIndex } from './utils';
import { METRIC_COLUMNS } from './metricConfig';
import {
	dailyCellClass,
	dailyMutedCellClass,
	dailyRowClass,
	getGroupStartFlag,
} from './dailyTableUi';

export default function DailyMetricsIndexRow({
	rows,
	rowsPrev,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
	variant = 'default',
}) {
	if (!rows?.length) return null;

	const indexData = computeIndex(rows, rowsPrev);
	const visibleCols = metricColumns.filter((m) => visibleMetrics[m.key]);

	return (
		<tr className={dailyRowClass(variant, 'index')}>
			<td className={dailyCellClass(variant)}>Index</td>
			{visibleCols.map((m) => {
				const groupStart = getGroupStartFlag(visibleCols, m.key);
				const idxCell = indexData[m.key];
				if (!idxCell || idxCell.index == null) {
					return (
						<td key={m.key} className={dailyMutedCellClass(variant, groupStart)}>
							—
						</td>
					);
				}
				return (
					<td key={m.key} className={dailyCellClass(variant, groupStart)}>
						{idxCell.formatted}
					</td>
				);
			})}
		</tr>
	);
}
