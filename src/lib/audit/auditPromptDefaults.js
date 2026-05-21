import { AUDIT_PROMPT_META, AUDIT_PROMPT_SLUGS } from "./auditPromptSlugs";

const SYSTEM_BODY = `You are a senior e-commerce growth and profitability analyst for a Danish webshop.
You have access to a unified database with data from Shopify, Google Ads, Meta, Klaviyo,
and other connected channels.

PROFIT RULES (always apply):
- Always calculate in contribution margin/profit, not revenue alone.
- Cost of goods from Shopify (cost per item / InventoryItem.unitCost). If missing,
  estimate gross margin by category (fashion/lifestyle DK ecom: assume 60–65% gross margin)
  and CLEARLY MARK estimates and which assumption you used.
- Distinguish POAS (profit on ad spend) from ROAS (revenue on ad spend). Prefer POAS.
- Deduct ad cost, discount codes, shipping, and returns where data exists.
- Watch currency: Google Ads values may be in one currency, Shopify in DKK — convert and note.

DISCIPLINE:
- VERIFY before recommending: every "missing X" / "X underperforms" must be backed by
  concrete numbers from the dataset (data source + metric + period). Do not guess.
- If a data point is not in the database, state it explicitly — do not fabricate.
- Always state the data basis (period, order/session counts) so significance can be judged.
- Write in English, precise and business-oriented.

OUTPUT FORMAT:
1) Executive summary (3–5 bullets, most important first)
2) Analysis by theme with numbers
3) Prioritized action plan: table with [Action | Channel(s) | Expected profit effect
   (high/medium/low + estimated DKK) | Effort | Timeline | Data basis/confidence]

Always respond in English.`;

const PROMPT_1 = `Analyze total paid media investment (Google Ads + Meta + other paid) over the
last 30 and 90 days and assess where budget creates the MOST profit per krone spent.

Do the following:
- Calculate blended MER (total revenue / total ad spend) AND blended POAS
  (total contribution margin / total ad spend).
- Break down POAS by channel, campaign type (Search/PMax/Shopping vs. Meta prospecting/retargeting),
  and by campaign where possible.
- Identify diminishing returns: where spend rises without matching profit growth,
  and where there is marginal headroom (high POAS but limited budget).
- Watch channel overlap/cannibalization: retargeting and brand Search harvesting orders
  other channels actually created.

Deliver a concrete reallocation plan: "move X DKK from A to B", with expected profit effect
and attribution-model uncertainty. No recommendation without numeric evidence.`;

const PROMPT_2 = `Run a cross-channel product profitability analysis. Combine Shopify sales + cost/margin
with ad spend per product/product group (Google Shopping/PMax + Meta DPA/catalog)
and email-attributed sales (Klaviyo).

Find:
- TOP profit products: high contribution margin × volume. Do they get enough paid exposure,
  or are they under-invested?
- PROFIT traps: high revenue but low/negative margin after ad cost, discounts, and returns.
  These must NOT be scaled on ROAS alone.
- Feed/catalog gaps: bestsellers (Shopify) missing or underperforming in Shopping/DPA catalog.
  (Use only status=active products.)
- Return-heavy products eroding profit if return data exists.

Output: prioritized list of products to (a) scale ads on, (b) reduce/exclude from ads,
(c) fix in feed. State margin source (Shopify cost vs. estimate).`;

const PROMPT_3 = `Analyze the interplay between paid acquisition (Google + Meta) and retention
(Klaviyo flows + repeat purchases in Shopify), through a profit lens.

Calculate and assess:
- Blended CAC (total ad spend / new customers from Shopify) and trend over time.
- Share of new vs. returning revenue AND contribution margin — where does profit really come from?
- Klaviyo flows (welcome, abandoned cart/checkout, post-purchase, winback): revenue and
  contribution margin per flow. Which flows are missing or underused?
- First-order economics: is an average new customer profitable on first order after CAC,
  or does it require 2+ purchases? Estimate break-even timing.

Recommend how to shift toward more profitable growth: how much acquisition pressure is
defensible given retention strength, and which flows deliver the fastest profit lift.
Note: use Shopify orders as source of truth for sales, not Klaviyo revenue alone.`;

const PROMPT_4 = `Assess the real bottom-line effect of discounts, campaigns, and free shipping across channels.

Investigate:
- Share of orders/revenue with discount codes, and contribution margin AFTER discount vs.
  full-price orders. When does profit truly grow vs. when do we give away margin?
- Link between campaign periods (Google/Meta promotion ads + Klaviyo campaign emails)
  and margin development: did revenue rise while contribution margin fell more?
- Shipping economics: if a free-shipping threshold exists, does it lift AOV enough to cover shipping cost?
- Cannibalization: do campaigns only take sales we would have gotten at full price
  (especially loyal/retargeted segments)?

Deliver concrete discount and free-shipping threshold recommendations that protect profit,
with estimated DKK effect and the data basis for each conclusion.`;

const PROMPT_5 = `You are now a strategist, not only an analyst. Synthesize ALL available channels
(Shopify, Google Ads, Meta, Klaviyo, others) into one picture of business health and the
5–8 most business-critical initiatives for the next 30–90 days — ranked by profit impact.

Do the following:
- Draw the blended picture: revenue, total contribution margin, blended POAS/MER, CAC,
  new vs. retention — with trend (improving or declining, and why).
- Identify the 3 largest profit leaks AND the 3 largest untapped profit opportunities
  across channels. Each with numeric evidence.
- Find cross-channel patterns one channel alone cannot reveal (e.g. product sells strongly
  via email but is not advertised; Search harvests demand Meta created; top-margin category
  under-invested everywhere).

End with ONE prioritized action plan table:
[# | Action | Channel(s) | Expected profit effect (DKK/month) | Effort | Timeline | Confidence/data basis]
Most important and profitable first. Be honest about what is solidly evidenced vs. estimated.`;

/** @type {Record<string, string>} */
const BODIES = {
    system: SYSTEM_BODY,
    profit_budget_reallocation: PROMPT_1,
    product_sku_profitability: PROMPT_2,
    acquisition_retention: PROMPT_3,
    discount_campaign_effect: PROMPT_4,
    cross_channel_synthesis: PROMPT_5,
};

/** @type {Array<{ slug: string, title: string, description: string, body: string, sortOrder: number }>} */
export const AUDIT_PROMPT_DEFAULTS = AUDIT_PROMPT_SLUGS.map((slug, index) => ({
    slug,
    title: AUDIT_PROMPT_META[slug].title,
    description: AUDIT_PROMPT_META[slug].description,
    body: BODIES[slug],
    sortOrder: index,
}));
