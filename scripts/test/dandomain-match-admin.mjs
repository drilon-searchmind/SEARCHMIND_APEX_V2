/**
 * Brute-force HostedShop / DanDomain metrics vs admin “Omsætning”, COGS, Ordrer.
 * Does NOT change APEX — use output to pick the right rule before implementing.
 *
 * Usage:
 *   node scripts/test/dandomain-match-admin.mjs --start=2026-09-01 --end=2026-09-30
 *   node scripts/test/dandomain-match-admin.mjs --start=2025-09-01 --end=2025-09-30 --target-oms=89566 --target-cogs=45781 --target-orders=254
 *   node scripts/test/dandomain-match-admin.mjs --year-sweep=2024,2025,2026 --month=9
 *
 * Env: MONGODB_URI
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import { normalizeDanDomainSettings, resolveDanDomainReportingRules } from "../../src/lib/danDomainCustomerSettings.js";
import {
    fetchDanDomainOrdersInRange,
    fetchDanDomainPerformanceDaily,
    getDanDomainShopHost,
    resolveDanDomainAccessToken,
    getDanDomainOrderStatusId,
    mapDanDomainOrderToMetrics,
    sumDanDomainOrderLineRevenue,
    sumDanDomainOrderLineCogs,
    danDomainSalgsstatistikOmsExclVat,
    danDomainGraphqlRequest,
    aggregateDanDomainOrdersToDaily,
} from "../../src/lib/danDomainApi.js";
dotenv.config();

/** @type {Record<string, number>} — 1 unit of currency → DKK multiplier (extend if needed). */
const FX_TO_DKK = { DKK: 1, EUR: 7.45, USD: 6.85, SEK: 0.64, NOK: 0.63, GBP: 8.7 };

function fxToDkk(code) {
    const c = String(code || "DKK").toUpperCase();
    return FX_TO_DKK[c] ?? 1;
}

const DEFAULT_CUSTOMER_ID = "6a3d0e3693c772b89cddb180";

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

function ymdUtc(iso) {
    return String(iso || "").slice(0, 10);
}

function ymdCopenhagen(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Copenhagen" });
}

function inRange(ymd, start, end) {
    return ymd && ymd >= start && ymd <= end;
}

function statusFilter(id, { include, exclude }) {
    if (exclude?.length && exclude.includes(id)) return false;
    if (include?.length) return include.includes(id);
    return true;
}

/**
 * @param {Record<string, unknown>[]} orders
 * @param {object} cfg
 */
function aggregateScenario(orders, cfg, { start, end }) {
    const dateFn = cfg.tz === "dk" ? ymdCopenhagen : ymdUtc;
    let orderCount = 0;
    let oms = 0;
    let cogs = 0;

    for (const order of orders) {
        const sid = getDanDomainOrderStatusId(order);
        if (!statusFilter(sid, cfg)) continue;

        const dateField = cfg.dateField || "createdAt";
        if (dateField === "sentAt" && cfg.requireSent && !order.sentAt) continue;
        const raw = order[dateField];
        const d = dateFn(raw);
        if (!inRange(d, start, end)) continue;

        if (cfg.countOnly !== true) {
            const m = mapDanDomainOrderToMetrics(order);
            let rev = 0;
            switch (cfg.revenue) {
                case "subTotal":
                    rev = Number(order.subTotal) || 0;
                    break;
                case "lineRevenue":
                    rev = sumDanDomainOrderLineRevenue(order) || Number(order.subTotal) || 0;
                    break;
                case "mappedNet":
                    rev = m.net_sales;
                    break;
                case "totalMinusTax":
                    rev = Math.max(0, (Number(order.total) || 0) - (m.taxes || 0));
                    break;
                case "salgsstatistik":
                    rev = danDomainSalgsstatistikOmsExclVat(order, m);
                    break;
                case "subTotalInclAsExcl":
                    rev = (Number(order.subTotal) || 0) / 1.25;
                    break;
                case "totalInclAsExcl":
                    rev = (Number(order.total) || 0) / 1.25;
                    break;
                default:
                    rev = m.net_sales;
            }
            if (sid === "100") rev = -Math.abs(rev);

            const orderFx = cfg.fx === "orderCurrency" ? fxToDkk(order.currencyCode) : 1;

            oms += rev * orderFx;
            let c = sumDanDomainOrderLineCogs(order);
            if (sid === "100") c = -Math.abs(c);
            cogs += c * orderFx;
        }

        if (cfg.countOrders !== false) orderCount += 1;
    }

    return {
        orders: orderCount,
        oms: round(oms),
        cogs: round(cogs),
        profit: round(oms - cogs),
    };
}

function score(row, targets) {
    const dOms = Math.abs(row.oms - targets.oms);
    const dCogs = Math.abs(row.cogs - targets.cogs);
    const dOrd = Math.abs(row.orders - targets.orders);
    return dOms + dCogs / 5 + dOrd * 200;
}

async function fetchOrdersMerged(shopHost, token, start, end, { includeSentSearch }) {
    const base = await fetchDanDomainOrdersInRange(shopHost, token, start, end, {
        includeOrderLines: true,
    });

    if (!includeSentSearch) return base;

    const startIso = `${start}T00:00:00+00:00`;
    const endExclusive = new Date(`${end}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endIso = endExclusive.toISOString().replace(".000Z", "+00:00");

    /** @type {Record<string, unknown>[]} */
    const bySent = [];
    for (let page = 1; page <= 20; page++) {
        const q = `
        query {
          orders(
            pagination: { limit: 100, page: ${page} }
            search: [
              { field: sentAt, comparator: GREATER_THAN_OR_EQUAL, value: "${startIso}" }
              { field: sentAt, comparator: LESS_THAN, value: "${endIso}" }
            ]
          ) {
            data { id createdAt sentAt updatedAt currencyCode subTotal total status { id }
              orderLines { totalRevenue totalCost unitCost vatRate productTitle }
            }
          }
        }`;
        const res = await danDomainGraphqlRequest(shopHost, token, q, "experimental");
        const rows = res?.data?.orders?.data || [];
        bySent.push(...rows);
        if (rows.length < 100) break;
    }

    const map = new Map();
    for (const o of [...base, ...bySent]) map.set(String(o.id), o);
    return [...map.values()];
}

function buildScenarios() {
    const statusVariants = [
        { label: "s3", include: ["3"], exclude: [] },
        { label: "excl0,5", include: null, exclude: ["0", "5"] },
        { label: "s3,203", include: ["3", "203"], exclude: [] },
        { label: "excl0,5,203", include: null, exclude: ["0", "5", "203"] },
        { label: "all", include: null, exclude: [] },
    ];

    const dateVariants = [
        { dateField: "createdAt", tz: "utc", requireSent: false },
        { dateField: "createdAt", tz: "dk", requireSent: false },
        { dateField: "sentAt", tz: "utc", requireSent: true },
        { dateField: "sentAt", tz: "dk", requireSent: true },
        { dateField: "updatedAt", tz: "utc", requireSent: false },
    ];

    const revenueVariants = [
        "subTotal",
        "lineRevenue",
        "mappedNet",
        "totalMinusTax",
        "salgsstatistik",
        "subTotalInclAsExcl",
        "totalInclAsExcl",
    ];

    const fxVariants = ["none", "orderCurrency"]; // orderCurrency only matters if currencyCode !== DKK

    /** @type {object[]} */
    const out = [];
    for (const st of statusVariants) {
        for (const dt of dateVariants) {
            for (const rev of revenueVariants) {
                for (const fx of fxVariants) {
                    out.push({
                        id: `${st.label}|${dt.dateField}|${dt.tz}|${rev}|fx=${fx}`,
                        include: st.include,
                        exclude: st.exclude,
                        ...dt,
                        revenue: rev,
                        fx,
                    });
                }
            }
        }
    }
    return out;
}

async function runApexPipeline(settings, start, end) {
    const rows = [];
    for (const mode of ["orderSent", "salgsstatistik"]) {
        const s = {
            ...settings,
            danDomain: { ...(settings.danDomain || {}), revenueReporting: mode },
        };
        const daily = await fetchDanDomainPerformanceDaily(s, start, end);
        const sum = (k) => daily.reduce((a, d) => a + (Number(d[k]) || 0), 0);
        rows.push({
            id: `APEX pipeline: ${mode}`,
            orders: sum("orders"),
            oms: round(sum("net_sales")),
            cogs: round(sum("cost_of_goods_sold")),
            profit: round(sum("net_sales") - sum("cost_of_goods_sold")),
        });
    }
    return rows;
}

async function main() {
    const args = parseArgs(process.argv);
    const targets = {
        oms: Number(args["target-oms"] ?? 89566),
        cogs: Number(args["target-cogs"] ?? 45781),
        orders: Number(args["target-orders"] ?? 254),
    };

    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI missing");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });
    const Customer = mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));

    let customer;
    if (args.customerId) customer = await Customer.findById(args.customerId.trim()).lean();
    else customer = await Customer.findById(DEFAULT_CUSTOMER_ID).lean();

    if (!customer) {
        console.error("Customer not found");
        process.exit(1);
    }

    const settings = { ...(customer.CustomerSettings || {}), customerName: customer.customerName };
    const dan = normalizeDanDomainSettings(settings);
    const shopHost = getDanDomainShopHost(dan);
    const token = await resolveDanDomainAccessToken(dan);
    const storeCurrency = String(settings.customerStoreValutaCode || "DKK").toUpperCase();

    const ranges = [];
    if (args["year-sweep"]) {
        const years = args["year-sweep"].split(",").map((y) => y.trim());
        const month = String(args.month || "9").padStart(2, "0");
        for (const y of years) {
            const lastDay = month === "02" ? "28" : "30";
            ranges.push({ start: `${y}-${month}-01`, end: `${y}-${month}-${lastDay}`, label: `${y}-${month}` });
        }
    } else {
        ranges.push({
            start: args.start || "2026-09-01",
            end: args.end || "2026-09-30",
            label: `${args.start || "2026-09-01"}..${args.end || "2026-09-30"}`,
        });
    }

    console.log("\n=== DanDomain admin match probe ===");
    console.log(
        JSON.stringify(
            {
                customer: customer.customerName,
                customerId: String(customer._id),
                shopHost,
                storeCurrency,
                storeFxToDkk: fxToDkk(storeCurrency),
                targets,
            },
            null,
            2
        )
    );

    const scenarios = buildScenarios();

    for (const range of ranges) {
        console.log(`\n=== Period: ${range.label} ===`);

        const ordersCreated = await fetchOrdersMerged(shopHost, token, range.start, range.end, {
            includeSentSearch: false,
        });
        const ordersMerged = await fetchOrdersMerged(shopHost, token, range.start, range.end, {
            includeSentSearch: true,
        });

        const currencies = {};
        for (const o of ordersCreated) {
            const c = String(o.currencyCode || "DKK").toUpperCase();
            currencies[c] = (currencies[c] || 0) + 1;
        }
        console.log("Orders (createdAt window):", ordersCreated.length, "| currencies:", currencies);

        /** @type {object[]} */
        const results = [];

        for (const dataset of [
            { name: "fetch:createdAt", orders: ordersCreated },
            { name: "fetch:created+sent", orders: ordersMerged },
        ]) {
            for (const sc of scenarios) {
                const row = aggregateScenario(dataset.orders, sc, {
                    start: range.start,
                    end: range.end,
                });
                results.push({
                    dataset: dataset.name,
                    ...sc,
                    ...row,
                    score: score(row, targets),
                });
            }
        }

        const apexRows = await runApexPipeline(settings, range.start, range.end);
        for (const row of apexRows) {
            results.push({ dataset: "APEX", id: row.id, ...row, score: score(row, targets) });
        }

        results.sort((a, b) => a.score - b.score);

        console.log("\nTop 12 closest to admin targets (lower score = better):");
        console.log(
            "score\torders\toms\tcogs\tprofit\tscenario"
        );
        for (const r of results.slice(0, 12)) {
            console.log(
                `${round(r.score)}\t${r.orders}\t${r.oms}\t${r.cogs}\t${r.profit}\t${r.dataset} | ${r.id}`
            );
        }

        const best = results[0];
        console.log("\nBest delta vs targets:", {
            oms: round(best.oms - targets.oms),
            cogs: round(best.cogs - targets.cogs),
            orders: best.orders - targets.orders,
        });

        console.log("\nReporting rules (current config):", resolveDanDomainReportingRules(dan));
    }

    console.log(
        "\nNote: If best omsætning matches targets on 2025-09 but not 2026-09, admin and APEX likely use different years."
    );
    console.log("DanDomain salgsstatistik docs: order CREATE date, exclude status 0+5, product+fragt excl. VAT.");

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
