/**
 * One-off generator for src/data/demo-customer-data.json
 * Run: node scripts/generate-demo-customer-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function daysYmd(startY, startM, startD, count) {
    const out = [];
    let d = new Date(Date.UTC(startY, startM - 1, startD));
    for (let i = 0; i < count; i++) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        out.push(`${y}-${m}-${day}`);
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

/** Inclusive calendar days from start (UTC) to end (UTC). */
function inclusiveDayCount(startY, startM, startD, endY, endM, endD) {
    const s = new Date(Date.UTC(startY, startM - 1, startD));
    const e = new Date(Date.UTC(endY, endM - 1, endD));
    return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

const DEMO_ID = "69c5097c84057563ba331cd2";
/** Demo merged-sources daily pool: 2025-01-01 through 2026-12-31 (730 days). */
const DEMO_DAILY_COUNT = inclusiveDayCount(2025, 1, 1, 2026, 12, 31);
const days = daysYmd(2025, 1, 1, DEMO_DAILY_COUNT);

/** Deterministic 0..1 — decorrelates revenue vs ad spend vs orders so YoY % isn’t ~same for every metric. */
function mix01(i, salt) {
    const x = Math.imul(i + salt * 9973, 1597334677) | 0;
    return ((x >>> 0) % 10001) / 10000;
}

/** Mild long-run growth (lower than before to avoid ~35% YoY everywhere) + weekly bump + daily jitter. */
const revenueDriftPerDay = 5;
const adSpendDriftPerDay = 2.4;

const shopifyDaily = days.map((period, i) => {
    const revJitter = 0.88 + mix01(i, 11) * 0.2;
    const orderJitter = 0.92 + mix01(i, 17) * 0.14;
    const base = (10800 + i * revenueDriftPerDay + (i % 7) * 260) * revJitter;
    const orders = Math.max(
        24,
        Math.round((34 + (i % 5) * 2.2 + i * 0.012) * orderJitter)
    );
    const net_sales = Math.round(base * 0.92 * 100) / 100;
    const total_sales = Math.round(base * 100) / 100;
    return {
        period,
        orders,
        gross_sales: Math.round(total_sales * 1.05 * 100) / 100,
        discounts: Math.round(total_sales * 0.02 * 100) / 100,
        returns: Math.round(total_sales * 0.01 * 100) / 100,
        net_sales,
        shipping_charges: Math.round(total_sales * 0.03 * 100) / 100,
        taxes: Math.round(total_sales * 0.15 * 100) / 100,
        total_sales,
        cost_of_goods_sold: Math.round(net_sales * 0.26 * 100) / 100,
    };
});

const facebookDaily = days.map((period, i) => {
    const spendJitter = 0.85 + mix01(i, 23) * 0.22;
    const spend =
        (620 + i * adSpendDriftPerDay + (i % 7) * 48 + mix01(i, 29) * 180) * spendJitter;
    return { period, spend: Math.round(spend * 100) / 100 };
});

const googleDaily = days.map((period, i) => {
    const spendJitter = 0.84 + mix01(i, 31) * 0.24;
    const spend =
        (480 + i * (adSpendDriftPerDay * 0.82) + (i % 6) * 42 + mix01(i, 37) * 140) * spendJitter;
    return { period, spend: Math.round(spend * 100) / 100 };
});

const netRevenue = shopifyDaily.reduce((s, d) => s + (d.net_sales || 0), 0);
const totalCogsForNet = shopifyDaily.reduce((s, d) => s + (d.cost_of_goods_sold || 0), 0);
const grossProfitNetSales = netRevenue - totalCogsForNet;
const fbAdspend = facebookDaily.reduce((s, d) => s + (d.spend || 0), 0);
const googleAdspend = googleDaily.reduce((s, d) => s + (d.spend || 0), 0);
const totalAdspend = fbAdspend + googleAdspend;
const orders = shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0);
const CACTotalSales = orders > 0 ? totalAdspend / orders : 0;

const mergedSources = {
    shopifyDaily,
    facebookDaily,
    googleDaily,
    grossProfitTotalSales: Math.round((shopifyDaily.reduce((s, d) => s + (d.total_sales || 0), 0) - totalCogsForNet) * 100) / 100,
    grossProfitNetSales: Math.round(grossProfitNetSales * 100) / 100,
    POASTotalSales: totalAdspend !== 0 ? grossProfitNetSales / totalAdspend : 0,
    CACTotalSales,
    calculationsData: {
        grossProfitCalculation: "Demo data",
        totalAdspendCalculation: "Demo data",
        poasCalculation: "Demo data",
        cacCalculation: "Demo data",
        valueLabels: {
            grossProfit: "Demo",
            spend: "Demo",
            poas: "Demo",
            cac: "Demo",
        },
    },
};

const customer = {
    _id: DEMO_ID,
    customerName: "Demo Property",
    customerType: "Shopify",
    isArchived: false,
    CustomerSettings: {
        metricPreference: "ROAS/POAS",
        fetchCogsFromStore: true,
        customerStoreValutaCode: "DKK",
        customerClickupID: "demo-clickup",
        customerMetaID: "",
        customerMetaIDExclude: "",
        changeCurrency: true,
        customerRevenueType: "net_sales",
        shopifyUrl: "demo-shop.myshopify.com",
        shopifyApiPassword: "demo-token",
        facebookAdAccountId: "123456789012345",
        googleAdsCustomerId: "1234567890",
        googleAdsCountryFilter: "",
        googleAdsCountryExclude: "",
        pinterestAdAccountId: "1234567890123",
        bingAdsCustomerId: "251234567",
        bingAdsAccountId: "1234567890",
        googleSearchConsoleProperty: "https://demo.example.com/",
        ga4PropertyId: "460732795",
        klaviyoPrivateApiKey: "demo-klaviyo-key",
    },
    CustomerStaticExpenses: {
        cogsPercentage: 0.26,
        shippingCostPerOrder: 16,
        pickNPackCostPerOrder: 5,
        transactionCostPercentage: 0.012,
        fixedExpenses: 22000,
        marketingBureauCost: 8000,
        marketingToolingCost: 1200,
    },
};

function ga4Row(dims, mets) {
    return {
        dimensionValues: dims.map((name, i) => ({ value: String(Object.values(arguments[0] || {})[i] ?? "") })),
        metricValues: mets.map((name, i) => ({ value: String(Object.values(arguments[1] || {})[i] ?? "0") })),
    };
}

// Simplified GA4-style responses (rows + headers) for analytics page
const ga4Timeseries = {
    dimensionHeaders: [{ name: "date" }],
    metricHeaders: [
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
    ],
    rows: days.slice(-30).map((date) => ({
        dimensionValues: [{ value: date.replace(/-/g, "") }],
        metricValues: [
            { value: String(80 + Math.floor(Math.random() * 40)) },
            { value: String(400 + Math.floor(Math.random() * 200)) },
            { value: String(0.35 + Math.random() * 0.1) },
            { value: String(120 + Math.floor(Math.random() * 60)) },
        ],
    })),
};

const ga4Channels = {
    dimensionHeaders: [{ name: "sessionDefaultChannelGroup" }],
    metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }],
    rows: [
        { dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "1200" }, { value: "980" }] },
        { dimensionValues: [{ value: "Direct" }], metricValues: [{ value: "800" }, { value: "720" }] },
        { dimensionValues: [{ value: "Paid Search" }], metricValues: [{ value: "600" }, { value: "540" }] },
    ],
};

const ga4Pages = {
    dimensionHeaders: [{ name: "pageTitle" }],
    metricHeaders: [{ name: "screenPageViews" }],
    rows: [
        { dimensionValues: [{ value: "Home — Demo" }], metricValues: [{ value: "2400" }] },
        { dimensionValues: [{ value: "Products" }], metricValues: [{ value: "1800" }] },
    ],
};

const ga4Acquisition = {
    dimensionHeaders: [{ name: "yearMonth" }, { name: "sessionDefaultChannelGroup" }],
    metricHeaders: [{ name: "sessions" }],
    rows: [
        { dimensionValues: [{ value: "202601" }, { value: "Direct" }], metricValues: [{ value: "400" }] },
        { dimensionValues: [{ value: "202601" }, { value: "Organic Search" }], metricValues: [{ value: "520" }] },
        { dimensionValues: [{ value: "202602" }, { value: "Direct" }], metricValues: [{ value: "380" }] },
        { dimensionValues: [{ value: "202602" }, { value: "Organic Search" }], metricValues: [{ value: "490" }] },
    ],
};

const ga4Devices = {
    dimensionHeaders: [{ name: "deviceCategory" }],
    metricHeaders: [{ name: "sessions" }],
    rows: [
        { dimensionValues: [{ value: "mobile" }], metricValues: [{ value: "2100" }] },
        { dimensionValues: [{ value: "desktop" }], metricValues: [{ value: "1400" }] },
        { dimensionValues: [{ value: "tablet" }], metricValues: [{ value: "180" }] },
    ],
};

const googlePpcDashboard = {
    metrics_by_date: days.slice(-14).map((date) => ({
        date,
        clicks: 200 + (date.charCodeAt(date.length - 1) % 50),
        impressions: 8000 + (date.charCodeAt(0) % 1000),
        conversions: 12 + (date.charCodeAt(5) % 8),
        conversions_value: 4500 + (date.charCodeAt(8) % 500),
        ad_spend: 2100 + (date.charCodeAt(3) % 200),
        roas: 2.1,
        aov: 350,
        ctr: 0.025,
        cpc: 10.5,
        conv_rate: 0.05,
    })),
    top_campaigns: [
        { campaign_name: "Search — Brand", clicks: 5000, impressions: 120000, ctr: 0.04 },
        { campaign_name: "PMax — Demo", clicks: 3200, impressions: 90000, ctr: 0.035 },
    ],
    campaigns_by_date: [],
};

const facebookCampaignInsights = {
    metrics_by_date: days.slice(-14).map((date) => ({
        date,
        clicks: 300,
        impressions: 12000,
        conversions: 18,
        conversion_value: 6200,
        ad_spend: 1800,
        roas: 3.4,
        aov: 340,
        ctr: 0.025,
        cpc: 6,
        cpm: 150,
        conv_rate: 0.06,
        purchase_roas: [{ value: 3.4 }],
        actions: [{ action_type: "offsite_conversion.purchase", value: "18" }],
    })),
    top_campaigns: [
        { campaign_name: "Prospecting — Demo", clicks: 4000, impressions: 95000, conversions: 120, ctr: 0.042 },
    ],
    campaigns_by_date: [],
};

const pinterestDashboard = {
    metrics_by_date: days.slice(-14).map((date) => ({
        date,
        conversion_value: 2100,
        ad_spend: 950,
        conversions: 14,
        impressions: 110000,
        clicks: 2200,
        saves: 180,
        roas: 2.2,
        aov: 150,
        ctr: 0.02,
        cpc: 0.43,
        cpm: 8.6,
    })),
    top_campaigns: [
        { campaign_name: "Pinterest — Awareness", clicks: 2100, impressions: 110000, ctr: 0.019, saves: 180 },
    ],
    campaigns_by_date: [],
};

const klaviyoDashboard = {
    metrics_by_date: [
        {
            date: "2026-03-01",
            recipients: 45000,
            opens: 12000,
            clicks: 2100,
            conversions: 340,
            conversion_value: 125000,
            unsubscribes: 120,
            open_rate: 12000 / 45000,
            click_rate: 2100 / 45000,
        },
    ],
    metrics_by_date_prev: [
        {
            date: "2025-03-01",
            recipients: 42000,
            opens: 11000,
            clicks: 1900,
            conversions: 310,
            conversion_value: 118000,
            unsubscribes: 115,
            open_rate: 11000 / 42000,
            click_rate: 1900 / 42000,
        },
    ],
    top_campaigns: [
        {
            campaign_name: "abc123…",
            campaign_id: "cmp_demo_1",
            recipients: 12000,
            opens: 4000,
            clicks: 800,
            open_rate: 0.33,
            click_rate: 0.067,
            conversions: 90,
            conversion_value: 32000,
            unsubscribes: 12,
        },
    ],
};

const seoDashboardMetrics = {
    metrics: {
        rows: days.slice(-30).map((date) => ({
            keys: [date],
            clicks: 20 + (date.charCodeAt(8) % 15),
            impressions: 800 + (date.charCodeAt(5) % 200),
            ctr: 0.03,
            position: 12 + (date.charCodeAt(3) % 8),
        })),
    },
    keywords: {
        rows: [
            { keys: ["demo brand"], clicks: 400, impressions: 5000, ctr: 0.08, position: 3.2 },
            { keys: ["demo product"], clicks: 220, impressions: 3200, ctr: 0.07, position: 5.1 },
        ],
    },
    urls: {
        rows: [
            { keys: ["https://demo.example.com/"], clicks: 600, impressions: 8000, ctr: 0.075, position: 4.5 },
        ],
    },
};

const shopifyProducts = {
    products: [
        {
            productId: "gid://shopify/Product/1",
            title: "Demo Hoodie",
            handle: "demo-hoodie",
            vendor: "Demo",
            image: null,
            productType: "Apparel",
            unitsSold: 210,
            ordersCount: 180,
            totalRevenue: 42000,
            avgPrice: 200,
            inventoryStock: null,
            inventoryValue: null,
        },
        {
            productId: "gid://shopify/Product/2",
            title: "Demo Tee",
            handle: "demo-tee",
            vendor: "Demo",
            image: null,
            productType: "Apparel",
            unitsSold: 560,
            ordersCount: 420,
            totalRevenue: 28000,
            avgPrice: 50,
            inventoryStock: null,
            inventoryValue: null,
        },
    ],
};

const shopifyInventory = {
    inventory: {
        "gid://shopify/Product/1": { inventoryStock: 120, inventoryValue: 8000 },
        "gid://shopify/Product/2": { inventoryStock: 340, inventoryValue: 10200 },
    },
};

const customerSegmentation = {
    totalCustomers: 8500,
    newCustomers: 3200,
    returningCustomers: 5300,
    newPct: 37.65,
    returningPct: 62.35,
    repeatRate: 0.42,
    ordersPerReturning: 2.1,
    totalOrders: 12400,
    totalRevenue: 1850000,
    totalNetRevenue: 1520000,
    ncaRevenue: 580000,
    ncaNetRevenue: 520000,
    returningCustomerNetRevenue: 1000000,
    ltv30: 450,
    ltv90: 890,
    ltv180: 1200,
    ltv365: 2100,
    dailySeries: shopifyDaily.slice(-30).map((d) => ({
        period: d.period,
        orders: d.orders,
        revenue: d.total_sales,
        newCustomers: Math.round(d.orders * 0.38),
        returningCustomers: d.orders - Math.round(d.orders * 0.38),
    })),
    churnPercent: 2.5,
    churnMonthly: 120,
    ltvEstimate: 950,
    firstTimeRepeatRate: 0.28,
    firstTimeRepeatCount: 400,
    firstTimeBuyersCount: 1200,
    firstOrdersCount: 1200,
    insights: ["Demo segmentation data."],
    cac: mergedSources.CACTotalSales,
    adSpend: totalAdspend,
};

const customerSegmentationShopifyql = {
    newCustomers: 3200,
    returningCustomers: 5300,
    totalCustomers: 8500,
    newPct: 37.65,
    returningPct: 62.35,
    source: "shopifyql",
    insights: ["Demo ShopifyQL segmentation."],
};

const customerSegmentationShopifyqlFull = { ...customerSegmentation, source: "shopifyql" };

const clickupTeamMembers = {
    members: [
        { id: "u1", username: "Alex Demo", email: "alex@example.com", service: "s1", avatar: null },
        { id: "u2", username: "Jamie Demo", email: "jamie@example.com", service: "s2", avatar: null },
    ],
};

const customerTrackingScores = {
    totalScore: 82,
    performanceScore: 85,
    trackingScore: 78,
    complianceScore: 80,
    createdAt: new Date().toISOString(),
};

const customKpis = [
    {
        id: "demo_kpi_1",
        _id: "demo_kpi_1",
        name: "Demo POAS",
        parts: [],
        metricA: "netRevenue",
        metricB: "adSpend",
        operator: "/",
    },
];

const campaigns = [];

const seoKeywordsBrand = {
    success: true,
    data: { keywords: ["demo", "demo brand", "demostore"] },
};

const seoKeywordsExact = {
    success: true,
    data: [{ _id: "ex1", name: "Core terms", keywords: ["buy demo", "demo shop"] }],
};

const seoKeywordsPartial = {
    success: true,
    data: [{ _id: "pa1", name: "Long tail", keywords: ["demo product review"] }],
};

const dataWrappedReports = {
    monthly: [
        { period: "2026-02", periodLabel: "February 2026", createdAt: new Date().toISOString() },
        { period: "2026-01", periodLabel: "January 2026", createdAt: new Date().toISOString() },
    ],
    quarterly: [],
    yearly: [],
};

const dataWrappedByPeriod = {
    data: {
        customerName: "Demo Property",
        period: "2026-02",
        year: 2026,
        month: 2,
        netRevenue: 420000,
        orders: 2100,
        roas: 4.2,
        poas: 1.8,
        totalSpend: 95000,
        netAov: 200,
        topChannel: "Facebook",
        topChannelShare: 58,
        services: ["PS", "PPC", "SEO", "EM"],
    },
    fromCache: true,
};

const bundle = {
    customer,
    mergedSources,
    googlePpcDashboard,
    facebookCampaignInsights,
    pinterestDashboard,
    klaviyoDashboard,
    ga4Timeseries,
    ga4Channels,
    ga4Pages,
    ga4Acquisition,
    ga4Devices,
    seoDashboardMetrics,
    shopifyProducts,
    shopifyInventory,
    customerSegmentation,
    customerSegmentationShopifyql,
    customerSegmentationShopifyqlFull,
    clickupTeamMembers,
    customerTrackingScores,
    customKpis,
    campaigns,
    seoKeywordsBrand,
    seoKeywordsExact,
    seoKeywordsPartial,
    dataWrappedReports,
    dataWrappedByPeriod,
};

const outPath = path.join(__dirname, "..", "src", "data", "demo-customer-data.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 0), "utf8");
console.log("Wrote", outPath, `(${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
