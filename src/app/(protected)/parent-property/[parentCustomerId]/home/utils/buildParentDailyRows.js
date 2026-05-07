import dayjs from "dayjs";

/**
 * Build daily rows for parent property by aggregating child data.
 * Matches the structure expected by DailyMetricsTable (daily-overview).
 * @param {Array} dailyDataList - Filtered allDailyChartData (per child: shopifyDaily, facebookDaily, googleDaily, shopifyDailyPrev, etc.)
 * @param {Array} childCustomers - Full customer objects with CustomerStaticExpenses
 * @param {Object} options - { usePrev: boolean, shopifyRevenueField?: 'net_sales'|'gross_sales' }
 *   Display revenue / ROAS / Spendshare / AOV use shopifyRevenueField; COGS%, transaction fees, net profit use net_sales.
 */
export function buildParentDailyRows(dailyDataList, childCustomers, options = {}) {
    const { usePrev = false, shopifyRevenueField = "net_sales" } = options;
    const shopifyKey = usePrev ? "shopifyDailyPrev" : "shopifyDaily";
    const facebookKey = usePrev ? "facebookDailyPrev" : "facebookDaily";
    const googleKey = usePrev ? "googleDailyPrev" : "googleDaily";

    const revenueField = shopifyRevenueField === "gross_sales" ? "gross_sales" : "net_sales";

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
            const economicsNetSales = d.net_sales || 0;
            const displaySales = (d[revenueField] != null ? d[revenueField] : economicsNetSales) || 0;
            const ppcCost = googleMap[date] || 0;
            const psCost = fbMap[date] || 0;
            const cogsStore = d.cost_of_goods_sold || 0;

            if (!periodMap[date]) {
                periodMap[date] = {
                    date,
                    orders: 0,
                    totalSales: 0,
                    displayRevenue: 0,
                    economicsNetSales: 0,
                    ppcCost: 0,
                    psCost: 0,
                    childContribs: [],
                };
            }

            const cogs = fetchCogs ? cogsStore : economicsNetSales * cogsPercentage;
            const variableExpense = shippingCostPerOrder * orders + pickNPackCostPerOrder * orders;
            const daysInMonth = dayjs(date).daysInMonth();
            const fixedExpense = fixedExpensesMonthly / daysInMonth;
            const transactionFee = economicsNetSales * transactionCostPercentage;

            periodMap[date].orders += orders;
            periodMap[date].totalSales += totalSales;
            periodMap[date].displayRevenue += displaySales;
            periodMap[date].economicsNetSales += economicsNetSales;
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
            const { date, orders, totalSales, displayRevenue, economicsNetSales, ppcCost, psCost, childContribs } = day;
            const cost = ppcCost + psCost;
            const cogs = childContribs.reduce((s, c) => s + c.cogs, 0);
            const variableExpense = childContribs.reduce((s, c) => s + c.variableExpense, 0);
            const fixedExpense = childContribs.reduce((s, c) => s + c.fixedExpense, 0);
            const transactionFee = childContribs.reduce((s, c) => s + c.transactionFee, 0);

            const allCosts = cogs + fixedExpense + variableExpense + transactionFee + cost;
            const netProfit = economicsNetSales - allCosts;
            const roas = cost > 0 ? displayRevenue / cost : null;
            const spendshare = displayRevenue > 0 ? cost / displayRevenue : null;
            const grossProfit = economicsNetSales - cogs;
            const poas = cost > 0 ? grossProfit / cost : null;
            const aov = orders > 0 ? displayRevenue / orders : null;

            return {
                date,
                orders,
                totalSales,
                netRevenue: displayRevenue,
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
