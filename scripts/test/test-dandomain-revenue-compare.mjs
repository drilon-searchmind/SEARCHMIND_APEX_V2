/**
 * Compare DanDomain revenue (APEX mapping) vs raw order fields for one customer.
 *
 * Usage:
 *   node scripts/test/test-dandomain-revenue-compare.mjs --customerId=6a3d0e3693c772b89cddb180 --start=2024-09-01 --end=2024-09-30
 *   node scripts/test/test-dandomain-revenue-compare.mjs --customerName="Hugo P" --start=2025-09-01 --end=2025-09-30
 *
 * Env: MONGODB_URI (loads credentials from CustomerSettings — never printed).
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeDanDomainSettings } from "../../src/lib/danDomainCustomerSettings.js";
import {
    aggregateDanDomainOrdersToDaily,
    fetchDanDomainOrdersInRange,
    fetchDanDomainPerformanceDaily,
    getDanDomainShopHost,
    mapDanDomainOrderToMetrics,
    resolveDanDomainAccessToken,
    danDomainGraphqlRequest,
} from "../../src/lib/danDomainApi.js";
import {
    fetchDanDomainOriginalOrdersInRange,
    mapDanDomainOriginalOrderToMetrics,
    aggregateDanDomainOriginalOrdersToDaily,
} from "../../src/lib/danDomainOriginalApi.js";
import { normalizeDanDomainOriginalSettings } from "../../src/lib/danDomainOriginalCustomerSettings.js";
const DK_VAT = 0.25;

function computeTotalSalesExVatDanDomain({ totalSales, taxes, netSales, shipping }) {
    const net = Number(netSales) || 0;
    const ship = Number(shipping) || 0;
    const total = Number(totalSales) || 0;
    const tax = Number(taxes) || 0;
    if (net > 0) return net + ship;
    if (total > tax) return total - tax;
    return Math.max(0, net + ship);
}

function applyRevenueVatDisplay(amount, customerSettings) {
    const mode = customerSettings?.revenueDisplayVat;
    if (mode === "incl") return (Number(amount) || 0) * (1 + DK_VAT);
    return Number(amount) || 0;
}

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const arg of argv.slice(2)) {
        const m = /^--([^=]+)=(.*)$/.exec(arg);
        if (m) out[m[1]] = m[2];
    }
    return out;
}

function round(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function sumDaily(daily, key) {
    return daily.reduce((s, d) => s + (Number(d[key]) || 0), 0);
}

function summarizeApexDaily(daily, customerSettings, customerType) {
    const totalSales = sumDaily(daily, "total_sales");
    const netSales = sumDaily(daily, "net_sales");
    const taxes = sumDaily(daily, "taxes");
    const shipping = sumDaily(daily, "shipping_charges");
    const gross = sumDaily(daily, "gross_sales");
    const orders = sumDaily(daily, "orders");
    const cogs = sumDaily(daily, "cost_of_goods_sold");

    const exVat = computeTotalSalesExVatDanDomain({
        totalSales,
        taxes,
        netSales,
        shipping,
    });

    const displayInclStatic = applyRevenueVatDisplay(exVat, customerSettings);

    return {
        orders,
        total_sales_incl_from_api: round(totalSales),
        net_sales_excl_approx: round(netSales + shipping),
        taxes: round(taxes),
        gross_sales: round(gross),
        cost_of_goods_sold: round(cogs),
        apex_totalSalesExVat: round(exVat),
        apex_display_with_revenueVatFactor: round(displayInclStatic),
    };
}

/**
 * @param {string} shopHost
 * @param {string} token
 * @param {string} startDate
 * @param {string} endDate
 */
async function fetchSampleOrdersWithLines(shopHost, token, startDate, endDate) {
    const startIso = `${startDate}T00:00:00+00:00`;
    const endExclusive = new Date(`${endDate}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endIso = endExclusive.toISOString().replace(".000Z", "+00:00");

    const query = `
        query SampleOrdersWithLines {
          orders(
            pagination: { limit: 5, page: 1 }
            sorting: { field: createdAt, direction: DESC }
            search: [
              { field: createdAt, comparator: GREATER_THAN_OR_EQUAL, value: "${startIso}" }
              { field: createdAt, comparator: LESS_THAN, value: "${endIso}" }
            ]
          ) {
            data {
              id
              createdAt
              subTotal
              total
              status { id }
              orderLines {
                id
                unit
                unitCost
                totalCost
              }
            }
          }
        }
    `;

    const res = await danDomainGraphqlRequest(shopHost, token, query, "experimental");
    return res?.data?.orders?.data || [];
}

/** @param {Record<string, unknown>[]} orders */
function sumHostedShopByStatusFilter(orders, statusIds) {
    const allow = statusIds ? new Set(statusIds.map(String)) : null;
    let count = 0;
    let sumTotal = 0;
    let sumSubTotal = 0;
    let sumMappedNet = 0;
    let sumMappedTotalSales = 0;
    let sumLineCogs = 0;

    for (const order of orders) {
        const sid =
            typeof order.status === "object" && order.status
                ? String(order.status.id ?? order.status.name ?? "")
                : String(order.status ?? "");
        if (allow && !allow.has(sid)) continue;

        count += 1;
        sumTotal += Number(order.total) || 0;
        sumSubTotal += Number(order.subTotal) || 0;
        const m = mapDanDomainOrderToMetrics(order);
        sumMappedNet += m.net_sales;
        sumMappedTotalSales += m.total_sales;

        const lines = Array.isArray(order.orderLines)
            ? order.orderLines
            : Array.isArray(order.lines)
              ? order.lines
              : [];
        for (const line of lines) {
            sumLineCogs += Number(line.totalCost ?? 0) || Number(line.unitCost ?? 0) * Number(line.quantity ?? 1);
        }
    }

    return {
        orderCount: count,
        sum_order_total_incl: round(sumTotal),
        sum_order_subTotal: round(sumSubTotal),
        sum_subTotal_x_1_25: round(sumSubTotal * (1 + DK_VAT)),
        sum_mapped_net_sales: round(sumMappedNet),
        sum_mapped_total_sales: round(sumMappedTotalSales),
        sum_line_totalCost: round(sumLineCogs),
    };
}

/** @param {Record<string, unknown>[]} orders */
function analyzeHostedShopOrders(orders) {
    /** @type {Record<string, { count: number, totalIncl: number, totalExcl: number, netMapped: number }>} */
    const byStatus = {};

    let rawTotalIncl = 0;
    let rawTotalExcl = 0;
    let mappedTotalSales = 0;
    let mappedNet = 0;
    let withCogsField = 0;
    let cogsSum = 0;

    /** @type {Set<string>} */
    const scalarKeys = new Set();
    /** @type {Set<string>} */
    const cogsLikeKeys = new Set();

    for (const order of orders) {
        for (const k of Object.keys(order || {})) {
            scalarKeys.add(k);
            if (/cost|cogs|purchase|profit|margin/i.test(k)) cogsLikeKeys.add(k);
        }
        const statusName =
            typeof order.status === "object" && order.status
                ? String(order.status.name || order.status.id || "unknown")
                : String(order.status || "unknown");

        const incl = Number(order.totalPriceIncVat ?? order.totalIncVat ?? order.totalPrice ?? 0);
        const excl = Number(order.totalPriceExVat ?? order.totalExVat ?? 0);
        const mapped = mapDanDomainOrderToMetrics(order);

        if (!byStatus[statusName]) {
            byStatus[statusName] = { count: 0, totalIncl: 0, totalExcl: 0, netMapped: 0 };
        }
        byStatus[statusName].count += 1;
        byStatus[statusName].totalIncl += incl || mapped.total_sales;
        byStatus[statusName].totalExcl += excl || mapped.net_sales;
        byStatus[statusName].netMapped += mapped.net_sales;

        rawTotalIncl += incl || mapped.total_sales;
        rawTotalExcl += excl || mapped.net_sales;
        mappedTotalSales += mapped.total_sales;
        mappedNet += mapped.net_sales;

        for (const k of cogsLikeKeys) {
            const v = order[k];
            if (v != null && v !== "" && Number(v) !== 0) {
                withCogsField += 1;
                cogsSum += Math.abs(Number(v) || 0);
            }
        }
    }

    return {
        orderCount: orders.length,
        byStatus,
        rawTotalIncl: round(rawTotalIncl),
        rawTotalExcl: round(rawTotalExcl),
        mappedTotalSales: round(mappedTotalSales),
        mappedNetSales: round(mappedNet),
        cogsLikeScalarFields: [...cogsLikeKeys].sort(),
        ordersWithAnyCogsLikeField: withCogsField,
        cogsLikeFieldSum: round(cogsSum),
        sampleScalarFields: [...scalarKeys].sort().slice(0, 40),
    };
}

/** @param {Record<string, unknown>[]} orders */
function analyzeOriginalOrders(orders) {
    let mappedIncl = 0;
    let mappedNet = 0;
    let cogsFromLines = 0;
    let skipped = 0;

    for (const order of orders) {
        const m = mapDanDomainOriginalOrderToMetrics(order);
        if (!m) {
            skipped += 1;
            continue;
        }
        mappedIncl += m.total_sales;
        mappedNet += m.net_sales;

        const lines = Array.isArray(order.orderLines) ? order.orderLines : [];
        for (const line of lines) {
            const buy = Number(line.buyPrice ?? line.costPrice ?? line.purchasePrice ?? 0);
            const qty = Number(line.amount ?? line.quantity ?? 1);
            if (buy > 0) cogsFromLines += buy * qty;
        }
    }

    return {
        orderCount: orders.length,
        skippedOrders: skipped,
        mappedTotalSalesIncl: round(mappedIncl),
        mappedNetSalesExcl: round(mappedNet),
        estimatedCogsFromOrderLines: round(cogsFromLines),
        sampleOrderKeys: orders[0] ? Object.keys(orders[0]).sort() : [],
        sampleLineKeys:
            orders[0]?.orderLines?.[0] && typeof orders[0].orderLines[0] === "object"
                ? Object.keys(orders[0].orderLines[0]).sort()
                : [],
    };
}

async function introspectOrderCogsFields(shopHost, token) {
    const introspection = `
        query IntrospectOrderCogs {
            __type(name: "Order") {
                fields {
                    name
                    type { kind name ofType { kind name ofType { kind name } } }
                }
            }
            orderLine: __type(name: "OrderLine") {
                fields { name }
            }
        }
    `;
    try {
        const res = await danDomainGraphqlRequest(shopHost, token, introspection, "experimental");
        const orderFields = (res?.data?.__type?.fields || []).map((f) => f.name);
        const lineFields = (res?.data?.orderLine?.fields || []).map((f) => f.name);
        const cogsOrder = orderFields.filter((n) => /cost|cogs|purchase|profit|margin/i.test(n));
        const cogsLine = lineFields.filter((n) => /cost|cogs|purchase|profit|margin|buy/i.test(n));
        return { cogsOrder, cogsLine, orderFieldCount: orderFields.length };
    } catch (e) {
        return { error: e.message };
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const startDate = args.start || "2024-09-01";
    const endDate = args.end || "2024-09-30";

    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI missing in .env");
        process.exit(1);
    }

    const Customer = mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });

    let customer;
    if (args.customerId) {
        customer = await Customer.findById(args.customerId.trim()).lean();
    } else if (args.customerName) {
        const re = new RegExp(args.customerName.trim(), "i");
        customer = await Customer.findOne({ customerName: re }).lean();
    } else {
        customer = await Customer.findById("6a3d0e3693c772b89cddb180").lean();
    }

    if (!customer) {
        console.error("Customer not found");
        process.exit(1);
    }

    const settings = { ...(customer.CustomerSettings || {}), customerName: customer.customerName };
    const customerType = customer.customerType || "Shopify";

    console.log("\n=== Customer ===");
    console.log(
        JSON.stringify(
            {
                id: String(customer._id),
                name: customer.customerName,
                customerType,
                revenueDisplayVat: settings.revenueDisplayVat,
                fetchCogsFromStore: settings.fetchCogsFromStore,
                currency: settings.customerStoreValutaCode || "DKK",
                dateRange: { startDate, endDate },
            },
            null,
            2
        )
    );

    console.log("\n=== Backend reference (manual) ===");
    console.log(
        "Enter DanDomain admin 'Omsætning' / profit for this range to compare (script prints API-side totals only)."
    );

    if (customerType === "DanDomain") {
        const dan = normalizeDanDomainSettings(settings);
        const shopHost = getDanDomainShopHost(dan);
        console.log("\n=== HostedShop (GraphQL) ===");
        console.log("shopHost:", shopHost);

        const token = await resolveDanDomainAccessToken(dan);
        const cogsFields = await introspectOrderCogsFields(shopHost, token);
        console.log("Introspection (cost/profit fields):", cogsFields);

        const includeOrderLines = settings.fetchCogsFromStore === true;
        const orders = await fetchDanDomainOrdersInRange(shopHost, token, startDate, endDate, {
            includeOrderLines,
        });
        const daily = aggregateDanDomainOrdersToDaily(orders, startDate, endDate, {
            statusIds: dan.orderStatusIds,
        });
        const apexDaily = await fetchDanDomainPerformanceDaily(settings, startDate, endDate);

        console.log("\n--- APEX pipeline (fetchDanDomainPerformanceDaily) ---");
        console.log(JSON.stringify(summarizeApexDaily(apexDaily, settings, customerType), null, 2));

        console.log("\n--- Raw order analysis ---");
        console.log(JSON.stringify(analyzeHostedShopOrders(orders), null, 2));

        console.log("\n--- Revenue scenarios (match DanDomain admin) ---");
        console.log(
            JSON.stringify(
                {
                    all_orders: sumHostedShopByStatusFilter(orders, null),
                    status_3_only: sumHostedShopByStatusFilter(orders, ["3"]),
                    status_0_and_3: sumHostedShopByStatusFilter(orders, ["0", "3"]),
                    note:
                        "DanDomain admin 'Omsætning' often aligns with subTotal (excl. VAT) or a subset of statuses — compare these rows to backend.",
                },
                null,
                2
            )
        );

        try {
            const withLines = await fetchSampleOrdersWithLines(
                shopHost,
                token,
                startDate,
                endDate
            );
            console.log("\n--- Sample orders with lines (COGS fields) ---");
            console.log(JSON.stringify(withLines, null, 2));
        } catch (e) {
            console.log("\n--- Sample orders with lines failed ---", e.message);
        }

        console.log("\n--- Daily aggregation (re-aggregate from raw orders) ---");
        console.log(JSON.stringify(summarizeApexDaily(daily, settings, customerType), null, 2));

        console.log("\n--- Post-fix pipeline note ---");
        console.log(
            "APEX DanDomain presets: orderSent (sentAt, status 3) | salgsstatistik (createdAt, exclude status 0+5). Ordrer = created date, exclude 0+5."
        );
    }

    if (customerType === "DanDomainOriginal") {
        const cfg = normalizeDanDomainOriginalSettings(settings);
        console.log("\n=== DanDomain Original (WEBAPI) ===");
        console.log("shopAdminUrl:", cfg.shopAdminUrl);

        const orders = await fetchDanDomainOriginalOrdersInRange(
            cfg.shopAdminUrl,
            cfg.apiKey,
            startDate,
            endDate
        );
        const daily = aggregateDanDomainOriginalOrdersToDaily(orders, startDate, endDate);

        console.log("\n--- WEBAPI order analysis ---");
        console.log(JSON.stringify(analyzeOriginalOrders(orders), null, 2));

        console.log("\n--- APEX-shaped daily totals ---");
        console.log(JSON.stringify(summarizeApexDaily(daily, settings, customerType), null, 2));
    }

    if (customerType !== "DanDomain" && customerType !== "DanDomainOriginal") {
        console.log("\nCustomer is not DanDomain — nothing to compare.");
    }

    // Optional: if Original creds exist alongside HostedShop, cross-check
    const orig = normalizeDanDomainOriginalSettings(settings);
    if (customerType === "DanDomain" && orig.shopAdminUrl && orig.apiKey) {
        console.log("\n=== Cross-check: DanDomain Original WEBAPI also configured ===");
        const orders = await fetchDanDomainOriginalOrdersInRange(
            orig.shopAdminUrl,
            orig.apiKey,
            startDate,
            endDate
        );
        console.log(JSON.stringify(analyzeOriginalOrders(orders), null, 2));
    }

    await mongoose.disconnect();
    console.log("\nDone.\n");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
