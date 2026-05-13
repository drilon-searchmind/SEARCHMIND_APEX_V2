import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
	adSpendByPeriodMap,
	buildChannelCumulativeSpendSeriesForPace,
	channelSpendTotalsFromMerged,
	adSpendChannelsForSpendTotals,
} from '@/lib/mergeAdSpendDaily';

export function usePaceReportData(
	customer,
	objectives,
	appliedDateRange,
	mergedSourcesQuerySuffix = '',
	paceChannelSpecs = null
) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [costData, setCostData] = useState([]);
	const [costByChannelSeries, setCostByChannelSeries] = useState([]);
	const [budget, setBudget] = useState(0);
	const [paceAnalysis, setPaceAnalysis] = useState(null);
	const [conversionValueData, setConversionValueData] = useState([]);
	const [conversionBudget, setConversionBudget] = useState(0);
	const [conversionPaceAnalysis, setConversionPaceAnalysis] = useState(null);

	useEffect(() => {
		if (!customer || !appliedDateRange) return;

		setLoading(true);
		setError(null);

		(async () => {
			try {
				const baseUrl =
					process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
				const res = await fetch(
					`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=pace-report${mergedSourcesQuerySuffix}`
				);
				if (!res.ok) throw new Error('Failed to fetch merged data');
				const merged = await res.json();

				const startDateObj = dayjs(appliedDateRange.startDate);
				const endDateObj = dayjs(appliedDateRange.endDate);

				const costMap = adSpendByPeriodMap(merged);
				// Generate all days from startDate to endDate for consistent chart display
				const allPeriods = [];
				let dayCursor = startDateObj;
				while (!dayCursor.isAfter(endDateObj)) {
					allPeriods.push(dayCursor.format('YYYY-MM-DD'));
					dayCursor = dayCursor.add(1, 'day');
				}
				let cumulative = 0;
				const costDaily = allPeriods.map((period) => {
					cumulative += costMap[period] || 0;
					return { period, spend: Number(cumulative.toFixed(2)) };
				});
				setCostData(costDaily);
				const visibleSpendChannels =
					paceChannelSpecs != null
						? paceChannelSpecs
						: adSpendChannelsForSpendTotals(
								customer?.CustomerSettings,
								channelSpendTotalsFromMerged(merged)
						  );
				setCostByChannelSeries(
					buildChannelCumulativeSpendSeriesForPace(
						merged,
						allPeriods,
						visibleSpendChannels
					)
				);

				const totalDays = endDateObj.diff(startDateObj, 'day') + 1;

				let monthsInRange = [];
				let cursor = startDateObj.startOf('month');
				while (
					cursor.isBefore(endDateObj) ||
					cursor.isSame(endDateObj, 'month')
				) {
					monthsInRange.push(cursor.format('MMMM').toLowerCase());
					cursor = cursor.add(1, 'month');
				}

				let budgetValue = monthsInRange.reduce((sum, month) => {
					const obj = objectives[month] || {};
					return sum + (typeof obj.marketingBudget === 'number' ? obj.marketingBudget : 0);
				}, 0);
				if (!budgetValue || budgetValue === 0) budgetValue = 1;
				setBudget(budgetValue);

				let antalDage = 0;
				let monthCursor = startDateObj.startOf('month');
				while (
					monthCursor.isBefore(endDateObj) ||
					monthCursor.isSame(endDateObj, 'month')
				) {
					antalDage += monthCursor.daysInMonth();
					monthCursor = monthCursor.add(1, 'month');
				}

				const dailyTarget = budgetValue / antalDage;
				let budgetCumulative = 0;
				const budgetDaily = costDaily.map((d) => {
					budgetCumulative += dailyTarget;
					return { period: d.period, budget: Number(budgetCumulative.toFixed(2)) };
				});

				const todayObj = dayjs();
				let a = 0;
				if (costDaily.length > 0) {
					a = costDaily[costDaily.length - 1].spend;
				}
				const costUntilLastDay = a;

				let todayDayNumber;
				if (todayObj.isBefore(startDateObj)) {
					todayDayNumber = 0;
				} else if (todayObj.isAfter(endDateObj)) {
					todayDayNumber = totalDays;
				} else {
					todayDayNumber = todayObj.diff(startDateObj, 'day') + 1;
				}
				const c = Math.max(0, todayDayNumber);

				const idealSpendToDate = dailyTarget * c;
				const b = dailyTarget;
				const bcForPace = idealSpendToDate;
				const pace = bcForPace > 0 ? a / bcForPace : 0;
				const actualSpendToDate =
					costDaily.length > 0 ? costDaily[costDaily.length - 1].spend : 0;

				const d = antalDage - 1;
				const e = c > 0 ? a / c : 0;
				const bcForAdjustment = dailyTarget * c;
				const bcMinusA = bcForAdjustment - a;
				const firstPart = -(bcMinusA / d);
				const secondPart = dailyTarget - e;
				const suggestedDailyAdjustment = firstPart + secondPart;

				setPaceAnalysis({
					budget: budgetValue,
					totalDays,
					dailyTarget,
					idealSpendToDate,
					actualSpendToDate,
					costUntilLastDay,
					daysPassed: c,
					pace,
					suggestedDailyAdjustment,
					budgetDaily,
				});

				const revenueType =
					customer?.CustomerSettings?.customerRevenueType || 'total_sales';
				const revenueMap = {};
				(merged.shopifyDaily || []).forEach((row) => {
					if (!revenueMap[row.period]) revenueMap[row.period] = 0;
					revenueMap[row.period] += Number(row[revenueType] || 0);
				});
				let revenueCumulative = 0;
				const revenueDaily = allPeriods.map((period) => {
					revenueCumulative += revenueMap[period] || 0;
					return { period, revenue: Number(revenueCumulative.toFixed(2)) };
				});
				setConversionValueData(revenueDaily);

				let conversionBudgetValue = monthsInRange.reduce((sum, month) => {
					const obj = objectives[month] || {};
					return sum + (typeof obj.revenueTarget === 'number' ? obj.revenueTarget : 0);
				}, 0);
				if (!conversionBudgetValue || conversionBudgetValue === 0)
					conversionBudgetValue = 1;
				setConversionBudget(conversionBudgetValue);

				const conversionDailyTarget = conversionBudgetValue / antalDage;
				let conversionBudgetCumulative = 0;
				const conversionBudgetDaily = costDaily.map((d) => {
					conversionBudgetCumulative += conversionDailyTarget;
					return {
						period: d.period,
						budget: Number(conversionBudgetCumulative.toFixed(2)),
					};
				});

				let revenueUntilLastDay = 0;
				if (revenueDaily.length > 0) {
					revenueUntilLastDay = revenueDaily[revenueDaily.length - 1].revenue;
				}

				const idealRevenueToDate = conversionDailyTarget * c;
				const conversionPace =
					idealRevenueToDate > 0
						? revenueUntilLastDay / idealRevenueToDate
						: 0;
				const actualRevenueToDate =
					revenueDaily.length > 0
						? revenueDaily[revenueDaily.length - 1].revenue
						: 0;

				const conversionD = antalDage - 1;
				const conversionE = c > 0 ? revenueUntilLastDay / c : 0;
				const conversionBc = conversionDailyTarget * c;
				const conversionBcMinusA = conversionBc - revenueUntilLastDay;
				const conversionFirstPart = -(conversionBcMinusA / conversionD);
				const conversionSecondPart = conversionDailyTarget - conversionE;
				const suggestedConversionDailyAdjustment =
					conversionFirstPart + conversionSecondPart;

				setConversionPaceAnalysis({
					budget: conversionBudgetValue,
					totalDays,
					dailyTarget: conversionDailyTarget,
					idealValueToDate: idealRevenueToDate,
					actualValueToDate: actualRevenueToDate,
					valueUntilLastDay: revenueUntilLastDay,
					daysPassed: c,
					pace: conversionPace,
					suggestedDailyAdjustment: suggestedConversionDailyAdjustment,
					budgetDaily: conversionBudgetDaily,
				});
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		})();
	}, [customer, objectives, appliedDateRange, mergedSourcesQuerySuffix, paceChannelSpecs]);

	return {
		loading,
		error,
		costData,
		costByChannelSeries,
		budget,
		paceAnalysis,
		conversionValueData,
		conversionBudget,
		conversionPaceAnalysis,
	};
}
