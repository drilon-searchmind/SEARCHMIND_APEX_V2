'use client';

import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { computeDifference } from './utils';
import { METRIC_COLUMNS } from './metricConfig';

export default function DailyMetricsDifferenceRow({
	rows,
	rowsPrev,
	visibleMetrics = {},
}) {
	if (!rows?.length) return null;

	const diff = computeDifference(rows, rowsPrev);

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
		<tr className="bg-amber-50/50 font-medium">
			<td className="px-3 py-2 whitespace-nowrap">Difference</td>
			{visibleCols.map((m) => {
				const { diff: val, formatted, isGood } = diff[m.key];
				const borderCls = getBorderLClass(m.key);

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

				const iconColorClass =
					isGood === true
						? 'text-green-600'
						: isGood === false
							? 'text-red-600'
							: 'text-gray-500';
				const Icon = val > 0 ? FiArrowUp : FiArrowDown;

				return (
					<td
						key={m.key}
						className={`px-3 py-2 whitespace-nowrap${borderCls}`}
					>
						<span className="inline-flex items-center gap-1">
							{formatted}
							<Icon className={`text-sm shrink-0 ${iconColorClass}`} />
						</span>
					</td>
				);
			})}
		</tr>
	);
}
