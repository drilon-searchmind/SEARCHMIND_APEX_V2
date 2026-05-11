// GET /api/parent-customers/[id]/aggregated
// Fetches parent + all children's merged data in one round-trip (server-side parallel fetches).
// Eliminates client waterfall and reduces network round-trips from ~13 to 1.
import { getParentCustomerById } from "../../../../../../lib/parentCustomerOperations";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { normalizeAdSpendExcludeList } from "@/lib/adSpendExcludeParam";

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

/** Prorate fixed expenses by actual days in each month (handles multi-month spans). */
function calcFixedForRange(rangeStart, rangeEnd, fixedExpensesMonthly) {
    const monthly = Number(fixedExpensesMonthly) || 0;
    let total = 0;
    const d = new Date(rangeStart);
    const end = new Date(rangeEnd);
    while (d <= end) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        total += monthly / daysInMonth;
        d.setDate(d.getDate() + 1);
    }
    return total;
}

/** Compute full performance-dashboard metrics for a single child from merged data. */
function computeChildFullMetrics(customer, merged, mergedPrev, startStr, endStr, prevStartStr, prevEndStr) {
    const shopify = merged?.shopifyDaily || [];
    const facebook = merged?.facebookDaily || [];
    const google = merged?.googleDaily || [];
    const shopifyPrev = mergedPrev?.shopifyDaily || [];
    const facebookPrev = mergedPrev?.facebookDaily || [];
    const googlePrev = mergedPrev?.googleDaily || [];

    const totalSales = shopify.reduce((s, d) => s + (d.total_sales || 0), 0);
    const grossSales = shopify.reduce((s, d) => s + (d.gross_sales || 0), 0);
    const discounts = shopify.reduce((s, d) => s + (d.discounts || 0), 0);
    const returns = shopify.reduce((s, d) => s + (d.returns || 0), 0);
    const netRevenue = shopify.reduce((s, d) => s + (d.net_sales || 0), 0);
    const orders = shopify.reduce((s, d) => s + (d.orders || 0), 0);
    const shippingCharges = shopify.reduce((s, d) => s + (d.shipping_charges || 0), 0);
    const taxes = shopify.reduce((s, d) => s + (d.taxes || 0), 0);
    const metaSpend = facebook.reduce((s, d) => s + (d.spend || 0), 0);
    const googleSpend = google.reduce((s, d) => s + (d.spend || 0), 0);
    const cost = metaSpend + googleSpend;

    const totalSalesPrev = shopifyPrev.reduce((s, d) => s + (d.total_sales || 0), 0);
    const grossSalesPrev = shopifyPrev.reduce((s, d) => s + (d.gross_sales || 0), 0);
    const discountsPrev = shopifyPrev.reduce((s, d) => s + (d.discounts || 0), 0);
    const returnsPrev = shopifyPrev.reduce((s, d) => s + (d.returns || 0), 0);
    const netRevenuePrev = shopifyPrev.reduce((s, d) => s + (d.net_sales || 0), 0);
    const ordersPrev = shopifyPrev.reduce((s, d) => s + (d.orders || 0), 0);
    const shippingChargesPrev = shopifyPrev.reduce((s, d) => s + (d.shipping_charges || 0), 0);
    const taxesPrev = shopifyPrev.reduce((s, d) => s + (d.taxes || 0), 0);
    const metaSpendPrev = facebookPrev.reduce((s, d) => s + (d.spend || 0), 0);
    const googleSpendPrev = googlePrev.reduce((s, d) => s + (d.spend || 0), 0);
    const costPrev = metaSpendPrev + googleSpendPrev;

    const staticExp = customer?.CustomerStaticExpenses || {};
    const cogsPercentage = staticExp.cogsPercentage ?? 0;
    const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;
    const totalCogs = fetchCogs
        ? shopify.reduce((s, d) => s + (d.cost_of_goods_sold || 0), 0)
        : netRevenue * cogsPercentage;
    const prevTotalCogs = fetchCogs
        ? shopifyPrev.reduce((s, d) => s + (d.cost_of_goods_sold || 0), 0)
        : netRevenuePrev * cogsPercentage;

    const fixedExpensesMonthly = Number(staticExp.fixedExpenses) || 0;
    const fixedCosts = calcFixedForRange(startStr, endStr, fixedExpensesMonthly);
    const fixedCostsPrev = calcFixedForRange(prevStartStr, prevEndStr, fixedExpensesMonthly);

    const shippingCostPerOrder = staticExp.shippingCostPerOrder ?? 0;
    const pickNPackCostPerOrder = staticExp.pickNPackCostPerOrder ?? 0;
    const transactionCostPct = staticExp.transactionCostPercentage ?? 0.015;
    const shippingCost = shippingCostPerOrder * orders;
    const shippingCostPrev = shippingCostPerOrder * ordersPrev;
    const pickPackCost = pickNPackCostPerOrder * orders;
    const pickPackCostPrev = pickNPackCostPerOrder * ordersPrev;
    const transactionFee = netRevenue * transactionCostPct;
    const transactionFeePrev = netRevenuePrev * transactionCostPct;
    const variableCosts = shippingCost + pickPackCost;
    const variableCostsPrev = shippingCostPrev + pickPackCostPrev;

    const allCosts = totalCogs + fixedCosts + variableCosts + transactionFee + cost;
    const allCostsPrev = prevTotalCogs + fixedCostsPrev + variableCostsPrev + transactionFeePrev + costPrev;
    const ebit = netRevenue - allCosts;
    const ebitPrev = netRevenuePrev - allCostsPrev;
    const grossProfit = netRevenue - totalCogs;
    const grossProfitPrev = netRevenuePrev - prevTotalCogs;

    const cac = orders > 0 ? cost / orders : null;
    const cacPrev = ordersPrev > 0 ? costPrev / ordersPrev : null;

    return {
        totalSales, grossSales, discounts, returns, netRevenue, orders, shippingCharges, taxes,
        metaSpend, googleSpend, cost, totalCogs, prevTotalCogs, fixedCosts, fixedCostsPrev,
        variableCosts, variableCostsPrev, shippingCost, shippingCostPrev, pickPackCost, pickPackCostPrev,
        transactionFee, transactionFeePrev, allCosts, allCostsPrev, ebit, ebitPrev,
        grossProfit, grossProfitPrev, cac, cacPrev,
        totalSalesPrev, grossSalesPrev, discountsPrev, returnsPrev, netRevenuePrev, ordersPrev,
        shippingChargesPrev, taxesPrev, metaSpendPrev, googleSpendPrev, costPrev,
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

        if (!startDate || !endDate) {
            return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const msDay = 24 * 60 * 60 * 1000;
        const days = Math.floor((end - start) / msDay) + 1;

        let prevStartStr, prevEndStr;
        if (comparisonMethod === "Last Year") {
            const prevStart = new Date(start);
            prevStart.setFullYear(prevStart.getFullYear() - 1);
            const prevEnd = new Date(end);
            prevEnd.setFullYear(prevEnd.getFullYear() - 1);
            prevStartStr = prevStart.toISOString().slice(0, 10);
            prevEndStr = prevEnd.toISOString().slice(0, 10);
        } else {
            const prevEndMs = start.getTime() - msDay;
            const prevStartMs = prevEndMs - (days - 1) * msDay;
            prevStartStr = new Date(prevStartMs).toISOString().slice(0, 10);
            prevEndStr = new Date(prevEndMs).toISOString().slice(0, 10);
        }

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

            const demo = isDemoCustomerId(String(cust._id));
            const [mergedCurrent, mergedPrev] = await Promise.all([
                demo
                    ? Promise.resolve(
                          getDemoMergedSourcesForRange(startDate, endDate, cust, {
                              excludeAdSpendPlatforms: mergeOptsBase.excludeAdSpendPlatforms,
                          })
                      )
                    : fetchMergedSources(settings, startDate, endDate, mergeOptsBase),
                demo
                    ? Promise.resolve(
                          getDemoMergedSourcesForRange(prevStartStr, prevEndStr, cust, {
                              excludeAdSpendPlatforms: mergeOptsBase.excludeAdSpendPlatforms,
                          })
                      )
                    : fetchMergedSources(settings, prevStartStr, prevEndStr, mergeOptsBase),
            ]);

            const shopify = mergedCurrent.shopifyDaily || [];
            const facebook = mergedCurrent.facebookDaily || [];
            const google = mergedCurrent.googleDaily || [];
            const revenue = shopify.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
            const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
            const facebookAdspend = facebook.reduce((sum, d) => sum + (d.spend || 0), 0);
            const googleAdspend = google.reduce((sum, d) => sum + (d.spend || 0), 0);
            const adspend = facebookAdspend + googleAdspend;
            const aov = orders > 0 ? revenue / orders : 0;
            const roas = adspend > 0 ? revenue / adspend : null;
            const spendshare = revenue > 0 ? adspend / revenue : null;

            const shopifyPrev = mergedPrev.shopifyDaily || [];
            const facebookPrev = mergedPrev.facebookDaily || [];
            const googlePrev = mergedPrev.googleDaily || [];
            const revenuePrev = shopifyPrev.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
            const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);
            const facebookAdspendPrev = facebookPrev.reduce((sum, d) => sum + (d.spend || 0), 0);
            const googleAdspendPrev = googlePrev.reduce((sum, d) => sum + (d.spend || 0), 0);
            const adspendPrev = facebookAdspendPrev + googleAdspendPrev;
            const roasPrev = adspendPrev > 0 ? revenuePrev / adspendPrev : null;
            const spendsharePrev = revenuePrev > 0 ? adspendPrev / revenuePrev : null;

            const fullMetrics = computeChildFullMetrics(
                cust, mergedCurrent, mergedPrev, startDate, endDate, prevStartStr, prevEndStr
            );

            return {
                row: {
                    _id: cust._id,
                    customerName: cust.customerName,
                    revenue,
                    orders,
                    adspend,
                    facebookAdspend,
                    googleAdspend,
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
                    facebookAdspend: facebookAdspendPrev,
                    googleAdspend: googleAdspendPrev,
                    orders: ordersPrev,
                    roas: roasPrev,
                    spendshare: spendsharePrev,
                },
                dailyData: {
                    _id: cust._id,
                    shopifyDaily: mergedCurrent.shopifyDaily || [],
                    facebookDaily: mergedCurrent.facebookDaily || [],
                    googleDaily: mergedCurrent.googleDaily || [],
                    shopifyDailyPrev: mergedPrev.shopifyDaily || [],
                    facebookDailyPrev: mergedPrev.facebookDaily || [],
                    googleDailyPrev: mergedPrev.googleDaily || [],
                    revenueType,
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
                        children: children.map((c) => ({ id: c._id, name: c.customerName })),
                    });

                    const resultsMap = {};
                    const promises = children.map((customer) =>
                        fetchForChild(customer).then((result) => {
                            send({
                                type: "loaded",
                                id: customer._id,
                                name: customer.customerName,
                                source: customer.customerType || "Shopify",
                                shop: customer.CustomerSettings?.shopifyUrl || "",
                            });
                            resultsMap[customer._id] = result;
                            return result;
                        })
                    );

                    await Promise.all(promises);
                    send({ type: "aggregating" });

                    const childResults = children.map((c) => resultsMap[c._id]);
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
