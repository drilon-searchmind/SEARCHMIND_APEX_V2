import dayjs from "dayjs";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";

/** Compact axis labels (150k, 1,5m) per DESIGN.md · Charts. */
function compactAxis(v) {
	const n = Number(v) || 0;
	const abs = Math.abs(n);
	if (abs >= 1e6) return `${(n / 1e6).toLocaleString("da-DK", { maximumFractionDigits: 1 })}m`;
	if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString("da-DK")}k`;
	return Math.round(n).toLocaleString("da-DK");
}

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
		{ name: 'Revenue target', data: conversionBudgetSeriesData },
	];

	return {
		chartSeries: [...revenueSeries, ...conversionBudgetSeries],
		chartCategoriesWithStart: conversionChartCategoriesWithStart,
	};
}

/** Detailed pacing charts: actual (blue, light area) vs cumulative target (muted, dashed). */
export const BASE_CHART_OPTIONS = {
	chart: {
		toolbar: { show: false },
		zoom: { enabled: false },
		fontFamily: COMMERCE_CHART_CHROME.fontFamily,
	},
	xaxis: {
		tickAmount: 8,
		axisTicks: { show: false },
		axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
		tooltip: { enabled: false },
		labels: {
			rotate: 0,
			hideOverlappingLabels: true,
			style: { colors: COMMERCE_CHART_CHROME.axisLabel },
			formatter: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dayjs(v).format('D MMM') : v),
		},
	},
	yaxis: {
		min: 0,
		tickAmount: 4,
		forceNiceScale: true,
		labels: { formatter: compactAxis },
	},
	colors: [METRIC_CHART_PALETTE[0], '#859085'],
	stroke: { width: [2.4, 1.6], curve: 'straight', dashArray: [0, 4] },
	fill: { type: 'solid', opacity: [1, 1] },
	markers: { size: 0, hover: { size: 5 }, colors: ['#ffffff', '#ffffff'], strokeColors: [METRIC_CHART_PALETTE[0], '#859085'], strokeWidth: 2 },
	grid: {
		borderColor: COMMERCE_CHART_CHROME.grid,
		strokeDashArray: 0,
		xaxis: { lines: { show: false } },
		yaxis: { lines: { show: true } },
	},
	dataLabels: { enabled: false },
	tooltip: {
		theme: 'dark',
		shared: true,
		intersect: false,
		y: { formatter: (v) => (v == null ? '-' : `${Math.round(Number(v) || 0).toLocaleString('da-DK')} kr.`) },
	},
	legend: { show: true, position: 'top', horizontalAlign: 'left' },
};
