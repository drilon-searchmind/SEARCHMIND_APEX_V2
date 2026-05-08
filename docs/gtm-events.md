# GTM dataLayer events

Custom events are pushed from the client via `pushGTMEvent` and helpers in `lib/gtmFunctions.js`. Payloads use an `eventData` object for parameters; every push also includes a `timestamp` (ISO string).

Naming: **`profile_update`** is the canonical event name (not `profile_updated`). Use `GTM_EVENTS` from `lib/gtmEvents.js` / `lib/gtmFunctions.js` to avoid typos.

## Stable `page` values for `dashboard_date_range_applied`

| `eventData.page` | Route (under `[customerId]`) |
|------------------|------------------------------|
| `analytics` | `/analytics` |
| `daily_overview` | `/daily-overview` |
| `ecommerce` | `/ecommerce` |
| `performance_dashboard` | `/performance-dashboard` |
| `tools_pace_report` | `/tools/pace-report` |
| `tools_pnl` | `/tools/pnl` |
| `service_dashboard_ppc` | `/service-dashboard/ppc` |
| `service_dashboard_paid_social` | `/service-dashboard/ps` |
| `service_dashboard_snapchat` | `/service-dashboard/snapchat` |
| `service_dashboard_pinterest` | `/service-dashboard/pinterest` |
| `service_dashboard_bing` | `/service-dashboard/bing` |
| `service_dashboard_reddit` | `/service-dashboard/reddit` |
| `service_dashboard_seo` | `/service-dashboard/seo` |
| `service_dashboard_em` | `/service-dashboard/em` |
| `service_dashboard_bing_webmaster` | `/service-dashboard/bing-webmaster` |

When the picker supports comparison mode, `eventData.comparisonMethod` may be `"Last Year"` or `"Last Period"` (string as shown in UI).

---

## Existing / implemented events

| Event name | Where it fires | `eventData` (typical) |
|------------|----------------|------------------------|
| `profile_update` | Profile → save profile or integrations (`src/app/(protected)/profile/page.jsx`) | `userId` |
| `dashboard_config_saved` | Dashboard config → Save All succeeds | `customerId` |
| `dashboard_parent_customer_created` | Config → General → create parent customer (modal) | `parentCustomerId`, `parentCustomerName` |
| `dashboard_date_range_applied` | Any dashboard `DateRangePicker` **Apply** (see table above); helper `pushDashboardDateRangeApplied` | `page`, `startDate`, `endDate`, optional `customerId`, optional `comparisonMethod` |
| `dashboard_pace_report_objectives_saved` | Pace report → sidebar save objectives | `customerId` |
| `performance_dashboard_custom_kpi_saved` | Performance dashboard → custom KPI modal save | `customerId`, `action` (`create` \| `update`) |
| `performance_dashboard_custom_kpi_deleted` | Performance dashboard → delete custom KPI | `customerId`, `kpiId` |
| `campaign_planner_v1_campaign_created` | Legacy campaign planner → create campaign(s) | `customerId`, `count` |
| `campaign_planner_v1_campaign_updated` | Legacy campaign planner → update campaign | `customerId`, `campaignId` |
| `campaign_planner_v1_campaign_deleted` | Legacy campaign planner → delete campaign | `customerId`, `campaignId` |
| `campaign_planner_v2_line_item_comment_added` | Campaign planner v2 → line item → add comment succeeds | `customerId`, `lineItemId` |
| `ecommerce_tab_changed` | Ecommerce dashboard → tab switch | `customerId`, `tab` (`products` \| `customers`) |
| `data_wrapped_modal_opened` | Data Wrapped → open report modal | `customerId`, `period` |

---

## Optional next steps

- Apex Radar team resync modal (outside `dashboard/`) after successful sync.
- Campaign planner **v2** workspace saves are debounced autosaves — avoid firing GTM every save; prefer explicit creates (modals) if needed.
- Service dashboard POSTs used only **to fetch metrics** do not emit events (those are reads, not configuration).
