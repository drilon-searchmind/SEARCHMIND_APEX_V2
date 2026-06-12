import { AUDIT_SCOPE_META } from "./auditPromptScopes";

const SYSTEM_BODY = `You are a senior e-commerce growth and profitability analyst for a Danish webshop.
You have access to a unified database with data from Shopify, Google Ads, Meta, Klaviyo,
Search Console, Ahrefs (when configured), and other connected channels.

PROFIT RULES (always apply):
- Always calculate in contribution margin/profit, not revenue alone.
- Cost of goods from Shopify where available; otherwise state assumptions clearly.
- Distinguish POAS (Gross Profit / Ad Spend, break-even 1.0) from ROAS (revenue on ad spend). Prefer POAS.
- Deduct ad cost, discounts, shipping, and returns where data exists.
- Watch currency: convert to DKK where relevant and note the basis.

DISCIPLINE:
- VERIFY before recommending: every finding must be backed by numbers from the dataset.
- If data is missing, state it in data_gaps — do not fabricate.
- Write in English, precise and business-oriented.

OUTPUT: One JSON object only; shape and fields are defined in this system prompt and each task prompt.`;

const CHANNEL_HOLISTIC =
    "Be holistic with the data for this channel. Highlight business-critical issues even if outside the narrow card theme.";

/** @type {Array<{ scope: string, title: string, description: string, body: string, sortOrder: number }>} */
export const AUDIT_PROMPT_SEED_DEFAULTS = [
    {
        scope: "system",
        title: "Default system prompt",
        description: AUDIT_SCOPE_META.system.description,
        body: SYSTEM_BODY,
        sortOrder: 0,
    },
    {
        scope: "cross",
        title: "Default cross-channel analysis",
        description: "Holistic profit-focused audit across all connected channels.",
        body: `Synthesize performance across Shopify, paid media, email, and organic search for the audit period.
Find cross-channel patterns (margin leaks, budget misallocation, funnel breaks, catalog gaps).
Prioritize actions by profit impact with numeric evidence.

${CHANNEL_HOLISTIC}`,
        sortOrder: 0,
    },
    {
        scope: "seo",
        title: "Default SEO analysis",
        description: "Organic search using Search Console and Ahrefs when available.",
        body: `Analyze organic search performance: striking-distance keywords, content gaps vs. catalog,
cannibalization, traffic losses vs. comparison period, and backlink opportunities.
Cross-reference Search Console with Ahrefs volume/positions and Shopify catalog.

${CHANNEL_HOLISTIC}`,
        sortOrder: 0,
    },
    {
        scope: "ppc",
        title: "Default PPC (Google Ads) analysis",
        description: "Google Ads profit and structure focus.",
        body: `Analyze Google Ads with a profit lens: search terms, Shopping/PMax, wasted spend,
budget allocation, and structural issues. Use Shopify margin/COGS where available.
Recommend concrete negatives, bid/budget shifts, and campaign structure changes with business cases.

${CHANNEL_HOLISTIC}`,
        sortOrder: 0,
    },
    {
        scope: "ps",
        title: "Default PS (Meta) analysis",
        description: "Meta paid social performance and creative/account structure.",
        body: `Analyze Meta Ads: campaign/ad performance, creative fatigue, audience structure,
frequency/CPM issues, and profit-aware scaling. Tie results to Shopify margin where possible.
Recommend budget, creative, and targeting changes with numeric evidence.

${CHANNEL_HOLISTIC}`,
        sortOrder: 0,
    },
    {
        scope: "em",
        title: "Default EM (Klaviyo) analysis",
        description: "Email flows, campaigns, and retention economics.",
        body: `Analyze Klaviyo email performance and core flows (welcome, cart/checkout abandonment,
post-purchase, winback). Cross-check with Shopify orders and paid acquisition context.
Find revenue leaks, underperforming flows, and retention opportunities with business cases.

${CHANNEL_HOLISTIC}`,
        sortOrder: 0,
    },
];
