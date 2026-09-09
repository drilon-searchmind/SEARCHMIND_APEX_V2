import { extractGoogleAdsClientErrorMessage, fetchGoogleAdsMetrics } from "@/lib/googleAdsApi";
import { aggregateGoogleAdsMetricsToDaily } from "@/lib/apexRadarGoogleAdsOverview";
import { getCurrencyConversionTable, conversionRateToDkk } from "@/lib/currencyConversionTable";
import { executeMcpGoogleAdsGaqlProxy } from "@root/lib/mcpGoogleAdsProxy";
import { classifyBrandGeneric } from "@/lib/googlePpcDashboardUtils";
import { pctChange, roundN, safeDiv } from "@/lib/performanceBriefDates";

const CHANNEL_LABELS = {
    2: "SEARCH",
    3: "DISPLAY",
    4: "SHOPPING",
    6: "VIDEO",
    10: "PERFORMANCE_MAX",
    12: "LOCAL",
    13: "SMART",
    14: "DISCOVERY",
    15: "TRAVEL",
    16: "DEMAND_GEN",
    SEARCH: "SEARCH",
    DISPLAY: "DISPLAY",
    SHOPPING: "SHOPPING",
    VIDEO: "VIDEO",
    PERFORMANCE_MAX: "PERFORMANCE_MAX",
    DEMAND_GEN: "DEMAND_GEN",
    DISCOVERY: "DISCOVERY",
};

function channelKey(value) {
    if (value == null) return "OTHER";
    const mapped = CHANNEL_LABELS[value] || CHANNEL_LABELS[String(value).toUpperCase()];
    return mapped || String(value).toUpperCase();
}

function campaignTypeLabel(channel, campaignName) {
    const key = channelKey(channel);
    if (key === "SEARCH") {
        const brand = classifyBrandGeneric(campaignName);
        if (brand === "brand") return "Søgning (brand)";
        if (brand === "generic") return "Søgning (generic)";
        return "Søgning";
    }
    if (key === "SHOPPING") return "Shopping";
    if (key === "PERFORMANCE_MAX") return "Performance Max";
    if (key === "DISPLAY") return "Display";
    if (key === "VIDEO") return "Video";
    if (key === "DEMAND_GEN") return "Demand Gen";
    if (key === "DISCOVERY") return "Discovery";
    return key.replace(/_/g, " ");
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function purchaseFromDailyRows(dailyRows) {
    let spend = 0;
    let revenue = 0;
    let conversions = 0;
    for (const row of dailyRows || []) {
        spend += num(row.spend);
        const convAction = (row.actions || []).find((a) => a.action_type === "purchase");
        conversions += num(convAction?.value);
        const valAction = (row.action_values || []).find((a) => a.action_type === "purchase");
        revenue += num(valAction?.value);
    }
    return {
        spend: roundN(spend, 2),
        revenue: roundN(revenue, 2),
        conversions: roundN(conversions, 2),
        roas: roundN(safeDiv(revenue, spend), 4),
        cpa: roundN(safeDiv(spend, conversions), 2),
    };
}

/**
 * Account totals via fetchGoogleAdsMetrics — same path as Apex overview / merged-sources googleDaily.
 */
function scaleMetricsToDkk(metrics, rate) {
    if (!rate || rate === 1) return metrics;
    return (metrics || []).map((row) => {
        const raw = Number(row?.metrics?.cost_micros) || 0;
        if (!raw) return row;
        return {
            ...row,
            metrics: {
                ...row.metrics,
                cost_micros: Math.round(raw * rate),
            },
        };
    });
}

async function fetchGoogleAccountTotals(settings, startDate, endDate) {
    const googleCid = String(settings.googleAdsCustomerId || "").trim();
    const { metrics, currencyCode } = await fetchGoogleAdsMetrics(
        googleCid,
        startDate,
        endDate,
        settings.googleAdsCountryFilter || undefined,
        settings.googleAdsCountryExclude || undefined,
        { quietLog: true }
    );
    const { data: currencyData } = await getCurrencyConversionTable();
    const rate = conversionRateToDkk(currencyCode || "DKK", currencyData);
    const daily = aggregateGoogleAdsMetricsToDaily(scaleMetricsToDkk(metrics, rate));
    return purchaseFromDailyRows(daily);
}

function parseCampaignRows(rows) {
    return (rows || []).map((row) => {
        const name = row?.campaign?.name || "Unknown";
        const spend = num(row?.metrics?.cost_micros) / 1_000_000;
        const revenue = num(row?.metrics?.conversions_value);
        const conversions = num(row?.metrics?.conversions);
        return {
            name,
            channel: channelKey(row?.campaign?.advertising_channel_type),
            status: row?.campaign?.status != null ? String(row.campaign.status) : "",
            type: campaignTypeLabel(row?.campaign?.advertising_channel_type, name),
            spend: roundN(spend, 2),
            revenue: roundN(revenue, 2),
            conversions: roundN(conversions, 2),
            clicks: Math.round(num(row?.metrics?.clicks)),
            impressions: Math.round(num(row?.metrics?.impressions)),
            roas: roundN(safeDiv(revenue, spend), 4),
            cpa: roundN(safeDiv(spend, conversions), 2),
        };
    });
}

function attachComparisons(current, previous) {
    return {
        ...current,
        vsPrev: {
            spend: pctChange(current.spend, previous?.spend),
            revenue: pctChange(current.revenue, previous?.revenue),
            conversions: pctChange(current.conversions, previous?.conversions),
            roas: pctChange(current.roas, previous?.roas),
            cpa: pctChange(current.cpa, previous?.cpa),
        },
    };
}

function rollupTypes(campaigns) {
    const byType = new Map();
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConv = campaigns.reduce((s, c) => s + c.conversions, 0);
    for (const c of campaigns) {
        const cur = byType.get(c.type) || { type: c.type, spend: 0, revenue: 0, conversions: 0 };
        cur.spend += c.spend;
        cur.revenue += c.revenue;
        cur.conversions += c.conversions;
        byType.set(c.type, cur);
    }
    return [...byType.values()]
        .map((row) => ({
            type: row.type,
            spend: roundN(row.spend, 2),
            revenue: roundN(row.revenue, 2),
            conversions: roundN(row.conversions, 2),
            roas: roundN(safeDiv(row.revenue, row.spend), 2),
            spendSharePct: roundN(safeDiv(row.spend, totalSpend) * 100, 1),
            conversionSharePct: roundN(safeDiv(row.conversions, totalConv) * 100, 1),
        }))
        .sort((a, b) => b.roas - a.roas);
}

async function queryCampaigns(customerId, startDate, endDate) {
    const gaql = `
SELECT campaign.name,
       campaign.advertising_channel_type,
       campaign.status,
       metrics.cost_micros,
       metrics.conversions,
       metrics.conversions_value,
       metrics.clicks,
       metrics.impressions
FROM campaign
WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  AND metrics.cost_micros > 0
`.trim();
    const result = await executeMcpGoogleAdsGaqlProxy(customerId, gaql);
    return parseCampaignRows(Array.isArray(result.rows) ? result.rows : []);
}

async function querySearchImpressionShare(customerId, startDate, endDate) {
    const gaql = `
SELECT campaign.name,
       metrics.search_impression_share,
       metrics.search_budget_lost_impression_share,
       metrics.search_rank_lost_impression_share,
       metrics.cost_micros
FROM campaign
WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  AND campaign.advertising_channel_type = 'SEARCH'
  AND metrics.cost_micros > 0
`.trim();
    const result = await executeMcpGoogleAdsGaqlProxy(customerId, gaql);
    const byName = new Map();
    const rows = Array.isArray(result.rows) ? result.rows : [];
    for (const row of rows) {
        const name = row?.campaign?.name || "";
        byName.set(name, {
            impressionShare: roundN(num(row?.metrics?.search_impression_share) * 100, 2),
            budgetLostIs: roundN(num(row?.metrics?.search_budget_lost_impression_share) * 100, 2),
            rankLostIs: roundN(num(row?.metrics?.search_rank_lost_impression_share) * 100, 2),
        });
    }
    return byName;
}

export async function fetchPerformanceBriefGoogle({ customerId, windows, settings = {} }) {
    try {
        const [last7Totals, prev7Totals, last7Campaigns, isByName] = await Promise.all([
            fetchGoogleAccountTotals(settings, windows.last7.start, windows.last7.end),
            fetchGoogleAccountTotals(settings, windows.prev7.start, windows.prev7.end),
            queryCampaigns(customerId, windows.last7.start, windows.last7.end),
            querySearchImpressionShare(customerId, windows.last7.start, windows.last7.end).catch(
                () => new Map()
            ),
        ]);

        const campaigns = last7Campaigns.slice(0, 20).map((c) => {
            const is = isByName.get(c.name) || null;
            return {
                ...c,
                spendSharePct: roundN(safeDiv(c.spend, last7Totals.spend) * 100, 1),
                impressionShare: is?.impressionShare ?? null,
                budgetLostIs: is?.budgetLostIs ?? null,
                rankLostIs: is?.rankLostIs ?? null,
            };
        });

        return {
            configured: true,
            dataSource:
                "fetchGoogleAdsMetrics + country filters + DKK conversion (same path as Apex overview googleDaily)",
            last7: attachComparisons(last7Totals, prev7Totals),
            campaignTypes: rollupTypes(last7Campaigns),
            campaigns,
            checksum: {
                accountSpend: last7Totals.spend,
                campaignQuerySpend: roundN(
                    last7Campaigns.reduce((s, c) => s + c.spend, 0),
                    2
                ),
            },
        };
    } catch (e) {
        throw new Error(extractGoogleAdsClientErrorMessage(e));
    }
}
