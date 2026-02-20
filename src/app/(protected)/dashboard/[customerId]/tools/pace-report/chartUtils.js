import dayjs from 'dayjs';

export function buildCostBudgetChartData(costData, paceAnalysis, appliedDateRange) {
	const chartCategories = costData.map((d) => d.period);
	const chartStartDate =
		costData.length > 0 ? costData[0].period : appliedDateRange.startDate;
	const chartStartDateObj = dayjs(chartStartDate);
	const dayBeforeStart = chartStartDateObj.subtract(1, 'day').format('YYYY-MM-DD');

	const costSeriesData =
		costData.length > 0
			? ['0', ...costData.map((d) => Math.round(Number(d.spend)).toString())]
			: ['0'];
	const budgetSeriesData =
		(paceAnalysis?.budgetDaily || []).length > 0
			? [
				'0',
				...paceAnalysis.budgetDaily.map((d) =>
					Math.round(Number(d.budget)).toString()
				),
			]
			: ['0'];

	const chartCategoriesWithStart =
		costData.length > 0 ? [dayBeforeStart, ...chartCategories] : [dayBeforeStart];

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
	const chartStartDate =
		costData.length > 0 ? costData[0].period : appliedDateRange.startDate;
	const chartStartDateObj = dayjs(chartStartDate);
	const dayBeforeStart = chartStartDateObj.subtract(1, 'day').format('YYYY-MM-DD');

	const conversionChartCategories = costData.map((d) => d.period);
	const revenueMap = {};
	conversionValueData.forEach((d) => {
		revenueMap[d.period] = d.revenue;
	});

	const revenueSeriesData =
		conversionChartCategories.length > 0
			? [
				'0',
				...conversionChartCategories.map((period) =>
					Math.round(Number(revenueMap[period] || 0)).toString()
				),
			]
			: ['0'];
	const conversionBudgetSeriesData =
		(conversionPaceAnalysis?.budgetDaily || []).length > 0
			? [
				'0',
				...conversionPaceAnalysis.budgetDaily.map((d) =>
					Math.round(Number(d.budget)).toString()
				),
			]
			: ['0'];

	const conversionChartCategoriesWithStart =
		conversionChartCategories.length > 0
			? [dayBeforeStart, ...conversionChartCategories]
			: [dayBeforeStart];

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
