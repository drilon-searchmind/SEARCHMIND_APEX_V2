import { shopifyqlQuery } from './shopifyApi';
import { getCurrencyConversionTable, conversionRateToDkk } from './currencyConversionTable';
import { totalAdSpendFromMerged, channelSpendTotalsFromMerged } from './mergeAdSpendDaily';

/**
 * Fetch Shopify orders for customer segmentation (customer id, date, total, net).
 * @param {object} settings - { shopifyUrl, shopifyApiPassword, customerStoreValutaCode }
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {object} opts - { extendForLtv: boolean } When true (default), fetches startDate-365 to endDate for LTV. When false, fetches only [startDate,endDate] for fast core metrics.
 * @returns {Promise<Array<{ customer, created_at, total_price, net_price }>>}
 */
async function fetchShopifyOrdersForSegmentation(settings, startDate, endDate, opts = {}) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return [];
    const shopUrl = settings.shopifyUrl;
    const accessToken = settings.shopifyApiPassword;

    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);

    const endpoint = `https://${shopUrl}/admin/api/2025-10/graphql.json`;
    const orders = [];
    // UI uses LTV 30/90/180, so we need 180 days of lookback for full LTV.
    const extendDays = opts.extendForLtv !== false ? 180 : 0;
    const fetchStart = new Date(startDate);
    fetchStart.setDate(fetchStart.getDate() - extendDays);
    const fetchStartStr = fetchStart.toISOString().slice(0, 10);

    const query = `query getOrdersForSegmentation($query: String!, $cursor: String) {
        orders(first: 250, query: $query, after: $cursor) {
            edges {
                node {
                    id
                    createdAt
                    totalPriceSet { shopMoney { amount } }
                    netPaymentSet { shopMoney { amount } }
                    customer {
                        id
                        email
                    }
                }
                cursor
            }
            pageInfo { hasNextPage endCursor }
        }
    }`;

    const q = `created_at:>="${fetchStartStr}" AND created_at:<="${endDate}"`;
    let cursor = null;
    let hasNext = true;
    let pageNum = 0;

    try {
        while (hasNext) {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken,
                },
                body: JSON.stringify({ query, variables: { query: q, cursor } }),
            });
            if (!res.ok) throw new Error(`Shopify GraphQL error: ${res.status}`);
            const json = await res.json();
            const apiErrors = json?.errors;
            if (apiErrors?.length) {
                console.warn('[Customer Segmentation] Shopify GraphQL API errors:', apiErrors);
                const accessDenied = apiErrors.find((e) => e?.extensions?.code === 'ACCESS_DENIED' || /access denied|required access/i.test(e?.message || ''));
                if (accessDenied) {
                    const requiredScope = (accessDenied?.extensions?.requiredAccess || accessDenied?.message?.match(/Required access: (.+)/i)?.[1] || 'additional scope').replace(/\.$/, '');
                    throw new Error(`Shopify access denied. This store's app needs the ${requiredScope} to compute LTV. Ask the merchant to add this scope in their Shopify app settings.`);
                }
            }
            const edges = json?.data?.orders?.edges || [];
            let skippedNoCustomer = 0;
            for (const edge of edges) {
                const node = edge.node;
                const cust = node.customer;
                const custId = cust?.id || cust?.email || null;
                if (!custId) {
                    skippedNoCustomer += 1;
                    continue;
                }
                const total = (parseFloat(node.totalPriceSet?.shopMoney?.amount) || 0) * conversionRate;
                const net = (parseFloat(node.netPaymentSet?.shopMoney?.amount) || 0) * conversionRate;
                orders.push({
                    customer: { id: cust?.id, email: cust?.email },
                    customer_id: cust?.id,
                    customer_email: cust?.email,
                    created_at: node.createdAt,
                    total_price: total,
                    net_price: net,
                });
            }
            const pageInfo = json?.data?.orders?.pageInfo || {};
            hasNext = !!pageInfo.hasNextPage;
            cursor = pageInfo.endCursor || null;
            // Log first page to diagnose empty results
            if (opts.extendForLtv !== false && pageNum === 0) {
                const firstNode = edges[0]?.node;
                console.log('[Customer Segmentation] fetchShopifyOrdersForSegmentation first page:', {
                    edgesCount: edges.length,
                    skippedNoCustomer,
                    hasNextPage: pageInfo.hasNextPage,
                    sampleNode: firstNode ? { hasCustomer: !!firstNode.customer, createdAt: firstNode.createdAt } : null,
                    apiErrors: apiErrors?.length ? apiErrors : undefined,
                });
            }
            pageNum += 1;
        }
        if (opts.extendForLtv !== false) {
            console.log('[Customer Segmentation] fetchShopifyOrdersForSegmentation:', {
                range: `${fetchStartStr} to ${endDate}`,
                ordersCount: orders.length,
                sampleCustomer: orders[0] ? { hasId: !!orders[0].customer_id, hasEmail: !!orders[0].customer_email } : null,
            });
        }

        // Fallback: Shopify restricts read_orders to 60 days for apps without read_all_orders.
        // If 180-day fetch returned 0 orders, retry with 60-day window.
        if (opts.extendForLtv !== false && !opts._retry60 && orders.length === 0 && extendDays === 180) {
            const fallbackStart = new Date(endDate);
            fallbackStart.setDate(fallbackStart.getDate() - 60);
            const fallbackStartStr = fallbackStart.toISOString().slice(0, 10);
            console.log('[Customer Segmentation] Retrying with 60-day window (Shopify read_orders scope):', fallbackStartStr, 'to', endDate);
            return fetchShopifyOrdersForSegmentation(settings, fallbackStartStr, endDate, { ...opts, extendForLtv: false, _retry60: true });
        }
        return orders;
    } catch (err) {
        if (/Shopify access denied|access denied|required access/i.test(err?.message || '')) {
            throw err;
        }
        console.error('fetchShopifyOrdersForSegmentation error:', err);
        return [];
    }
}

export function computeSegmentationFromMerged(merged = {}, startDate, endDate) {
    // Try to find per-order customer-level data first
    const orders = merged.shopifyOrders || merged.orders || merged.shopify?.orders || [];

    if (orders.length === 0) {
        console.log('[Customer Segmentation] computeSegmentationFromMerged: no order-level data, merged keys:', Object.keys(merged));
    }

    // Initialize defaults
    let totalCustomers = 0;
    let newCustomers = 0;
    let returningCustomers = 0;
    let repeatRate = 0;
    let ordersPerReturning = 0;
    const insights = [];

    const adSpendFromMerged = totalAdSpendFromMerged(merged);
    const adSpendByChannelFromMerged = channelSpendTotalsFromMerged(merged);

    if (Array.isArray(orders) && orders.length > 0) {
        const s = new Date(startDate);
        const e = new Date(endDate);

        // Group by customer identifier (email preferred)
        const byCust = new Map();
        let totalRevenue = 0;
        let totalOrders = 0;
        let totalNetRevenue = 0;
        orders.forEach(o => {
            const cust = (o.customer && (o.customer.id || o.customer.email)) || o.customer_email || o.email || o.customer_id || o.buyer_email || null;
            if (!cust) return;
            const id = String(cust).toLowerCase();
            const created = o.created_at || o.createdAt || o.date || o.processed_at || null;
            const total = Number(o.total_price || o.total || o.price || o.amount || o.subtotal || 0) || 0;
            const net = o.net_price != null ? Number(o.net_price) : total;
            if (!byCust.has(id)) byCust.set(id, { orders: [], firstSeen: null, totalValue: 0, totalNetValue: 0 });
            const rec = byCust.get(id);
            const orderDate = created ? new Date(created) : null;
            rec.orders.push({ date: orderDate, total, net });
            rec.totalValue += total;
            rec.totalNetValue += net;
            // Only include orders within the selected period for revenue/order totals
            if (orderDate instanceof Date && orderDate >= s && orderDate <= e) {
                totalRevenue += total;
                totalNetRevenue += net;
                totalOrders += 1;
            }
            if (created) {
                const d = new Date(created);
                if (!rec.firstSeen || d < rec.firstSeen) rec.firstSeen = d;
            }
        });

        totalCustomers = byCust.size;
        let returningOrdersCount = 0, returningCustomersCount = 0;
        let newCustomersWithRepeat = 0; // new customers who placed >1 order in range
        let firstOrdersCount = 0; // count orders that were first orders (customer's first order falling in range)

        // Prepare daily map for time-series
        const msPerDay = 1000 * 60 * 60 * 24;
        const days = Math.floor((e - s) / msPerDay) + 1;
        const dailyMap = {};
        for (let i = 0; i < days; i++) {
            const d = new Date(s.getTime() + i * msPerDay);
            const key = d.toISOString().slice(0, 10);
            dailyMap[key] = { newSet: new Set(), returningSet: new Set(), orders: 0, revenue: 0 };
        }

        byCust.forEach((info, id) => {
            const isNewCustomer = info.firstSeen && info.firstSeen >= s && info.firstSeen <= e;
            if (isNewCustomer) newCustomers += 1;
            else returningCustomers += 1;

            const ordersInRange = info.orders.filter(o => o.date instanceof Date && o.date >= s && o.date <= e);
            const ordersInRangeCount = ordersInRange.length;

            if (isNewCustomer && ordersInRangeCount > 1) newCustomersWithRepeat += 1;

            if (!isNewCustomer) {
                returningCustomersCount += 1;
                returningOrdersCount += ordersInRangeCount;
            }

            // Count first orders (per-order level) and fill dailyMap
            ordersInRange.forEach(o => {
                const dayKey = o.date.toISOString().slice(0, 10);
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { newSet: new Set(), returningSet: new Set(), orders: 0, revenue: 0 };
                dailyMap[dayKey].orders += 1;
                dailyMap[dayKey].revenue += o.total || 0;
                // If this order date equals the customer's firstSeen and that firstSeen is within range -> it's a first order
                if (info.firstSeen && info.firstSeen.toISOString().slice(0, 10) === dayKey) {
                    dailyMap[dayKey].newSet.add(id);
                    firstOrdersCount += 1;
                } else {
                    dailyMap[dayKey].returningSet.add(id);
                }
            });
        });

        let dailySeries = Object.keys(dailyMap).sort().map(period => ({
            period,
            newCustomers: dailyMap[period].newSet.size,
            returningCustomers: dailyMap[period].returningSet.size,
            orders: dailyMap[period].orders,
            revenue: Number(dailyMap[period].revenue.toFixed(2)),
        }));

        // Repeat rate and avg orders per returning customer
        repeatRate = returningCustomersCount > 0 ? (returningOrdersCount / returningCustomersCount) : 0;
        ordersPerReturning = returningCustomersCount > 0 ? (returningOrdersCount / returningCustomersCount) : 0;

        // First-time buyer conversion (within period): % of new customers who placed >1 order in period
        const firstTimeRepeatRate = newCustomers > 0 ? (newCustomersWithRepeat / newCustomers) * 100 : 0;

        // Churn estimate: compare active customers in first half vs second half of range
        const halfDays = Math.max(1, Math.ceil(days / 2));
        const midDate = new Date(s.getTime() + (halfDays - 1) * msPerDay);
        const firstHalfStart = s;
        const firstHalfEnd = midDate;
        const secondHalfStart = new Date(midDate.getTime() + msPerDay);
        const secondHalfEnd = e;

        const activeFirstHalf = new Set();
        const activeSecondHalf = new Set();
        byCust.forEach((info, id) => {
            const hasFirstHalf = info.orders.some(o => o.date instanceof Date && o.date >= firstHalfStart && o.date <= firstHalfEnd);
            const hasSecondHalf = info.orders.some(o => o.date instanceof Date && o.date >= secondHalfStart && o.date <= secondHalfEnd);
            if (hasFirstHalf) activeFirstHalf.add(id);
            if (hasSecondHalf) activeSecondHalf.add(id);
        });
        const intersection = new Set([...activeFirstHalf].filter(x => activeSecondHalf.has(x)));
        const churnCount = activeFirstHalf.size > 0 ? (activeFirstHalf.size - intersection.size) : 0;
        const churnPercent = activeFirstHalf.size > 0 ? (churnCount / activeFirstHalf.size) * 100 : 0;
        const churnMonthly = churnPercent * (30 / Math.max(1, halfDays));

        // LTV estimate (naive): avg monthly revenue per customer * (1 / churnMonthlyDecimal)
        const avgRevenuePerCustomerPeriod = totalCustomers > 0 ? (totalRevenue / totalCustomers) : 0;
        const avgMonthlyRevenuePerCustomer = avgRevenuePerCustomerPeriod * (30 / Math.max(1, days));
        const churnMonthlyDecimal = churnMonthly / 100;
        const lifetimeMonths = churnMonthlyDecimal > 0 ? (1 / churnMonthlyDecimal) : null;
        const ltvEstimate = lifetimeMonths ? Number((avgMonthlyRevenuePerCustomer * lifetimeMonths).toFixed(2)) : null;

        // NCA Revenue = new customers × AOV (assumes each new customer places exactly one order)
        const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const ncaRevenue = Number((newCustomers * aov).toFixed(2));

        // NCA net revenue = sum of net from new customers' first orders in period
        let ncaNetRevenue = 0;
        let returningCustomerNetRevenue = 0;
        byCust.forEach((info) => {
            const isNewCustomer = info.firstSeen && info.firstSeen >= s && info.firstSeen <= e;
            const firstOrder = info.orders.find(o => o.date && info.firstSeen && o.date.toISOString().slice(0, 10) === info.firstSeen.toISOString().slice(0, 10));
            if (isNewCustomer && firstOrder?.net != null) ncaNetRevenue += firstOrder.net;
            else if (isNewCustomer && firstOrder) ncaNetRevenue += firstOrder.total;
        });
        ncaNetRevenue = Number(ncaNetRevenue.toFixed(2));
        returningCustomerNetRevenue = Number((totalNetRevenue - ncaNetRevenue).toFixed(2));

        // LTV 30, 90, 180 days: avg revenue per customer in first X days from first purchase
        const msPerDayNum = 1000 * 60 * 60 * 24;
        const ltvWindows = [30, 90, 180];
        const ltvResult = { ltv30: null, ltv90: null, ltv180: null, ltv365: null };
        const cutoffDate = new Date(e.getTime() - 1); // exclude partial windows at end
        const ltvCohortCounts = {};
        for (const window of ltvWindows) {
            const windowMs = window * msPerDayNum;
            const cutoff = new Date(cutoffDate.getTime() - windowMs);
            let sum = 0;
            let count = 0;
            byCust.forEach((info) => {
                if (!info.firstSeen) return;
                if (info.firstSeen > cutoff) return; // customer must have first order window+days ago
                const windowEnd = new Date(info.firstSeen.getTime() + windowMs);
                const revenueInWindow = info.orders
                    .filter(o => o.date instanceof Date && o.date >= info.firstSeen && o.date < windowEnd)
                    .reduce((acc, o) => acc + (o.net != null ? o.net : o.total), 0);
                sum += revenueInWindow;
                count += 1;
            });
            ltvCohortCounts[`ltv${window}`] = count;
            if (count > 0) ltvResult[`ltv${window}`] = Number((sum / count).toFixed(2));
        }
        if (Object.values(ltvResult).every((v) => v == null)) {
            const firstSeenDates = [...byCust.values()].map((i) => i.firstSeen).filter(Boolean);
            const earliestFirstSeen = firstSeenDates.reduce((min, d) => (!min || d < min ? d : min), null);
            const cutoffLtv30 = new Date(cutoffDate.getTime() - 30 * msPerDayNum);
            const sampleFirstSeen = firstSeenDates.slice(0, 5).map((d) => d.toISOString().slice(0, 10));
            const qualifyingForLtv30 = firstSeenDates.filter((d) => d <= cutoffLtv30).length;
            console.log('[Customer Segmentation] LTV all null - debug:', {
                ordersCount: orders.length,
                byCustSize: byCust.size,
                ltvCohortCounts,
                endDate: String(endDate),
                cutoffLtv30: cutoffLtv30.toISOString().slice(0, 10),
                earliestFirstSeen: earliestFirstSeen ? earliestFirstSeen.toISOString().slice(0, 10) : null,
                sampleFirstSeen,
                qualifyingForLtv30,
            });
        }

        // If we have store-wide daily totals, prefer them for overall orders/revenue to avoid dropping guest/unknown-customer orders.
        // (Order-level payload skips orders with no customer id/email, which makes totals look "wrong" vs Shopify.)
        let storeTotalOrders = totalOrders;
        let storeTotalRevenue = totalRevenue;
        let storeTotalNetRevenue = totalNetRevenue;
        const shopifyDaily = merged.shopifyDaily || merged.shopify_daily || merged.shopify || [];
        if (Array.isArray(shopifyDaily) && shopifyDaily.length > 0) {
            storeTotalOrders = shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0);
            storeTotalRevenue = shopifyDaily.reduce((sum, d) => sum + (d.total_sales || d.net_sales || 0), 0);
            storeTotalNetRevenue = shopifyDaily.reduce((sum, d) => sum + (d.net_sales || d.total_sales || 0), 0);

            // Merge daily series: keep new/returning customer counts from order-level, but orders/revenue from store totals.
            const byDay = new Map(dailySeries.map(d => [d.period, { ...d }]));
            for (const d of shopifyDaily) {
                const period = d.period || d.date || d.day;
                if (!period) continue;
                const rec = byDay.get(period) || { period, newCustomers: 0, returningCustomers: 0, orders: 0, revenue: 0 };
                rec.orders = d.orders || 0;
                rec.revenue = Number(((d.total_sales ?? d.net_sales ?? 0) || 0).toFixed(2));
                byDay.set(period, rec);
            }
            // overwrite dailySeries variable by shadowing
            const mergedDailySeries = [...byDay.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)));
            dailySeries = mergedDailySeries;
        }

        // Insights
        if (totalCustomers === 0) insights.push('No customers in orders payload');
        else {
            const returningPct = totalCustomers ? (returningCustomers / totalCustomers) * 100 : 0;
            if (returningPct >= 70) insights.push('Strong retention: high returning customer share');
            else if (returningPct >= 40) insights.push('Balanced customer mix');
            else insights.push('High share of new customers — consider retention programs');

            // Add churn & LTV insights
            insights.push(`Churn: ${churnPercent.toFixed(2)}% over the period (≈ ${churnMonthly.toFixed(2)}% monthly)`);
            if (ltvEstimate !== null) insights.push(`Estimated LTV: ${ltvEstimate.toLocaleString()} kr (approximate)`);
            insights.push(`First-time repeat within period: ${firstTimeRepeatRate.toFixed(2)}% (${newCustomersWithRepeat}/${newCustomers || 0})`);
        }

        return {
            totalCustomers,
            newCustomers,
            returningCustomers,
            newPct: totalCustomers ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : 0,
            returningPct: totalCustomers ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : 0,
            repeatRate: Number(repeatRate.toFixed(2)),
            ordersPerReturning: Number(ordersPerReturning.toFixed(2)),
            totalOrders: storeTotalOrders,
            totalRevenue: Number(storeTotalRevenue.toFixed(2)),
            totalNetRevenue: Number(storeTotalNetRevenue.toFixed(2)),
            ncaRevenue,
            ncaNetRevenue,
            returningCustomerNetRevenue: Number((storeTotalNetRevenue - ncaNetRevenue).toFixed(2)),
            ltv30: ltvResult.ltv30,
            ltv90: ltvResult.ltv90,
            ltv180: ltvResult.ltv180,
            ltv365: ltvResult.ltv365,
            dailySeries,
            churnPercent: Number(churnPercent.toFixed(2)),
            churnMonthly: Number(churnMonthly.toFixed(2)),
            ltvEstimate,
            firstTimeRepeatRate: Number(firstTimeRepeatRate.toFixed(2)),
            firstTimeRepeatCount: newCustomersWithRepeat,
            firstTimeBuyersCount: newCustomers,
            firstOrdersCount,
            insights,
            cac: merged.CACTotalSales ?? null,
            adSpend: adSpendFromMerged,
            adSpendByChannel: adSpendByChannelFromMerged,
        };
    }

    // Fallback: if no per-order data, try to approximate from shopifyDaily
    const shopifyDaily = merged.shopifyDaily || merged.shopify_daily || merged.shopify || [];
    if (Array.isArray(shopifyDaily) && shopifyDaily.length > 0) {
        const totalOrders = shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0);
        // naive heuristic: assume ~40% new customers (typical) unless data suggests otherwise
        const approxReturning = Math.round(totalOrders * 0.6);
        const approxNew = totalOrders - approxReturning;

        // daily series approximation
        const dailySeries = shopifyDaily.map(d => ({
            period: d.period || d.date || d.day,
            orders: d.orders || 0,
            revenue: Number((d.total_sales || d.net_sales || 0).toFixed(2)),
            newCustomers: Math.round((d.orders || 0) * 0.4),
            returningCustomers: (d.orders || 0) - Math.round((d.orders || 0) * 0.4),
        }));

        const totalRevenueVal = Number(shopifyDaily.reduce((s, d) => s + (d.total_sales || d.net_sales || 0), 0).toFixed(2));
        const aovApprox = totalOrders > 0 ? totalRevenueVal / totalOrders : 0;
        const ncaRevenueApprox = Number((approxNew * aovApprox).toFixed(2));
        // Approximate new/returning revenue by same split as orders (40% new, 60% returning)
        const ncaNetRevenueApprox = totalOrders > 0 ? Number(((approxNew / totalOrders) * totalRevenueVal).toFixed(2)) : null;
        const returningNetRevenueApprox = totalOrders > 0 ? Number(((approxReturning / totalOrders) * totalRevenueVal).toFixed(2)) : null;

        insights.push('Segmentation approximated from daily aggregates (no order-level data).');
        return {
            totalCustomers: totalOrders,
            newCustomers: approxNew,
            returningCustomers: approxReturning,
            newPct: totalOrders ? Number(((approxNew / totalOrders) * 100).toFixed(2)) : 0,
            returningPct: totalOrders ? Number(((approxReturning / totalOrders) * 100).toFixed(2)) : 0,
            repeatRate: 0,
            ordersPerReturning: 0,
            totalOrders,
            totalRevenue: totalRevenueVal,
            totalNetRevenue: totalRevenueVal,
            ncaRevenue: ncaRevenueApprox,
            ncaNetRevenue: ncaNetRevenueApprox,
            returningCustomerNetRevenue: returningNetRevenueApprox,
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
            firstTimeBuyersCount: approxNew,
            firstOrdersCount: approxNew,
            insights,
            cac: merged.CACTotalSales ?? null,
            adSpend: adSpendFromMerged,
            adSpendByChannel: adSpendByChannelFromMerged,
        };
    }

    // Final fallback: zeroed
    insights.push('No Shopify orders or daily data available to compute segmentation');
    return {
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        newPct: 0,
        returningPct: 0,
        repeatRate: 0,
        ordersPerReturning: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalNetRevenue: 0,
        ncaRevenue: 0,
        ncaNetRevenue: null,
        returningCustomerNetRevenue: null,
        ltv30: null,
        ltv90: null,
        ltv180: null,
        ltv365: null,
        dailySeries: [],
        churnPercent: null,
        churnMonthly: null,
        ltvEstimate: null,
        firstTimeRepeatRate: null,
        firstTimeRepeatCount: 0,
        firstTimeBuyersCount: 0,
        firstOrdersCount: 0,
        insights,
        cac: merged.CACTotalSales ?? null,
        adSpend: adSpendFromMerged,
        adSpendByChannel: adSpendByChannelFromMerged,
    };
}

export async function fetchCustomerSegmentation(customerId, startDate, endDate, options = {}) {
    if (!customerId || !startDate || !endDate) {
        throw new Error('Missing parameters');
    }

    const { fast = false, extendForLtv = true } = options;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Fetch customer settings (same approach as merged-sources route)
    const custRes = await fetch(`${baseUrl}/api/customers/${customerId}`);
    if (!custRes.ok) {
        // If we can't get settings, try merged sources anyway
        const mergedRes = await fetch(`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`);
        if (!mergedRes.ok) throw new Error('Failed to fetch customer settings and merged sources');
        const merged = await mergedRes.json();
        return computeSegmentationFromMerged(merged, startDate, endDate);
    }

    const custData = await custRes.json();
    const settings = { ...(custData.CustomerSettings || {}) };

    // Try ShopifyQL if Shop credentials are available
    const shopifyUrl = settings.shopifyUrl || settings.shopify?.domain || settings.shopifyDomain;
    const accessToken = settings.shopifyApiPassword || settings.shopifyAccessToken || settings.shopifyApiKey || settings.apiKey;

    // First: try ShopifyQL to get counts
    if (shopifyUrl && accessToken) {
        const shopifyql = `
SELECT
  CASE WHEN MIN(order.created_at) >= "${startDate}T00:00:00Z" AND MIN(order.created_at) <= "${endDate}T23:59:59Z" THEN 'new' ELSE 'returning' END AS customer_type,
  COUNT(DISTINCT customer.id) AS customer_count
FROM orders
WHERE order.created_at <= "${endDate}T23:59:59Z"
GROUP BY customer_type
`;
        try {
            const resp = await shopifyqlQuery(shopifyUrl, accessToken, shopifyql);
            const rows = resp?.data?.shopifyqlQuery?.tableData?.rows || resp?.rows || [];
            let newCustomers = 0, returningCustomers = 0;
            for (const r of rows) {
                if (!r) continue;
                if (Array.isArray(r)) {
                    const [type, count] = r;
                    if (String(type).toLowerCase().includes('new')) newCustomers = Number(count) || 0;
                    else returningCustomers = Number(count) || 0;
                } else if (r.customer_type || r[0]) {
                    const type = r.customer_type || r[0];
                    const count = Number(r.customer_count ?? r[1] ?? 0);
                    if (String(type).toLowerCase().includes('new')) newCustomers = count;
                    else returningCustomers = count;
                } else if (r.cells && Array.isArray(r.cells)) {
                    const [typeCell, countCell] = r.cells;
                    const type = typeCell?.value ?? typeCell?.text ?? typeCell;
                    const count = Number(countCell?.value ?? countCell?.text ?? countCell ?? 0);
                    if (String(type).toLowerCase().includes('new')) newCustomers = count;
                    else returningCustomers = count;
                }
            }
            const totalCustomers = newCustomers + returningCustomers;

            // For deeper insights (AOV, repeat, LTV, NCA) fetch merged-sources + orders (unless fast mode)
            const mergedPromise = fetch(`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`);
            const shopifyOrdersPromise = fast ? Promise.resolve([]) : fetchShopifyOrdersForSegmentation(settings, startDate, endDate, { extendForLtv });
            const [mergedRes, shopifyOrders] = await Promise.all([mergedPromise, shopifyOrdersPromise]);
            const merged = mergedRes.ok ? await mergedRes.json() : {};
            if (shopifyOrders.length > 0) merged.shopifyOrders = shopifyOrders;
            if (extendForLtv) {
                console.log('[Customer Segmentation] Before computeSegmentationFromMerged:', {
                    shopifyOrdersCount: shopifyOrders.length,
                    mergedHasShopifyOrders: !!merged.shopifyOrders,
                    mergedHasShopifyDaily: !!(merged.shopifyDaily?.length),
                });
            }
            if (mergedRes.ok || shopifyOrders.length > 0) {
                const computed = computeSegmentationFromMerged(merged, startDate, endDate);
                const aov = computed.totalOrders > 0 ? computed.totalRevenue / computed.totalOrders : 0;
                const ncaRevenueOverride = (newCustomers || computed.newCustomers) * aov;
                return {
                    ...computed,
                    totalCustomers: totalCustomers || computed.totalCustomers,
                    newCustomers: newCustomers || computed.newCustomers,
                    returningCustomers: returningCustomers || computed.returningCustomers,
                    newPct: totalCustomers ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : computed.newPct,
                    returningPct: totalCustomers ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : computed.returningPct,
                    ncaRevenue: Number(ncaRevenueOverride.toFixed(2)),
                };
            }

            // If both merged and orders failed, return the counts only
            const aovFallback = 0;
            return {
                totalCustomers,
                newCustomers,
                returningCustomers,
                newPct: totalCustomers ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : 0,
                returningPct: totalCustomers ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : 0,
                repeatRate: 0,
                ordersPerReturning: 0,
                totalOrders: 0,
                totalRevenue: 0,
                totalNetRevenue: 0,
                ncaRevenue: Number((newCustomers * aovFallback).toFixed(2)),
                ncaNetRevenue: null,
                returningCustomerNetRevenue: null,
                ltv30: null,
                ltv90: null,
                ltv180: null,
                ltv365: null,
                dailySeries: [],
                churnPercent: null,
                churnMonthly: null,
                ltvEstimate: null,
                firstTimeRepeatRate: null,
                firstTimeRepeatCount: 0,
                firstTimeBuyersCount: 0,
                firstOrdersCount: 0,
                insights: [totalCustomers === 0 ? 'No customers found via ShopifyQL' : 'Counts computed via ShopifyQL; for more insights enable order-level export.']
            };
        } catch (err) {
            if (/Shopify access denied|access denied|required access/i.test(err?.message || '')) {
                throw err;
            }
            console.warn('ShopifyQL failed, falling back to merged sources', err);
        }
    }

    // Fallback - use merged sources
    const mergedRes = await fetch(`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`);
    if (!mergedRes.ok) throw new Error('Failed to fetch merged sources as fallback');
    const merged = await mergedRes.json();
    return computeSegmentationFromMerged(merged, startDate, endDate);
}

export default fetchCustomerSegmentation;