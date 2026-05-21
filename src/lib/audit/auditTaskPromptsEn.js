/**
 * English task prompts for audit cards (used instead of Danish bodies in audit-prompts.md).
 */

const HOLISTIC =
    "Be holistic and open with the data in this area — if something business-critical should be highlighted, include it even if outside the obvious scope.";

/** @type {Record<string, { title: string, tag: string, dataLine: string, taskPrompt: string }>} */
export const AUDIT_TASK_PROMPTS_EN = {
    "ppc-1": {
        title: "Search terms → missing collection",
        tag: "Growth",
        dataLine: "Google Ads search terms (revenue, ROAS, conv., volume) · Shopify collections + products.",
        taskPrompt: `Start from Google Ads search terms against the Shopify catalog. Find terms that drive the most real value — weigh revenue, ROAS, contribution margin, and volume together, since winners differ by metric — and uncover commercial demand without a matching collection or dedicated landing page.

For each opportunity: propose a concrete collection name, which products it should group, and why it will move the business. Include a business case per suggestion (estimated revenue/profit upside + assumptions) for prioritization.

Go beyond 1:1 term→collection: themes, bundles, brands, price tiers, or intents in search data that deserve their own structure. Separate quick wins from larger builds.

${HOLISTIC}`,
    },
    "ppc-2": {
        title: "GSN & Shopping expansion",
        tag: "Structure",
        dataLine: "Google Ads Shopping/PMax at product level · Search Console queries · Ahrefs volume · Shopify products.",
        taskPrompt: `Use Shopping/Performance Max data at product level to find uncovered demand that should be captured better. Decide from revenue, profit, ROAS, impression share, and inventory which products/groups lack enough Search or Google Search Network coverage; validate demand with Search Console + Ahrefs.

Recommend specific campaign types and structures (e.g. Standard Shopping, Search, brand vs. non-brand, dedicated PMax asset groups) and which products/themes to prioritize first, with a business case per recommendation.

Assess whether account structure itself blocks growth — flag structural changes that could lift the whole account.

${HOLISTIC}`,
    },
    "ppc-3": {
        title: "Wasted spend & negatives",
        tag: "Optimization",
        dataLine: "Google Ads search terms + keywords + campaigns (spend, conv., ROAS) · Shopify margin.",
        taskPrompt: `Find where Google Ads spend is not working hard enough. Review search terms, keywords, and campaigns for waste — but judge with contribution margin: strong ROAS can still lose on low-margin products, and weak ROAS can be fine on high margin. Deliver a concrete negative keyword list and keywords/campaigns to lower bids, pause, or adjust.

Estimate how much spend can truly be freed and where reallocation yields the best return (with business case). Explain structural drivers (match types, themes, landing pages) if relevant.

${HOLISTIC}`,
    },
    "ppc-4": {
        title: "Budget reallocation by ROAS",
        tag: "ROI",
        dataLine: "Google Ads campaigns + product groups (spend, ROAS, impression share, budget caps) · Shopify COGS/margin.",
        taskPrompt: `Assess whether budget is allocated where it creates the most business value. Model profit with Shopify COGS/margin (not revenue ROAS alone) and decide the growth vs. profitability balance from the data. Find profitable areas constrained by budget/impression share and over-investment in unprofitable areas.

Propose a concrete reallocation plan with expected profit/return impact and business cases for the largest moves. Use the comparison period (if provided) to show whether efficiency is improving or declining and what needs action now.

${HOLISTIC}`,
    },
    "ppc-5": {
        title: "PMax vs. Search overlap",
        tag: "Structure",
        dataLine: "Google Ads PMax + Search (search terms, brand/non-brand, conv.).",
        taskPrompt: `Analyze how Performance Max and Search interact — where they cannibalize vs. complement. Uncover overlap (same terms/products, brand vs. non-brand) and where PMax harvests conversions Search would have taken (and vice versa).

Recommend budget, prioritization, and structural changes to maximize incremental profit (not just reported ROAS). If the setup should be rethought, say so with a business case for the upside.

${HOLISTIC}`,
    },
    "ppc-6": {
        title: "Outliers — good and bad",
        tag: "Alert",
        dataLine: "Google Ads campaigns/ad groups/keywords/products (CPC, CTR, conv. rate, ROAS, spend) + comparison period.",
        taskPrompt: `Find what stands out in Google Ads — winners to scale and runaway spend to fix. Review campaigns, ad groups, keywords, and products across CPC, CTR, conv. rate, ROAS, contribution margin, and spend. With no pre-processing, define what is a real anomaly (vs. account average, distribution, comparison period) and state your thresholds.

Separate winners to scale from losers to fix or stop. Per outlier: likely cause, concrete action, and business case for acting.

${HOLISTIC}`,
    },
    "ps-1": {
        title: "Creative fatigue",
        tag: "Creative",
        dataLine: "Meta ads at ad level over time (CTR, CPM, frequency, ROAS) + comparison period.",
        taskPrompt: `Assess ad health at ad level over the period. Find fatigue signals (declining CTR, rising CPM/frequency, falling ROAS/margin over time) and use the comparison period to show trends. Recommend what to pause, refresh, or scale.

Equally important: infer what works — angles, formats, hooks, messages — so new creatives follow a pattern, not guesses. Business case for refresh upside; flag the most urgent ads.

${HOLISTIC}`,
    },
    "ps-2": {
        title: "Audience overlap & scaling",
        tag: "Structure",
        dataLine: "Meta ad sets/audiences (spend, ROAS, frequency, overlap indicators) · Shopify margin.",
        taskPrompt: `Analyze ad sets and audiences for waste and untapped potential. Uncover likely overlap (ad sets bidding against each other) and winning profitable audiences capped by budget. Weigh revenue, profit, and contribution margin when defining "winners."

Recommend consolidation, budget increases, new audiences to test broadly, and what to close. Business cases for the largest moves.

${HOLISTIC}`,
    },
    "ps-3": {
        title: "Funnel balance",
        tag: "Structure",
        dataLine: "Meta campaigns split prospecting vs. retargeting (spend, conv., ROAS).",
        taskPrompt: `Assess funnel balance between prospecting (TOF) and retargeting (MOF/BOF) in spend and real value created. Find imbalances: retargeting taking credit for conversions that would happen anyway? Too little prospecting starving future growth? Judge with profit/contribution margin, not ROAS alone.

Recommend an optimal budget split backed by data and a business case for short- and long-term impact.

${HOLISTIC}`,
    },
    "ps-4": {
        title: "Budget by ROAS/CAC",
        tag: "ROI",
        dataLine: "Meta campaigns/ad sets (spend, ROAS, CAC) · Shopify COGS/margin + comparison period.",
        taskPrompt: `Decide if Meta budget sits where it creates the most value. Model profit with Shopify COGS/margin; identify what to scale vs. cut and the growth/profit balance from the data.

Provide a concrete reallocation plan with expected effect and business cases for the largest shifts. Use the comparison period to judge if performance is stable enough to scale.

${HOLISTIC}`,
    },
    "ps-5": {
        title: "Catalog performance",
        tag: "Growth",
        dataLine: "Meta catalog/DPA/Advantage+ product performance · Shopify margin + inventory.",
        taskPrompt: `Link Meta catalog/product performance with Shopify margin and inventory. Find over-exposed products that do not earn their keep and profitable products under-exposed. Weight revenue, contribution margin, and stock together.

Recommend what to push harder, deprioritize, or remove from catalog; how to structure/segment the feed. Business cases for the biggest shifts.

${HOLISTIC}`,
    },
    "ps-6": {
        title: "Outlier campaigns",
        tag: "Alert",
        dataLine: "Meta campaigns/ads (spend, ROAS, frequency, CPM, conv. rate) + comparison period.",
        taskPrompt: `Find Meta outliers — campaigns/ads far above or below normal on spend, ROAS, margin, frequency, CPM, conv. rate. Define real anomalies vs. account norm and comparison period; state thresholds.

Separate winners from losers; concrete action per outlier and business case where relevant.

${HOLISTIC}`,
    },
    "seo-1": {
        title: "Striking distance keywords",
        tag: "Growth",
        dataLine: "Search Console queries (position, impressions, clicks, CTR) · Ahrefs volume.",
        taskPrompt: `Find organic quick wins. Use Search Console for queries near page one (often ~positions 5–15) with real volume (Ahrefs) — but do not fixate on a position band if data suggests other lifts. Assess commercial intent and which URLs rank.

Per opportunity: what the page lacks (content, internal links, on-page, intent match), concrete optimization, and business case (traffic/revenue upside). Prioritize by potential vs. effort.

${HOLISTIC}`,
    },
    "seo-2": {
        title: "Content gap vs. catalog",
        tag: "Growth",
        dataLine: "Ahrefs keywords + Search Console queries · Shopify collections/products · (optional converting paid terms).",
        taskPrompt: `Match search demand (Ahrefs + Search Console) to the Shopify catalog where commercial demand lacks a capturing page. Cross-check converting Google Ads terms to inform organic priority.

Propose concrete new pages/collections (name, type, target keywords, products) prioritized by volume, intent, and business value, with a business case each. Think categories, guides, brand pages, use cases — whatever will earn traffic and sales.

${HOLISTIC}`,
    },
    "seo-3": {
        title: "Cannibalization",
        tag: "Optimization",
        dataLine: "Search Console queries × URLs.",
        taskPrompt: `Uncover keyword cannibalization in Search Console: multiple URLs competing for the same query and dragging each other down. Show affected queries and URLs. Recommend consolidation (canonical page, merge/redirect/deindex) and expected ranking/traffic impact.

Flag broader structural issues (thin content, internal linking, category overlap) with business cases for cleanup.

${HOLISTIC}`,
    },
    "seo-4": {
        title: "Lost traffic & rankings",
        tag: "Alert",
        dataLine: "Search Console (clicks, impressions, position) period vs. comparison · Ahrefs backlinks.",
        taskPrompt: `Compare the period to the comparison period (YoY by default) and find organic losses: pages/queries losing clicks, impressions, or positions. Per meaningful loss: likely cause (seasonality, algorithm, cannibalization, lost backlinks — check Ahrefs, technical/content) and concrete recovery actions.

Prioritize by lost traffic value; business cases for recovery. Separate urgent vs. can-wait.

${HOLISTIC}`,
    },
    "seo-5": {
        title: "Backlink opportunities",
        tag: "Growth",
        dataLine: "Ahrefs backlinks + referring domains + competitor profiles.",
        taskPrompt: `Use Ahrefs to compare backlink profiles to competitors. Find gaps (domains linking to competitors but not you), lost/broken links to reclaim, and high-value pages needing links. Prioritize outreach by authority, relevance, and realism.

Recommend which pages should earn links to move rankings that matter commercially, with business cases.

${HOLISTIC}`,
    },
    "seo-6": {
        title: "New landing pages",
        tag: "Growth",
        dataLine: "Ahrefs + Search Console (uncovered demand) · Shopify catalog · (optional paid terms).",
        taskPrompt: `Turn uncovered search demand (Ahrefs + Search Console) plus Shopify catalog into new pages with commercial intent. Per page: target keyword(s), estimated volume, intent, and how to build it. Note overlap with high-performing paid terms.

Think broadly about page types (collections, categories, guides, comparisons); prioritize by potential vs. effort; business case per proposal.

${HOLISTIC}`,
    },
    "em-1": {
        title: "Flow gaps",
        tag: "Structure",
        dataLine: "Klaviyo flows (type, status, open/click/conv., RPR) · Shopify purchase data.",
        taskPrompt: `Review Klaviyo flows for revenue leaks in the automated journey. Assess whether core flows exist and perform (welcome, abandoned cart/checkout, browse abandonment, post-purchase, winback/sunset) and cross-check Shopify data for where customers drop. Find missing and underperforming flows (low open/click/conv./RPR).

Recommend what to create or improve, prioritized by revenue potential, with business cases. Suggest non-standard flows if purchase patterns support them.

${HOLISTIC}`,
    },
    "em-2": {
        title: "Campaign performance",
        tag: "Optimization",
        dataLine: "Klaviyo campaigns (opens, clicks, conv., unsubscribes, RPR, send time, segment) + comparison period.",
        taskPrompt: `Analyze email campaigns: what drives results vs. what does not (opens, clicks, conv., unsubscribes, RPR, send time, segment). Infer patterns in subject lines, content, timing, and audience; use comparison period if provided.

Recommend concrete improvements for upcoming campaigns and a cadence balancing revenue and list health. Business cases for key changes.

${HOLISTIC}`,
    },
    "em-3": {
        title: "Segment health",
        tag: "ROI",
        dataLine: "Klaviyo lists/segments (growth, engagement, churn) · Shopify customer/LTV data.",
        taskPrompt: `Assess list health: growth, engagement, churn. Find segments with falling engagement (sunset candidates hurting deliverability) and high-value segments to activate more. Use Shopify data for valuable groups (high LTV, repeat buyers, category buyers).

Recommend segments to create, activate, or clean; business cases for deliverability protection and incremental revenue.

${HOLISTIC}`,
    },
    "em-4": {
        title: "Revenue per recipient",
        tag: "ROI",
        dataLine: "Klaviyo campaigns/flows (RPR, bounce, spam, unsubscribes, deliverability).",
        taskPrompt: `Find campaigns and flows with low revenue per recipient and diagnose why (relevance, segmentation, offer, deliverability — check bounce/spam/unsubscribes). Flag deliverability risks before they become costly.

Recommend concrete lifts to RPR and sender reputation; business case for email revenue upside.

${HOLISTIC}`,
    },
    "em-5": {
        title: "Cross-sell from purchase data",
        tag: "Growth",
        dataLine: "Shopify purchase data (line items, sequence, repurchase frequency) · Klaviyo flows.",
        taskPrompt: `Use Shopify purchase data (what customers buy, order, frequency) for cross-sell and replenishment opportunities. Which products are bought together or in sequence; typical repurchase cycle?

Recommend concrete cross-sell/replenishment flows and segments with timing from purchase patterns; business cases for incremental revenue. Cover automation (flows) and campaigns.

${HOLISTIC}`,
    },
    "em-6": {
        title: "Outliers",
        tag: "Alert",
        dataLine: "Klaviyo campaigns/flows (unsubscribes, spam, bounce, performance) + baseline.",
        taskPrompt: `Find outlier campaigns and flows — unusually high unsubscribes/spam/bounce harming the program, or unusually strong performance to repeat. Define real anomalies vs. account norm; state thresholds.

Explain causes; concrete actions to stop harm or scale winners. Business cases where relevant.

${HOLISTIC}`,
    },
    "cross-1": {
        title: "Blended returns & MER",
        tag: "ROI",
        dataLine: "All paid channels (spend, revenue) · Shopify total revenue + COGS + orders + comparison period.",
        taskPrompt: `Assess overall marketing efficiency: calculate and interpret blended ROAS, CAC, and MER across channels, tied to Shopify total revenue, orders, and COGS/margin. Identify channels that truly drive profit vs. revenue only.

Recommend cross-channel budget allocation (Google Ads, Meta, SEO, email) to maximize total profit; decide growth vs. profitability balance from data. Use comparison period for trends; business cases for the largest shifts.

${HOLISTIC}`,
    },
    "cross-2": {
        title: "Margin-aware spend",
        tag: "ROI",
        dataLine: "Paid channels at product/category level · Shopify COGS/margin.",
        taskPrompt: `Layer Shopify COGS/margin on marketing spend at product/category level across paid channels. Find spend selling revenue without real bottom-line profit (low-margin products pushed hard) and high-margin products under-invested.

Recommend where to move spend for maximum contribution margin; business cases for profit impact. Highlight biggest product/category wins.

${HOLISTIC}`,
    },
    "cross-3": {
        title: "Full-funnel story",
        tag: "Structure",
        dataLine: "SEO (organic), Google Ads, Meta, Klaviyo · Shopify traffic/conversion.",
        taskPrompt: `Connect SEO, paid search, paid social, and email into one funnel story — how channels truly interact (e.g. social/SEO creating demand that brand search captures; email converting paid traffic). Find leaks: high traffic/low conv., TOF without BOF follow-up, channels not working together.

Recommend cross-channel fixes with business cases. Flag missing channels or journey steps if data supports it.

${HOLISTIC}`,
    },
    "cross-4": {
        title: "Top products cross-channel",
        tag: "Growth",
        dataLine: "Shopify product performance + margin · product data from all channels.",
        taskPrompt: `Find Shopify products that win in one channel but are underused in others — e.g. email bestseller not pushed in paid, or high-margin product with organic demand but no ads. Weight revenue, contribution margin, and demand together.

Per product: where the opportunity is, which channel should activate it, business case. Prioritize by margin and potential.

${HOLISTIC}`,
    },
    "cross-5": {
        title: "Prioritized action plan",
        tag: "Plan",
        dataLine: "All sources (often after other analyses, or with full data).",
        taskPrompt: `Roll up ALL relevant findings across channels into one prioritized action plan for the coming period. Each action: channel, concrete step, expected effect (revenue/profit/contribution margin), business case, effort, and suggested owner. Sort by expected value vs. effort; include quick wins and structural work.

This is the "what we do now and why" overview — sharp enough for a marketing lead to execute directly.

${HOLISTIC}`,
    },
};

/**
 * @param {string} cardId
 */
export function getEnglishTaskPrompt(cardId) {
    return AUDIT_TASK_PROMPTS_EN[cardId] || null;
}
