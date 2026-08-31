# APEX MCP tool guide

Complete reference for the ~77 read-only APEX MCP tools (v0.7.3). All customer-scoped tools need **`customerId`** (MongoDB id from `list_customers`).

**Concurrency (v0.7.3+):** `mcp-server-apex` serializes `/mcp` requests per session and validates `customerId` in responses, so parallel tool calls in one Claude session no longer cross customer data. Multiple independent MCP sessions (different clients) can still run in parallel safely.

## Core tools

| Tool | Purpose |
|------|---------|
| `ping` | Connectivity check |
| `list_customers` | All clients: id, name, type, currency, integrations, `clickupTaskId` |
| `list_mcp_resources` | Catalog of metrics sources + customer + global resources |
| `get_customer` | Full sanitized settings, objectives, radar, cached team (no secrets) |
| `list_data_sources` | Platform metric source names |
| `get_merged_sources` | Combined daily store revenue + all ad spend |

## Platform metrics (`/api/mcp/data/…`)

Requires `customerId`, `startDate`, `endDate` unless noted.

| Tool | Data |
|------|------|
| `get_facebook_ads` | Meta daily spend / PS dashboard metrics |
| `get_google_ads` | Google Ads PPC metrics |
| `get_pinterest_ads` | Pinterest metrics |
| `get_snapchat_ads` | Snapchat metrics |
| `get_reddit_ads` | Reddit metrics |
| `get_bing_ads` | Microsoft Advertising metrics |
| `get_klaviyo_metrics` | Klaviyo sent-campaign performance (opens, clicks, conversions) |
| `get_store_revenue` | E-commerce revenue only (no ad spend) |
| `get_ga4_metrics` | GA4 sessions/users by day |
| `get_seo_metrics` | GSC clicks/impressions + top keywords |
| `list_meta_campaigns` | Meta campaign list |
| `list_google_campaigns` | Google campaign list |
| `get_meta_ad_performance` | Ad-level Meta performance |
| `get_google_ad_performance` | Ad-level Google performance |
| `get_google_ppc_dashboard` | Full Google PPC dashboard payload |
| `get_klaviyo_dashboard` | Full Klaviyo EM dashboard (+ optional `prevStartDate`, `prevEndDate`) |
| `get_klaviyo_scheduled_campaigns` | Planned Klaviyo email campaigns (scheduled, draft, preparing) — optional `daysAhead`, `includeDrafts` |
| `get_klaviyo_flows` | Klaviyo flow setup (triggers, delays, email steps) — optional `includeActions`, `status`, `maxFlows` |
| `get_weekly_audit` | Compact weekly audit JSON — `startDate`, `endDate`; optional `compare` (`prev_period` default, `yoy`) |
| `get_pinterest_dashboard` | Full Pinterest dashboard |
| `get_snapchat_dashboard` | Full Snapchat dashboard |
| `get_reddit_dashboard` | Full Reddit dashboard |
| `get_bing_dashboard` | Full Bing dashboard |
| `get_seo_brand_keywords` | Configured brand keywords (no dates) |
| `get_seo_exact_keywords` | Exact-match keyword groups |
| `get_seo_partial_keywords` | Partial-match keyword groups |
| `get_seo_insights` | Full SEO insights bundle (+ optional `compareStartDate`, `compareEndDate`, `siteUrl`) |

## Customer resources (`/api/mcp/customers/{id}/resources/…`)

| Tool | Extra params | Purpose |
|------|--------------|---------|
| `get_clickup_team` | — | ClickUp members + service tags |
| `get_custom_kpis` | — | Custom KPI definitions |
| `get_campaigns` | — | APEX campaign records |
| `get_tracking_scores` | — | Latest tracking/compliance scan |
| `get_customer_segmentation` | dates | Segmentation from merged data |
| `get_markets_overview` | dates | Shopify markets overview rows |
| `get_share_of_search` | — | Saved SoS snapshots |
| `get_data_wrapped` | `period=YYYY-MM` | Monthly wrap summary |
| `list_data_wrapped_reports` | — | Saved wrap reports |
| `get_shopify_markets` | — | Shopify markets catalog |
| `get_shopify_products` | dates, optional `fast=true` | Product metrics |
| `get_segmentation_shopifyql` | dates, optional `full=true` | ShopifyQL segmentation |
| `get_dashboard_audit` | optional `auditId` | List or fetch channel audit |
| `list_ai_analysis` | optional `dashboardType` | AI analysis chat list |
| `get_ai_analysis_chat` | `chatId` | Single AI chat |
| `get_campaign_planner_workspace` | — | Campaign planner v2 state |
| `list_campaign_planner_comments` | `lineItemId` | Planner comments |
| `get_bing_webmaster_site_data` | optional dates | Bing traffic/crawl |
| `get_bing_webmaster_ai_performance` | dates | Bing AI performance series |
| `get_merged_sources_filtered` | dates + optional `source`, `shopifyMarkets`, `adSpendExclude` | Daily-overview-style filters |
| `get_apex_radar_customer_settings` | — | Apex Radar channel settings |

## Global resources (`/api/mcp/global/…`)

| Tool | Params | Purpose |
|------|--------|---------|
| `list_internal_users` | — | Staff with name, email, `clickupId` |
| `list_parent_customers` | — | Parent groups + children summary |
| `list_our_tools` | — | Internal tools directory |
| `get_parent_customer_detail` | `parentId` | One parent + child list |
| `get_parent_aggregated_metrics` | `parentId`, dates, optional comparison params | Parent roll-up |
| `get_parent_customer_filters` | `parentId` | Saved Google/Meta filters |
| `list_user_campaigns` | `userId` | Campaigns by assigned user |
| `list_apex_radar_assignments` | `channel` = `facebook` \| `google-ads` | Radar user assignments |
| `get_apex_radar_google_overview` | dates, optional `customerId` | Google Radar overview |
| `get_apex_radar_facebook_overview` | dates, optional `customerId` | Meta Radar overview |
| `get_apex_radar_google_investigator` | `customerId`, `funnelStartDate`, `funnelEndDate`, optional `currentYear` | Google PI |
| `get_apex_radar_facebook_investigator` | same | Meta PI |
| `get_bing_webmaster_status` | — | Bing integration config status (booleans only) |
| `list_seo_properties` | — | GSC properties APEX can access |

## Use-case → tool matrix

| Question type | Start here |
|---------------|------------|
| Find client id | `list_customers` |
| Who works on client? | `get_clickup_team` + `list_internal_users` |
| Daily / monthly performance | `get_merged_sources` |
| Daily overview with market filters | `get_merged_sources_filtered` |
| Meta deep dive | `get_meta_ad_performance` or `get_facebook_ads` |
| Google deep dive | `get_google_ppc_dashboard` or `get_google_ads` |
| Email performance (sent campaigns) | `get_klaviyo_dashboard` or `get_klaviyo_metrics` |
| Klaviyo planned campaign calendar | `get_klaviyo_scheduled_campaigns` |
| Klaviyo flow / automation setup | `get_klaviyo_flows` |
| Weekly audit report | `get_weekly_audit` |
| SEO deep dive | `get_seo_insights` |
| Shopify products | `get_shopify_products` |
| Client config / objectives | `get_customer` |
| Parent brand roll-up | `get_parent_aggregated_metrics` |
| Ops / account health | Apex Radar overview + assignments tools |
| Audit PDF data | `get_dashboard_audit` |
| Competitor search share | `get_share_of_search` |

## Proxy tools (v0.7.0 — allowlisted read access)

Use **`list_proxy_routes`** first to see allowlists and guardrails. Prefer curated tools above when they cover your question — proxies are for ad-hoc reads not wrapped by a dedicated tool.

| Tool | Purpose |
|------|---------|
| `list_proxy_routes` | Catalog of allowlisted APEX routes, Shopify query types, GAQL resources, Meta endpoints |
| `call_apex_api` | `{ route, customerId, params }` → allowlisted APEX dashboard APIs |
| `request_route_access` | `{ route, customerId, reason }` → optional; blocked `call_apex_api` calls are **auto-logged** by APEX |
| `shopify_graphql_read` | `{ queryType, customerId, params }` → ShopifyQL or Admin GraphQL templates |
| `google_ads_gaql_read` | `{ customerId, query }` → read-only GAQL SELECT |
| `meta_ads_read` | `{ endpoint, customerId, params }` → Meta insights / campaigns / adsets / ads / accounts |

### Allowlisted APEX routes (`call_apex_api`)

| Route | Required params |
|-------|-----------------|
| `/api/merged-sources` | `startDate`, `endDate` |
| `/api/markets-overview` | `startDate`, `endDate` |
| `/api/google-ads` | `startDate`, `endDate` |
| `/api/facebook-ads` | `startDate`, `endDate` |
| `/api/klaviyo` | `startDate`, `endDate` |
| `/api/shopify-products` | `startDate`, `endDate` |
| `/api/shopify-orders` | `startDate`, `endDate` |
| `/api/shopify-customers` | `startDate`, `endDate` |
| `/api/shopify-analytics` | `startDate`, `endDate` |
| `/api/seo-metrics` | `startDate`, `endDate` |
| `/api/customer-segmentation` | `startDate`, `endDate` |
| `/api/data-wrapped` | `period` (YYYY-MM) |
| `/api/weekly-audit` | `startDate`, `endDate`; optional `compare` (`prev_period` default, `yoy`) |
| `/api/klaviyo-scheduled-campaigns` | optional `daysAhead` (default 60), `includeDrafts` (default true) |
| `/api/klaviyo-flows` | optional `includeActions` (default true), `status` (`live`/`draft`/`manual`), `maxFlows` (default 80) |
| `/api/apex-radar` | `startDate`, `endDate`, `channel` (`google-ads` or `facebook`) |
| `/api/shopify-channel-attribution` | `startDate`, `endDate` |
| `/api/shopify-referrer-domain-sessions` | `startDate`, `endDate` |
| `/api/shopify-agentic-attribution` | `startDate`, `endDate` |

### Approvable routes (`call_apex_api` — require admin approval per customer)

These routes have MCP handlers but are **not** on the default allowlist. A blocked `call_apex_api` call **auto-creates** a pending admin request.

| Route | Required params |
|-------|-----------------|
| `/api/pinterest-ads` | `startDate`, `endDate` |
| `/api/snapchat-ads` | `startDate`, `endDate` |
| `/api/reddit-ads` | `startDate`, `endDate` |
| `/api/bing-ads` | `startDate`, `endDate` |
| `/api/ga4-metrics` | `startDate`, `endDate` |

Admin review: `https://apex.searchmind.tech/admin/route-requests`

### Shopify proxy query types (`shopify_graphql_read`)

| queryType | Kind | Notes |
|-----------|------|-------|
| `SalesReport`, `OrdersReport`, `ProductsReport`, `CustomersReport`, `InventoryReport` | ShopifyQL | Standard reports |
| `AgenticSalesReport` | ShopifyQL | Sales by `agentic_sales_channel` (tries API 2026-04→2026-01; falls back to filtered `sales_channel`) |
| `AgenticReferringReport` | ShopifyQL | Sales by `agentic_referring_channel` (FROM sales, then FROM payments fallback) |
| `orders` | GraphQL | Basic order list for date range |
| `ordersAttribution` | GraphQL | Orders with `sourceName`, `tags`, `app`, `channelInformation`, `attribution`, `customerJourneySummary` |
| `products`, `customers`, `inventory`, `shop` | GraphQL | Paginated Admin reads |

Pair **session-level** AI traffic (`/api/shopify-channel-attribution`, `/api/shopify-referrer-domain-sessions`) with **order-level** agentic sales (`/api/shopify-agentic-attribution` or `ordersAttribution`) to see if AI referrals convert.

### Shopify referrer domain sessions (`/api/shopify-referrer-domain-sessions`)

Use when platforms tag links inconsistently (UTM vs referrer). Groups **human** sessions by `referrer_domain` (e.g. `perplexity.ai`, `chatgpt.com`) — the fairest way to compare Perplexity vs ChatGPT vs Copilot **visit** volume.

| Response block | What it gives you |
|----------------|-------------------|
| `trafficByReferrerDomain` | Full `FROM sessions GROUP BY referrer_domain` breakdown |
| `aiReferrerDomains` | Filtered subset of known AI/agent domains |

Also included in `/api/shopify-channel-attribution` as `trafficByReferrerDomain` + `aiReferrerDomains`.

All agentic endpoints return **`shopifyqlApiVersion`** — one shared resolved version per request (default `2026-04`).

| Response block | What it gives you |
|----------------|-------------------|
| `shopChannelSales` | `sales_channel = Shop` revenue/orders — proxy for Shopify Admin widget "Shop" line |
| `trafficByAgenticUtmSource` | Sessions by `utm_source` (chatgpt.com, perplexity, copilot.com, openai, shop_app) |
| `salesByAgenticSalesChannel` | Native `agentic_sales_channel` when Shopify exposes it, else Shop/AI `sales_channel` filter |
| `salesByAgenticReferringChannel` | Native `agentic_referring_channel`, then `referring_channel` sales, then UTM/referrer session fallback |
| `salesByReferringChannel` | Full `FROM sales GROUP BY referring_channel` breakdown (Shopify-suggested approximation; use `agenticApproximation` subset for AI-like channels) |

Native `agentic_sales_channel` / `agentic_referring_channel` may still be unavailable on API 2026-04 for some stores. Use `salesByReferringChannel` to approximate Admin Agentic revenue by channel — compare to the widget; values are not guaranteed to match exactly.

## Parameter notes

- **`period`** (Data Wrapped): `YYYY-MM` e.g. `2025-06`
- **`channel`** (Radar assignments): exactly `facebook` or `google-ads`
- **`parentId`**: from `list_parent_customers` or `get_parent_customer_detail`
- **`auditId`**, **`chatId`**, **`lineItemId`**: ids from list tools
- **`shopifyMarkets`**, **`adSpendExclude`**: JSON or comma-separated — match APEX daily overview URL params when user specifies filters
