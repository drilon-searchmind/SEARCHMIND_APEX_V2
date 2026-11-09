# Custom dashboards

Hardcoded dashboards for single customers. Shown in the sidebar under **Custom**.

## How it works

1. `Customer.CustomerSettings.customDashboardsEnabled` (Config > General > "Custom dashboards") turns the menu on per customer.
2. `index.js` is the registry. Each customer has one module (for example `Aura.js`) exporting
   `{ customerNames: [...], dashboards: [{ slug, label, Component }] }`. A customer is matched on `customerName`.
3. The sidebar lists `getCustomDashboards(customer)`. It is empty (no menu) unless the setting is on AND a module exists.
4. Routes: `/dashboard/[customerId]/custom` redirects to the first dashboard, `/dashboard/[customerId]/custom/[slug]` renders it.
   Both return 404 when the setting is off or the customer has no such dashboard.

## Add a customer

1. Create `NewCustomer.js` (copy `Aura.js`), put dashboard components in a `newcustomer/` folder.
2. Add the module to `CUSTOM_DASHBOARD_MODULES` in `index.js`.
3. Import its stylesheets in `styles.js` (not inside the dashboard component, lazy chunks do not load CSS in dev).
4. Turn on "Custom dashboards" in that customer's Config.

## Aura DK

`aura/` rebuilds the old Google Sheets / Supermetrics dashboard. The sheet's logic and what could not be matched is
documented in `aura/SHEET_LOGIC.md`. The calculations live in `aura/auraSheetLogic.js`.

## Campaign filter

The campaign filter is one setting on the account, not per viewer. It is edited once under Data inputs, Campaign filter
(`aura/AuraFilterEditor.jsx`, with a test tool that lists the campaigns a month imports and lets single campaigns be excluded by
exact name), saved as the `filter` input and read by every Aura dashboard through `aura/useAuraFilter.js`. Its shape is
`{ enabled, google: { include, exclude, excludeExact }, meta: { ... } }`, which `aura/auraApi.js` turns into the
`campaignInclude` / `campaignExclude` params of `/api/google-ppc-dashboard` and `/api/facebook-campaign-insights`
(matching lives in `src/lib/campaignNameFilter.js`; an exclude term starting with `=` is an exact campaign name).

## Hand-entered inputs

Values an ad platform API cannot provide (for Aura: daily conversions, planned campaign budgets, monthly goals) are saved per customer in
`CustomDashboardInput` (`src/models/CustomDashboardInput.js`) and edited on the dashboard's "Data inputs" page (`aura/AuraInputs.jsx`).
`src/lib/auraInputs.js` validates them and turns them into daily series, `/api/custom-dashboards/aura/inputs` reads and saves them (writing is
limited to internal users) and `/api/custom-dashboards/aura/data` serves the computed series to the dashboard.
