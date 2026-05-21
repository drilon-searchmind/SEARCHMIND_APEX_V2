/**
 * Fixed audit prompt library keys (admin-editable, never deleted).
 */

export const AUDIT_PROMPT_SLUGS = [
    "system",
    "profit_budget_reallocation",
    "product_sku_profitability",
    "acquisition_retention",
    "discount_campaign_effect",
    "cross_channel_synthesis",
];

/** @type {Record<string, { title: string, description: string }>} */
export const AUDIT_PROMPT_META = {
    system: {
        title: "Shared system prompt",
        description: "Prepended to every audit analysis call (reused across all five task prompts).",
    },
    profit_budget_reallocation: {
        title: "Profit-driven budget reallocation (cross-channel)",
        description: "Module 1 — where paid spend creates the most profit per krone.",
    },
    product_sku_profitability: {
        title: "Product / SKU profitability (cross-channel)",
        description: "Module 2 — top profit SKUs, profit traps, and catalog gaps.",
    },
    acquisition_retention: {
        title: "Acquisition vs. retention: CAC, LTV & email–paid interplay",
        description: "Module 3 — paid acquisition vs. retention and Klaviyo flows.",
    },
    discount_campaign_effect: {
        title: "Discount & campaign effect on bottom line",
        description: "Module 4 — real margin impact of discounts, promos, and free shipping.",
    },
    cross_channel_synthesis: {
        title: "Cross-channel executive synthesis & action plan",
        description: "Module 5 — synthesize all channels into a prioritized 30–90 day plan.",
    },
};

/**
 * Maps Run Audit card ids to modular prompt slugs (audit-prompts-updated.md modules).
 * Cards not listed fall back to legacy per-card English prompts.
 * @type {Record<string, string>}
 */
export const AUDIT_CARD_MODULAR_SLUG = {
    "cross-1": "profit_budget_reallocation",
    "cross-2": "product_sku_profitability",
    "cross-3": "acquisition_retention",
    "cross-4": "product_sku_profitability",
    "cross-5": "cross_channel_synthesis",
    "ppc-4": "profit_budget_reallocation",
    "ps-4": "profit_budget_reallocation",
    "ppc-2": "product_sku_profitability",
    "ps-5": "product_sku_profitability",
    "ps-3": "acquisition_retention",
    "em-1": "acquisition_retention",
    "em-5": "acquisition_retention",
    "em-2": "discount_campaign_effect",
    "em-3": "discount_campaign_effect",
};
