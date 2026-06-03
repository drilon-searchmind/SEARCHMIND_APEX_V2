import { totalAdSpendFromMerged, channelSpendTotalsFromMerged } from '@/lib/mergeAdSpendDaily';
import {
    appendShopifyOnlineStoreFilter,
    shopifySalesWhereClause,
} from '@/lib/shopifyQlFilters';
import { shopifyAdminGraphqlPost } from '@/lib/shopifyAdminClient';

/**
 * Fetch new vs returning customer counts via ShopifyQL using the built-in
 * new_or_returning_customer dimension from the sales dataset.
 * This is much faster than fetching all orders and computing manually.
 *
 * @param {string} customerId - Customer ID for settings lookup
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{ newCustomers: number, returningCustomers: number, totalCustomers: number, source: string, ... }>}
 */
export async function fetchCustomerSegmentationShopifyql(customerId, startDate, endDate) {
    if (!customerId || !startDate || !endDate) {
        throw new Error('Missing parameters');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Fetch customer settings (Shopify credentials)
    const custRes = await fetch(`${baseUrl}/api/customers/${customerId}`);
    if (!custRes.ok) {
        throw new Error('Failed to fetch customer settings');
    }

    const custData = await custRes.json();
    const settings = custData.CustomerSettings || {};
    const shopifyUrl = settings.shopifyUrl || settings.shopify?.domain || settings.shopifyDomain;
    const accessToken = settings.shopifyApiPassword || settings.shopifyAccessToken || settings.shopifyApiKey || settings.apiKey;

    if (!shopifyUrl || !accessToken) {
        throw new Error('Shopify credentials not configured');
    }

    // ShopifyQL query using new_or_returning_customer from sales dataset
    // Based on: FROM sales SHOW customers WHERE new_or_returning_customer IS NOT NULL GROUP BY new_or_returning_customer
    const whereParts = ['new_or_returning_customer IS NOT NULL'];
    appendShopifyOnlineStoreFilter(whereParts, settings);
    const whereClause = shopifySalesWhereClause(whereParts);

    const shopifyql = `FROM sales
  SHOW customers
  ${whereClause}
  GROUP BY new_or_returning_customer
  SINCE ${startDate} UNTIL ${endDate}
  ORDER BY new_or_returning_customer ASC
  LIMIT 10`;

    const body = JSON.stringify({
        query: `query ShopifyqlNewReturning($q: String!) {
            shopifyqlQuery(query: $q) {
                tableData {
                    columns { name dataType displayName }
                    rows
                }
                parseErrors
            }
        }`,
        variables: { q: shopifyql },
    });
    const { res, json } = await shopifyAdminGraphqlPost(shopifyUrl, accessToken, body);

    if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);

    if (json?.errors?.length > 0) {
        throw new Error(json.errors[0]?.message || 'Shopify GraphQL error');
    }

    const parseErrors = json?.data?.shopifyqlQuery?.parseErrors;
    if (parseErrors?.length > 0) {
        console.warn('ShopifyQL parse errors:', parseErrors);
        throw new Error(parseErrors[0] || 'ShopifyQL query failed');
    }

    const rows = json?.data?.shopifyqlQuery?.tableData?.rows || [];

    let newCustomers = 0;
    let returningCustomers = 0;

    for (const row of rows) {
        let type = null;
        let count = 0;

        if (Array.isArray(row)) {
            const [typeVal, countVal] = row;
            type = typeVal;
            count = Number(countVal) || 0;
        } else if (row && typeof row === 'object') {
            type = row.new_or_returning_customer ?? row.new_or_returning ?? row[0];
            let countVal = row.customers ?? row.customers__totals ?? row[1];
            if (countVal == null) {
                const countKey = Object.keys(row).find(
                    (k) => (k.includes('customers') || k === 'customer_count') && !k.includes('returning') && !k.includes('new_or')
                );
                countVal = countKey ? row[countKey] : 0;
            }
            count = Number(countVal) || 0;
        }

        if (type != null && count > 0) {
            const typeStr = String(type).toLowerCase();
            if (typeStr.includes('new') || typeStr === 'new') {
                newCustomers = count;
            } else if (typeStr.includes('returning') || typeStr === 'returning') {
                returningCustomers = count;
            }
        }
    }

    const totalCustomers = newCustomers + returningCustomers;

    return {
        newCustomers,
        returningCustomers,
        totalCustomers,
        newPct: totalCustomers > 0 ? Number(((newCustomers / totalCustomers) * 100).toFixed(2)) : 0,
        returningPct: totalCustomers > 0 ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2)) : 0,
        source: 'shopifyql',
        insights: ['New vs returning counts from Shopify Analytics (new_or_returning_customer dimension).'],
    };
}

/**
 * Fetch full customer segmentation using ShopifyQL (fast) + merged-sources.
 * Returns a shape compatible with CustomerPerformance. LTV fields are null;
 * call the full customer-segmentation API in background for LTV if needed.
 *
 * @param {string} customerId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {{ mergedSourcesQuerySuffix?: string }} [options] — e.g. Shopify Markets: `&shopifyMarkets=...` or `&shopifyMarketNoSelection=1`
 * @returns {Promise<object>} Segmentation object for CustomerPerformance
 */
export async function fetchCustomerSegmentationShopifyqlFull(customerId, startDate, endDate, options = {}) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const suffix = typeof options.mergedSourcesQuerySuffix === 'string' ? options.mergedSourcesQuerySuffix : '';

    const [shopifyqlData, merged] = await Promise.all([
        fetchCustomerSegmentationShopifyql(customerId, startDate, endDate),
        fetch(
            `${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}${suffix}`
        ).then((r) => (r.ok ? r.json() : {})),
    ]);

    const shopifyDaily = merged.shopifyDaily || merged.shopify_daily || merged.shopify || [];
    const totalOrders = Array.isArray(shopifyDaily)
        ? shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0)
        : 0;
    const totalNetRevenue = Array.isArray(shopifyDaily)
        ? Number(shopifyDaily.reduce((s, d) => s + (d.net_sales || d.total_sales || 0), 0).toFixed(2))
        : 0;

    const { newCustomers, returningCustomers, totalCustomers, newPct, returningPct } = shopifyqlData;
    const newPctDec = totalCustomers > 0 ? newCustomers / totalCustomers : 0.4;
    const returningPctDec = totalCustomers > 0 ? returningCustomers / totalCustomers : 0.6;

    const firstOrdersCount = Math.round(totalOrders * newPctDec);
    const ncaNetRevenue = totalOrders > 0 ? Number(((totalNetRevenue * newPctDec)).toFixed(2)) : 0;
    const returningCustomerNetRevenue = Number((totalNetRevenue - ncaNetRevenue).toFixed(2));

    const dailySeries = Array.isArray(shopifyDaily)
        ? shopifyDaily.map((d) => {
              const orders = d.orders || 0;
              const rev = Number((d.net_sales || d.total_sales || 0).toFixed(2));
              return {
                  period: d.period || d.date || d.day,
                  orders,
                  revenue: rev,
                  newCustomers: Math.round(orders * newPctDec),
                  returningCustomers: orders - Math.round(orders * newPctDec),
              };
          })
        : [];

    const adSpend = totalAdSpendFromMerged(merged);
    const adSpendByChannel = channelSpendTotalsFromMerged(merged);

    return {
        totalCustomers: totalCustomers || totalOrders,
        newCustomers,
        returningCustomers,
        newPct,
        returningPct,
        repeatRate: 0,
        ordersPerReturning: 0,
        totalOrders,
        totalRevenue: totalNetRevenue,
        totalNetRevenue,
        ncaRevenue: ncaNetRevenue,
        ncaNetRevenue,
        returningCustomerNetRevenue,
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
        firstTimeBuyersCount: newCustomers,
        firstOrdersCount,
        insights: ['New vs returning from ShopifyQL (fast). LTV loads in background.'],
        cac: merged.CACTotalSales ?? null,
        adSpend,
        adSpendByChannel,
        source: 'shopifyql',
    };
}
