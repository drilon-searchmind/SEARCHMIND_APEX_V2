'use client';

import { METRIC_COLUMNS } from './metricConfig';

export default function MetricToggleBar({
	visibleMetrics,
	onToggle,
	showTrendChart = false,
	onTrendChartToggle,
}) {
	return (
		<div className="flex flex-wrap items-center gap-2 mb-4">
			<span className="text-sm text-gray-600 mr-2">Toggle metrics:</span>
			{METRIC_COLUMNS.map((opt) => (
				<button
					key={opt.key}
					type="button"
					className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${
						visibleMetrics[opt.key]
							? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]'
							: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
					}`}
					onClick={() => onToggle(opt.key)}
				>
					{opt.label}
				</button>
			))}
			{onTrendChartToggle && (
				<>
					<span className="text-sm text-gray-400 mx-1">|</span>
					<button
						type="button"
						className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${
							showTrendChart
								? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]'
								: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
						}`}
						onClick={onTrendChartToggle}
					>
						Trend Chart
					</button>
				</>
			)}
		</div>
	);
}
