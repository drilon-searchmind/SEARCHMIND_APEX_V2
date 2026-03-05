'use client';

import { computeIndex } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsIndexRow({
	rows,
	rowsPrev,
	visibleMetrics = {},
}) {
	if (!rows?.length) return null;

	const indexData = computeIndex(rows, rowsPrev);

	const visibleCols = METRIC_COLUMNS.filter((m) => visibleMetrics[m.key]);
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
		<tr className="bg-slate-50/80 font-medium">
			<td className="px-3 py-2 whitespace-nowrap">Index</td>
			{visibleCols.map((m) => {
				const { index, formatted } = indexData[m.key];
				const borderCls = getBorderLClass(m.key);

				if (index == null) {
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
