'use client';

import GraphCard from '@/components/dashboard/GraphCard';
import Spinner from '@/components/ui/Spinner';
import RevenuePaceAnalysisCard from './RevenuePaceAnalysisCard';
import {
	buildRevenueTargetChartData,
	BASE_CHART_OPTIONS,
} from './chartUtils';

export default function RevenuePaceSection({
	costData,
	conversionValueData,
	conversionPaceAnalysis,
	appliedDateRange,
	loading,
	error,
	onOpenSettings,
	showCalcs = false,
	revenueLabel = 'Total Sales',
}) {
	const { chartSeries, chartCategoriesWithStart } =
		buildRevenueTargetChartData(
			costData,
			conversionValueData,
			conversionPaceAnalysis,
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
		<div className="flex flex-col md:flex-row gap-8 mt-8">
			<div className="flex-1">
				{loading ? (
					<div className="flex items-center justify-center h-64">
						<Spinner size={40} color="#406969" />
					</div>
				) : (
					<GraphCard
						title="Revenue vs Budget"
						chartOptions={chartOptions}
						chartSeries={chartSeries}
						chartType="line"
					/>
				)}
			</div>
			<RevenuePaceAnalysisCard
				analysis={conversionPaceAnalysis}
				loading={loading}
				error={error}
				onOpenSettings={onOpenSettings}
				showCalcs={showCalcs}
				revenueLabel={revenueLabel}
			/>
		</div>
	);
}
