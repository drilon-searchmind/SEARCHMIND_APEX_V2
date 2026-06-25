import {
    normalizeDanDomainOriginalSettings,
    normalizeDanDomainOriginalShopAdminUrl,
} from "./danDomainOriginalCustomerSettings";

/**
 * DanDomain legacy WEBAPI (pre-HostedShop GraphQL).
 * @example GET {shopAdminUrl}/admin/WEBAPI/Endpoints/v1_0/OrderService/{apiKey}/GetByDateInterval?start=YYYY-MM-DD&end=YYYY-MM-DD
 */

function num(v) {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function dbg(...args) {
    if (process.env.DEBUG_DANDOMAIN_ORIGINAL === "1" || process.env.NODE_ENV === "development") {
        console.log("[DanDomainOriginal]", ...args);
    }
}

/**
 * @param {ReturnType<typeof normalizeDanDomainOriginalSettings>} cfg
 */
export function getDanDomainOriginalShopAdminUrl(cfg) {
    const url = normalizeDanDomainOriginalShopAdminUrl(cfg?.shopAdminUrl);
    if (!url) {
        throw new Error(
            "Missing DanDomain Original shop admin URL — set Config → DanDomain Original → Shop admin URL (e.g. https://ajengros.dk)"
        );
    }
    return url;
}

/**
 * @param {ReturnType<typeof normalizeDanDomainOriginalSettings>} cfg
 */
export function getDanDomainOriginalApiKey(cfg) {
    const key = String(cfg?.apiKey || "").trim();
    if (!key) {
        throw new Error(
            "Missing DanDomain Original WEBAPI key — set Config → DanDomain Original → WEBAPI key"
        );
    }
    return key;
}

/**
 * @param {unknown} raw
 * @returns {string} YYYY-MM-DD
 */
export function parseDanDomainOriginalOrderDateYmd(raw) {
    if (!raw) return "";
    const s = String(raw);
    const m = /\/Date\((-?\d+)/.exec(s);
    if (m) {
        const d = new Date(Number(m[1]));
        if (!Number.isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
        }
    }
    if (s.length >= 10) return s.slice(0, 10);
    return "";
}

/**
 * @param {unknown} vatPct
 * @returns {number}
 */
function parseVatRate(vatPct) {
    const n = parseFloat(String(vatPct ?? "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n / 100;
    return 0.25;
}

/**
 * @param {number} amount
 * @param {boolean} inclVat
 * @param {number} vatRate
 */
function amountExVat(amount, inclVat, vatRate) {
    const a = num(amount);
    if (!a) return 0;
    if (!inclVat) return a;
    return a / (1 + vatRate);
}

/**
 * @param {string} shopAdminUrl
 * @param {string} apiKey
 * @param {string} startDate
 * @param {string} endDate
 */
export function buildDanDomainOriginalOrdersUrl(shopAdminUrl, apiKey, startDate, endDate) {
    const base = normalizeDanDomainOriginalShopAdminUrl(shopAdminUrl);
    const key = encodeURIComponent(String(apiKey).trim());
    const params = new URLSearchParams({ start: startDate, end: endDate });
    return `${base}/admin/WEBAPI/Endpoints/v1_0/OrderService/${key}/GetByDateInterval?${params.toString()}`;
}

/**
 * @param {string} shopAdminUrl
 * @param {string} apiKey
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchDanDomainOriginalOrdersInRange(
    shopAdminUrl,
    apiKey,
    startDate,
    endDate
) {
    const url = buildDanDomainOriginalOrdersUrl(shopAdminUrl, apiKey, startDate, endDate);
    dbg("fetch", url.replace(apiKey, "***"));

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });

    const raw = await res.json().catch(() => null);
    if (!res.ok) {
        const msg =
            (raw && typeof raw === "object" && (raw.message || raw.error)) ||
            res.statusText ||
            `HTTP ${res.status}`;
        throw new Error(`DanDomain Original WEBAPI failed: ${msg}`);
    }

    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && Array.isArray(raw.orders)) return raw.orders;
    if (raw && typeof raw === "object" && Array.isArray(raw.data)) return raw.data;
    return [];
}

/**
 * Map a legacy WEBAPI order to Shopify-compatible daily metric components.
 * @param {Record<string, unknown>} order
 * @returns {Record<string, number> | null}
 */
export function mapDanDomainOriginalOrderToMetrics(order) {
    if (order?.orderState?.exclStatistics === true) return null;
    if (order?.incomplete === true) return null;

    const vatRate = parseVatRate(order.vatPct);
    const discount = Math.abs(num(order.salesDiscount));
    const giftCert = Math.abs(num(order.giftCertificateAmount));
    const totalDiscount = discount + giftCert;

    const totalIncl = num(order.totalPrice);
    if (totalIncl <= 0) return null;

    const shippingInfo =
        typeof order.shippingInfo === "object" && order.shippingInfo !== null
            ? order.shippingInfo
            : {};
    const paymentInfo =
        typeof order.paymentInfo === "object" && order.paymentInfo !== null
            ? order.paymentInfo
            : {};

    const shippingFee = num(shippingInfo.fee);
    const shippingInclVat = shippingInfo.feeInclVat !== false;
    const shippingExcl = amountExVat(shippingFee, shippingInclVat, vatRate);

    const paymentFee = num(paymentInfo.fee);
    const paymentInclVat = paymentInfo.feeInclVat === true;
    const paymentExcl = amountExVat(paymentFee, paymentInclVat, vatRate);

    const totalExcl = totalIncl / (1 + vatRate);
    const tax = Math.max(0, totalIncl - totalExcl);

    let linesGrossIncl = 0;
    const lines = Array.isArray(order.orderLines) ? order.orderLines : [];
    for (const line of lines) {
        linesGrossIncl += num(line.totalPrice);
    }
    const linesGrossExcl = linesGrossIncl > 0 ? linesGrossIncl / (1 + vatRate) : 0;

    let gross = linesGrossExcl + totalDiscount;
    if (!gross) {
        gross = Math.max(0, totalExcl - shippingExcl - paymentExcl + totalDiscount);
    }

    const netSales = Math.max(0, totalExcl - shippingExcl - paymentExcl);

    return {
        gross_sales: gross,
        discounts: totalDiscount,
        returns: 0,
        net_sales: netSales,
        shipping_charges: shippingExcl,
        duties: 0,
        additional_fees: paymentExcl,
        taxes: tax,
        total_sales: totalIncl,
        custom_1: netSales + shippingExcl,
        orders: 1,
    };
}

/**
 * @param {Record<string, unknown>[]} orders
 * @param {string} startDate
 * @param {string} endDate
 */
export function aggregateDanDomainOriginalOrdersToDaily(orders, startDate, endDate) {
    /** @type {Record<string, Record<string, number>>} */
    const byDay = {};

    for (const order of orders || []) {
        const ymd = parseDanDomainOriginalOrderDateYmd(order.createdDate);
        if (!ymd || ymd < startDate || ymd > endDate) continue;

        const m = mapDanDomainOriginalOrderToMetrics(order);
        if (!m) continue;

        if (!byDay[ymd]) {
            byDay[ymd] = {
                period: ymd,
                gross_sales: 0,
                discounts: 0,
                returns: 0,
                net_sales: 0,
                shipping_charges: 0,
                duties: 0,
                additional_fees: 0,
                taxes: 0,
                total_sales: 0,
                custom_1: 0,
                orders: 0,
            };
        }
        const d = byDay[ymd];
        d.gross_sales += m.gross_sales;
        d.discounts += m.discounts;
        d.returns += m.returns;
        d.net_sales += m.net_sales;
        d.shipping_charges += m.shipping_charges;
        d.duties += m.duties;
        d.additional_fees += m.additional_fees;
        d.taxes += m.taxes;
        d.total_sales += m.total_sales;
        d.custom_1 += m.custom_1;
        d.orders += 1;
    }

    return Object.values(byDay).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Daily revenue rows compatible with merged-sources shape.
 * @param {Record<string, unknown>} customerSettings
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
export async function fetchDanDomainOriginalPerformanceDaily(
    customerSettings,
    startDate,
    endDate
) {
    const cfg = normalizeDanDomainOriginalSettings(customerSettings);
    const shopAdminUrl = getDanDomainOriginalShopAdminUrl(cfg);
    const apiKey = getDanDomainOriginalApiKey(cfg);

    const orders = await fetchDanDomainOriginalOrdersInRange(
        shopAdminUrl,
        apiKey,
        startDate,
        endDate
    );
    dbg("orders fetched", orders.length);
    return aggregateDanDomainOriginalOrdersToDaily(orders, startDate, endDate);
}
