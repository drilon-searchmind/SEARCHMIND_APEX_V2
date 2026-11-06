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
3. Turn on "Custom dashboards" in that customer's Config.

## Aura DK

`aura/` rebuilds the old Google Sheets / Supermetrics dashboard. The sheet's logic and what could not be matched is
documented in `aura/SHEET_LOGIC.md`. The calculations live in `aura/auraSheetLogic.js`.
