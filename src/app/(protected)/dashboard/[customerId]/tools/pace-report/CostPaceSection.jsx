'use client';

import GraphCard from '@/components/dashboard/GraphCard';
import Spinner from '@/components/ui/Spinner';
import PaceAnalysisCard from './PaceAnalysisCard';
import {
	buildCostBudgetChartData,
	BASE_CHART_OPTIONS,
} from './chartUtils';

export default function CostPaceSection({
	costData,
	costByChannelSeries = [],
	paceAnalysis,
	appliedDateRange,
	loading,
	error,
	onOpenSettings,
	showCalcs = false,
	onShowCalcsChange,
	objectivesScopeLabel,
}) {
	const { chartSeries, chartCategoriesWithStart } = buildCostBudgetChartData(
		costData,
		paceAnalysis,
		appliedDateRange
	);

	const channelColors = [
		'#4267B2',
		'#4285F4',
		'#E60023',
		'#FFFC00',
		'#0078D4',
		'#FF4500',
	];
	const channelChartOptions =
		costByChannelSeries.length > 0
			? {
					...BASE_CHART_OPTIONS,
					colors: channelColors,
					xaxis: {
						...BASE_CHART_OPTIONS.xaxis,
						categories: chartCategoriesWithStart,
					},
					stroke: {
						width: costByChannelSeries.map(() => 2),
						curve: 'smooth',
					},
				}
			: null;

	const chartOptions = {
		...BASE_CHART_OPTIONS,
		xaxis: {
			...BASE_CHART_OPTIONS.xaxis,
			categories: chartCategoriesWithStart,
		},
	};

	return (
		<div className="flex flex-col gap-4 mt-4">
			<div className="flex items-center gap-3">
				<button
					type="button"
					className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${showCalcs ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
					onClick={() => onShowCalcsChange?.((v) => !v)}
				>
					Show calcs
				</button>
			</div>
			<div className="flex flex-col md:flex-row gap-8">
			<div className="flex-1">
				{loading ? (
					<div className="flex items-center justify-center h-64">
						<Spinner size={40} color="#406969" />
					</div>
				) : (
					<GraphCard
						title="Cost vs Budget"
						chartOptions={chartOptions}
						chartSeries={chartSeries}
						chartType="line"
					/>
				)}
			</div>
			<PaceAnalysisCard
				title="Spend Pace"
				analysis={paceAnalysis}
				loading={loading}
				error={error}
				onOpenSettings={onOpenSettings}
				settingsButtonText="Adjust your property budgets here."
				showCalcs={showCalcs}
				objectivesScopeLabel={objectivesScopeLabel}
			/>
			</div>
			{!loading && channelChartOptions && costByChannelSeries.length > 0 && (
				<GraphCard
					title="Cumulative paid media by channel"
					chartOptions={channelChartOptions}
					chartSeries={costByChannelSeries}
					chartType="line"
				/>
			)}
		</div>
	);
}
