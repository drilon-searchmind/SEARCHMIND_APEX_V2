import { getDemoPayload, mergeDemoStaticExpenses } from "@/lib/demoCustomer";
import {
    totalAdSpendFromMerged,
    channelSpendTotalsFromMerged,
    AD_SPEND_CHANNELS,
} from "@/lib/mergeAdSpendDaily";
/** YYYY-MM-DD rows with `period` */
function filterDailyRows(rows, startDate, endDate) {
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => {
        const p = r.period || r.date;
        return p && String(p) >= startDate && String(p) <= endDate;
    });
}

/**
 * Recompute merged-sources aggregates from daily slices (matches mergedSourcesApi.js).
 * @param {object} settings - CustomerSettings + CustomerStaticExpenses merged shape
 */
export function sliceAndRecomputeMergedSources(fullMerged, startDate, endDate, settings = {}) {
    const shopifyDaily = filterDailyRows(fullMerged?.shopifyDaily, startDate, endDate);
    const facebookDaily = filterDailyRows(fullMerged?.facebookDaily, startDate, endDate);
    const googleDaily = filterDailyRows(fullMerged?.googleDaily, startDate, endDate);
    const pinterestDaily = filterDailyRows(fullMerged?.pinterestDaily, startDate, endDate);
    const snapchatDaily = filterDailyRows(fullMerged?.snapchatDaily, startDate, endDate);
    const bingDaily = filterDailyRows(fullMerged?.bingDaily, startDate, endDate);
    const redditDaily = filterDailyRows(fullMerged?.redditDaily, startDate, endDate);

    const staticExp = settings?.CustomerStaticExpenses || {};
    const cogsPercentage = staticExp.cogsPercentage ?? 0;
    const fetchCogs = settings?.fetchCogsFromStore === true;

    const totalSales = shopifyDaily.reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const netRevenue = shopifyDaily.reduce((sum, d) => sum + (d.net_sales || 0), 0);
    const orders = shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0);

    let totalCogs = 0;
    if (fetchCogs) {
        totalCogs = shopifyDaily.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0);
    } else {
        totalCogs = totalSales * cogsPercentage;
    }

    const totalCogsForNet = fetchCogs
        ? shopifyDaily.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
        : netRevenue * cogsPercentage;

    const fbAdspend = facebookDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const googleAdspend = googleDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const pinterestAdspend = pinterestDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const snapchatAdspend = snapchatDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const bingAdspend = bingDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const redditAdspend = redditDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const otherPaid = pinterestAdspend + snapchatAdspend + bingAdspend + redditAdspend;
    const grossProfitTotalSales = totalSales - totalCogs;
    const grossProfitNetSales = netRevenue - totalCogsForNet;
    const totalAdspend = fbAdspend + googleAdspend + otherPaid;
    const POASTotalSales = totalAdspend !== 0 ? grossProfitTotalSales / totalAdspend : 0;
    const CACTotalSales = orders > 0 ? totalAdspend / orders : 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((end - start) / msPerDay) + 1;

    const fmt = (n, d = 0) => (n ?? 0).toLocaleString("da-DK", { maximumFractionDigits: d });
    const grossProfitCalculation = fetchCogs
        ? `Net Revenue Ex Tax - COGS (from Store) \n
        = ${fmt(netRevenue)} - ${fmt(totalCogsForNet)} \n
        = ${fmt(grossProfitNetSales)}
    `
        : `Net Revenue - (Cogs % × Net Revenue) \n
        = ${fmt(netRevenue)} - (${cogsPercentage} × ${fmt(netRevenue)}) \n
        = ${fmt(netRevenue)} - ${fmt(totalCogsForNet)} \n
        = ${fmt(grossProfitNetSales)}
    `;
    const totalAdspendCalculation = `Facebook Adspend + Google Adspend \n
        = ${fmt(fbAdspend)} + ${fmt(googleAdspend)} \n
        = ${fmt(totalAdspend)}
    `;
    const POASNetProfit = totalAdspend !== 0 ? grossProfitNetSales / totalAdspend : 0;
    const poasCalculation =
        totalAdspend !== 0
            ? `(Gross Profit / Ad Spend) \n
        = ${fmt(grossProfitNetSales)} / ${fmt(totalAdspend)} \n
        = ${POASNetProfit.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    `
            : "N/A";
    const cacCalculation =
        orders > 0
            ? `(Marketing Spend / Orders) \n
        = (${fmt(fbAdspend)} + ${fmt(googleAdspend)}) / ${orders} \n
        = ${fmt(totalAdspend)} / ${orders} \n
        = ${fmt(CACTotalSales)}
    `
            : "N/A";

    const calculationsValueLabels = {
        grossProfit: `Net Revenue: ${fmt(netRevenue)}\nCOGS: ${fmt(totalCogsForNet)}`,
        spend: `Google Adspend: ${fmt(googleAdspend)}\nFB Adspend: ${fmt(fbAdspend)}`,
        poas: `Gross Profit: ${fmt(grossProfitNetSales)}\nAd Spend: ${fmt(totalAdspend)}`,
        cac: `Google Adspend: ${fmt(googleAdspend)}\nFB Adspend: ${fmt(fbAdspend)}\nOrders: ${orders}`,
    };

    return {
        shopifyDaily,
        facebookDaily,
        googleDaily,
        pinterestDaily,
        snapchatDaily,
        bingDaily,
        redditDaily,
        grossProfitTotalSales,
        grossProfitNetSales,
        POASTotalSales,
        CACTotalSales,
        calculationsData: {
            grossProfitCalculation,
            totalAdspendCalculation,
            poasCalculation,
            cacCalculation,
            valueLabels: calculationsValueLabels,
        },
    };
}

function normalizeCustomerSettings(customer) {
    if (!customer || typeof customer !== "object") return {};
    return {
        ...(customer.CustomerSettings || {}),
        CustomerStaticExpenses: customer.CustomerStaticExpenses || {},
    };
}

/**
 * Demo merged sources for [startDate, endDate] from the static template + customer COGS settings.
 * @param {object} [customer] - Mongo customer doc (optional; falls back to demo template customer)
 * @param {{ excludeAdSpendPlatforms?: string[] }} [options]
 */
export function getDemoMergedSourcesForRange(startDate, endDate, customer = null, options = {}) {
    const fullPayload = getDemoPayload("mergedSources");
    /** @type {Record<string, unknown>} */
    let full;
    try {
        full = JSON.parse(JSON.stringify(fullPayload));
    } catch {
        full = fullPayload;
    }
    const ex = Array.isArray(options.excludeAdSpendPlatforms) ? options.excludeAdSpendPlatforms : [];
    for (const c of AD_SPEND_CHANNELS) {
        if (ex.includes(c.id)) {
            full[c.mergeKey] = [];
        }
    }
    const template = getDemoPayload("customer");
    const mergedCustomer = template
        ? {
              ...template,
              ...(customer || {}),
              customerName: customer?.customerName ?? template.customerName,
              CustomerSettings: {
                  ...template.CustomerSettings,
                  ...(customer?.CustomerSettings || {}),
              },
              CustomerStaticExpenses: mergeDemoStaticExpenses(
                  template.CustomerStaticExpenses || {},
                  customer?.CustomerStaticExpenses || {}
              ),
          }
        : customer || {};
    const settings = normalizeCustomerSettings(mergedCustomer);
    return sliceAndRecomputeMergedSources(full, startDate, endDate, settings);
}

/** Matches fetchCustomerSegmentationShopifyql shape using merged slice. */
export function getDemoShopifyqlSegmentationFromMerged(merged) {
    const shopifyDaily = merged.shopifyDaily || [];
    const totalOrders = shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0);
    const newCustomers = Math.round(totalOrders * 0.38);
    const returningCustomers = Math.max(0, totalOrders - newCustomers);
    const totalCustomers = newCustomers + returningCustomers;
    return {
        newCustomers,
        returningCustomers,
        totalCustomers: totalCustomers || totalOrders,
        newPct: totalCustomers > 0 ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : 0,
        returningPct: totalCustomers > 0 ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : 0,
        source: "shopifyql",
        insights: ["Demo: new vs returning derived from merged-sources for the selected period."],
    };
}

/** Matches fetchCustomerSegmentationShopifyqlFull using demo merged data. */
export function getDemoShopifyqlFullFromMerged(merged) {
    const shopifyqlData = getDemoShopifyqlSegmentationFromMerged(merged);
    const shopifyDaily = merged.shopifyDaily || [];
    const totalOrders = shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0);
    const totalNetRevenue = Number(
        shopifyDaily.reduce((s, d) => s + (d.net_sales || d.total_sales || 0), 0).toFixed(2)
    );

    const { newCustomers, returningCustomers, totalCustomers, newPct, returningPct } = shopifyqlData;
    const newPctDec = totalCustomers > 0 ? newCustomers / totalCustomers : 0.4;

    const firstOrdersCount = Math.round(totalOrders * newPctDec);
    const ncaNetRevenue = totalOrders > 0 ? Number((totalNetRevenue * newPctDec).toFixed(2)) : 0;
    const returningCustomerNetRevenue = Number((totalNetRevenue - ncaNetRevenue).toFixed(2));

    const dailySeries = shopifyDaily.map((d) => {
        const orders = d.orders || 0;
        const rev = Number((d.net_sales || d.total_sales || 0).toFixed(2));
        return {
            period: d.period || d.date || d.day,
            orders,
            revenue: rev,
            newCustomers: Math.round(orders * newPctDec),
            returningCustomers: orders - Math.round(orders * newPctDec),
        };
    });

    const adSpend = totalAdSpendFromMerged(merged);
    const adSpendByChannel = channelSpendTotalsFromMerged(merged);


    return {
        totalCustomers: totalCustomers || totalOrders,
        newCustomers,
        returningCustomers,
        newPct,
        returningPct,
        repeatRate: 0,
        ordersPerReturning: 0,
        totalOrders,
        totalRevenue: totalNetRevenue,
        totalNetRevenue,
        ncaRevenue: ncaNetRevenue,
        ncaNetRevenue,
        returningCustomerNetRevenue,
        ltv30: null,
        ltv90: null,
        ltv180: null,
        ltv365: null,
        dailySeries,
        churnPercent: null,
        churnMonthly: null,
        ltvEstimate: null,
        firstTimeRepeatRate: null,
        firstTimeRepeatCount: 0,
        firstTimeBuyersCount: newCustomers,
        firstOrdersCount,
        insights: ["Demo: segmentation from merged-sources for the selected period."],
        cac: merged.CACTotalSales ?? null,
        adSpend,
        adSpendByChannel,
        source: "shopifyql",
    };
}
