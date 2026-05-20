// src/app/api/customer-segmentation-shopifyql/[customerId]/route.js
// Alternative API: fetches new vs returning customers via ShopifyQL's built-in
// new_or_returning_customer dimension (FROM sales). Much faster than order-level fetch.
// ?full=true returns full segmentation (ShopifyQL + merged-sources) for Customer Performance page.
import { fetchCustomerSegmentationShopifyql, fetchCustomerSegmentationShopifyqlFull } from '@/lib/customerSegmentationShopifyql';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import {
    getDemoMergedSourcesForRange,
    getDemoShopifyqlFullFromMerged,
    getDemoShopifyqlSegmentationFromMerged,
} from '@/lib/demoMergedSources';
import { getCustomerById } from '../../../../../lib/customerOperations';
import { parseAdSpendExcludeQueryParam } from '@/lib/adSpendExcludeParam';

export async function GET(request, { params }) {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const full = searchParams.get('full') === 'true';

    const shopifyMarketNoSelection = searchParams.get('shopifyMarketNoSelection') === '1';
    const shopifyMarketsRaw = searchParams.get('shopifyMarkets');
    let mergedSourcesQuerySuffix = '';
    if (shopifyMarketNoSelection) mergedSourcesQuerySuffix += '&shopifyMarketNoSelection=1';
    if (shopifyMarketsRaw != null && String(shopifyMarketsRaw).trim() !== '') {
        mergedSourcesQuerySuffix += `&shopifyMarkets=${encodeURIComponent(shopifyMarketsRaw)}`;
    }
    if (searchParams.get('shopifyMarketFilterAdSpend') === '1') {
        mergedSourcesQuerySuffix += '&shopifyMarketFilterAdSpend=1';
    }
    const adSpendExcludeRaw = searchParams.get('adSpendExclude');
    if (adSpendExcludeRaw != null && String(adSpendExcludeRaw).trim() !== '') {
        mergedSourcesQuerySuffix += `&adSpendExclude=${encodeURIComponent(adSpendExcludeRaw)}`;
    }

    if (!customerId) return Response.json({ error: 'Missing customerId in path' }, { status: 400 });
    if (!startDate || !endDate) return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });

    if (isDemoCustomerId(customerId)) {
        let customer = null;
        try {
            const doc = await getCustomerById(customerId);
            customer = doc?.toObject ? doc.toObject() : doc;
        } catch {
            customer = getDemoPayload('customer');
        }
        const excludeAdSpendPlatforms = parseAdSpendExcludeQueryParam(searchParams.get('adSpendExclude'));
        const merged = getDemoMergedSourcesForRange(startDate, endDate, customer, {
            excludeAdSpendPlatforms,
        });
        const payload = full
            ? getDemoShopifyqlFullFromMerged(merged)
            : getDemoShopifyqlSegmentationFromMerged(merged);
        return Response.json(payload);
    }

    try {
        const data = full
            ? await fetchCustomerSegmentationShopifyqlFull(customerId, startDate, endDate, {
                  mergedSourcesQuerySuffix,
              })
            : await fetchCustomerSegmentationShopifyql(customerId, startDate, endDate);
        return Response.json(data);
    } catch (err) {
        console.error('ShopifyQL customer segmentation error:', err);
        return Response.json({ error: err.message || 'ShopifyQL query failed' }, { status: 500 });
    }
}
