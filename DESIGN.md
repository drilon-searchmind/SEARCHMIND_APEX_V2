# Design · Searchmind Apex (Commerce dashboard)

This is the design system for the Apex dashboard. It replaces the previous "minimal" black and white spec, which now lives in `docs/design/DESIGN-minimal-legacy.md` (still in use on pages that are not migrated yet).

The look in one line: a full-screen, calm sage and mint workspace, a near-black surface for the most important number on each page, and green used to highlight.

**Scope rule for the redesign:** keep Apex's data, metrics, logic and page layout. Only the visual layer changes (tokens, type, surfaces, components, chart colours). Pages are migrated one at a time; see the status table at the end.

---

## 1. Principles

1. **Soft and calm.** Mint-white sidebar and header, a light sage canvas, pale mint cards. No pure white, no pure black.
2. **Green is the accent.** Green marks the active state, the primary button, positive change and chart highlights.
3. **One dark card per page.** The page's main number sits on a near-black `#111A12` surface. Everything else stays light.
4. **Full screen.** No outer padding, no floating frame. Sidebar on the left, header strip on top, content on the canvas.
5. **Numbers carry the design.** Large values with a smaller muted unit, tabular figures everywhere.
6. **Honest data.** Apex shows live data. If a view ever shows sample data it must carry a "Demo data" chip, and placeholder targets must be labelled.
7. **Grid texture fades out from the left.** Where a dark surface carries the faint grid (landing hero, login panel, the home Properties tile) it is a flat mint line colour masked so it is strongest on the right and gone at the left edge. No glows or colour gradients.
8. **Flags and channel logos are local.** Market flags are static SVGs in `public/images/flags` (copied once from the MIT `country-flag-icons` set, see `README.txt` there), shown through `CountryFlag` and `MarketFlags` in `src/components/ui/CountryFlag.jsx`. Shopify only provides country codes, so the markets endpoint returns `countryCodes` per market, cached 12 hours per shop on the server and 24 hours in the browser. Paid channels use `ChannelLogo` tiles (`src/components/ui/ChannelLogo.jsx`) in the sidebar and the Adspend filter. No flag or logo is ever fetched from an API.

---

## 2. Colour tokens

Defined in `src/styles/commerce-design-tokens.css` as `--cd-*` and mapped onto the existing `--apex-*` / `--color-*` variables inside `.apex-dashboard`, so existing class names keep working.

```css
:root{
  /* Surfaces */
  --cd-frame:#F3F8F1;    /* sidebar + header strip */
  --cd-canvas:#E6ECE4;   /* page background behind cards */
  --cd-card:#F6FAF4;     /* cards */
  --cd-sunk:#EAF0E8;     /* tiles, bar tracks, inset areas, hover */
  --cd-line:#E0E7DE;     /* card borders, dividers */
  --cd-line-2:#D2DBD0;   /* stronger borders, inputs, total rows */

  /* Text */
  --cd-ink:#121A13;      /* headings, body, values */
  --cd-ink-2:#4C564D;    /* secondary text */
  --cd-muted:#859085;    /* captions, axis labels, units */

  /* Dark surface */
  --cd-dark:#111A12;     /* hero card, active nav, avatar, tooltip */
  --cd-dark-2:#1C271D;   /* chips on dark */
  --cd-dark-line:#2A362B;/* borders on dark */

  /* Accent */
  --cd-green:#3A9B3F;    /* primary button, live dot, accents */
  --cd-green-2:#2F8434;  /* hover, icons, darker green */
  --cd-mint:#A9EDA2;     /* highlight on dark, light series */
  --cd-mint-soft:#DFF3DB;/* icon bubbles, chips */

  /* Channels */
  --cd-meta:#2F8434;   --cd-meta-soft:#DCEFD9;
  --cd-google:#93D88C; --cd-google-soft:#EAF6E3;

  /* Semantic */
  --cd-pos:#2F8434;  --cd-pos-soft:#DFF0DB;
  --cd-neg:#C2423B;  --cd-neg-soft:#F8E1DF;
  --cd-warn-bg:#F7EED8; --cd-warn:#8A6416;
}
```

### Where each colour goes

| Element | Colour |
|---|---|
| Page background | `--cd-canvas` |
| Sidebar, header strip | `--cd-frame` |
| Cards | `--cd-card` with `--cd-line` border |
| Hero card, active nav item, avatar, chart tooltip | `--cd-dark` |
| Active nav marker (4px left bar) | `--cd-green`; active icon `--cd-mint` |
| Primary button | `--cd-green` bg, white text, hover `--cd-green-2` |
| Positive delta on light | `--cd-pos` text in a card-coloured chip |
| Positive delta on dark | `--cd-mint` text in a `--cd-dark-2` chip |
| Negative delta | `--cd-neg` (on dark: `#F2A49E`) |
| KPI icon bubble | `--cd-mint-soft` bg, `--cd-green-2` icon |
| Selected KPI / selected row | `--cd-mint-soft` fill, `--cd-green` marker |
| Live status dot | `--cd-green` with a 3px `--cd-mint-soft` ring |

### Chart palette

Charts stay on ApexCharts (the existing stack). Colours come from `COMMERCE_CHART_PALETTE` in `src/lib/charts/chartSeriesColors.js`.

| Series | Colour |
|---|---|
| Revenue / first series | `--cd-ink` |
| Meta Ads | `#2F8434` |
| Google Ads | `#93D88C` |
| Comparison / prior period | same hue at 45% opacity, dashed `4 3` |
| Projection | `--cd-green`, dotted `2 4` |
| Single positive metric bars | `--cd-green` |
| Second stacked series | `--cd-mint` |
| Waterfall | subtotals ink, costs `#E9B1AC`, gains `--cd-pos` |

Categorical sequence: `#111A12, #2F8434, #5DBB58, #A9EDA2, #7D877D, #C5CFC4, #3F4C40, #DDF2D8`

**Metric comparison charts** (for example the overview "metrics over time" chart, where the user picks any number of metrics) do **not** use the brand greens. Use `METRIC_CHART_PALETTE` so each metric is easy to tell apart: `#2563EB` blue, `#EA580C` orange, `#7C3AED` violet, `#DB2777` pink, `#0891B2` cyan, `#CA8A04` amber, `#475569` slate, `#DC2626` red. The first selected metric gets a 10% area fill; comparison periods reuse the same hue at 45% opacity, dashed.

Funnel steps: `#111A12, #2F8434, #5DBB58, #93D88C, #A9EDA2`

Heat cells: `rgba(93,187,88, t * 0.35)` where `t` runs 0 to 1 across the period.

Tooltip: `--cd-dark` background, 10px radius, 12px text, rows of colour dot + label + bold value.

---

## 3. Typography

- **Font:** Plus Jakarta Sans (Google Fonts, 400/500/600/700). Fallback `'Helvetica Neue',Helvetica,Arial,sans-serif`.
- Tabular figures on everything numeric: `font-feature-settings:"tnum" 1`.
- Danish number format (`4.019.640`, `2,23%`, `4,87`), DKK shown as `kr.`

| Role | Size / weight |
|---|---|
| Page title | 22px / 600, tracking -0.015em |
| Card title | 15.5px / 600 |
| Body, table cells | 13.5 to 14px / 400 to 500 |
| Captions, axis, subtext | 11 to 12.5px, `--cd-muted` |
| Sidebar section labels | 11.5px / 600, uppercase, tracking 0.04em |
| KPI value | 24px / 700, tracking -0.02em |
| Hero value | 44px / 700 (34px on mobile) |
| Unit after a value | 0.58em / 500, `--cd-muted` (on dark `#9AA79B`) |

---

## 4. Shape and spacing

- Radius: cards **20px**, medium elements **14px**, tiles, buttons, selects **10px**, tags and chips **999px**.
- Card border `1px solid var(--cd-line)`. **No shadows, no gradients.**
- Card padding `22px 24px` (18px on mobile). Grid gap **18px**.
- Content padding `24px 30px 40px` (mobile `18px 16px 32px`).

---

## 5. Layout

```
+------------+---------------------------------------------------+
| SIDEBAR    | HEADER STRIP (frame): search, actions, user       |
| frame      +---------------------------------------------------+
| sticky     | Page title + filters                              |
|            | [ DARK HERO ][ card ][ card ][ card ]             |
| sections   | [ chart card                                   ]  |
|  items     | [ KPI grid                                     ]  |
+------------+---------------------------------------------------+
```

- Sidebar and header strip use `--cd-frame`; content uses `--cd-canvas`.
- Row patterns from the reference: `row-hero` = `1.9fr repeat(3,1fr)`, `cols-2-1` = `2fr 1fr`, `cols-2` = `1fr 1fr`. In Apex we keep each page's existing grid and only restyle it.
- Responsive: test at 390, 768, 1024 and 1400px. Tables scroll inside their card; the page never scrolls sideways.

---

## 6. Components

**Sidebar.** Brand row with a 32px `--cd-card` logo tile. Section labels 11.5px/600 uppercase with a `--cd-line` top divider. Nav item: icon + label, `padding:10px 14px`, radius 10px, `--cd-ink-2`, hover `--cd-sunk`. Active: `--cd-dark` background, white text, mint icon, 4px green bar on the left edge.

**Header strip.** `--cd-frame` background, `--cd-line` bottom border, no shadow. Buttons are 10px radius on `--cd-card`.

**KPI card.** Icon bubble (24px circle, `--cd-mint-soft` bg, `--cd-green-2` icon) + label, value 24px/700 with muted unit, delta chip (`--cd-card`, `--cd-line` border, 8px radius, arrow + signed %). Delta colour follows good or bad.

**Hero KPI card (dark).** Same structure on `--cd-dark`, value 44px, unit `#9AA79B`, delta chip on `--cd-dark-2` with mint (up) or `#F2A49E` (down), caption `#C9D2C9`.

**Segmented control.** `--cd-sunk` track, 10px radius; active segment `--cd-card` with `--cd-line` border.

**Chips / tags.** Pill, 12px/600. Good `--cd-pos-soft` + `--cd-pos`, watch `--cd-warn-bg` + `--cd-warn`, bad `--cd-neg-soft` + `--cd-neg`, Meta `--cd-meta-soft` + `--cd-meta`, Google `--cd-google-soft` + `#4D8A47`.

**Tables.** Header 12.5px `--cd-muted`, numbers right-aligned, `--cd-line` row dividers, total row 700 with `--cd-line-2` top border.

**Metric breakdown rows (overview columns).** Each row is a grid: label | value | change chip. Values right-align; every chip in a column has the same fixed width (`--perf-chip-w`, 4.75rem) so they line up whatever the customer's numbers are. Rows without a chip keep an invisible placeholder of the same width. Chevrons and their placeholders share one 20px slot so labels align. Long labels wrap to a second line rather than being cut off. Percent changes use a decimal comma.

**Pacing bars.** 10px `--cd-sunk` track, 2px ink marker at month elapsed.

---

## 7. Page templates (reference)

| Page | Hero KPI | Other KPIs | Body |
|---|---|---|---|
| Dashboard overview | Total revenue | Orders, Ad spend, MER | Spend donut, insight card, key ratio tiles, revenue vs spend, channel rows, tables |
| Daily overview | Revenue yesterday | Orders, Ad spend, CPA | Stacked daily spend, revenue vs same day last week, day-by-day table with MER heat cell |
| Pace report | Revenue pace % | Projected month, Needed per day, Month elapsed | Cumulative actual vs target vs projection, pacing bars, targets table |
| P&L | Contribution margin | Net revenue, Gross profit, Marketing cost | Waterfall, margin vs marketing, monthly P&L table |
| Ecommerce view | Conversion rate | Sessions, AOV, New customer CAC | Funnel, new vs returning, top products, revenue by category |

Apex keeps its own page content; the templates guide where the dark hero goes and which component styles to use.

Market colours: each market keeps one colour across the whole Markets page, assigned from `METRIC_CHART_PALETTE` by net revenue rank.

Channel colours in Apex charts (ad spend by channel): Meta `#2563EB`, Google `#EA580C`, Pinterest `#DB2777`, Snapchat `#CA8A04`, Microsoft (Bing) `#0891B2`, Reddit `#7C3AED`. Like metric charts, these stay away from the brand greens so channels are easy to tell apart.

**Dev note:** Turbopack can keep serving an old copy of `performance-dashboard.css` to pages that `@import` it. If a style change to that file doesn't show, restart the dev server (clearing `.next/dev/cache` if needed). Page-specific rules can live in the page's own CSS file.

---

## 8. Copy

Plain English, sentence case, short captions. No em or en dashes, no emojis, no decorative labels. Caveats go in a quiet note under the card.

---

## 9. Do and don't

**Do:** one dark card per page, green as the accent, units smaller and muted, tabular numbers.

**Don't:** pure `#fff` surfaces or `#000` text, shadows, gradients, outer frames, emojis, invented numbers.

---

## 10. Implementation in Apex

| File | Role |
|---|---|
| `src/styles/commerce-design-tokens.css` | `--cd-*` tokens (no remote `@import` here: it breaks when the file is inlined via nested page imports) |
| `src/app/globals.css` | Loads Plus Jakarta Sans from Google Fonts at the top of the root stylesheet |
| `src/app/(protected)/dashboard/dashboard-shell.css` | Shell: remaps `--apex-*` to `--cd-*` inside `.apex-dashboard`, sidebar, header strip |
| `src/app/(protected)/dashboard/[customerId]/performance-dashboard/performance-dashboard.css` | Shared `apex-perf-*` components (sections, KPI cards, graph card, buttons, chips, date picker) used by most dashboard views |
| `src/lib/charts/chartSeriesColors.js` | `COMMERCE_CHART_PALETTE` and helpers for ApexCharts |
| `src/lib/charts/cobaltChartTheme.js` | Shared ApexCharts base options (font, dark tooltip, solid guide line, white hover dots, line legend markers) merged into every dashboard chart |
| `src/components/dashboard/ComparisonPeriodPopover.jsx` | Hover popover on metrics, styled as the dark tooltip (`.apex-cmp-pop`) |
| `performance-dashboard/components/OverviewKeyMetrics.jsx` | Overview key metrics: dark hero row, Costs card with split bars, Key ratios tiles |
| `daily-overview/DailySummary.jsx` | Daily: hero row (last day vs same weekday last week), stacked daily ad spend, daily revenue vs same day last week |
| `daily-overview/daily-overview.css` | Daily: day-by-day table card, column toggles, heat cells (ROAS and POAS only, scaled lowest to highest) |
| `markets-overview/MarketsInsights.jsx` | Markets: top market hero, markets in profit, best ROAS, weakest POAS, revenue share vs spend share (efficiency index), revenue donut, market scorecard with status tags and growth vs last period |
| `src/lib/demoMarketsOverview.js` | Demo customers only: seeded per-market split of the demo store data for `/api/markets-overview` and `/preview/.../markets-overview` |
| `tools/pace-report/PaceOverview.jsx` | Pace: hero row (revenue pace, projected month, needed per day, month elapsed), cumulative revenue vs target vs projection, budget pacing bars with time-elapsed marker, targets and pace table. Targets come from property objectives; 1 kr. objectives count as not set and show a set-objectives prompt instead of a fake target |
| `tools/pnl/PnlOverview.jsx` | P&L: net result hero, net sales, DB1, marketing cost (vs comparison period); waterfall from sales to result whose subtotals come from the P&L itself; DB1/DB2/DB3 margin bars; realized vs break-even ROAS. The statement and static expenses card below keep Apex's detail |
| `ecommerce/components/ProductOverview.jsx`, `CustomerOverview.jsx` | Ecommerce: per-tab overview on top of Apex's detail. Products: sales hero, orders, AOV, units per order, inventory stock/value/incoming, top products, net sales by category, stock watch (days to sold out). Customers: new customers hero, returning orders, nCAC, LTV/nCAC payback, new vs returning bars, revenue split, LTV ladder with nCAC marker |
| `service-dashboard/seo/*`, `src/lib/seoAnalytics.js` | SEO: three tabs. **Overview** (clicks hero, impressions, position, CTR, organic revenue, conversions, spend saved, revenue per click, trend chart with metric chips, rank bands, brand mix, authority, winners and losers, weekly rhythm). **Opportunities** (extra clicks within reach, volume potential, striking distance, snippet gaps, cannibalization). **Keywords and pages** (brand split chart, landing pages, keyword overview). Derived views use only Search Console rows already loaded, and compare keywords with the site's own peers, never an outside benchmark. Position is judged lower-is-better and shown as places gained or lost |
| `src/lib/demoSeo.js` | Demo customers only: seeded, deterministic SEO data (keywords, pages, daily clicks, GA4 and Ahrefs figures, cannibalization) for `/api/seo-dashboard/*` and the preview route |
| `service-dashboard/ppc/*`, `src/lib/ppcAnalytics.js` | Paid Search: three tabs. **Overview** (ad spend hero, revenue, ROAS, conversions, CPA, CPC, CTR, conversion rate with change chips, trend chart with metric chips where spend and revenue share one real-value axis, impression share diagnosis won vs lost to budget vs lost to rank with a daily stacked chart and a labelled estimate of what the budget-lost share would add, spend by campaign type, customer mix when the account reports it, an auto-generated "what to look at" list, weekly rhythm by revenue and ROAS). **Campaigns** (campaign map as bubble chart of spend against ROAS with the account average line, grouped brand / generic / other, scorecard with Scale / Healthy / Watch / Cut back status judged against the account's own ROAS, never an outside benchmark). **Search terms** (wasted spend finder with copy-as-negatives, winners and losers, word insights that sum spend and ROAS per word, sortable and searchable term table). Previous-period data feeds the change chips and campaign ROAS arrows |
| `src/lib/demoPpc.js` | Demo customers only: seeded, deterministic Google Ads data built bottom-up from per-campaign daily rows (so totals, campaigns, brand/generic split and search terms agree) for `/api/google-ppc-dashboard` and the preview route |
| `service-dashboard/ps/*`, `src/lib/psAnalytics.js` | Paid Social (Meta): four tabs. **Overview** (spend hero, revenue, ROAS, conversions, CPA, CPM, link CTR, conversion rate, trend chart with metric chips, funnel balance of spend share against revenue share per stage, audience reach, frequency and engagement, customer mix, a "what to look at" list, weekly rhythm). **Creatives** (fatigue map of frequency against ROAS, spend by frequency band, winners and losers, scorecard with status and a fatigue flag at frequency 3,5, a rule of thumb and not a Meta limit). **Campaigns** (campaign map, funnel stage totals, scorecard against the account's own ROAS). **Placements** (spend share against revenue share per placement, delivery verdicts, a labelled upper-bound estimate of moving spend from the weakest to the strongest placement). Ad-level data loads separately so a failure there does not blank the page |
| `src/lib/demoPs.js` | Demo customers only: seeded, deterministic Meta data built from per-campaign daily rows (so daily totals, campaigns, funnel split, placements and ads agree) for `/api/facebook-campaign-insights`, `/api/facebook-ads-ad-performance` and the preview route |
| `service-dashboard/em/*`, `src/lib/emAnalytics.js` | Email (Klaviyo): three tabs. **Overview** (email revenue hero, orders, emails sent, revenue per email, open, click, click-to-open, unsubscribes per 1.000, flow trend chart with metric chips, send-to-order funnel, campaigns against flows with revenue per email, "what to look at", upcoming scheduled sends read from Klaviyo). **Campaigns** (campaign map of volume against revenue per email, best and weakest sends, scorecard with status against the campaign average and a marker for heavy unsubscribes). **Flows** (revenue share against email share per flow, flow scorecard). Status is always judged against the group's own revenue per email, and the campaign upside is a labelled upper-bound estimate. Opens are flagged as including automatic opens from privacy features |
| `src/lib/demoEm.js` | Demo customers only: seeded, deterministic Klaviyo data in the three parts the page loads (campaigns, flows, daily flow series) for `/api/klaviyo-dashboard` |
| `service-dashboard/pinterest/*`, `src/lib/pinAnalytics.js` | Pinterest: two tabs. **Overview** (spend hero, revenue and ROAS when Pinterest returns checkout value, checkouts, impressions, outbound clicks, saves, CTR, CPM, CPC, cost per save, trend chart with metric chips, a pin-to-purchase funnel on a square-root scale, save and checkout rates, "what to look at", weekly rhythm by outbound clicks). **Campaigns** (campaign map of reach against click-through, best and weakest clicking, scorecard with status against the account's own CTR; spend, CPC, checkouts and ROAS appear when the API returns them). Only what the Pinterest analytics API provides is shown. It states clearly when the range is outside Pinterest's 90-day sync window, and hides comparison changes when the comparison period is outside it |
| `src/lib/demoPin.js` | Demo customers only: seeded Pinterest data with exactly the fields the live fetcher can return (daily spend, impressions, outbound clicks, saves, checkouts, checkout value, and campaign totals) for `/api/pinterest-dashboard` |
| `service-dashboard/bing/*` | Microsoft Ads: three tabs that reuse the paid search parts (`ppc/components`, with `platform`, `impressionShare` and `extra` props) so Bing and Google read the same. **Overview** adds a devices and networks card (share of spend against share of revenue). **Campaigns** and **Search terms** are the PPC views. The fetcher in `microsoftAdvertisingApi.js` runs the original daily campaign report plus three best-effort reports in parallel (search queries, device and network, impression share); a failure in one is returned as a warning and the rest still loads. The extras only run for the dashboard, not for merged-source spend lookups. Wrong or alphanumeric account IDs get a plain explanation instead of the raw SOAP error |
| `src/lib/demoBing.js` | Demo customers only: seeded Microsoft Ads data with the fields the live fetcher returns (daily campaign totals, campaigns, search queries, device and network split, impression share) for `/api/bing-dashboard` |
| `service-dashboard/linkedin/*`, `src/lib/liAnalytics.js` | LinkedIn Ads: four tabs. **Overview** (spend hero, leads, cost per lead, web conversions, impressions, clicks, CTR, Lead Gen Form completion, trend chart with metric chips, impression-to-lead funnel, reach, frequency and engagement, "what to look at", weekly rhythm with cost per lead). **Audience** (job function, seniority, company size and industry: share of reach against share of leads, with over- and under-indexing). **Campaigns** (spend against cost per result, scorecard). **Ads** (by ad format, scorecard). LinkedIn reports no revenue, so success is leads plus web conversions and status is against the account's own cost per result. Demographic pivots ignore paging and return the whole set, so they are requested once; names come from `/rest/functions`, `/rest/seniorities` and `/rest/industries` with a 4 second lookup limit. Extras only run for the dashboard (`includeExtras`), never for the comparison period |
| `src/lib/demoLi.js` | Demo customers only: seeded LinkedIn data with the live fields (daily metrics, campaigns, ads with format, Lead Gen Form opens and leads, reach, four demographic breakdowns) for `/api/linkedin-dashboard`. The demo property also gets a `linkedinAdAccountId`, and the demo merge lets the template fill empty stored settings |
| `service-dashboard/snapchat/*`, `src/lib/snapAnalytics.js` | Snapchat Ads: three tabs. **Overview** (spend hero, revenue and ROAS when purchase value is tracked, purchases, impressions, swipe-ups, swipe-up rate, cost per purchase, trend chart with metric chips, snap-to-purchase funnel, video and engagement tiles, "what to look at", weekly rhythm). **Audience** (gender, age, country, region, OS and device make: share of reach against share of purchases, with over- and under-indexing; overlapping age groups such as 35+ and 35-44 are merged). **Campaigns** (spend against ROAS or swipe-up rate, scorecard with status against the account, video completion and frequency per campaign). All numbers are as Snapchat attributes them (28 day swipe-up, 1 day view). Fetcher notes: DAY stats are limited to 32 days, so longer ranges run in 31-day windows and are merged (before this, any range over 32 days failed); audience dimensions only allow `fields=spend` at ad account level, so they are requested with `breakdown=campaign` and summed; reach and frequency are only returned for single-window ranges. Extras run for the dashboard only and never for the comparison period, and failures return as warnings |
| `src/lib/demoSnap.js` | Demo customers only: seeded Snapchat data with the live fields (daily metrics, campaigns with video, engagement and frequency, six audience breakdowns) for `/api/snapchat-dashboard` |
| `service-dashboard/reddit/*`, `src/lib/redAnalytics.js` | Reddit Ads: five tabs. **Overview** (spend hero, clicks, CTR, CPC, impressions, unique members reached and frequency, video starts, purchases and ROAS only when purchases are tracked, trend chart with metric chips, video viewing funnel, communities that click above their share, what to look at, weekly rhythm). **Communities** (subreddits, interests and keywords: share of reach against share of clicks or purchases with over- and under-indexing, and an exclusion candidate list with a copy button). **Audience** (gender, country, placement). **Campaigns** (spend against ROAS or CTR bubble map, scorecard with status, ad groups). **Ads** (ad scorecard with names). Reddit has no age or device breakdown for this API, so those are not shown; the region breakdown is dropped because its codes cannot be mapped. Status is always against the account's own numbers. Heavier breakdowns load only for the main period, and report calls retry on 429 |
| `src/lib/demoReddit.js` | Demo customers only: seeded Reddit data with the live fields (daily metrics, campaigns, ad groups, ads, reach, frequency, video funnel, six audience breakdowns, purchases tracked) for `/api/reddit-dashboard` |
| Email loading | Reports are limited to about two per minute and 225 per day. The page loads in stages: campaigns and flow totals in parallel (the numbers on top), then the daily flow series, then the comparison period. The old fixed 65 second waits between calls are gone, because the API route already retries on 429 using Klaviyo's own wait hint. The route also shares one in-flight call between identical requests and keeps finished reports for 20 minutes |
| `src/components/dashboard/ServiceTable.jsx` | Shared sortable, searchable, paginated table card used by the PPC and PS dashboards |
| `src/components/dashboard/ServiceParts.jsx`, `service-parts.css` | Shared by the service dashboards: formatters, change chip (percent, position or percentage points), KPI card, donut, tag, tabs, tables and layout grids. SEO re-exports these from `SeoParts.jsx` |

Because the old pages reference `--apex-*` variables, remapping them inside `.apex-dashboard` gives unmigrated pages the new palette automatically. Migrating a page means checking its specific components against this spec and fixing what the remap does not cover.

### Migration status

| Page (`src/app`) | Status |
|---|---|
| Dashboard shell (sidebar + topbar) | Migrated |
| `dashboard/[customerId]/performance-dashboard` (Overview) | Migrated |
| `dashboard/[customerId]/daily-overview` | Migrated |
| `dashboard/[customerId]/tools/pace-report` | Migrated |
| `dashboard/[customerId]/tools/pnl` | Migrated |
| `dashboard/[customerId]/ecommerce` | Migrated |
| `dashboard/[customerId]/markets-overview` | Migrated |
| `dashboard/[customerId]/service-dashboard/seo` | Migrated |
| `dashboard/[customerId]/service-dashboard/ppc` | Migrated |
| `dashboard/[customerId]/service-dashboard/ps` | Migrated |
| `dashboard/[customerId]/service-dashboard/em` | Migrated |
| `dashboard/[customerId]/service-dashboard/pinterest` | Migrated |
| `dashboard/[customerId]/service-dashboard/bing` | Migrated |
| `dashboard/[customerId]/service-dashboard/linkedin` | Migrated |
| `dashboard/[customerId]/service-dashboard/snapchat` | Migrated |
| `dashboard/[customerId]/service-dashboard/reddit` | Migrated |
| Other service dashboards, config, other tools | Pending |
| `/` (landing page, `src/components/landing/*`) | Migrated (CSS only: tokens remapped to `--cd-*`; black `#111A12` slabs for the header, hero, services, AI card, radar panel and signup, alternating with sage sections, mint as the accent on black and green on light; unlike dashboards the landing page may use several dark surfaces; the HubSpot signup form is an iframe and keeps HubSpot's own field colours) |
| `/login` | Migrated (CSS plus small markup edits: sage canvas, light form card, black brand slab with grid, mint glow and a dashboard preview; the form comes first on phones) |
| `dashboard/[customerId]/data-wrapped/*`, `src/lib/dataWrapped.js` | Data Wrapped, redone as a story: a phone-shaped card (full screen on phones) of flat colour slides (black, mint, green, sage; no gradients) with auto-advance progress segments, tap left or right, swipe, arrow keys, hold or `P` to pause, and a wipe transition. Slides: intro with a scrolling marquee, revenue count-up, day by day line that draws itself, orders, weekday bars, average order, ad spend, a channel race with logos, ROAS, a POAS gauge with a break-even mark, comparison with the previous month, team, recap tiles and an outro with confetti. The snapshot (`version: 2`) now covers all six paid channels, the daily series, best day, weekday pattern and the previous month; saved version 1 reports still open with the slides their fields support. Team avatars are initials, no outside avatar service. Reduced motion shows final states and disables auto-advance. Review without a login at `/preview/dashboard/<demo id>/data-wrapped` (`?period=YYYY-MM`, `?legacy=1` for an old snapshot). The landing page has one dark hero with floating story cards and flat colour month tiles |
| `src/components/notifications/*`, `/notifications` page, topbar bell | Notifications. Shared parts: category badges (alert in warn tones, new feature in mint, system neutral), relative time, one link rule for external, internal and no link. **Bell dropdown**: opens instantly, loads the latest 8 once per open, keeps the items that were new highlighted with a green dot and a "3 new" line while the badge clears, then marks read after the list is shown; skeleton, empty state and Escape to close (focus returns to the bell); the badge refreshes when the tab becomes visible and every two minutes; full width sheet on phones. **Page**: a rail with the one dark Unread tile, an In your history tile, filters (All, Unread, Alerts, New features, System, with counts) and Mark all as read, beside the list grouped as Today, This week and Earlier with category badge, New tag, body, meta line, author, optional thumbnail and a link arrow; the bell and the page stay in sync through the `apex:notifications-read` event. Review without a login at `/preview/notifications` (seeded inbox; `?empty=1` for the empty state) |
| `/profile` (`src/app/(protected)/profile/*`) | Profile, rebuilt: a sticky identity rail holding the one dark card (avatar with an initials fallback instead of a stock photo, name, email, role chips, member since, real Pinned and Properties or Shared with you counts, log out), beside four cards that save separately and only enable Save and Discard when something changed: Personal details (live avatar preview), Password (show and hide, confirmation, mismatch message), Connections (Slack and ClickUp logo tiles with a Connected status) and Your properties (pinned and shared properties as links). Fixes the old password field, which had no name and never registered a change. Review without a login at `/preview/profile` (`?external=1` for an external user) |
| `/home` (`src/components/table/CustomerTable.jsx`, `home-v2.css`) | Migrated and restructured, in the dashboard style: full width, no gradients, light cards on the sage canvas, one dark KPI tile (Properties, with a flat grid texture), and green used sparingly (primary button, active chip, Open link, pinned stars, icon bubbles on KPI and Pinned). Flow: title and one search (Enter opens the first match, Ctrl+K or `/` focuses it), a KPI strip (Properties, Groups, Pinned), a Pinned card of tiles, and All properties as a table with sortable Property, Group and Platform columns, a sticky header, platform chips and a Group by parent switch (collapsible group rows; the Group column shows when it is off). On phones the table becomes single-line rows. A right rail holds Jump to and the latest news. `home.css` stays because the dashboard palette, standalone topbar and create form share it. The Create property form (`CustomerCreateForm`, apex-home variant) is grouped into Basics, Store connection, Currency, Advertising accounts, collapsible Snapchat and Reddit, and Other, in two columns on wide screens with a sticky action bar and a green primary button. Review without a login at `/preview/home` (seeded, made-up workspace; the New property button opens the form) |

### Checklist per page

- [ ] Plus Jakarta Sans applied
- [ ] Canvas `#E6ECE4`, frame `#F3F8F1`, cards `#F6FAF4` with `#E0E7DE` border, 20px radius, no shadows
- [ ] Exactly one dark `#111A12` hero card
- [ ] Green for active, primary and positive; mint for highlights on dark
- [ ] Danish number format, units muted and smaller
- [ ] No horizontal page scroll at 390px; tables scroll in their card
- [ ] No em or en dashes in any text
