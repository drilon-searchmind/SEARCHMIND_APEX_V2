'use client';

function countVisibleInGroup(metricColumns, visibleMetrics, group) {
	return metricColumns.filter((m) => m.group === group && visibleMetrics[m.key]).length;
}

export default function MarketsMetricsTableHeader({
	visibleMetrics = {},
	metricColumns = [],
}) {
	const salesCount = countVisibleInGroup(metricColumns, visibleMetrics, 'sales');
	const marketingCount = countVisibleInGroup(metricColumns, visibleMetrics, 'marketing');
	const resultCount = countVisibleInGroup(metricColumns, visibleMetrics, 'result');

	const showSales = salesCount > 0;
	const showMarketing = marketingCount > 0;
	const showResult = resultCount > 0;

	return (
		<thead className="bg-gray-50 text-gray-700">
			<tr>
				<th
					rowSpan={2}
					className="px-2 py-2 w-10 border-b border-gray-200"
					aria-label="Include market"
				/>
				<th
					rowSpan={2}
					className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-gray-200"
				>
					Market
				</th>
				{showSales && (
					<th
						colSpan={salesCount}
						className="px-3 py-2 text-center font-semibold border-b border-l border-gray-200"
					>
						Sales
					</th>
				)}
				{showMarketing && (
					<th
						colSpan={marketingCount}
						className="px-3 py-2 text-center font-semibold border-b border-l border-gray-200"
					>
						Marketing
					</th>
				)}
				{showResult && (
					<th
						colSpan={resultCount}
						className="px-3 py-2 text-center font-semibold border-b border-l border-gray-200"
					>
						Result
					</th>
				)}
			</tr>
			<tr>
				{metricColumns.map((m) => {
					if (!visibleMetrics[m.key]) return null;
					const visibleCols = metricColumns.filter((c) => visibleMetrics[c.key]);
					const idx = visibleCols.findIndex((c) => c.key === m.key);
					const prevInGroup = visibleCols
						.slice(0, idx)
						.filter((p) => p.group === m.group);
					const isFirst = idx === 0;
					const isFirstInGroup = prevInGroup.length === 0;
					const borderCls =
						isFirst || (isFirstInGroup && m.group !== 'sales')
							? ' border-l border-gray-200'
							: '';

					return (
						<th
							key={m.key}
							className={`px-3 py-2 text-left font-medium whitespace-nowrap border-b border-gray-200${borderCls}`}
						>
							{m.label}
						</th>
					);
				})}
			</tr>
		</thead>
	);
}
