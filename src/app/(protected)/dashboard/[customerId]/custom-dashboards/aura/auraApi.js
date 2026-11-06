import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";

/** GET json, throws the API's error message on failure. */
export async function fetchJson(url) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
}

/**
 * URL builders for the data sources the Aura dashboard reads. `google` / `meta` are null when the
 * integration id in Config is missing or a placeholder (0 or 1).
 */
export function buildAuraSources(customerId, settings = {}) {
    const { googleAdsCustomerId, googleAdsCountryFilter, googleAdsCountryExclude, facebookAdAccountId } = settings;
    const id = String(customerId);

    const google = isValidIntegrationId(googleAdsCustomerId)
        ? (range) => {
              const p = new URLSearchParams({
                  customerId: googleAdsCustomerId,
                  startDate: range.startDate,
                  endDate: range.endDate,
                  dashboardCustomerId: id,
              });
              if (googleAdsCountryFilter) p.set("countryFilter", googleAdsCountryFilter);
              if (googleAdsCountryExclude) p.set("countryExclude", googleAdsCountryExclude);
              return `/api/google-ppc-dashboard?${p.toString()}`;
          }
        : null;

    const meta = isValidIntegrationId(facebookAdAccountId)
        ? (range) => {
              const p = new URLSearchParams({
                  adAccountId: facebookAdAccountId.startsWith("act_") ? facebookAdAccountId : `act_${facebookAdAccountId}`,
                  since: range.startDate,
                  until: range.endDate,
                  dashboardCustomerId: id,
              });
              if (settings.customerMetaID) p.set("customerMetaID", settings.customerMetaID);
              if (settings.customerMetaIDExclude) p.set("customerMetaIDExclude", settings.customerMetaIDExclude);
              return `/api/facebook-campaign-insights?${p.toString()}`;
          }
        : null;

    const sheet = (range) =>
        `/api/custom-dashboards/aura/sheet-data?${new URLSearchParams({
            customerId: id,
            startDate: range.startDate,
            endDate: range.endDate,
        }).toString()}`;

    return { google, meta, sheet };
}

export const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
