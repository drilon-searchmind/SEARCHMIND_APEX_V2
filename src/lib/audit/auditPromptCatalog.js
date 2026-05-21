/**
 * UI catalog for Run Audit modal.
 * Task text per channel tab comes from the active prompt in the Audit Prompt Library (MongoDB).
 */

/** @typedef {'green'|'blue'|'amber'|'purple'|'red'|'pink'|'teal'} AuditTagColor */

/** @typedef {{ id: string, tag: string, tagColor: AuditTagColor, title: string, description: string }} AuditCatalogCard */

/** @typedef {{ id: string, label: string, shortLabel: string, serviceId: string|null, description: string, items: AuditCatalogCard[] }} AuditCatalogGroup */

/** @type {AuditCatalogGroup[]} */
export const AUDIT_CATALOG_GROUPS = [
    {
        id: "cross",
        label: "Cross-channel",
        shortLabel: "Cross-channel",
        serviceId: null,
        description: "Full data footprint tied together into business-critical recommendations.",
        items: [
            { id: "cross-1", tag: "ROI", tagColor: "purple", title: "Blended returns & MER", description: "Assess blended ROAS/CAC/MER and recommend budget allocation across all channels." },
            { id: "cross-2", tag: "ROI", tagColor: "purple", title: "Margin-aware spend", description: "Factor in Shopify COGS/margin — find where spend drives real profit, not just revenue." },
            { id: "cross-3", tag: "Structure", tagColor: "blue", title: "Full-funnel story", description: "Connect SEO, paid, and email into one funnel — find where the journey leaks." },
            { id: "cross-4", tag: "Growth", tagColor: "green", title: "Top products cross-channel", description: "Find products that win in one channel but are underused in others." },
            { id: "cross-5", tag: "Plan", tagColor: "teal", title: "Prioritized action plan", description: "Roll up findings into a prioritized 30-day plan with expected impact and owners." },
        ],
    },
    {
        id: "ppc",
        label: "PPC · Google Ads",
        shortLabel: "Google Ads",
        serviceId: "ppc",
        description: "Google Ads data combined with Shopify catalog, margin, and Search Console.",
        items: [
            { id: "ppc-1", tag: "Growth", tagColor: "green", title: "Search terms → missing collection", description: "Find high revenue/ROAS search terms with no matching Shopify collection." },
            { id: "ppc-2", tag: "Structure", tagColor: "blue", title: "GSN & Shopping expansion", description: "Analyze Shopping data and suggest Search/GSN expansion for top products without coverage." },
            { id: "ppc-3", tag: "Optimization", tagColor: "amber", title: "Wasted spend & negatives", description: "Identify search terms/campaigns with high spend and low conversion." },
            { id: "ppc-4", tag: "ROI", tagColor: "purple", title: "Budget reallocation by ROAS", description: "Shift budget from low- to high-ROAS campaigns with Shopify COGS/margin included." },
            { id: "ppc-5", tag: "Structure", tagColor: "blue", title: "PMax vs. Search overlap", description: "Assess cannibalization between Performance Max and Search." },
            { id: "ppc-6", tag: "Alert", tagColor: "red", title: "Outliers — good and bad", description: "Find outliers in CPC, CTR, conversion, and spend that need action." },
        ],
    },
    {
        id: "ps",
        label: "PS · Meta",
        shortLabel: "Meta",
        serviceId: "ps",
        description: "Meta advertising combined with Shopify catalog and margin.",
        items: [
            { id: "ps-1", tag: "Creative", tagColor: "pink", title: "Creative fatigue", description: "Find ads with declining CTR or rising CPM. Recommend what to pause and refresh." },
            { id: "ps-2", tag: "Structure", tagColor: "blue", title: "Audience overlap & scaling", description: "Identify ad set overlap and scaling opportunities on winning audiences." },
            { id: "ps-3", tag: "Structure", tagColor: "blue", title: "Funnel balance", description: "Assess prospecting vs. retargeting split and recommend optimal budget balance." },
            { id: "ps-4", tag: "ROI", tagColor: "purple", title: "Budget by ROAS/CAC", description: "Reallocate budget toward best ROAS/CAC with Shopify margin included." },
            { id: "ps-5", tag: "Growth", tagColor: "green", title: "Catalog performance", description: "Link product/catalog performance with Shopify margin." },
            { id: "ps-6", tag: "Alert", tagColor: "red", title: "Outlier campaigns", description: "Find outliers in spend, ROAS, and frequency that need action." },
        ],
    },
    {
        id: "seo",
        label: "SEO",
        shortLabel: "SEO",
        serviceId: "seo",
        description: "Search Console + Ahrefs combined with Shopify catalog.",
        items: [
            { id: "seo-1", tag: "Growth", tagColor: "green", title: "Striking distance keywords", description: "Find keywords around positions 5–15 with volume — quick wins toward page 1." },
            { id: "seo-2", tag: "Growth", tagColor: "green", title: "Content gap vs. catalog", description: "Match search demand with Shopify collections and products." },
            { id: "seo-3", tag: "Optimization", tagColor: "amber", title: "Cannibalization", description: "Find pages competing for the same keywords in GSC." },
            { id: "seo-4", tag: "Alert", tagColor: "red", title: "Lost traffic & rankings", description: "Identify pages losing clicks or positions." },
            { id: "seo-5", tag: "Growth", tagColor: "green", title: "Backlink opportunities", description: "Use Ahrefs for backlink gaps vs. competitors." },
            { id: "seo-6", tag: "Growth", tagColor: "green", title: "New landing pages", description: "Propose new collection/category pages from uncovered search demand." },
        ],
    },
    {
        id: "em",
        label: "EM · Klaviyo",
        shortLabel: "Klaviyo",
        serviceId: "em",
        description: "Klaviyo flows and campaigns combined with Shopify purchase data.",
        items: [
            { id: "em-1", tag: "Structure", tagColor: "blue", title: "Flow gaps", description: "Review welcome, abandoned cart, browse, post-purchase, and winback flows." },
            { id: "em-2", tag: "Optimization", tagColor: "amber", title: "Campaign performance", description: "Analyze open, click, and conversion rates." },
            { id: "em-3", tag: "ROI", tagColor: "purple", title: "Segment health", description: "Assess list growth, engagement, and churn." },
            { id: "em-4", tag: "ROI", tagColor: "purple", title: "Revenue per recipient", description: "Find campaigns/flows with low RPR and deliverability issues." },
            { id: "em-5", tag: "Growth", tagColor: "green", title: "Cross-sell from purchase data", description: "Use Shopify purchase data for cross-sell and replenishment flows." },
            { id: "em-6", tag: "Alert", tagColor: "red", title: "Outliers", description: "Find outlier campaigns (unsubscribe, spam, bounce)." },
        ],
    },
];

/** @param {string} cardId */
export function auditGroupIdFromCardId(cardId) {
    const idx = String(cardId || "").indexOf("-");
    return idx > 0 ? cardId.slice(0, idx) : "cross";
}

/** @param {string} groupId */
export function getAuditCatalogGroup(groupId) {
    return AUDIT_CATALOG_GROUPS.find((g) => g.id === groupId) || null;
}

/** @param {string} cardId */
export function getAuditCatalogCard(cardId) {
    for (const g of AUDIT_CATALOG_GROUPS) {
        const card = g.items.find((c) => c.id === cardId);
        if (card) return { group: g, card };
    }
    return null;
}

export const AUDIT_TAG_COLOR_CLASSES = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-800",
    purple: "bg-purple-50 text-purple-700",
    red: "bg-red-50 text-red-700",
    pink: "bg-pink-50 text-pink-700",
    teal: "bg-teal-50 text-teal-800",
};
