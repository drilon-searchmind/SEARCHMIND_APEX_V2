'use client';

import { computeDifference } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsDifferenceRow({
	rows,
	rowsPrev,
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
}) {
	if (!rows?.length) return null;

	const diff = computeDifference(rows, rowsPrev);

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
		<tr className="bg-amber-50/50 font-medium border-t border-b border-gray-200">
			<td className="px-3 py-2 whitespace-nowrap">Difference</td>
			{visibleCols.map((m) => {
				const borderCls = getBorderLClass(m.key);
				const cell = diff[m.key];
				if (!cell) {
					return (
						<td key={m.key} className={`px-3 py-2 whitespace-nowrap text-gray-500${borderCls}`}>
							—
						</td>
					);
				}
				const { diff: val, formatted } = cell;

				if (val === 0) {
					return (
						<td
							key={m.key}
							className={`px-3 py-2 whitespace-nowrap text-gray-500${borderCls}`}
						>
							—
						</td>
					);
				}

				return (
					<td
						key={m.key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
					>
						{formatted}
					</td>
				);
			})}
		</tr>
	);
}
