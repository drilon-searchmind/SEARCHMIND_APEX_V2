export function buildCostBudgetChartData(costData, paceAnalysis, appliedDateRange) {
	const chartCategories = costData.map((d) => d.period);
	// Chart starts from range startDate (no "day before"); first point shows 0
	const costSeriesData =
		costData.length > 0
			? ['0', ...costData.slice(1).map((d) => Math.round(Number(d.spend)).toString())]
			: ['0'];
	const budgetSeriesData =
		(paceAnalysis?.budgetDaily || []).length > 0
			? [
				'0',
				...paceAnalysis.budgetDaily.slice(1).map((d) =>
					Math.round(Number(d.budget)).toString()
				),
			]
			: ['0'];

	const chartCategoriesWithStart = chartCategories.length > 0 ? chartCategories : [appliedDateRange.startDate];

	const costSeries = [{ name: 'Cost', data: costSeriesData }];
	const budgetSeries = [{ name: 'Budget', data: budgetSeriesData }];

	return {
		chartSeries: [...costSeries, ...budgetSeries],
		chartCategoriesWithStart,
	};
}

export function buildRevenueTargetChartData(
	costData,
	conversionValueData,
	conversionPaceAnalysis,
	appliedDateRange
) {
	const conversionChartCategories = costData.map((d) => d.period);
	const revenueMap = {};
	conversionValueData.forEach((d) => {
		revenueMap[d.period] = d.revenue;
	});

	// Chart starts from range startDate; first point shows 0
	const revenueSeriesData =
		conversionChartCategories.length > 0
			? [
				'0',
				...conversionChartCategories.slice(1).map((period) =>
					Math.round(Number(revenueMap[period] || 0)).toString()
				),
			]
			: ['0'];
	const conversionBudgetSeriesData =
		(conversionPaceAnalysis?.budgetDaily || []).length > 0
			? [
				'0',
				...conversionPaceAnalysis.budgetDaily.slice(1).map((d) =>
					Math.round(Number(d.budget)).toString()
				),
			]
			: ['0'];

	const conversionChartCategoriesWithStart =
		conversionChartCategories.length > 0
			? conversionChartCategories
			: [appliedDateRange.startDate];

	const revenueSeries = [{ name: 'Revenue', data: revenueSeriesData }];
	const conversionBudgetSeries = [
		{ name: 'Revenue Target', data: conversionBudgetSeriesData },
	];

	return {
		chartSeries: [...revenueSeries, ...conversionBudgetSeries],
		chartCategoriesWithStart: conversionChartCategoriesWithStart,
	};
}

export const BASE_CHART_OPTIONS = {
	chart: {
		toolbar: { show: false },
		zoom: { enabled: false },
		fontFamily: 'Outfit, sans-serif',
	},
	xaxis: {
		axisTicks: { show: true },
		axisBorder: { show: true },
		labels: {
			style: { colors: '#406969' },
		},
	},
	yaxis: {
		labels: { style: { colors: '#1E2B2B' } },
	},
	colors: ['#213834', '#C6ED62'],
	stroke: { width: 2, curve: 'smooth' },
	fill: { type: 'solid', opacity: 1 },
	grid: {
		borderColor: '#e5e7eb',
		strokeDashArray: 0,
		xaxis: { lines: { show: false } },
		yaxis: { lines: { show: true } },
	},
	dataLabels: { enabled: false },
	tooltip: { theme: 'light' },
	legend: { show: true, position: 'top', labels: { colors: '#1E2B2B' } },
};
