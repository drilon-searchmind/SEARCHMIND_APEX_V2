/**
 * Fixed “anchor” metrics for Hugo P / DanDomain vs admin dashboard.
 * Run: node scripts/test/dandomain-admin-anchors.mjs --start=2026-09-01 --end=2026-09-30
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import {
    fetchDanDomainOrdersInRange,
    getDanDomainShopHost,
    resolveDanDomainAccessToken,
    getDanDomainOrderStatusId,
    mapDanDomainOrderToMetrics,
    sumDanDomainOrderLineCogs,
    sumDanDomainOrderLineRevenue,
    danDomainSalgsstatistikOmsExclVat,
    fetchDanDomainPerformanceDaily,
    danDomainGraphqlRequest,
} from "../../src/lib/danDomainApi.js";
import { normalizeDanDomainSettings } from "../../src/lib/danDomainCustomerSettings.js";

dotenv.config();

const CUSTOMER_ID = "6a3d0e3693c772b89cddb180";
const ADMIN = { oms: 89566, cogs: 45781, orders: 254 };

function parseArgs(argv) {
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

function ymd(iso) {
    return String(iso || "").slice(0, 10);
}

function inRange(d, start, end) {
    return d && d >= start && d <= end;
}

function statusOk(id, { include, exclude }) {
    if (exclude?.includes(id)) return false;
    if (include?.length) return include.includes(id);
    return true;
}

function aggregate(orders, { start, end, dateField, status, revenueKey, requireSent }) {
    let ordersN = 0;
    let oms = 0;
    let cogs = 0;
    for (const order of orders) {
        const sid = getDanDomainOrderStatusId(order);
        if (!statusOk(sid, status)) continue;
        if (requireSent && dateField === "sentAt" && !order.sentAt) continue;
        const d = ymd(order[dateField]);
        if (!inRange(d, start, end)) continue;
        ordersN++;
        const m = mapDanDomainOrderToMetrics(order);
        let rev = 0;
        switch (revenueKey) {
            case "net_sales":
                rev = m.net_sales;
                break;
            case "salgsstatistik":
                rev = danDomainSalgsstatistikOmsExclVat(order, m);
                break;
            case "total_div_125":
                rev = (Number(order.total) || 0) / 1.25;
                break;
            case "subTotal":
                rev = Number(order.subTotal) || 0;
                break;
            case "totalMinusTax":
                rev = Math.max(0, (Number(order.total) || 0) - (m.taxes || 0));
                break;
            case "lineRevenue":
                rev = sumDanDomainOrderLineRevenue(order) || Number(order.subTotal) || 0;
                break;
            case "totalExVatField":
                rev =
                    Number(order.totalPriceExVat) ||
                    Number(order.totalExVat) ||
                    Number(order.totalPriceExVat) ||
                    0;
                break;
            default:
                rev = m.net_sales;
        }
        if (sid === "100") rev = -Math.abs(rev);
        oms += rev;
        let c = sumDanDomainOrderLineCogs(order);
        if (sid === "100") c = -Math.abs(c);
        cogs += c;
    }
    return { orders: ordersN, oms: round(oms), cogs: round(cogs) };
}

async function sampleExVatFields(shopHost, token, orderId) {
    const q = `
    query {
      orders(pagination: { limit: 1, page: 1 }, search: [{ field: id, comparator: EQUAL, value: "${orderId}" }]) {
        data {
          id total subTotal totalPriceExVat totalPriceIncVat totalExVat totalIncVat totalVat vat tax
        }
      }
    }`;
    try {
        const res = await danDomainGraphqlRequest(shopHost, token, q, "experimental");
        return res?.data?.orders?.data?.[0] || null;
    } catch {
        return null;
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const start = args.start || "2026-09-01";
    const end = args.end || "2026-09-30";

    await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });
    const Customer = mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));
    const customer = await Customer.findById(CUSTOMER_ID).lean();
    const settings = { ...(customer.CustomerSettings || {}), customerName: customer.customerName };
    const dan = normalizeDanDomainSettings(settings);
    const shopHost = getDanDomainShopHost(dan);
    const token = await resolveDanDomainAccessToken(dan);

    const orders = await fetchDanDomainOrdersInRange(shopHost, token, start, end, {
        includeOrderLines: true,
    });

    const excl05 = { include: null, exclude: ["0", "5"] };
    const s3only = { include: ["3"], exclude: [] };
    const s3203 = { include: ["3", "203"], exclude: [] };

    const anchors = [
        {
            label: "APEX orderSent (sentAt, status 3, net_sales)",
            ...aggregate(orders, {
                start,
                end,
                dateField: "sentAt",
                status: s3only,
                revenueKey: "net_sales",
                requireSent: true,
            }),
        },
        {
            label: "Salgsstatistik (createdAt, excl 0+5, net+shipping)",
            ...aggregate(orders, {
                start,
                end,
                dateField: "createdAt",
                status: excl05,
                revenueKey: "salgsstatistik",
                requireSent: false,
            }),
        },
        {
            label: "Admin-like oms: createdAt excl 0+5, total/1.25",
            ...aggregate(orders, {
                start,
                end,
                dateField: "createdAt",
                status: excl05,
                revenueKey: "total_div_125",
                requireSent: false,
            }),
        },
        {
            label: "createdAt excl 0+5, mapped net_sales",
            ...aggregate(orders, {
                start,
                end,
                dateField: "createdAt",
                status: excl05,
                revenueKey: "net_sales",
                requireSent: false,
            }),
        },
        {
            label: "createdAt status 3+203, total/1.25",
            ...aggregate(orders, {
                start,
                end,
                dateField: "createdAt",
                status: s3203,
                revenueKey: "total_div_125",
                requireSent: false,
            }),
        },
        {
            label: "sentAt status 3 only, subTotal",
            ...aggregate(orders, {
                start,
                end,
                dateField: "sentAt",
                status: s3only,
                revenueKey: "subTotal",
                requireSent: true,
            }),
        },
    ];

    for (const mode of ["orderSent", "salgsstatistik"]) {
        const s = {
            ...settings,
            danDomain: { ...(settings.danDomain || {}), revenueReporting: mode },
        };
        const daily = await fetchDanDomainPerformanceDaily(s, start, end);
        const sum = (k) => daily.reduce((a, d) => a + (Number(d[k]) || 0), 0);
        anchors.push({
            label: `APEX pipeline (${mode})`,
            orders: sum("orders"),
            oms: round(sum("net_sales")),
            cogs: round(sum("cost_of_goods_sold")),
        });
    }

    console.log("\n=== DanDomain admin anchors ===");
    console.log(`Period: ${start} .. ${end}`);
    console.log(`Admin targets: oms ${ADMIN.oms} | cogs ${ADMIN.cogs} | orders ${ADMIN.orders}`);
    console.log(`Fetched (createdAt window): ${orders.length} orders | all currencyCode DKK\n`);

    console.log("label\torders\toms Δ\tcogs Δ\toms\tcogs");
    for (const a of anchors) {
        console.log(
            `${a.label}\t${a.orders}\t${round(a.oms - ADMIN.oms)}\t${round(a.cogs - ADMIN.cogs)}\t${a.oms}\t${a.cogs}`
        );
    }

    const sample = orders.find((o) => getDanDomainOrderStatusId(o) === "3");
    if (sample) {
        const fields = await sampleExVatFields(shopHost, token, String(sample.id));
        console.log("\nSample order ex-VAT GraphQL fields (one status-3 order):");
        console.log(JSON.stringify(fields, null, 2));
    }

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
