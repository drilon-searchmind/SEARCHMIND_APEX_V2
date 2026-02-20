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
	paceAnalysis,
	appliedDateRange,
	loading,
	error,
	onOpenSettings,
}) {
	const { chartSeries, chartCategoriesWithStart } = buildCostBudgetChartData(
		costData,
		paceAnalysis,
		appliedDateRange
	);

	const chartOptions = {
		...BASE_CHART_OPTIONS,
		xaxis: {
			...BASE_CHART_OPTIONS.xaxis,
			categories: chartCategoriesWithStart,
		},
	};

	return (
		<div className="flex flex-col md:flex-row gap-8 mt-4">
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
			/>
		</div>
	);
}
