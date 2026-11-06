# Aura DK Google Sheet: reverse engineered logic

Source: the "Performance Dashboard" workbook (29 tabs, Danish tab names, built with Supermetrics). Read through the
public xlsx export, including formulas. Everything below is read from the formulas, nothing is assumed unless flagged.

## 1. Where the data really lives

The workbook holds almost no raw data itself. Every number is pulled with `IMPORTRANGE` from three other Google Sheets
(named in tab `Link`, cells C2, C3, C7). Those sheets are filled by Supermetrics and were NOT readable from here.

| Link cell | Name in sheet | Tabs read | Content (from how formulas use them) |
|---|---|---|---|
| C2 | Datasource Paid | `PPC!K:P`, `Meta!Q:Z` | Daily Google Ads (date, clicks, spend, impressions, conversions, conv. value) and daily Meta (date, spend, impressions, ...) |
| C3 | SM Datasource | `GA4!F:H`, `GA4!S:T`, `Timelogger!A:F` | GA4 sessions by date and default channel group; hourly orders/sales (hidden hour tab) |
| C7 | Conversions data | `Conversions!B:D`, `Campaigns Cost!B:E` | Daily "Emob" conversions (these are the customers/orders the CAC is based on) and a daily "Other" cost |

## 2. Tab roles

| Tab | State | Role |
|---|---|---|
| Link | visible | Config: source sheet names, `TODAY()` |
| Config | visible | VAT (25%), monthly goal (customers) and monthly budget per month, channel on/off flags, backend = Shopify |
| Performance Dashboard | visible | THE dashboard (scorecards and charts). Holds only the date range (P3, Q3), comparison mode (L3: Previous Period or Previous Year) and dropdown selectors |
| p calc | visible | Calculation tab for the dashboard (every scorecard and chart series) |
| p calc import | visible | Raw import for the dashboard: queries on the date range, current / last period (LP) / last year (LY) |
| Overview Day | visible | Daily table for one month (picked in C2), copies a month tab |
| Pace | visible | Month budget and customer goal pace |
| Januar ... December | one visible (August), rest hidden | One tab per month: daily conversions, PPC cost, PS cost, Other cost, total, CAC, plus last year block |
| Pace Calc, Budget Calc, Hour Calc, Overview Hour, Budget | hidden | Calculation helpers for Pace, an hourly view and a budget view |
| SEO Dashboard, SEO Dashboard Calculator | hidden | Search Console view (not in scope) |
| Designregler, Overview, SupermetricsQueries | hidden | Design notes, a link menu, Supermetrics query storage |

## 3. Dashboard metrics and exact formulas

Date range: start P3, end Q3. Previous period (LP): start minus N days, same length N = end - start + 1.
Previous year (LY): start and end minus **365.25 days** (fractional, so LY can be off by a day). Today is excluded in the
monthly tabs (`IF(date < TODAY(), ..., "")`), the dashboard uses the chosen range.
VAT: `(1 - Config!C7)` = x0.75 is applied to every revenue / conversion value figure.

### General (all channels)
| Metric | Formula |
|---|---|
| Orders (customers) | `SUM(Conversions!D)` over the range (the "Emob" column) |
| Cost | Google Ads spend + Meta spend + Other cost (`Campaigns Cost` column D) |
| CAC | `Cost / Orders` |
| Revenue, ROAS, POAS, GP, AOV | Defined (`Revenue = SUM(import!C) x 0.75`, `ROAS = Revenue / Cost`, `POAS = Revenue x Config!C6 / Cost`, `GP = Revenue x Config!C6 - Cost`, `AOV = Revenue / Orders`) but **dead**: the revenue source column is empty, so all show 0. `Config!C6` (margin) does not exist. They are not rebuilt. |

### PPC (Google Ads)
Conversions = SUM conversions, Conv. Value = SUM value x 0.75, Ad Spend = SUM spend, ROAS = Conv. Value / Spend,
AOV = Conv. Value / Conversions, Impressions, Clicks, CTR = Clicks / Impressions, CPC = Spend / Clicks,
Conv. Rate = Conversions / Clicks, CPA = Spend / Conversions. In the sheet conv. value is always 0, so ROAS and AOV show 0.

### PS (Meta)
Ad Spend, Impressions, Conversions (x 0.75, odd: a VAT factor on a count), Clicks, CTR = "AS" column / Impressions,
CPC = Spend / "AS" column, CPM = Spend / Impressions x 1000, CPA = Spend / Conversions.

### Pace tab
- Daily budget = month budget / days in month. Pace (cost) = month-to-date cost / (daily budget x (DAY(today) - 1)).
- Pace (customers) = month-to-date customers / (goal / days in month x (DAY(today) - 1)).
- Suggested daily adjustment = `-(cost - budget/days x DAY(today-1)) / (days - DAY(today-1)) + (budget/days - cost/DAY(today-1))`.
- Budget and goal are typed into `Pace!C4` / `Pace!K4` AND separately in `Config`. They are not linked.

### Monthly charts
Conversions vs goal and CAC by month, cost split by month (PPC / PS / Other share of the sum), AOV by month (broken: `#REF!`),
Sessions per channel group (GA4), Ad Spend / Clicks / Impressions / Conversions / CPC style charts by month with a dropdown.

## 4. Things that look wrong in the sheet (flagged, not guessed)

1. Revenue, ROAS, POAS, GP and AOV (general) are 0 because no revenue column is wired in. Config says backend = Shopify.
2. Meta column headers in `p calc import` are shifted by one from column AR. The values used as "clicks" sit under the header
   "Avg. Frequency". The ratio math is consistent with real clicks. Meta conversions are always 0, so Meta CPA is `#DIV/0!`.
3. VAT x0.75 on Meta conversion count is probably a copy-paste from the revenue formula.
4. "AOV by month" in `p calc` references `#REF!`.
5. LY uses 365.25 days, not a calendar year or 364 days.
6. Budget and goal are duplicated in `Pace` and `Config`.
7. The LP sum for cost starts at `Z2` instead of `Z12` (harmless unless rows 2 to 11 get data).
8. Orders (customers) use `B13` as the first row while others use row 12 (header row, harmless).
9. The "Other" cost is a flat daily number per month in the sample read (looks like a prorated fixed cost). Its origin is
   unknown.

## 5. What Apex can and cannot match

| Sheet source | Apex source | Status |
|---|---|---|
| Google Ads daily (spend, clicks, impressions, conversions, conv. value) | `/api/google-ppc-dashboard` | Matched |
| Meta daily (spend, impressions, clicks, conversions) | `/api/facebook-campaign-insights` | Matched. Apex returns real Meta clicks and conversions, so Meta CPA/conv. numbers will differ from the sheet (sheet conversions are 0) |
| GA4 sessions by channel group | `/api/ga4` | Matched (needs `ga4PropertyId`, set for Aura) |
| Orders / customers ("Emob" conversions) | Aura conversions sheet, tab `Conversions`, read live by `/api/custom-dashboards/aura/sheet-data` | Matched. Daily value = `SUM(G:J)` (Eje ny, Eje eks, Leje ny, Leje eks), typed by hand in that sheet, not from an ad platform |
| "Other" cost (`Campaigns Cost`) | Same sheet, hidden tab `Campaigns Cost`, column D (Emob), computed there from the `Campaign` tab budgets | Matched via the same route |
| Hourly orders and sales (`Timelogger`) | none | Not rebuilt (hidden tab) |
| SEO / Search Console tabs | n/a | Not rebuilt (hidden tabs) |

The conversions sheet is shared with anyone who has the link. Its ID can be overridden with the `AURA_CONVERSIONS_SHEET_ID` environment variable. If the sharing is turned off, the Conversions, Other cost and CAC figures stop loading.

## 6. Campaign filter (found while checking the numbers)

The sheet's paid data comes from a source file named "Aura EMOB" (private, filters not readable). Comparing January 2026 against Apex's own campaign data:

| Channel | Sheet | Apex campaigns that add up to it |
|---|---|---|
| Google Ads (PPC cost) | 91,100 | Campaigns with "ladeboks" in the name: 91,100 |
| Meta (PS cost) | 61,491 | Campaigns with "Emob" in the name (59,680) plus the "Permission | De Vilde Kaniner" campaign (1,811): 61,491 |
| Other cost | 37,801 | Matches the Aura sheet exactly |

So the old dashboard only counted the Emob product (EV charger) campaigns, while Apex currently reads whole accounts (El and Fiber campaigns included). This is inferred from the numbers, not read from the Supermetrics query. To reproduce the sheet, Cost and CAC need a campaign name filter on the Google Ads and Meta fetches (for Meta, "Emob" plus the Permission campaign).

Also: the Conversions tab in the source sheet has its older rows hidden (everything before 7 Dec 2025). The Google gviz endpoint skips hidden rows, so that tab is read through the CSV export instead.
