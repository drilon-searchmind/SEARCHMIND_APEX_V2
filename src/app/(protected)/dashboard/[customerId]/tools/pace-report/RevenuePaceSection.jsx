'use client';

import GraphCard from '@/components/dashboard/GraphCard';
import CobaltLoader from '@/components/ui/CobaltLoader';
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
	objectivesScopeLabel,
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
		<section className="apex-pace-section">
			<div className="apex-pace-section__head">
				<h2 className="apex-pace-section__title">Revenue pacing</h2>
			</div>
			<div className="apex-pace-section__row">
				<div className="apex-pace-section__chart">
					{loading ? (
						<div className="apex-perf-loading">
							<CobaltLoader
								variant="block"
								title="Loading revenue data"
								request="GET /api/merged-sources"
							/>
						</div>
					) : (
						<GraphCard
							variant="cobalt"
							hideChartToggle
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
					objectivesScopeLabel={objectivesScopeLabel}
				/>
			</div>
		</section>
	);
}
