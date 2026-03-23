import dayjs from "dayjs";

/**
 * Build daily rows for parent property by aggregating child data.
 * Matches the structure expected by DailyMetricsTable (daily-overview).
 * @param {Array} dailyDataList - Filtered allDailyChartData (per child: shopifyDaily, facebookDaily, googleDaily, shopifyDailyPrev, etc.)
 * @param {Array} childCustomers - Full customer objects with CustomerStaticExpenses
 * @param {Object} options - { usePrev: boolean } - use prev daily arrays when true
 */
export function buildParentDailyRows(dailyDataList, childCustomers, options = {}) {
    const { usePrev = false } = options;
    const shopifyKey = usePrev ? "shopifyDailyPrev" : "shopifyDaily";
    const facebookKey = usePrev ? "facebookDailyPrev" : "facebookDaily";
    const googleKey = usePrev ? "googleDailyPrev" : "googleDaily";

    const periodMap = {};

    dailyDataList.forEach((result) => {
        const customer = childCustomers.find((c) => c._id === result._id);
        if (!customer) return;

        const shopify = result[shopifyKey] || [];
        const facebook = result[facebookKey] || [];
        const google = result[googleKey] || [];

        const fbMap = Object.fromEntries(facebook.map((d) => [d.period, d.spend || 0]));
        const googleMap = Object.fromEntries(google.map((d) => [d.period, d.spend || 0]));

        const cogsPercentage = customer?.CustomerStaticExpenses?.cogsPercentage ?? 0;
        const shippingCostPerOrder = customer?.CustomerStaticExpenses?.shippingCostPerOrder ?? 0;
        const pickNPackCostPerOrder = customer?.CustomerStaticExpenses?.pickNPackCostPerOrder ?? 0;
        const transactionCostPercentage = customer?.CustomerStaticExpenses?.transactionCostPercentage ?? 0.015;
        const fixedExpensesMonthly = Number(customer?.CustomerStaticExpenses?.fixedExpenses) || 0;
        const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;

        shopify.forEach((d) => {
            const date = d.period;
            const orders = d.orders || 0;
            const totalSales = d.total_sales || 0;
            const netRevenue = d.net_sales || 0;
            const ppcCost = googleMap[date] || 0;
            const psCost = fbMap[date] || 0;
            const cogsStore = d.cost_of_goods_sold || 0;

            if (!periodMap[date]) {
                periodMap[date] = {
                    date,
                    orders: 0,
                    totalSales: 0,
                    netRevenue: 0,
                    ppcCost: 0,
                    psCost: 0,
                    childContribs: [],
                };
            }

            const cogs = fetchCogs ? cogsStore : netRevenue * cogsPercentage;
            const variableExpense = shippingCostPerOrder * orders + pickNPackCostPerOrder * orders;
            const daysInMonth = dayjs(date).daysInMonth();
            const fixedExpense = fixedExpensesMonthly / daysInMonth;
            const transactionFee = netRevenue * transactionCostPercentage;

            periodMap[date].orders += orders;
            periodMap[date].totalSales += totalSales;
            periodMap[date].netRevenue += netRevenue;
            periodMap[date].ppcCost += ppcCost;
            periodMap[date].psCost += psCost;
            periodMap[date].childContribs.push({
                cogs,
                variableExpense,
                fixedExpense,
                transactionFee,
            });
        });
    });

    return Object.values(periodMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day) => {
            const { date, orders, totalSales, netRevenue, ppcCost, psCost, childContribs } = day;
            const cost = ppcCost + psCost;
            const cogs = childContribs.reduce((s, c) => s + c.cogs, 0);
            const variableExpense = childContribs.reduce((s, c) => s + c.variableExpense, 0);
            const fixedExpense = childContribs.reduce((s, c) => s + c.fixedExpense, 0);
            const transactionFee = childContribs.reduce((s, c) => s + c.transactionFee, 0);

            const allCosts = cogs + fixedExpense + variableExpense + transactionFee + cost;
            const netProfit = netRevenue - allCosts;
            const roas = cost > 0 ? netRevenue / cost : null;
            const spendshare = netRevenue > 0 ? cost / netRevenue : null;
            const grossProfit = netRevenue - cogs;
            const poas = cost > 0 ? grossProfit / cost : null;
            const aov = orders > 0 ? netRevenue / orders : null;

            return {
                date,
                orders,
                totalSales,
                netRevenue,
                ppcCost,
                psCost,
                roas,
                spendshare,
                poas,
                aov,
                cac: null,
                cogs,
                variableExpense,
                fixedExpense,
                transactionFee,
                netProfit,
            };
        });
}
