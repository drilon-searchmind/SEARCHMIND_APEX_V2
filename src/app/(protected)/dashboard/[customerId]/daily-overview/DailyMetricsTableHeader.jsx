import { METRIC_COLUMNS } from './metricConfig';

function countVisibleInGroup(visibleMetrics, group) {
	return METRIC_COLUMNS.filter((m) => m.group === group && visibleMetrics[m.key])
		.length;
}

export default function DailyMetricsTableHeader({
	variant = 'default',
	visibleMetrics = {},
}) {
	const headerBg = variant === 'lastYear' ? 'bg-gray-100' : 'bg-gray-50';

	const salesCount = countVisibleInGroup(visibleMetrics, 'sales');
	const marketingCount = countVisibleInGroup(visibleMetrics, 'marketing');
	const resultCount = countVisibleInGroup(visibleMetrics, 'result');

	const showSales = salesCount > 0;
	const showMarketing = marketingCount > 0;
	const showResult = resultCount > 0;
	const showGroupRow = showSales || showMarketing || showResult;

	return (
		<thead>
			{showGroupRow && (
				<tr className="bg-gray-200">
					<th
						className="px-3 py-1.5 font-semibold text-gray-200 bg-black"
						rowSpan={2}
					>
						Date
					</th>
					{showSales && (
						<th
							className="px-3 py-1.5 font-semibold text-gray-200 text-center border-l border-gray-300 bg-[#1e2b2b]"
							colSpan={salesCount}
						>
							Sales
						</th>
					)}
					{showMarketing && (
						<th
							className="px-3 py-1.5 font-semibold text-gray-200 text-center border-l border-gray-300 bg-[#3b5252]"
							colSpan={marketingCount}
						>
							Marketing
						</th>
					)}
					{showResult && (
						<th
							className="px-3 py-1.5 font-semibold text-gray-200 text-center border-l border-gray-300 bg-[#5e8888]"
							colSpan={resultCount}
						>
							Result
						</th>
					)}
				</tr>
			)}
			<tr className={headerBg}>
				{!showGroupRow && (
					<th className="px-3 py-1.5 font-semibold text-gray-700">Date</th>
				)}
				{METRIC_COLUMNS.map((m, idx) => {
					if (!visibleMetrics[m.key]) return null;
					const visibleBefore = METRIC_COLUMNS.filter(
						(p, i) =>
							i < idx && visibleMetrics[p.key]
					).length;
					const isFirstVisible = visibleBefore === 0;
					const prevInGroup = METRIC_COLUMNS.slice(0, idx).filter(
						(p) => p.group === m.group && visibleMetrics[p.key]
					);
					const showBorderL =
						isFirstVisible ||
						(prevInGroup.length === 0 &&
							(m.group === 'marketing' || m.group === 'result'));
					return (
						<th
							key={m.key}
							className={`px-3 py-1.5 font-semibold text-gray-700 ${
								showBorderL ? 'border-l border-gray-300' : ''
							}`}
						>
							{m.label}
						</th>
					);
				})}
			</tr>
		</thead>
	);
}
