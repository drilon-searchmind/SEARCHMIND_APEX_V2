import { shopifyqlQuery } from './shopifyApi';

export function computeSegmentationFromMerged(merged = {}, startDate, endDate) {
    // Try to find per-order customer-level data first
    const orders = merged.shopifyOrders || merged.orders || merged.shopify?.orders || [];

    // Initialize defaults
    let totalCustomers = 0;
    let newCustomers = 0;
    let returningCustomers = 0;
    let avgOrderValueNew = 0;
    let avgOrderValueReturning = 0;
    let repeatRate = 0;
    let ordersPerReturning = 0;
    const insights = [];

    if (Array.isArray(orders) && orders.length > 0) {
        // Group by customer identifier (email preferred)
        const byCust = new Map();
        orders.forEach(o => {
            const cust = (o.customer && (o.customer.id || o.customer.email)) || o.customer_email || o.email || o.customer_id || o.buyer_email || null;
            if (!cust) return;
            const id = String(cust).toLowerCase();
            const created = o.created_at || o.createdAt || o.date || o.processed_at || null;
            const total = Number(o.total_price || o.total || o.price || o.amount || o.subtotal || 0) || 0;
            if (!byCust.has(id)) byCust.set(id, { orders: [], firstSeen: null, totalValue: 0 });
            const rec = byCust.get(id);
            rec.orders.push({ date: created ? new Date(created) : null, total });
            rec.totalValue += total;
            if (created) {
                const d = new Date(created);
                if (!rec.firstSeen || d < rec.firstSeen) rec.firstSeen = d;
            }
        });

        totalCustomers = byCust.size;
        let newAovSum = 0, returningAovSum = 0, newAovCount = 0, returningAovCount = 0;
        let returningOrdersCount = 0, returningCustomersCount = 0;

        const s = new Date(startDate);
        const e = new Date(endDate);

        byCust.forEach((info) => {
            // check if first order falls within range -> new
            const isNew = info.firstSeen && info.firstSeen >= s && info.firstSeen <= e;
            const ordersInRange = info.orders.filter(o => o.date instanceof Date && o.date >= s && o.date <= e);
            const ordersInRangeCount = ordersInRange.length;
            const revenueInRange = ordersInRange.reduce((sum, o) => sum + o.total, 0);

            if (isNew) {
                newCustomers += 1;
                if (ordersInRangeCount > 0) { newAovSum += (revenueInRange / ordersInRangeCount); newAovCount += 1; }
            } else {
                returningCustomers += 1;
                returningCustomersCount += 1;
                returningOrdersCount += ordersInRangeCount;
                if (ordersInRangeCount > 0) { returningAovSum += (revenueInRange / ordersInRangeCount); returningAovCount += 1; }
            }
        });

        avgOrderValueNew = newAovCount ? (newAovSum / newAovCount) : 0;
        avgOrderValueReturning = returningAovCount ? (returningAovSum / returningAovCount) : 0;
        repeatRate = returningCustomersCount > 0 ? (returningOrdersCount / returningCustomersCount) : 0;
        ordersPerReturning = returningCustomersCount > 0 ? (returningOrdersCount / returningCustomersCount) : 0;

        // Insights
        if (totalCustomers === 0) insights.push('No customers in orders payload');
        else {
            const returningPct = totalCustomers ? (returningCustomers / totalCustomers) * 100 : 0;
            if (returningPct >= 70) insights.push('Strong retention: high returning customer share');
            else if (returningPct >= 40) insights.push('Balanced customer mix');
            else insights.push('High share of new customers — consider retention programs');

            if (avgOrderValueReturning > avgOrderValueNew) insights.push('Returning customers have higher AOV than new customers');
            else insights.push('New customers spend more per order on average');
        }

        return {
            totalCustomers,
            newCustomers,
            returningCustomers,
            newPct: totalCustomers ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : 0,
            returningPct: totalCustomers ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : 0,
            avgOrderValueNew: Number(avgOrderValueNew.toFixed(2)),
            avgOrderValueReturning: Number(avgOrderValueReturning.toFixed(2)),
            repeatRate: Number(repeatRate.toFixed(2)),
            ordersPerReturning: Number(ordersPerReturning.toFixed(2)),
            insights,
        };
    }

    // Fallback: if no per-order data, try to approximate from shopifyDaily
    const shopifyDaily = merged.shopifyDaily || merged.shopify_daily || merged.shopify || [];
    if (Array.isArray(shopifyDaily) && shopifyDaily.length > 0) {
        const totalOrders = shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0);
        // naive heuristic: assume ~40% new customers (typical) unless data suggests otherwise
        const approxReturning = Math.round(totalOrders * 0.6);
        const approxNew = totalOrders - approxReturning;
        insights.push('Segmentation approximated from daily aggregates (no order-level data).');
        return {
            totalCustomers: totalOrders,
            newCustomers: approxNew,
            returningCustomers: approxReturning,
            newPct: totalOrders ? Number(((approxNew / totalOrders) * 100).toFixed(2)) : 0,
            returningPct: totalOrders ? Number(((approxReturning / totalOrders) * 100).toFixed(2)) : 0,
            avgOrderValueNew: 0,
            avgOrderValueReturning: 0,
            repeatRate: 0,
            ordersPerReturning: 0,
            insights,
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
        avgOrderValueNew: 0,
        avgOrderValueReturning: 0,
        repeatRate: 0,
        ordersPerReturning: 0,
        insights,
    };
}

export async function fetchCustomerSegmentation(customerId, startDate, endDate) {
    if (!customerId || !startDate || !endDate) {
        throw new Error('Missing parameters');
    }

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

            // For deeper insights (AOV, repeat) try merged-sources
            const mergedRes = await fetch(`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`);
            if (mergedRes.ok) {
                const merged = await mergedRes.json();
                const computed = computeSegmentationFromMerged(merged, startDate, endDate);
                // Merge counts if ShopifyQL produced better totals
                return {
                    totalCustomers: totalCustomers || computed.totalCustomers,
                    newCustomers: newCustomers || computed.newCustomers,
                    returningCustomers: returningCustomers || computed.returningCustomers,
                    newPct: totalCustomers ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : computed.newPct,
                    returningPct: totalCustomers ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : computed.returningPct,
                    avgOrderValueNew: computed.avgOrderValueNew,
                    avgOrderValueReturning: computed.avgOrderValueReturning,
                    repeatRate: computed.repeatRate,
                    ordersPerReturning: computed.ordersPerReturning,
                    insights: computed.insights,
                };
            }

            // If merged fetch failed, return the counts only
            return {
                totalCustomers,
                newCustomers,
                returningCustomers,
                newPct: totalCustomers ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : 0,
                returningPct: totalCustomers ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : 0,
                avgOrderValueNew: 0,
                avgOrderValueReturning: 0,
                repeatRate: 0,
                ordersPerReturning: 0,
                insights: [totalCustomers === 0 ? 'No customers found via ShopifyQL' : 'Counts computed via ShopifyQL; for more insights enable order-level export.']
            };
        } catch (err) {
            // ShopifyQL failed - fall back
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