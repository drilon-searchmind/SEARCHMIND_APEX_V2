/**
 * Compute one ecommerce portfolio-summary row (store + ad spend + attributed channel revenue).
 * Lighter than weekly-audit (no ClickUp team, top sellers, SEO). Never throws.
 */
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { fetchFacebookAdsPSDashboardMetrics } from "@/lib/facebookApi";
import { fetchGoogleAdsPPCDashboardMetrics } from "@/lib/googleAdsPpcDashboard";
import {
    getGoogleAdsDeveloperToken,
    getGoogleAdsManagerCustomerId,
    getGoogleAdsOAuthClientId,
    getGoogleAdsOAuthClientSecret,
    getGoogleAdsRefreshToken,
} from "@/lib/googleAdsOAuthEnv";
import { fetchKlaviyoDashboardMetricsBothPeriods } from "@/lib/klaviyoDashboard";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import {
    aggregateBlendedFromMerged,
    aggregatePpcFromGoogle,
    aggregatePsFromFacebook,
    roundNum,
} from "@root/lib/weeklyAuditHelpers";

function plain(doc) {
    return doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function buildSettings(customer) {
    return {
        customerName: customer.customerName,
        customerType: customer.customerType || "Shopify",
        ...(customer.CustomerSettings || {}),
        CustomerStaticExpenses: customer.CustomerStaticExpenses || {},
    };
}

function sumField(rows, key) {
    return (rows || []).reduce((s, d) => s + (parseFloat(d[key]) || 0), 0);
}

/** Store revenue breakdown (already DKK from fetchMergedSources). */
function storeRevenueBreakdown(shopifyDaily) {
    return {
        netSales: roundNum(sumField(shopifyDaily, "net_sales")),
        totalSales: roundNum(sumField(shopifyDaily, "total_sales")),
        grossSales: roundNum(sumField(shopifyDaily, "gross_sales")),
        custom1Sales: roundNum(sumField(shopifyDaily, "custom_1")),
    };
}

function preferredStoreRevenue(breakdown, revenueType) {
    const type = String(revenueType || "net_sales").trim();
    if (type === "total_sales") return breakdown.totalSales;
    if (type === "gross_sales") return breakdown.grossSales;
    if (type === "custom_1") return breakdown.custom1Sales;
    return breakdown.netSales;
}

function emptyMoneyFields() {
    return {
        revenue: null,
        revenuePrev: null,
        revenueType: "net_sales",
        preferredRevenue: null,
        preferredRevenuePrev: null,
        netSales: null,
        netSalesPrev: null,
        totalSales: null,
        totalSalesPrev: null,
        grossSales: null,
        grossSalesPrev: null,
        custom1Sales: null,
        custom1SalesPrev: null,
        orders: null,
        ordersPrev: null,
        spendTotal: null,
        spendTotalPrev: null,
        spendGoogle: null,
        spendGooglePrev: null,
        spendMeta: null,
        spendMetaPrev: null,
        spendOther: null,
        spendOtherPrev: null,
        revenueGoogle: null,
        revenueGooglePrev: null,
        revenueMeta: null,
        revenueMetaPrev: null,
        revenueEmail: null,
        revenueEmailPrev: null,
        grossProfit: null,
        grossProfitPrev: null,
    };
}

async function settle(promise) {
    try {
        return { ok: true, value: await promise };
    } catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
}

function gap(source, reason, message) {
    return { source, reason, message: message || reason };
}

/**
 * @param {object} customerDoc
 * @param {{ startDate: string, endDate: string, compareStartDate: string, compareEndDate: string, windowKey: string }} window
 * @param {{ parentNameById?: Map<string, string> }} [opts]
 */
export async function computePortfolioSummaryRow(customerDoc, window, opts = {}) {
    const customer = plain(customerDoc);
    const settings = buildSettings(customer);
    const customerId = String(customer._id);
    const parentId = customer.parentCustomer ? String(customer.parentCustomer) : null;
    const parentName =
        parentId && opts.parentNameById ? opts.parentNameById.get(parentId) || null : null;

    const base = {
        customerId,
        customerName: customer.customerName || "",
        // All money fields are converted to DKK by fetchMergedSources / Meta / Google pipelines.
        // Do not label with the shop's native currency (EUR/GBP) — that misleads MCP/TV dashboards.
        currency: "DKK",
        storeCurrency: settings.customerStoreValutaCode || "DKK",
        parentId,
        parentName,
        businessCategory: "ecommerce",
        windowKey: window.windowKey,
        startDate: window.startDate,
        endDate: window.endDate,
        compareStartDate: window.compareStartDate,
        compareEndDate: window.compareEndDate,
        lastSync: { store: null, google: null, meta: null, klaviyo: null },
        dataGaps: [],
        status: "ok",
        lastError: "",
        cogsConfigured: false,
    };

    const mergeOpts = { dailyBreakdown: true, source: "portfolio-summary" };
    const [curMergedR, prevMergedR] = await Promise.all([
        settle(fetchMergedSources(settings, window.startDate, window.endDate, mergeOpts)),
        settle(
            fetchMergedSources(
                settings,
                window.compareStartDate,
                window.compareEndDate,
                mergeOpts
            )
        ),
    ]);

    if (!curMergedR.ok || !prevMergedR.ok) {
        return {
            ...base,
            status: "error",
            lastError: curMergedR.error || prevMergedR.error || "Store/adspend fetch failed",
            dataGaps: [gap("store", "error", curMergedR.error || prevMergedR.error)],
            ...emptyMoneyFields(),
        };
    }

    const cur = curMergedR.value;
    const prev = prevMergedR.value;
    const nowIso = new Date().toISOString();
    base.lastSync.store = nowIso;

    const blendedCur = aggregateBlendedFromMerged(cur);
    const blendedPrev = aggregateBlendedFromMerged(prev);

    const fetchCogs = settings.fetchCogsFromStore === true;
    const cogsCur = sumField(cur.shopifyDaily, "cost_of_goods_sold");
    const cogsPrev = sumField(prev.shopifyDaily, "cost_of_goods_sold");
    const cogsConfigured = Boolean(fetchCogs && (cogsCur > 0 || cogsPrev > 0));
    // Match weekly-audit: grossProfitNet = COGS-aware when present, else net sales.
    const grossProfit = cogsConfigured
        ? roundNum(blendedCur.netSales - cogsCur)
        : roundNum(blendedCur.grossProfitNet);
    const grossProfitPrev = cogsConfigured
        ? roundNum(blendedPrev.netSales - cogsPrev)
        : roundNum(blendedPrev.grossProfitNet);

    if (!(cur.shopifyDaily || []).length && !(prev.shopifyDaily || []).length) {
        base.dataGaps.push(gap("store", "no_data", "No store revenue rows for either period"));
    }

    // Google attributed conversion value (current + prev)
    let revenueGoogle = null;
    let revenueGooglePrev = null;
    if (isValidIntegrationId(settings.googleAdsCustomerId)) {
        const [gCur, gPrev] = await Promise.all([
            settle(
                fetchGoogleAdsPPCDashboardMetrics({
                    developerToken: getGoogleAdsDeveloperToken(),
                    clientId: getGoogleAdsOAuthClientId(),
                    clientSecret: getGoogleAdsOAuthClientSecret(),
                    refreshToken: getGoogleAdsRefreshToken(),
                    customerId: settings.googleAdsCustomerId,
                    managerCustomerId: getGoogleAdsManagerCustomerId(),
                    startDate: window.startDate,
                    endDate: window.endDate,
                    countryFilter: settings.googleAdsCountryFilter || undefined,
                    countryExclude: settings.googleAdsCountryExclude || undefined,
                })
            ),
            settle(
                fetchGoogleAdsPPCDashboardMetrics({
                    developerToken: getGoogleAdsDeveloperToken(),
                    clientId: getGoogleAdsOAuthClientId(),
                    clientSecret: getGoogleAdsOAuthClientSecret(),
                    refreshToken: getGoogleAdsRefreshToken(),
                    customerId: settings.googleAdsCustomerId,
                    managerCustomerId: getGoogleAdsManagerCustomerId(),
                    startDate: window.compareStartDate,
                    endDate: window.compareEndDate,
                    countryFilter: settings.googleAdsCountryFilter || undefined,
                    countryExclude: settings.googleAdsCountryExclude || undefined,
                })
            ),
        ]);
        if (gCur.ok) {
            revenueGoogle = roundNum(aggregatePpcFromGoogle(gCur.value.metrics_by_date).conversionValue);
            base.lastSync.google = nowIso;
        } else {
            base.dataGaps.push(gap("google", "error", gCur.error));
        }
        if (gPrev.ok) {
            revenueGooglePrev = roundNum(
                aggregatePpcFromGoogle(gPrev.value.metrics_by_date).conversionValue
            );
        } else if (!gCur.ok) {
            // already recorded
        } else {
            base.dataGaps.push(gap("google", "error", gPrev.error || "Previous period failed"));
        }
    }

    // Meta purchase value
    let revenueMeta = null;
    let revenueMetaPrev = null;
    if (isValidIntegrationId(settings.facebookAdAccountId) && process.env.FACEBOOK_APP_TOKEN) {
        const token = process.env.FACEBOOK_APP_TOKEN;
        const [mCur, mPrev] = await Promise.all([
            settle(
                fetchFacebookAdsPSDashboardMetrics({
                    accessToken: token,
                    adAccountId: settings.facebookAdAccountId,
                    startDate: window.startDate,
                    endDate: window.endDate,
                    metaIdInclude: settings.customerMetaID || undefined,
                    metaIdExclude: settings.customerMetaIDExclude || undefined,
                })
            ),
            settle(
                fetchFacebookAdsPSDashboardMetrics({
                    accessToken: token,
                    adAccountId: settings.facebookAdAccountId,
                    startDate: window.compareStartDate,
                    endDate: window.compareEndDate,
                    metaIdInclude: settings.customerMetaID || undefined,
                    metaIdExclude: settings.customerMetaIDExclude || undefined,
                })
            ),
        ]);
        if (mCur.ok) {
            revenueMeta = roundNum(aggregatePsFromFacebook(mCur.value.metrics_by_date).conversionValue);
            base.lastSync.meta = nowIso;
        } else {
            base.dataGaps.push(gap("meta", "error", mCur.error));
        }
        if (mPrev.ok) {
            revenueMetaPrev = roundNum(
                aggregatePsFromFacebook(mPrev.value.metrics_by_date).conversionValue
            );
        } else if (mCur.ok) {
            base.dataGaps.push(gap("meta", "error", mPrev.error || "Previous period failed"));
        }
    }

    // Klaviyo attributed revenue
    let revenueEmail = null;
    let revenueEmailPrev = null;
    const klaviyoKey = String(settings.klaviyoPrivateApiKey || "").trim();
    if (klaviyoKey) {
        const em = await settle(
            fetchKlaviyoDashboardMetricsBothPeriods({
                apiKey: klaviyoKey,
                startDate: window.startDate,
                endDate: window.endDate,
                prevStartDate: window.compareStartDate,
                prevEndDate: window.compareEndDate,
                // Summary only — attributed revenue totals, much faster than full daily series.
                part: "summary",
            })
        );
        if (em.ok) {
            const curRow = em.value.metrics_by_date?.[0] || {};
            const prevRow = em.value.metrics_by_date_prev?.[0] || {};
            revenueEmail = roundNum(curRow.conversion_value);
            revenueEmailPrev = roundNum(prevRow.conversion_value);
            base.lastSync.klaviyo = nowIso;
        } else {
            base.dataGaps.push(gap("klaviyo", "error", em.error));
        }
    }

    if (base.dataGaps.length) base.status = "partial";
    if (
        blendedCur.netSales === 0 &&
        blendedPrev.netSales === 0 &&
        blendedCur.totalSpend === 0 &&
        blendedPrev.totalSpend === 0
    ) {
        base.status = base.dataGaps.some((g) => g.reason === "error") ? "partial" : "no_data";
    }

    const revCur = storeRevenueBreakdown(cur.shopifyDaily);
    const revPrev = storeRevenueBreakdown(prev.shopifyDaily);
    const revenueType = settings.customerRevenueType || "net_sales";
    const preferredRevenue = preferredStoreRevenue(revCur, revenueType);
    const preferredRevenuePrev = preferredStoreRevenue(revPrev, revenueType);

    return {
        ...base,
        // Backward-compatible headline = net sales (same as weekly-audit blended.netSales).
        revenue: revCur.netSales,
        revenuePrev: revPrev.netSales,
        // Customer's configured preference + all store revenue types (DKK).
        revenueType,
        preferredRevenue,
        preferredRevenuePrev,
        netSales: revCur.netSales,
        netSalesPrev: revPrev.netSales,
        totalSales: revCur.totalSales,
        totalSalesPrev: revPrev.totalSales,
        grossSales: revCur.grossSales,
        grossSalesPrev: revPrev.grossSales,
        custom1Sales: revCur.custom1Sales,
        custom1SalesPrev: revPrev.custom1Sales,
        orders: roundNum(blendedCur.orders),
        ordersPrev: roundNum(blendedPrev.orders),
        spendTotal: roundNum(blendedCur.totalSpend),
        spendTotalPrev: roundNum(blendedPrev.totalSpend),
        spendGoogle: roundNum(blendedCur.googleSpend),
        spendGooglePrev: roundNum(blendedPrev.googleSpend),
        spendMeta: roundNum(blendedCur.metaSpend),
        spendMetaPrev: roundNum(blendedPrev.metaSpend),
        spendOther: roundNum(blendedCur.otherSpend),
        spendOtherPrev: roundNum(blendedPrev.otherSpend),
        revenueGoogle,
        revenueGooglePrev,
        revenueMeta,
        revenueMetaPrev,
        revenueEmail,
        revenueEmailPrev,
        grossProfit,
        grossProfitPrev,
        cogsConfigured,
    };
}
