// src/app/api/merged-sources/[customerId]/route.js
import { fetchMergedSources } from '@/lib/mergedSourcesApi';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoMergedSourcesForRange } from '@/lib/demoMergedSources';
import { getCustomerById } from '../../../../../lib/customerOperations';
import { parseAdSpendExcludeQueryParam } from '@/lib/adSpendExcludeParam';

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source');
    const shopifyMarketNoSelection = searchParams.get('shopifyMarketNoSelection') === '1';
    const shopifyMarketsRaw = searchParams.get('shopifyMarkets');
    const legacyShopifyMarketId = searchParams.get('shopifyMarketId');
    const excludeAdSpendPlatforms = parseAdSpendExcludeQueryParam(searchParams.get('adSpendExclude'));
    const shopifyMarketFilterAdSpend = searchParams.get('shopifyMarketFilterAdSpend') === '1';

    /** @type {Array<{ shopifyqlMarketId: string, handle?: string }> | undefined} */
    let shopifyMarketsSelection;
    if (shopifyMarketsRaw) {
        try {
            const decoded = decodeURIComponent(shopifyMarketsRaw);
            const parsed = JSON.parse(decoded);
            if (Array.isArray(parsed)) {
                shopifyMarketsSelection = parsed.map((row) => ({
                    shopifyqlMarketId: String(row?.shopifyqlMarketId ?? row?.id ?? "").trim(),
                    handle:
                        row?.handle != null && String(row.handle).trim() !== ""
                            ? String(row.handle).trim()
                            : undefined,
                })).filter((m) => m.shopifyqlMarketId);
            }
        } catch {
            shopifyMarketsSelection = undefined;
        }
    }
    if (
        !shopifyMarketsSelection &&
        legacyShopifyMarketId &&
        String(legacyShopifyMarketId).trim() !== ""
    ) {
        shopifyMarketsSelection = [
            { shopifyqlMarketId: String(legacyShopifyMarketId).trim(), handle: undefined },
        ];
    }

    if (!startDate || !endDate) {
        return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        let customer = null;
        try {
            const doc = await getCustomerById(customerId);
            customer = doc?.toObject ? doc.toObject() : doc;
        } catch {
            customer = getDemoPayload('customer');
        }
        return Response.json(getDemoMergedSourcesForRange(startDate, endDate, customer, { excludeAdSpendPlatforms }));
    }

    // Rule: parent-property, daily-overview, and performance-dashboard need daily breakdown for Facebook (PS cost per day, Ad Spend Allocation chart)
    const dailyBreakdown = source === 'parent-property' || source === 'daily-overview' || source === 'performance-dashboard' || source === 'markets-overview';

    try {
        const doc = await getCustomerById(customerId);
        if (!doc) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }
        const data = doc.toObject ? doc.toObject() : doc;
        const settings = {
            customerName: data.customerName,
            customerType: data.customerType || 'Shopify',
            ...(data.CustomerSettings || {}),
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
        };

        const shopRef =
            settings.customerType === 'DanDomain'
                ? settings.danDomain?.shopHost || 'N/A'
                : settings.customerType === 'Magento'
                  ? settings.magentoBaseUrl || 'N/A'
                  : settings.customerType === 'WooCommerce'
                    ? settings.wooCommerceApiUrl || 'N/A'
                    : settings.shopifyUrl || 'N/A';
        console.log(
            `[Merged Sources] Customer: ${data.customerName || 'Unknown'} (${customerId}), type: ${settings.customerType}, shop: ${shopRef}`
        );

        // Fetch merged sources (now returns daily arrays)
        const merged = await fetchMergedSources(settings, startDate, endDate, {
            dailyBreakdown,
            source: source || undefined,
            shopifyMarketNoSelection,
            shopifyMarketsSelection,
            shopifyMarketFilterAdSpend,
            excludeAdSpendPlatforms,
        });
        return Response.json(merged);
    } catch (error) {
        console.error('Error fetching merged sources:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}