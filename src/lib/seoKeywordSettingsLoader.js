import dbConnect from "@root/lib/mongodb";
import SEOBrandKeyword from "@/models/SEOBrandKeyword";
import SEOExactKeywordGroup from "@/models/SEOExactKeywordGroup";
import SEOPartialKeywordGroup from "@/models/SEOPartialKeywordGroup";
import { buildSeoKeywordFilterConfig, buildAppliedFilterDescriptors } from "@/lib/seoKeywordFilters";

/**
 * Load SEO keyword settings and normalized filter config for a customer.
 * @param {string} customerId
 */
export async function loadSeoKeywordFilterConfigForCustomer(customerId) {
    if (!customerId) {
        return { config: buildSeoKeywordFilterConfig({}), appliedFilters: [] };
    }

    await dbConnect();

    const [brandDoc, exactGroups, partialGroups] = await Promise.all([
        SEOBrandKeyword.findOne({ customer: customerId }).lean(),
        SEOExactKeywordGroup.find({ customer: customerId }).sort({ createdAt: -1 }).lean(),
        SEOPartialKeywordGroup.find({ customer: customerId }).sort({ createdAt: -1 }).lean(),
    ]);

    const config = buildSeoKeywordFilterConfig({ brandDoc, exactGroups, partialGroups });
    return {
        config,
        appliedFilters: buildAppliedFilterDescriptors(config),
    };
}
