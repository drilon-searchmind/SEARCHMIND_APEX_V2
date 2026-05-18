import dayjs from "dayjs";
import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";

/**
 * Build daily rows for parent property by aggregating child data.
 * Matches the structure expected by DailyMetricsTable (daily-overview).
 * @param {Array} dailyDataList - Filtered allDailyChartData (per child: shopifyDaily, channel *Daily, *DailyPrev)
 * @param {Array} childCustomers - Full customer objects with CustomerStaticExpenses
 * @param {Object} options - { usePrev: boolean, shopifyRevenueField?: 'net_sales'|'gross_sales' }
 *   Display revenue / ROAS / Spendshare / AOV use shopifyRevenueField; COGS%, transaction fees, net profit use net_sales.
 */
export function buildParentDailyRows(dailyDataList, childCustomers, options = {}) {
    const { usePrev = false, shopifyRevenueField = "net_sales" } = options;
    const shopifyKey = usePrev ? "shopifyDailyPrev" : "shopifyDaily";
    const revenueField = shopifyRevenueField === "gross_sales" ? "gross_sales" : "net_sales";

    const periodMap = {};

    dailyDataList.forEach((result) => {
        const customer = childCustomers.find((c) => String(c._id) === String(result._id));
        if (!customer) return;

        const shopify = result[shopifyKey] || [];
        /** @type {Record<string, Record<string, number>>} */
        const channelMaps = {};
        for (const c of AD_SPEND_CHANNELS) {
            const mergeKey = usePrev ? `${c.mergeKey}Prev` : c.mergeKey;
            const arr = result[mergeKey] || [];
            channelMaps[c.dailyOverviewColumnKey] = Object.fromEntries(
                arr.map((d) => [d.period, Number(d.spend || 0)])
            );
        }

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

            let paidMediaCost = 0;
            const channelCosts = {};
            for (const c of AD_SPEND_CHANNELS) {
                const v = channelMaps[c.dailyOverviewColumnKey][date] || 0;
                channelCosts[c.dailyOverviewColumnKey] = v;
                paidMediaCost += v;
            }

            if (!periodMap[date]) {
                periodMap[date] = {
                    date,
                    orders: 0,
                    totalSales: 0,
                    displayRevenue: 0,
                    economicsNetSales: 0,
                    ppcCost: 0,
                    psCost: 0,
                    snapchatCost: 0,
                    redditCost: 0,
                    pinterestCost: 0,
                    bingCost: 0,
                    childContribs: [],
                };
            }

            const cogs = fetchCogs ? d.cost_of_goods_sold || 0 : economicsNetSales * cogsPercentage;
            const variableExpense = shippingCostPerOrder * orders + pickNPackCostPerOrder * orders;
            const daysInMonth = dayjs(date).daysInMonth();
            const fixedExpense = fixedExpensesMonthly / daysInMonth;
            const transactionFee = economicsNetSales * transactionCostPercentage;

            periodMap[date].orders += orders;
            periodMap[date].totalSales += totalSales;
            periodMap[date].displayRevenue += displaySales;
            periodMap[date].economicsNetSales += economicsNetSales;
            periodMap[date].ppcCost += channelCosts.ppcCost || 0;
            periodMap[date].psCost += channelCosts.psCost || 0;
            periodMap[date].snapchatCost += channelCosts.snapchatCost || 0;
            periodMap[date].redditCost += channelCosts.redditCost || 0;
            periodMap[date].pinterestCost += channelCosts.pinterestCost || 0;
            periodMap[date].bingCost += channelCosts.bingCost || 0;
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
            const {
                date,
                orders,
                totalSales,
                displayRevenue,
                economicsNetSales,
                ppcCost,
                psCost,
                snapchatCost,
                redditCost,
                pinterestCost,
                bingCost,
                childContribs,
            } = day;
            const cost =
                ppcCost + psCost + snapchatCost + redditCost + pinterestCost + bingCost;
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
                snapchatCost,
                redditCost,
                pinterestCost,
                bingCost,
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
