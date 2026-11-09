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

## 5. Where each number comes from in Apex

Nothing is read from Google Sheets at runtime.

| Sheet source | Apex source |
|---|---|
| Google Ads daily (spend, clicks, impressions, conversions, conv. value) | `/api/google-ppc-dashboard` (the customer's Google Ads account) |
| Meta daily (spend, impressions, clicks, conversions) | `/api/facebook-campaign-insights` (the customer's Meta ad account) |
| GA4 sessions by channel group (`p calc` B109:C123: sessions summed per default channel group for the selected period, most first) | `/api/ga4` with the customer's GA4 property, shown in "Sessions per channel group" |
| Orders / customers ("Emob" conversions): typed by hand in the sheet | Saved Apex input "Conversions" (Custom > Data inputs). Daily value = `SUM(G:J)` (Eje ny, Eje eks, Leje ny, Leje eks), older days only have a total |
| "Other" cost (`Campaigns Cost` tab, computed in the sheet from its `Campaign` tab) | Saved Apex input "Campaign budgets". Each campaign's budget is spread evenly over start to end, the channel "Emob" makes up Other cost |
| Monthly customer goal and budget (`Config` tab) | Saved Apex input "Goals". CAC goal = budget / customer goal |
| Hourly orders and sales (`Timelogger`) | Not rebuilt (hidden tab) |
| SEO / Search Console tabs | Not rebuilt (hidden tabs) |

The three hand-entered inputs are stored in the `CustomDashboardInput` collection (one document per customer, dashboard and key). They were copied
once from the sheet on 6 Nov 2026 and are edited on the "Data inputs" page from now on. The sheet is no longer used.

## 6. Campaign filter (found while checking the numbers)

The sheet's paid data comes from a source file named "Aura EMOB" (private, filters not readable). Comparing January 2026 against Apex's own campaign data:

| Channel | Sheet | Apex campaigns that add up to it |
|---|---|---|
| Google Ads (PPC cost) | 91,100 | Campaigns with "ladeboks" in the name: 91,100. From April the sheet also counts the video campaign "SM - V: Branding" |
| Meta (PS cost) | 61,491 | Campaigns with "Emob" in the name (59,680) plus the "Permission | De Vilde Kaniner" campaign (1,811): 61,491. In 2025 the sheet also counts campaigns with "Ladebok" in the name (for example "SM \| Ladebokskampagne") |
| Other cost | 37,801 | Matches the Aura sheet exactly |

So the old dashboard only counted the Emob product (EV charger) campaigns, while Apex currently reads whole accounts (El and Fiber campaigns included). This is inferred from the numbers, not read from the Supermetrics query. To reproduce the sheet, Cost and CAC need a campaign name filter on the Google Ads and Meta fetches (for Meta, "Emob" plus the Permission campaign).

Also: the Conversions tab in the source sheet has its older rows hidden (everything before 7 Dec 2025). The Google gviz endpoint skips hidden rows, so that tab is read through the CSV export instead.

The dashboard has a reusable **campaign filter** (an account setting under Data inputs, off by default). When on, the Google Ads and Meta requests get `campaignInclude` / `campaignExclude` (comma separated, "name contains", case-insensitive). The "Emob (as in the old sheet)" preset fills in the terms above and reproduces the sheet's January 2026 cost (Google Ads 91,100.38 vs 91,100.41, Meta 61,491 vs 61,491). The filter applies to the KPIs and the Conversions / CAC chart. Search terms, impression share and the account summary in the underlying Google Ads response are not filtered.

Month by month check of the Emob preset (Google Ads: `ladeboks, SM - V: Branding`, Meta: `Emob, Permission`) against the sheet's monthly cost:
Google Ads matches to the krone for January to March and May to September. April is 2,731 lower in Apex (one small campaign the sheet counts is not
identified) and October is higher in Apex only because the sheet screenshot was taken before month end. Meta matches exactly for January to May.

Meta (Emob preset `Emob, Permission, Ladebok`) matches the sheet's monthly cost and conversions exactly for January to April 2025 and January 2026.
In the Meta tab "Clicks" are Meta link clicks, as in the sheet (22,805 link clicks in January 2026 against 29,241 total clicks), so CTR = link clicks /
impressions, CPC = spend / link clicks, CPM = spend / impressions x 1000 and CAC = spend / conversions. The sheet's own Meta period KPIs show
Conversions 0 and a broken third scorecard (a column mapping mistake in the sheet), the monthly charts are correct. Apex shows the real conversions.

## Pace report and Overview day (Apex: Custom > Pace report, Custom > Overview day)

Both sheet tabs use the same daily data as the Performance dashboard (Google Ads daily spend, Meta daily spend, saved
daily conversions, saved campaign budgets as "Other" cost) for one month. Code: `auraDailyLogic.js`, `useAuraMonthData.js`.

- Overview Day: a month picked in a dropdown. Per day: Conversions, PPC Cost (Google Ads), PS Cost (Meta), Other Cost,
  Spend Total (= PPC + PS + Other) and CAC (= Spend Total / Conversions). Days that have not finished are blank.
  Total row = sum of the finished days, CAC = total spend / total conversions. "Last Year" = the same number of days
  a year earlier (checked: 43 conversions = the first 8 days of November 2025), Index = this year / last year x 100,
  Dif = this year minus last year. Weekends are marked.
- Pace: month budget and customer goal come from the saved Goals input (the sheet typed them into the Pace tab AND Config).
  Pace (cost) = cost to date / (budget / days in month x finished days), Pace (customers) the same with the goal, finished
  days = DAY(today) - 1. Suggested daily adjustment = `-(cost - daily budget x finished) / (days - finished) + (daily budget - cost / finished)`.
  Checked against the sheet's 9 November 2026 figures: 46,807 cost, 178,667 budget -> 0.98, 143; 115 customers, goal 250 -> 1.73.
  The two charts are the cumulative cost against the straight budget line and cumulative conversions against the straight goal line.
- Like the other views, cost only matches the sheet with the Emob campaign filter on (see section 6).
