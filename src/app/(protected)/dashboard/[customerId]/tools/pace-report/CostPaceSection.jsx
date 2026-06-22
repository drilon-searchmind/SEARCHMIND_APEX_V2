'use client';

import GraphCard from '@/components/dashboard/GraphCard';
import CobaltLoader from '@/components/ui/CobaltLoader';
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

	const channelChartOptions =
		costByChannelSeries.length > 0
			? {
					...BASE_CHART_OPTIONS,
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
		<section className="apex-pace-section">
			<div className="apex-pace-section__head">
				<h2 className="apex-pace-section__title">Spend pacing</h2>
				<button
					type="button"
					className={`apex-perf-chip${showCalcs ? ' is-active' : ''}`}
					onClick={() => onShowCalcsChange?.((v) => !v)}
				>
					Show calcs
				</button>
			</div>
			<div className="apex-pace-section__row">
				<div className="apex-pace-section__chart">
					{loading ? (
						<div className="apex-perf-loading">
							<CobaltLoader
								variant="block"
								title="Loading spend data"
								request="GET /api/merged-sources"
							/>
						</div>
					) : (
						<GraphCard
							variant="cobalt"
							hideChartToggle
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
				<div className="apex-pace-section__secondary">
					<GraphCard
						variant="cobalt"
						hideChartToggle
						title="Cumulative paid media by channel"
						chartOptions={channelChartOptions}
						chartSeries={costByChannelSeries}
						chartType="line"
					/>
				</div>
			)}
		</section>
	);
}
