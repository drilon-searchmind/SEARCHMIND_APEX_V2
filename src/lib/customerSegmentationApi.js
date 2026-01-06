import { shopifyqlQuery } from './shopifyApi';

export function computeSegmentationFromMerged(merged = {}, startDate, endDate) {
    // Try to find per-order customer-level data first
    const orders = merged.shopifyOrders || merged.orders || merged.shopify?.orders || [];

    // Initialize defaults
    let totalCustomers = 0;
    let newCustomers = 0;
    let returningCustomers = 0;
    let repeatRate = 0;
    let ordersPerReturning = 0;
    const insights = [];

    if (Array.isArray(orders) && orders.length > 0) {
        // Group by customer identifier (email preferred)
        const byCust = new Map();
        let totalRevenue = 0;
        let totalOrders = 0;

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
            totalRevenue += total;
            totalOrders += 1;
            if (created) {
                const d = new Date(created);
                if (!rec.firstSeen || d < rec.firstSeen) rec.firstSeen = d;
            }
        });

        totalCustomers = byCust.size;
        let returningOrdersCount = 0, returningCustomersCount = 0;
        let newCustomersWithRepeat = 0; // new customers who placed >1 order in range
        let firstOrdersCount = 0; // count orders that were first orders (customer's first order falling in range)

        const s = new Date(startDate);
        const e = new Date(endDate);

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

        const dailySeries = Object.keys(dailyMap).sort().map(period => ({
            period,
            newCustomers: dailyMap[period].newSet.size,
            returningCustomers: dailyMap[period].returningSet.size,
            orders: dailyMap[period].orders,
            revenue: Number(dailyMap[period].revenue.toFixed(2)),
        }));

        // Cohort retention (weekly cohorts, up to MAX_WEEKS)
        const MAX_WEEKS = 12;
        const cohortMap = new Map();
        const weekMs = msPerDay * 7;

        const weekStart = (date) => {
            const d = new Date(date);
            // Monday as week start
            const day = d.getDay(); // 0 = Sun, 1 = Mon
            const diff = (day + 6) % 7; // days since Monday
            const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
            ws.setHours(0,0,0,0);
            return ws;
        };

        for (const [id, info] of byCust.entries()) {
            if (!info.firstSeen) continue;
            const cohortStart = weekStart(info.firstSeen);
            const cohortKey = cohortStart.toISOString().slice(0,10);
            if (!cohortMap.has(cohortKey)) {
                cohortMap.set(cohortKey, { size: 0, weeklySets: Array.from({ length: MAX_WEEKS }, () => new Set()) });
            }
            const entry = cohortMap.get(cohortKey);
            entry.size += 1;
            info.orders.forEach(o => {
                if (!(o.date instanceof Date)) return;
                const weekDiff = Math.floor((o.date - cohortStart) / weekMs);
                if (weekDiff >= 0 && weekDiff < MAX_WEEKS) entry.weeklySets[weekDiff].add(id);
            });
        }

        const cohortList = Array.from(cohortMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));
        let maxWeekUsed = 0;
        const cohorts = cohortList.map(([cohort, entry]) => {
            const retention = entry.weeklySets.map(s => Number(((s.size / entry.size) * 100).toFixed(1)));
            for (let i = retention.length - 1; i >= 0; i--) {
                if (retention[i] > 0) { maxWeekUsed = Math.max(maxWeekUsed, i + 1); break; }
            }
            return { cohort, size: entry.size, retention };
        });

        const weeksToShow = Math.max(4, Math.min(MAX_WEEKS, maxWeekUsed || 4));
        const cohortRetention = {
            weeks: weeksToShow,
            cohorts: cohorts.map(c => ({ cohort: c.cohort, size: c.size, retention: c.retention.slice(0, weeksToShow) })),
        };

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
            totalOrders,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            dailySeries,
            cohortRetention, // newly added
            churnPercent: Number(churnPercent.toFixed(2)),
            churnMonthly: Number(churnMonthly.toFixed(2)),
            ltvEstimate,
            firstTimeRepeatRate: Number(firstTimeRepeatRate.toFixed(2)),
            firstTimeRepeatCount: newCustomersWithRepeat,
            firstTimeBuyersCount: newCustomers,
            firstOrdersCount,
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

        // daily series approximation
        const dailySeries = shopifyDaily.map(d => ({
            period: d.period || d.date || d.day,
            orders: d.orders || 0,
            revenue: Number((d.total_sales || d.net_sales || 0).toFixed(2)),
            newCustomers: Math.round((d.orders || 0) * 0.4),
            returningCustomers: (d.orders || 0) - Math.round((d.orders || 0) * 0.4),
        }));

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
            totalRevenue: Number(shopifyDaily.reduce((s, d) => s + (d.total_sales || d.net_sales || 0), 0).toFixed(2)),
            dailySeries,
            churnPercent: null,
            churnMonthly: null,
            ltvEstimate: null,
            firstTimeRepeatRate: null,
            firstTimeRepeatCount: 0,
            firstTimeBuyersCount: approxNew,
            firstOrdersCount: approxNew,
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
        repeatRate: 0,
        ordersPerReturning: 0,
        totalOrders: 0,
        totalRevenue: 0,
        dailySeries: [],
        churnPercent: null,
        churnMonthly: null,
        ltvEstimate: null,
        firstTimeRepeatRate: null,
        firstTimeRepeatCount: 0,
        firstTimeBuyersCount: 0,
        firstOrdersCount: 0,
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
                    repeatRate: computed.repeatRate,
                    ordersPerReturning: computed.ordersPerReturning,
                    totalOrders: computed.totalOrders,
                    totalRevenue: computed.totalRevenue,
                    dailySeries: computed.dailySeries,
                    churnPercent: computed.churnPercent,
                    churnMonthly: computed.churnMonthly,
                    ltvEstimate: computed.ltvEstimate,
                    firstTimeRepeatRate: computed.firstTimeRepeatRate,
                    firstTimeRepeatCount: computed.firstTimeRepeatCount,
                    firstTimeBuyersCount: computed.firstTimeBuyersCount,
                    firstOrdersCount: computed.firstOrdersCount,
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
                repeatRate: 0,
                ordersPerReturning: 0,
                totalOrders: 0,
                totalRevenue: 0,
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