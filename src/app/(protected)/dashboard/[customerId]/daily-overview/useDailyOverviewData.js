import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { adSpendByPeriodMap, channelDailyRowsFromMerged, adSpendChannelsForDashboard } from '@/lib/mergeAdSpendDaily';

async function fetchPeriodData(customerId, startDate, endDate, mergedSourcesQuerySuffix = '') {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
	const res = await fetch(
		`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}&source=daily-overview${mergedSourcesQuerySuffix}`
	);
	if (!res.ok) throw new Error('Failed to fetch daily data');
	return await res.json();
}

function buildDailyRows(merged, customer, revenueType) {
	const shopify = merged.shopifyDaily || [];
	const spendByDate = adSpendByPeriodMap(merged);
	const chRows = channelDailyRowsFromMerged(merged);
	const channelMaps = Object.fromEntries(
		Object.entries(chRows).map(([id, arr]) => [
			id,
			Object.fromEntries(
				(arr || []).map((d) => [
					String(d.period).slice(0, 10),
					Number(d.spend) || 0,
				])
			),
		])
	);

	let cogsPercentage = 0;
	if (
		customer?.CustomerStaticExpenses &&
		typeof customer.CustomerStaticExpenses.cogsPercentage === 'number'
	) {
		cogsPercentage = customer.CustomerStaticExpenses.cogsPercentage;
	}

	const shippingCostPerOrder =
		customer?.CustomerStaticExpenses?.shippingCostPerOrder ?? 0;
	const pickNPackCostPerOrder =
		customer?.CustomerStaticExpenses?.pickNPackCostPerOrder ?? 0;
	const transactionCostPercentage =
		customer?.CustomerStaticExpenses?.transactionCostPercentage ?? 0.015;
	const fixedExpensesMonthly = Number(customer?.CustomerStaticExpenses?.fixedExpenses) || 0;
	const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;

	return shopify.map((d) => {
		const date = d.period;
		const ymd = String(date).slice(0, 10);
		const orders = d.orders || 0;
		const totalSales = d.total_sales || 0;
		const netRevenue = d.net_sales || 0;
		const ppcCost = channelMaps.google?.[ymd] ?? 0;
		const psCost = channelMaps.facebook?.[ymd] ?? 0;
		const pinterestCost = channelMaps.pinterest?.[ymd] ?? 0;
		const snapchatCost = channelMaps.snapchat?.[ymd] ?? 0;
		const bingCost = channelMaps.bing?.[ymd] ?? 0;
		const redditCost = channelMaps.reddit?.[ymd] ?? 0;
		const cost = spendByDate[ymd] ?? 0;
		const roas = cost > 0 ? netRevenue / cost : null;
		const spendshare = netRevenue > 0 ? cost / netRevenue : null;

		let cogs = 0;
		if (fetchCogs) {
			cogs = d.cost_of_goods_sold || 0;
		} else {
			cogs = netRevenue * cogsPercentage;
		}

		let poas = null;
		if (cost > 0) {
			const grossProfit = netRevenue - cogs;
			poas = grossProfit / cost;
		}

		const cac = merged.CACTotalSales ?? null;
		const aov = orders > 0 ? netRevenue / orders : null;

		// Variable costs: shipping + pick & pack only (no transaction fee - matches performance-dashboard)
		const variableExpense =
			shippingCostPerOrder * orders + pickNPackCostPerOrder * orders;
		// Fixed costs: prorate by actual days in month (matches performance-dashboard)
		const daysInMonth = dayjs(date).daysInMonth();
		const fixedExpense = fixedExpensesMonthly / daysInMonth;
		// Transaction fee: separate from variable (matches performance-dashboard)
		const transactionFee = netRevenue * transactionCostPercentage;

		// Net Profit = Net Revenue - COGS - Fixed - Variable - Transaction Fee - Spend (matches performance-dashboard)
		const allCosts = cogs + fixedExpense + variableExpense + transactionFee + cost;
		const netProfit = netRevenue - allCosts;

		return {
			date,
			orders,
			totalSales,
			netRevenue,
			ppcCost,
			psCost,
			pinterestCost,
			snapchatCost,
			bingCost,
			redditCost,
			totalMarketingSpend: cost,
			roas,
			spendshare,
			poas,
			aov,
			cac,
			cogs,
			variableExpense,
			fixedExpense,
			transactionFee,
			netProfit,
		};
	});
}

function buildPrevPeriodRows(mergedPrev, customer, revenueType) {
	const rows = buildDailyRows(mergedPrev, customer, revenueType);
	return rows.map((r) => ({
		...r,
		poas: mergedPrev.POASTotalSales ?? r.poas,
	}));
}

export function useDailyOverviewData(customer, appliedDateRange, mergedSourcesQuerySuffix = '') {
	const [revenueTypeState, setRevenueTypeState] = useState('total_sales');
	const [customerMetricPreference, setCustomerMetricPreference] =
		useState('ROAS/POAS');
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [rowsPrev, setRowsPrev] = useState([]);
	const [rowsLastYear, setRowsLastYear] = useState([]);
	const [loadingLastYear, setLoadingLastYear] = useState(false);
	const [visibleMarketingColumnKeys, setVisibleMarketingColumnKeys] = useState(null);

	useEffect(() => {
		if (!customer || !appliedDateRange) return;

		const metricPref =
			customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';
		setCustomerMetricPreference(metricPref);

		const revenueType =
			customer?.CustomerSettings?.customerRevenueType || 'total_sales';
		setRevenueTypeState(revenueType);

		setLoading(true);
		setError(null);
		setVisibleMarketingColumnKeys(null);

		(async () => {
			try {
				const merged = await fetchPeriodData(
					customer._id,
					appliedDateRange.startDate,
					appliedDateRange.endDate,
					mergedSourcesQuerySuffix
				);
				const dailyRows = buildDailyRows(merged, customer, revenueType);
				setRows(dailyRows);

				const start = new Date(appliedDateRange.startDate);
				const end = new Date(appliedDateRange.endDate);
				const days =
					Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
				const prevEnd = new Date(start.getTime() - 1000 * 60 * 60 * 24);
				const prevStart = new Date(
					prevEnd.getTime() - (days - 1) * 1000 * 60 * 60 * 24
				);
				const prevStartStr = prevStart.toISOString().slice(0, 10);
				const prevEndStr = prevEnd.toISOString().slice(0, 10);

				const mergedPrev = await fetchPeriodData(
					customer._id,
					prevStartStr,
					prevEndStr,
					mergedSourcesQuerySuffix
				);
				const dailyRowsPrev = buildPrevPeriodRows(
					mergedPrev,
					customer,
					revenueType
				);
				setRowsPrev(dailyRowsPrev);

				const spendCols = adSpendChannelsForDashboard(
					customer?.CustomerSettings,
					merged,
					mergedPrev
				).map((s) => s.dailyOverviewColumnKey);
				setVisibleMarketingColumnKeys(spendCols);

				setLoadingLastYear(true);
				try {
					// Last Year Period: show entire month of the same month last year
					const startMonth = dayjs(appliedDateRange.startDate);
					const lastYearMonthStart = startMonth.subtract(1, 'year').startOf('month');
					const lastYearMonthEnd = lastYearMonthStart.endOf('month');
					const lastYearStart = lastYearMonthStart.format('YYYY-MM-DD');
					const lastYearEnd = lastYearMonthEnd.format('YYYY-MM-DD');
					const mergedLastYear = await fetchPeriodData(
						customer._id,
						lastYearStart,
						lastYearEnd,
						mergedSourcesQuerySuffix
					);
          const dailyRowsLastYear = buildDailyRows(
            mergedLastYear,
            customer,
            revenueType
          );
					setRowsLastYear(dailyRowsLastYear);
				} catch (err) {
					console.error('Error fetching last year data:', err);
					setRowsLastYear([]);
				} finally {
					setLoadingLastYear(false);
				}
			} catch (err) {
				setError(err.message);
				setVisibleMarketingColumnKeys(null);
			} finally {
				setLoading(false);
			}
		})();
	}, [customer, appliedDateRange, mergedSourcesQuerySuffix]);

	return {
		rows,
		rowsPrev,
		rowsLastYear,
		loading,
		loadingLastYear,
		error,
		revenueTypeState,
		customerMetricPreference,
		visibleMarketingColumnKeys,
	};
}
