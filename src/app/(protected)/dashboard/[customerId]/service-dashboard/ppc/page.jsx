

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import { FiDollarSign, FiTrendingUp, FiBarChart2, FiPieChart, FiShoppingCart, FiEye, FiMousePointer, FiPercent, FiArrowDownRight } from "react-icons/fi";
import { useCustomers } from "@/hooks/useCustomers";
import dayjs from "dayjs";

const METRIC_OPTIONS = [
	{ key: "conversion_value", label: "Conv. Value", icon: FiDollarSign },
	{ key: "ad_spend", label: "Adspend", icon: FiTrendingUp },
	{ key: "roas", label: "ROAS", icon: FiBarChart2 },
	{ key: "aov", label: "AOV", icon: FiPieChart },
	{ key: "conversions", label: "Conversions", icon: FiShoppingCart },
	{ key: "impressions", label: "Impressions", icon: FiEye },
	{ key: "clicks", label: "Clicks", icon: FiMousePointer },
	{ key: "ctr", label: "CTR", icon: FiPercent },
	{ key: "cpc", label: "CPC", icon: FiArrowDownRight },
	{ key: "conv_rate", label: "Conv Rate", icon: FiPercent },
];

export default function GoogleAdsPPCPage() {
	const params = useParams();
	const { customers } = useCustomers();
	const customer = customers.find((c) => c._id === params.customerId);

	// Date range state
	// Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');

    // If today is the 1st of the month, use 1st as both start and end
    // Otherwise, use 1st as start and yesterday as end
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
	const defaultRangeValue = { startDate: defaultStart, endDate: defaultEnd };
	const [tempRange, setTempRange] = useState(defaultRangeValue);
	const [appliedRange, setAppliedRange] = useState(defaultRangeValue);

	// Handlers for DateRangePicker (controlled) - comparison only applies on Apply
	const handleDateRangeApply = ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
		setAppliedRange({ startDate, endDate });
		if (appliedComparison) setComparisonMethod(appliedComparison);
	};
	const handleStartDateChange = (newStart) => {
		setTempRange((dr) => ({ ...dr, startDate: newStart }));
	};
	const handleEndDateChange = (newEnd) => {
		setTempRange((dr) => ({ ...dr, endDate: newEnd }));
	};

	// Comparison method: applied (triggers fetch) vs temp (picker until Apply)
	const [comparisonMethod, setComparisonMethod] = useState("Last Year");
	const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");

	// Google Ads data state
	const [metricsByDate, setMetricsByDate] = useState([]);
	const [topCampaigns, setTopCampaigns] = useState([]);
	const [campaignsByDate, setCampaignsByDate] = useState([]);
	// Previous period data for comparison
	const [metricsByDatePrev, setMetricsByDatePrev] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedMetrics, setSelectedMetrics] = useState(["conversion_value"]);

	// Ensure at least one metric is always selected
	useEffect(() => {
		if (selectedMetrics.length === 0) {
			setSelectedMetrics(["conversion_value"]);
		}
	}, [selectedMetrics]);

	useEffect(() => {
		if (!customer) return;
		setLoading(true);
		setError(null);
		(async () => {
			try {
				const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
				// Fetch customer settings for Google Ads customer ID
				const res = await fetch(`${baseUrl}/api/customers/${customer._id}`);
				if (!res.ok) throw new Error("Failed to fetch customer settings");
				const settings = (await res.json()).CustomerSettings || {};
				const { googleAdsCustomerId, googleAdsCountryFilter, googleAdsCountryExclude } = settings;
				if (!googleAdsCustomerId) throw new Error("Missing Google Ads customer ID");

				// Calculate previous period based on comparisonMethod
				const start = dayjs(appliedRange.startDate);
				const end = dayjs(appliedRange.endDate);
				const days = end.diff(start, 'day') + 1;

				let prevStart, prevEnd;
				if (comparisonMethod === "Last Year") {
					// Same period last year
					prevStart = start.subtract(1, 'year');
					prevEnd = end.subtract(1, 'year');
				} else {
					// Last Period (previous contiguous period of same length)
					prevEnd = start.subtract(1, 'day');
					prevStart = prevEnd.subtract(days - 1, 'day');
				}

				// Fetch current and previous period data in parallel
				const countryParams = [
					googleAdsCountryFilter ? `countryFilter=${encodeURIComponent(googleAdsCountryFilter)}` : '',
					googleAdsCountryExclude ? `countryExclude=${encodeURIComponent(googleAdsCountryExclude)}` : '',
				].filter(Boolean).join('&');
				const countryParam = countryParams ? `&${countryParams}` : '';
				const [ppcRes, ppcResPrev] = await Promise.all([
					fetch(`/api/google-ppc-dashboard?customerId=${encodeURIComponent(googleAdsCustomerId)}&startDate=${encodeURIComponent(appliedRange.startDate)}&endDate=${encodeURIComponent(appliedRange.endDate)}${countryParam}`),
					fetch(`/api/google-ppc-dashboard?customerId=${encodeURIComponent(googleAdsCustomerId)}&startDate=${encodeURIComponent(prevStart.format('YYYY-MM-DD'))}&endDate=${encodeURIComponent(prevEnd.format('YYYY-MM-DD'))}${countryParam}`)
				]);
				
				if (!ppcRes.ok) throw new Error("Failed to fetch Google Ads PPC dashboard metrics");
				const metrics = await ppcRes.json();
				setMetricsByDate(metrics.metrics_by_date || []);
				setTopCampaigns(metrics.top_campaigns || []);
				setCampaignsByDate(metrics.campaigns_by_date || []);

				// Set previous period data (even if fetch fails, we'll just have empty array)
				if (ppcResPrev.ok) {
					const metricsPrev = await ppcResPrev.json();
					setMetricsByDatePrev(metricsPrev.metrics_by_date || []);
				} else {
					setMetricsByDatePrev([]);
				}
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		})();
	}, [customer, appliedRange, comparisonMethod]);

	// % change helpers
	const percentChange = (current, prev) => {
		if (prev === 0 || prev === null || prev === undefined) return null;
		return ((current - prev) / Math.abs(prev)) * 100;
	};
	const changeType = (val) => {
		if (val === null) return undefined;
		return val > 0 ? "up" : val < 0 ? "down" : undefined;
	};

	// Metrics cards (aggregate for period)
	const metrics = useMemo(() => {
		if (!metricsByDate.length) return [];
		
		const agg = (key, data) => {
			if (key === "conversion_value") {
				return data.reduce((sum, row) => sum + (row.conversions_value || 0), 0);
			}
			if (key === "conversions") {
				return data.reduce((sum, row) => sum + (row.conversions || 0), 0);
			}
			if (key === "aov") {
				const totalValue = data.reduce((sum, row) => sum + (row.conversions_value || 0), 0);
				const totalConv = data.reduce((sum, row) => sum + (row.conversions || 0), 0);
				return totalConv > 0 ? totalValue / totalConv : null;
			}
			if (key === "roas") {
				const totalSpend = data.reduce((sum, row) => sum + (row.ad_spend || 0), 0);
				const totalValue = data.reduce((sum, row) => sum + (row.conversions_value || 0), 0);
				return totalSpend > 0 ? totalValue / totalSpend : null;
			}
			if (key === "ctr") {
				const totalImpr = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
				const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
				return totalImpr > 0 ? totalClicks / totalImpr : null;
			}
			if (key === "cpc") {
				const totalSpend = data.reduce((sum, row) => sum + (row.ad_spend || 0), 0);
				const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
				return totalClicks > 0 ? totalSpend / totalClicks : null;
			}
			if (key === "conv_rate") {
				const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
				const totalConv = data.reduce((sum, row) => sum + (row.conversions || 0), 0);
				return totalClicks > 0 ? totalConv / totalClicks : null;
			}
			// Default: sum
			return data.reduce((sum, row) => sum + (row[key] || 0), 0);
		};
		
		return METRIC_OPTIONS.map(opt => {
			const currentValue = agg(opt.key, metricsByDate);
			const prevValue = metricsByDatePrev.length > 0 ? agg(opt.key, metricsByDatePrev) : null;
			const change = percentChange(currentValue, prevValue);
			
			return {
				label: opt.label,
				value: currentValue,
				change: change !== null ? Math.abs(change).toFixed(1) : undefined,
				changeType: changeType(change),
			};
		});
	}, [metricsByDate, metricsByDatePrev]);

	// Graph data for selected metrics
	const chartCategories = metricsByDate.map(row => row.date);
	
	// Create a map for previous period data by date
	const metricsByDatePrevMap = Object.fromEntries(
		metricsByDatePrev.map(row => [row.date, row])
	);

	// Build chart series with current and previous period data
	const chartSeries = [];
	
	// Add current period series
	(selectedMetrics || []).forEach(metricKey => {
		const metricOption = METRIC_OPTIONS.find(opt => opt.key === metricKey);
		chartSeries.push({
			name: `${metricOption?.label || "Metric"} (Current)`,
			data: chartCategories.map(date => {
				const row = metricsByDate.find(r => r.date === date);
				if (!row) return null;
				let val;
				if (metricKey === "conversion_value") val = row.conversions_value;
				else val = row[metricKey];
				if (typeof val === 'number' && !isNaN(val)) {
					return (metricKey === "ctr" || metricKey === "roas" || metricKey === "conv_rate") ? Number(val.toFixed(2)) : Math.round(val);
				}
				return val ?? null;
			}),
		});
	});

	// Add previous period series
	(selectedMetrics || []).forEach(metricKey => {
		const metricOption = METRIC_OPTIONS.find(opt => opt.key === metricKey);
		chartSeries.push({
			name: `${metricOption?.label || "Metric"} (${comparisonMethod})`,
			data: chartCategories.map(date => {
				// Map current period date to corresponding previous period date
				let prevDate;
				if (comparisonMethod === "Last Year") {
					const currentDate = dayjs(date);
					prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
				} else {
					// Last Period - same date in previous contiguous period
					const currentDate = dayjs(date);
					const periodStart = dayjs(appliedRange.startDate);
					const periodEnd = dayjs(appliedRange.endDate);
					const daysDiff = currentDate.diff(periodStart, 'day');
					const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
					prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
				}

				const row = metricsByDatePrevMap[prevDate];
				if (!row) return null;
				let val;
				if (metricKey === "conversion_value") val = row.conversions_value;
				else val = row[metricKey];
				if (typeof val === 'number' && !isNaN(val)) {
					return (metricKey === "ctr" || metricKey === "roas" || metricKey === "conv_rate") ? Number(val.toFixed(2)) : Math.round(val);
				}
				return val ?? null;
			}),
		});
	});

	// Prepare stroke and fill arrays for current and previous series
	const selectedMetricsCount = (selectedMetrics || []).length;
	const strokeWidths = [...Array(selectedMetricsCount).fill(2), ...Array(selectedMetricsCount).fill(1)];
	const strokeDashArrays = [...Array(selectedMetricsCount).fill(0), ...Array(selectedMetricsCount).fill(5)];
	const fillOpacities = [...Array(selectedMetricsCount).fill(1), ...Array(selectedMetricsCount).fill(0.5)];

	const chartOptions = {
		chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
		xaxis: { categories: chartCategories },
		yaxis: {},
		colors: ["#406969", "#1E2B2B", "#4F46E5", "#06B6D4", "#C6ED62", "#D6CDB6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#10B981"],
		stroke: { 
			width: strokeWidths, 
			curve: 'smooth',
			dashArray: strokeDashArrays
		},
		fill: { 
			type: 'solid', 
			opacity: fillOpacities
		},
		grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
		dataLabels: { enabled: false },
		tooltip: { theme: 'light' },
		legend: { show: true, position: 'top' },
	};

	// Top campaigns table: sort by clicks desc
	const topCampaignsTable = useMemo(() => {
		if (!topCampaigns.length) return [];
		return topCampaigns;
	}, [topCampaigns]);

	return (
		<div className="w-full">
			<DashboardHeading
				title="Google Ads PPC Dashboard"
				label={customer ? customer.customerName : ""}
				customerId={params.customerId}
				dateRange={appliedRange}
				comparisonMethod={comparisonMethod}
				loading={loading}
				dashboardType="ppc-dashboard"
				dataSnapshot={{ metricsByDate, topCampaigns, campaignsByDate, selectedMetrics, METRIC_OPTIONS }}
				right={
					<DateRangePicker
						onApply={handleDateRangeApply}
						startDate={tempRange.startDate}
						endDate={tempRange.endDate}
						onStartDateChange={handleStartDateChange}
						onEndDateChange={handleEndDateChange}
						loading={loading}
						showComparisonMethodToggler={true}
						comparisonMethod={tempComparisonMethod}
						onComparisonMethodChange={setTempComparisonMethod}
					/>
				}
			/>

			{/* Metrics Cards Section */}
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full mb-8">
				{loading ? (
					<div className="col-span-5 text-center"><Spinner size={40} color="#406969" /></div>
				) : error ? (
					<div className="col-span-5 text-center text-red-500">{error}</div>
				) : (
					metrics.map((metric, idx) => {
						const Icon = METRIC_OPTIONS.find(opt => opt.label === metric.label)?.icon;
						const isActive = selectedMetrics.includes(METRIC_OPTIONS[idx].key);
						return (
							<div
								key={idx}
								onClick={() => setSelectedMetrics(prev => {
									const metricKey = METRIC_OPTIONS[idx].key;
									if (prev.includes(metricKey)) {
										// Don't allow deselecting if it's the only selected metric
										return prev.length > 1 ? prev.filter(m => m !== metricKey) : prev;
									} else {
										return [...prev, metricKey];
									}
								})}
								style={{ cursor: 'pointer' }}
							>
								<MetricCard
									label={metric.label}
									value={
										metric.value !== null && metric.value !== undefined
											? (typeof metric.value === "number" && !isNaN(metric.value)
												? (metric.label === "Conv. Value" || metric.label === "Adspend" || metric.label === "AOV" ? metric.value.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0, minimumFractionDigits: 0 })
													: metric.label === "CTR" || metric.label === "Conv Rate" ? `${(metric.value * 100).toFixed(2)}%`
														: metric.label === "ROAS" ? metric.value.toFixed(2)
															: metric.value.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 }))
												: metric.value)
											: "-"
									}
									icon={Icon ? <Icon size={22} color={isActive ? '#fff' : undefined} /> : null}
									isActive={isActive}
									change={metric.change}
									changeType={metric.changeType}
									comparisonMethod={comparisonMethod}
								/>
							</div>
						);
					})
				)}
			</div>

			{/* Graph Section */}
			<div className="mb-8">
				<div className="flex items-center gap-4 mb-2">
					<span className="font-semibold">Metric:</span>
					<div className="flex gap-2">
						{METRIC_OPTIONS.map(opt => (
							<button
								key={opt.key}
								className={`px-3 py-1 rounded text-xs font-medium border transition-colors duration-150 ${selectedMetrics.includes(opt.key) ? 'bg-white text-[var(--color-primary-searchmind)] border-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 border-gray-200 hover:text-[var(--color-primary-searchmind)]'}`}
								onClick={() => setSelectedMetrics(prev => {
									if (prev.includes(opt.key)) {
										// Don't allow deselecting if it's the only selected metric
										return prev.length > 1 ? prev.filter(m => m !== opt.key) : prev;
									} else {
										return [...prev, opt.key];
									}
								})}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
				{loading ? (
					<div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
				) : (
					<GraphCard title={
						(selectedMetrics || []).length === 1 && (selectedMetrics || [])[0]
							? `${METRIC_OPTIONS.find(opt => opt.key === (selectedMetrics || [])[0])?.label ?? "Metric"} vs ${comparisonMethod}`
							: `Multiple PPC Metrics vs ${comparisonMethod}`
					} chartOptions={chartOptions} chartSeries={chartSeries} />
				)}
			</div>

			{/* Top Campaigns Table */}
			<div className="bg-white rounded-xl border border-gray-200 p-6">
				<h3 className="text-lg font-semibold mb-4">Top Performance Campaigns</h3>
				{loading ? (
					<div className="flex justify-center items-center min-h-[120px]"><Spinner size={40} color="#406969" /></div>
				) : error ? (
					<div className="text-red-500 text-center">{error}</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '12px' }}>
							<thead>
								<tr className="bg-gray-50">
									<th className="px-3 py-1.5 font-semibold text-gray-700">Campaign</th>
									<th className="px-3 py-1.5 font-semibold text-gray-700">Clicks</th>
									<th className="px-3 py-1.5 font-semibold text-gray-700">Impressions</th>
									<th className="px-3 py-1.5 font-semibold text-gray-700">CTR</th>
								</tr>
							</thead>
							<tbody className="text-[12px]">
								{topCampaignsTable.length === 0 ? (
									<tr><td colSpan={4} className="text-center py-8 text-gray-400">No campaign data for selected range.</td></tr>
								) : topCampaignsTable.map((row, idx) => {
									const max = {
										clicks: Math.max(...topCampaignsTable.map(r => Number(r.clicks) || 0)),
										impressions: Math.max(...topCampaignsTable.map(r => Number(r.impressions) || 0)),
										ctr: Math.max(...topCampaignsTable.map(r => Number(r.ctr) || 0)),
									};
									return (
										<tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
											<td className="px-3 py-2 whitespace-nowrap">{row.campaign_name}</td>
											<td className="px-3 py-2 whitespace-nowrap" style={{ ...(row.clicks > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.clicks / max.clicks)})` } : {}) }}>{Number(row.clicks || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
											<td className="px-3 py-2 whitespace-nowrap" style={{ ...(row.impressions > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.impressions / max.impressions)})` } : {}) }}>{Number(row.impressions || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
											<td className="px-3 py-2 whitespace-nowrap" style={{ ...(row.ctr > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.ctr / max.ctr)})` } : {}) }}>{row.ctr ? `${(Number(row.ctr) * 100).toFixed(2)}%` : '-'}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}