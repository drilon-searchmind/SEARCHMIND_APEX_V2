import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

const DANISH_VAT = 1.25;

async function fetchPeriodData(customerId, startDate, endDate) {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
	const res = await fetch(
		`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`
	);
	if (!res.ok) throw new Error('Failed to fetch daily data');
	return await res.json();
}

function buildDailyRows(merged, customer, revenueType) {
	const shopify = merged.shopifyDaily || [];
	const facebook = merged.facebookDaily || [];
	const google = merged.googleDaily || [];
	const fbMap = Object.fromEntries(facebook.map((d) => [d.period, d.spend]));
	const googleMap = Object.fromEntries(google.map((d) => [d.period, d.spend]));

	let cogsPercentage = 0;
	if (
		customer?.CustomerStaticExpenses &&
		typeof customer.CustomerStaticExpenses.cogsPercentage === 'number'
	) {
		cogsPercentage = customer.CustomerStaticExpenses.cogsPercentage;
	}

	const shippingCostPerOrder =
		customer?.CustomerStaticExpenses?.shippingCostPerOrder ?? 0;
	const transactionCostPercentage =
		customer?.CustomerStaticExpenses?.transactionCostPercentage ?? 0.015;
	const fixedExpensesMonthly = Number(customer?.CustomerStaticExpenses?.fixedExpenses) || 0;
	const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;

	return shopify.map((d) => {
		const date = d.period;
		const orders = d.orders || 0;
		const totalSales = d.total_sales || 0;
		const netRevenue = d.net_sales || 0;
		const revenueExTax = (d.net_sales || d.total_sales || 0) / DANISH_VAT;
		const ppcCost = googleMap[date] || 0;
		const psCost = fbMap[date] || 0;
		const cost = ppcCost + psCost;
		const roas = cost > 0 ? revenueExTax / cost : null;
		const spendshare = revenueExTax > 0 ? cost / revenueExTax : null;

		let cogs = 0;
		if (fetchCogs) {
			cogs = d.cost_of_goods_sold || 0;
		} else {
			cogs = revenueExTax * cogsPercentage;
		}

		let poas = null;
		if (cost > 0) {
			const grossProfit = revenueExTax - cogs;
			poas = grossProfit / cost;
		}

    const cac = merged.CACTotalSales ?? null;
    const aov = orders > 0 ? revenueExTax / orders : null;
		// Variable costs: shipping + transaction fees only (excludes ad spend, matches performance-dashboard)
		const variableExpense =
			shippingCostPerOrder * orders +
			revenueExTax * transactionCostPercentage;
		// Fixed costs: prorate by actual days in month (matches performance-dashboard)
		const daysInMonth = dayjs(date).daysInMonth();
		const fixedExpense = fixedExpensesMonthly / daysInMonth;

		return {
			date,
			orders,
			totalSales,
			netRevenue,
			revenueExTax,
			ppcCost,
			psCost,
			roas,
			spendshare,
			poas,
			aov,
			cac,
			cogs,
			variableExpense,
			fixedExpense,
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

export function useDailyOverviewData(customer, appliedDateRange) {
	const [revenueTypeState, setRevenueTypeState] = useState('total_sales');
	const [customerMetricPreference, setCustomerMetricPreference] =
		useState('ROAS/POAS');
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [rowsPrev, setRowsPrev] = useState([]);
	const [rowsLastYear, setRowsLastYear] = useState([]);
	const [loadingLastYear, setLoadingLastYear] = useState(false);

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

		(async () => {
			try {
				const merged = await fetchPeriodData(
					customer._id,
					appliedDateRange.startDate,
					appliedDateRange.endDate
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
					prevEndStr
				);
				const dailyRowsPrev = buildPrevPeriodRows(
					mergedPrev,
					customer,
					revenueType
				);
				setRowsPrev(dailyRowsPrev);

				setLoadingLastYear(true);
				try {
					const start2 = new Date(appliedDateRange.startDate);
					const end2 = new Date(appliedDateRange.endDate);
					const lastYearStart = new Date(
						start2.setFullYear(start2.getFullYear() - 1)
					).toISOString().slice(0, 10);
					const lastYearEnd = new Date(
						end2.setFullYear(end2.getFullYear() - 1)
					).toISOString().slice(0, 10);
					const mergedLastYear = await fetchPeriodData(
						customer._id,
						lastYearStart,
						lastYearEnd
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
			} finally {
				setLoading(false);
			}
		})();
	}, [customer, appliedDateRange]);

	return {
		rows,
		rowsPrev,
		rowsLastYear,
		loading,
		loadingLastYear,
		error,
		revenueTypeState,
		customerMetricPreference,
	};
}
