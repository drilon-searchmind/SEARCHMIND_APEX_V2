// GET /api/parent-customers/[id]/aggregated
// Fetches parent + all children's merged data in one round-trip (server-side parallel fetches).
// Eliminates client waterfall and reduces network round-trips from ~13 to 1.
import connectToDatabase from "@root/lib/mongodb";
import { getParentCustomerById } from "../../../../../../lib/parentCustomerOperations";
import {
    getCustomerFiltersByParentId,
    googleAdsFiltersDocToAggregatedOverrides,
    metaAdsFiltersDocToAggregatedOverrides,
} from "@/lib/customerFiltersDb";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { normalizeAdSpendExcludeList } from "@/lib/adSpendExcludeParam";
import {
    parentChildDailyPayloadFromMerged,
    parentRowAdspendFromMerged,
} from "@/lib/parentPropertyAdSpend";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";

function resolveAdCampaignOverride(overrides, customerId) {
    const id = normalizeMongoId(customerId);
    if (!id || !overrides || typeof overrides !== "object") return null;
    if (overrides[id]) return overrides[id];
    for (const [key, value] of Object.entries(overrides)) {
        if (normalizeMongoId(key) === id) return value;
    }
    return null;
}
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import {
    computeChildFullMetricsForParent,
    sumChildShopifyRevenue,
} from "@/lib/parentPropertyMetrics";

function plainCustomer(c) {
    if (!c) return c;
    if (typeof c.toObject === "function") return c.toObject();
    return c;
}

function buildSettings(customer) {
    return {
        customerName: customer.customerName,
        customerType: customer.customerType || "Shopify",
        ...(customer.CustomerSettings || {}),
        CustomerStaticExpenses: customer.CustomerStaticExpenses || {},
    };
}

export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const parentId = resolvedParams.id;
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const comparisonMethod = searchParams.get("comparisonMethod") || "Last Year";
        const compareStartDate = searchParams.get("compareStartDate") || "";
        const compareEndDate = searchParams.get("compareEndDate") || "";

        if (!startDate || !endDate) {
            return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
        }

        const compDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate,
            endDate,
            compareStartDate,
            compareEndDate,
        });
        const prevStartStr = compDates.startDate;
        const prevEndStr = compDates.endDate;
        const skipPrevFetch = compDates.skip || !prevStartStr || !prevEndStr;

        const parent = await getParentCustomerById(parentId);
        if (!parent) {
            return Response.json({ error: "Parent not found" }, { status: 404 });
        }

        const children = parent.customers || [];
        const stream = searchParams.get("stream") === "1";

        /** @type {Record<string, { noSelection?: boolean, markets?: Array<{ shopifyqlMarketId: string, handle?: string }> }>} */
        let shopifyMarketOverrides = {};
        const rawOverrides = searchParams.get("shopifyMarketOverrides");
        if (rawOverrides && rawOverrides.length <= 24_000) {
            try {
                const decoded = decodeURIComponent(rawOverrides);
                const parsed = JSON.parse(decoded);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    shopifyMarketOverrides = parsed;
                }
            } catch {
                shopifyMarketOverrides = {};
            }
        }

        /** @type {Record<string, { exclude?: string[] }>} */
        let adSpendPlatformOverrides = {};
        const rawAdSpendOv = searchParams.get("adSpendPlatformOverrides");
        if (rawAdSpendOv && rawAdSpendOv.length <= 24_000) {
            try {
                const decoded = decodeURIComponent(rawAdSpendOv);
                const parsed = JSON.parse(decoded);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    adSpendPlatformOverrides = parsed;
                }
            } catch {
                adSpendPlatformOverrides = {};
            }
        }

        await connectToDatabase();
        const customerFiltersDoc = await getCustomerFiltersByParentId(parentId);
        const googleAdsCampaignFilterEnabled =
            customerFiltersDoc?.googleAds?.filterEnabled === true;
        const googleAdsCampaignOverrides =
            googleAdsFiltersDocToAggregatedOverrides(customerFiltersDoc);
        const metaAdsCampaignFilterEnabled =
            customerFiltersDoc?.metaAds?.filterEnabled === true;
        const metaAdsCampaignOverrides =
            metaAdsFiltersDocToAggregatedOverrides(customerFiltersDoc);

        if (children.length === 0) {
            const emptyResponse = {
                parent: { _id: parent._id, name: parent.name, customers: [] },
                rows: [],
                dailyData: [],
                predominantMetricPreference: "ROAS/POAS",
            };
            if (stream) {
                const encoder = new TextEncoder();
                return new Response(encoder.encode(JSON.stringify({ type: "complete", ...emptyResponse }) + "\n"), {
                    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
                });
            }
            return Response.json(emptyResponse);
        }
        const dailyBreakdown = true;

        const fetchForChild = async (customer) => {
            const raw = plainCustomer(customer);
            const cust = isDemoCustomerId(String(raw._id)) ? mergeDemoCustomerDocument(raw) : raw;
            const settings = buildSettings(cust);
            const revenueType = cust?.CustomerSettings?.customerRevenueType || "total_sales";
            const metricPreference = cust?.CustomerSettings?.metricPreference || "ROAS/POAS";

            const mergeOptsBase = { dailyBreakdown };
            const cid = String(cust._id);
            const ov = shopifyMarketOverrides[cid];
            if (
                settings.shopifyMarketsEnabled === true &&
                ov &&
                typeof ov === "object"
            ) {
                if (ov.filterAdSpendByMarket === true) {
                    mergeOptsBase.shopifyMarketFilterAdSpend = true;
                } else {
                    mergeOptsBase.shopifyMarketFilterAdSpend = false;
                }
                if (ov.noSelection === true) {
                    mergeOptsBase.shopifyMarketNoSelection = true;
                } else if (Array.isArray(ov.markets) && ov.markets.length > 0) {
                    mergeOptsBase.shopifyMarketsSelection = ov.markets
                        .filter((m) => m && String(m.shopifyqlMarketId || "").trim() !== "")
                        .map((m) => ({
                            shopifyqlMarketId: String(m.shopifyqlMarketId).trim(),
                            handle: m.handle != null ? String(m.handle) : "",
                        }));
                }
            }

            const spendOv = adSpendPlatformOverrides[cid];
            if (
                settings.shopifyMarketsEnabled === true &&
                spendOv &&
                Array.isArray(spendOv.exclude) &&
                spendOv.exclude.length > 0
            ) {
                mergeOptsBase.excludeAdSpendPlatforms = normalizeAdSpendExcludeList(spendOv.exclude);
            }

            if (googleAdsCampaignFilterEnabled) {
                const campaignOv = resolveAdCampaignOverride(
                    googleAdsCampaignOverrides,
                    cust._id
                );
                if (campaignOv) {
                    if (Array.isArray(campaignOv.exclude) && campaignOv.exclude.length > 0) {
                        mergeOptsBase.googleAdsExcludedCampaignIds = campaignOv.exclude
                            .map((id) => String(id).trim())
                            .filter(Boolean);
                    }
                    if (
                        Array.isArray(campaignOv.excludeNameKeywords) &&
                        campaignOv.excludeNameKeywords.length > 0
                    ) {
                        mergeOptsBase.googleAdsExcludedCampaignNameKeywords =
                            campaignOv.excludeNameKeywords;
                    }
                }
            }

            if (metaAdsCampaignFilterEnabled) {
                const campaignOv = resolveAdCampaignOverride(
                    metaAdsCampaignOverrides,
                    cust._id
                );
                if (campaignOv) {
                    if (Array.isArray(campaignOv.exclude) && campaignOv.exclude.length > 0) {
                        mergeOptsBase.metaAdsExcludedCampaignIds = campaignOv.exclude
                            .map((id) => String(id).trim())
                            .filter(Boolean);
                    }
                    if (
                        Array.isArray(campaignOv.excludeNameKeywords) &&
                        campaignOv.excludeNameKeywords.length > 0
                    ) {
                        mergeOptsBase.metaAdsExcludedCampaignNameKeywords =
                            campaignOv.excludeNameKeywords;
                    }
                }
            }

            const demo = isDemoCustomerId(String(cust._id));
            const emptyMergedPrev = { shopifyDaily: [] };
            const mergedCurrent = demo
                ? await Promise.resolve(
                      getDemoMergedSourcesForRange(startDate, endDate, cust, {
                          excludeAdSpendPlatforms: mergeOptsBase.excludeAdSpendPlatforms,
                      })
                  )
                : await fetchMergedSources(settings, startDate, endDate, mergeOptsBase);
            const mergedPrev = skipPrevFetch
                ? emptyMergedPrev
                : demo
                  ? await Promise.resolve(
                        getDemoMergedSourcesForRange(prevStartStr, prevEndStr, cust, {
                            excludeAdSpendPlatforms: mergeOptsBase.excludeAdSpendPlatforms,
                        })
                    )
                  : await fetchMergedSources(settings, prevStartStr, prevEndStr, mergeOptsBase);

            const shopify = mergedCurrent.shopifyDaily || [];
            const customerSettings = cust?.CustomerSettings || {};
            const revenue = sumChildShopifyRevenue(shopify, revenueType, customerSettings);
            const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
            const spendCurr = parentRowAdspendFromMerged(mergedCurrent);
            const spendPrev = parentRowAdspendFromMerged(mergedPrev);
            const adspend = spendCurr.adspend;
            const aov = orders > 0 ? revenue / orders : 0;
            const roas = adspend > 0 ? revenue / adspend : null;
            const spendshare = revenue > 0 ? adspend / revenue : null;

            const shopifyPrev = mergedPrev.shopifyDaily || [];
            const revenuePrev = sumChildShopifyRevenue(shopifyPrev, revenueType, customerSettings);
            const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);
            const adspendPrev = spendPrev.adspend;
            const roasPrev = adspendPrev > 0 ? revenuePrev / adspendPrev : null;
            const spendsharePrev = revenuePrev > 0 ? adspendPrev / revenuePrev : null;

            const fullMetrics = computeChildFullMetricsForParent(
                cust,
                mergedCurrent,
                mergedPrev,
                startDate,
                endDate,
                skipPrevFetch ? startDate : prevStartStr,
                skipPrevFetch ? endDate : prevEndStr
            );

            return {
                row: {
                    _id: cust._id,
                    customerName: cust.customerName,
                    revenue,
                    orders,
                    adspend,
                    facebookAdspend: spendCurr.facebookAdspend,
                    googleAdspend: spendCurr.googleAdspend,
                    snapchatAdspend: spendCurr.snapchatAdspend,
                    redditAdspend: spendCurr.redditAdspend,
                    pinterestAdspend: spendCurr.pinterestAdspend,
                    bingAdspend: spendCurr.bingAdspend,
                    channelAdspend: spendCurr.channelAdspend,
                    roas,
                    spendshare,
                    aov,
                    revenueType,
                    metricPreference,
                    fullMetrics: fullMetrics,
                },
                prevData: {
                    _id: cust._id,
                    revenue: revenuePrev,
                    adspend: adspendPrev,
                    facebookAdspend: spendPrev.facebookAdspend,
                    googleAdspend: spendPrev.googleAdspend,
                    snapchatAdspend: spendPrev.snapchatAdspend,
                    redditAdspend: spendPrev.redditAdspend,
                    pinterestAdspend: spendPrev.pinterestAdspend,
                    bingAdspend: spendPrev.bingAdspend,
                    channelAdspend: spendPrev.channelAdspend,
                    orders: ordersPrev,
                    roas: roasPrev,
                    spendshare: spendsharePrev,
                },
                dailyData: {
                    _id: cust._id,
                    shopifyDaily: mergedCurrent.shopifyDaily || [],
                    shopifyDailyPrev: mergedPrev.shopifyDaily || [],
                    revenueType,
                    ...parentChildDailyPayloadFromMerged(mergedCurrent, mergedPrev),
                },
                fullMetrics,
            };
        };

        if (stream) {
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

                    send({
                        type: "start",
                        parentName: parent.name,
                        children: children.map((c) => ({
                            id: String(c._id),
                            name: c.customerName,
                        })),
                    });

                    const resultsMap = {};
                    const promises = children.map((customer) => {
                        const childId = String(customer._id);
                        return fetchForChild(customer)
                            .then((result) => {
                                send({
                                    type: "loaded",
                                    id: childId,
                                    name: customer.customerName,
                                    source: customer.customerType || "Shopify",
                                    shop: customer.CustomerSettings?.shopifyUrl || "",
                                });
                                resultsMap[childId] = result;
                                return result;
                            })
                            .catch((err) => {
                                console.error(
                                    `[parent aggregated] Failed for child ${childId} (${customer.customerName}):`,
                                    err
                                );
                                send({
                                    type: "loaded",
                                    id: childId,
                                    name: customer.customerName,
                                    source: customer.customerType || "Shopify",
                                    shop: customer.CustomerSettings?.shopifyUrl || "",
                                    error: true,
                                });
                                resultsMap[childId] = null;
                                return null;
                            });
                    });

                    await Promise.all(promises);
                    send({ type: "aggregating" });

                    const childResults = children
                        .map((c) => resultsMap[String(c._id)])
                        .filter(Boolean);
                    const rows = childResults.map((r, idx) => ({ ...r.row, prevData: r.prevData }));
                    const dailyData = childResults.map((r) => r.dailyData);
                    const preferenceCounts = childResults.reduce((acc, r) => {
                        acc[r.row.metricPreference] = (acc[r.row.metricPreference] || 0) + 1;
                        return acc;
                    }, {});
                    const predominantMetricPreference = Object.keys(preferenceCounts).reduce(
                        (a, b) => (preferenceCounts[a] > preferenceCounts[b] ? a : b),
                        "ROAS/POAS"
                    );

                    send({
                        type: "complete",
                        parent: { _id: parent._id, name: parent.name, customers: children },
                        rows,
                        dailyData,
                        predominantMetricPreference,
                    });
                    controller.close();
                },
            });

            return new Response(readable, {
                headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
            });
        }

        const childResults = await Promise.all(children.map((c) => fetchForChild(c)));
        const rows = childResults.map((r, idx) => ({ ...r.row, prevData: r.prevData }));
        const dailyData = childResults.map((r) => r.dailyData);

        const preferenceCounts = childResults.reduce((acc, r) => {
            acc[r.row.metricPreference] = (acc[r.row.metricPreference] || 0) + 1;
            return acc;
        }, {});
        const predominantMetricPreference = Object.keys(preferenceCounts).reduce(
            (a, b) => (preferenceCounts[a] > preferenceCounts[b] ? a : b),
            "ROAS/POAS"
        );

        return Response.json({
            parent: { _id: parent._id, name: parent.name, customers: children },
            rows,
            dailyData,
            predominantMetricPreference,
        });
    } catch (error) {
        console.error("Error fetching parent aggregated:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
