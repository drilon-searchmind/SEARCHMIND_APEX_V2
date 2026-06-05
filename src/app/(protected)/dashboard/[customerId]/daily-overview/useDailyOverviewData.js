import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
	adSpendByPeriodMap,
	channelDailyRowsFromMerged,
	adSpendChannelsForDashboard,
	adSpendChannelsForShopifyMarketsFilterUi,
} from '@/lib/mergeAdSpendDaily';
import { getReturnsOverrideSettings } from '@/lib/performanceDashboard/performanceDashboardConstants';
import { calcShopifyDayProfitMetrics } from '@/lib/performanceDashboard/profitMetrics';

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

	const staticExpenses = customer?.CustomerStaticExpenses || {};
	const customerSettings = customer?.CustomerSettings || {};
	const returnsOverride = getReturnsOverrideSettings(customerSettings);

	return shopify.map((d) => {
		const date = d.period;
		const ymd = String(date).slice(0, 10);
		const totalSales = d.total_sales || 0;
		const ppcCost = channelMaps.google?.[ymd] ?? 0;
		const psCost = channelMaps.facebook?.[ymd] ?? 0;
		const pinterestCost = channelMaps.pinterest?.[ymd] ?? 0;
		const snapchatCost = channelMaps.snapchat?.[ymd] ?? 0;
		const bingCost = channelMaps.bing?.[ymd] ?? 0;
		const redditCost = channelMaps.reddit?.[ymd] ?? 0;
		const cost = spendByDate[ymd] ?? 0;

		const profit = calcShopifyDayProfitMetrics({
			shopifyDay: d,
			marketingSpend: cost,
			customerSettings,
			staticExpenses,
			returnsOverride,
		});

		const {
			netRevenue,
			orders,
			cogs,
			variableExpense,
			fixedExpense,
			transactionFee,
			netProfit,
			poas,
			roas,
			spendshare,
		} = profit;

		const aov = orders > 0 ? netRevenue / orders : null;

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
			cac: merged.CACTotalSales ?? null,
			cogs,
			variableExpense,
			fixedExpense,
			transactionFee,
			netProfit,
		};
	});
}

function buildPrevPeriodRows(mergedPrev, customer, revenueType) {
	return buildDailyRows(mergedPrev, customer, revenueType);
}

/**
 * @param {object|null} customer
 * @param {{ startDate: string, endDate: string }} appliedDateRange
 * @param {string} [mergedSourcesQuerySuffix]
 * @param {{ shopifyMarkets: boolean, appliedExcludedPlatforms: Record<string, boolean|true> }} [marketsSpendColumns] — when set, marketing column visibility follows Spend filter (Shopify Markets) instead of spend thresholds.
 */
export function useDailyOverviewData(
	customer,
	appliedDateRange,
	mergedSourcesQuerySuffix = '',
	marketsSpendColumns = null
) {
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

				const spendCols = (() => {
					const ms = marketsSpendColumns;
					if (
						ms?.shopifyMarkets &&
						customer?.CustomerSettings?.shopifyMarketsEnabled === true
					) {
						const ex = ms.appliedExcludedPlatforms || {};
						return adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings)
							.filter((c) => ex[c.id] !== true)
							.map((s) => s.dailyOverviewColumnKey);
					}
					return adSpendChannelsForDashboard(
						customer?.CustomerSettings,
						merged,
						mergedPrev
					).map((s) => s.dailyOverviewColumnKey);
				})();
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
	}, [customer, appliedDateRange, mergedSourcesQuerySuffix, marketsSpendColumns]);

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
