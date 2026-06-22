import { METRIC_COLUMNS } from './metricConfig';
import { dailyHeadCellClass, isCobaltDaily } from './dailyTableUi';

const GROUP_CLASS = {
	sales: 'is-sales',
	marketing: 'is-marketing',
	result: 'is-result',
};

function countVisibleInGroup(metricColumns, visibleMetrics, group) {
	return metricColumns.filter((m) => m.group === group && visibleMetrics[m.key]).length;
}

export default function DailyMetricsTableHeader({
	variant = 'default',
	visibleMetrics = {},
	metricColumns = METRIC_COLUMNS,
}) {
	const isCobalt = isCobaltDaily(variant);
	const headerBg = variant === 'lastYear' ? 'bg-gray-100' : 'bg-gray-50';

	const salesCount = countVisibleInGroup(metricColumns, visibleMetrics, 'sales');
	const marketingCount = countVisibleInGroup(metricColumns, visibleMetrics, 'marketing');
	const resultCount = countVisibleInGroup(metricColumns, visibleMetrics, 'result');

	const showSales = salesCount > 0;
	const showMarketing = marketingCount > 0;
	const showResult = resultCount > 0;
	const showGroupRow = showSales || showMarketing || showResult;

	if (isCobalt) {
		return (
			<thead>
				{showGroupRow && (
					<tr className="apex-daily-table__head-group-row">
						<th className="apex-daily-table__head-date" rowSpan={2}>
							Date
						</th>
						{showSales && (
							<th
								className={`apex-daily-table__head-group ${GROUP_CLASS.sales}`}
								colSpan={salesCount}
							>
								Sales
							</th>
						)}
						{showMarketing && (
							<th
								className={`apex-daily-table__head-group ${GROUP_CLASS.marketing}`}
								colSpan={marketingCount}
							>
								Marketing
							</th>
						)}
						{showResult && (
							<th
								className={`apex-daily-table__head-group ${GROUP_CLASS.result}`}
								colSpan={resultCount}
							>
								Result
							</th>
						)}
					</tr>
				)}
				<tr className="apex-daily-table__head-row">
					{!showGroupRow && (
						<th className="apex-daily-table__head-date">Date</th>
					)}
					{metricColumns.map((m, idx) => {
						if (!visibleMetrics[m.key]) return null;
						const visibleBefore = metricColumns.filter(
							(p, i) => i < idx && visibleMetrics[p.key]
						).length;
						const isFirstVisible = visibleBefore === 0;
						const prevInGroup = metricColumns
							.slice(0, idx)
							.filter((p) => p.group === m.group && visibleMetrics[p.key]);
						const showBorderL =
							isFirstVisible ||
							(prevInGroup.length === 0 &&
								(m.group === 'marketing' || m.group === 'result'));
						return (
							<th
								key={m.key}
								className={dailyHeadCellClass(variant, showBorderL)}
							>
								{m.label}
							</th>
						);
					})}
				</tr>
			</thead>
		);
	}

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
				{metricColumns.map((m, idx) => {
					if (!visibleMetrics[m.key]) return null;
					const visibleBefore = metricColumns.filter(
						(p, i) => i < idx && visibleMetrics[p.key]
					).length;
					const isFirstVisible = visibleBefore === 0;
					const prevInGroup = metricColumns.slice(0, idx).filter(
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
