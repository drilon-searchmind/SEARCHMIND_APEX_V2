import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";

/** GET json, throws the API's error message on failure. */
export async function fetchJson(url) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
}

/** Adds the campaign name filter params for one channel when the filter is on. */
function applyCampaignFilter(params, filter, channel) {
    if (!filter?.enabled) return;
    const { include, exclude } = filter[channel] || {};
    if (include?.trim()) params.set("campaignInclude", include.trim());
    if (exclude?.trim()) params.set("campaignExclude", exclude.trim());
}

/**
 * URL builders for the data sources the Aura dashboard reads. `google` / `meta` are null when the
 * integration id in Config is missing or a placeholder (0 or 1). `filter` is the campaign filter
 * ({ enabled, google: { include, exclude }, meta: { include, exclude } }), off when omitted.
 */
export function buildAuraSources(customerId, settings = {}, filter = null) {
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
              applyCampaignFilter(p, filter, "google");
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
              applyCampaignFilter(p, filter, "meta");
              return `/api/facebook-campaign-insights?${p.toString()}`;
          }
        : null;

    // GA4 sessions by default channel group. null when the customer has no valid GA4 property id.
    const ga4 = isValidIntegrationId(settings.ga4PropertyId)
        ? (range) =>
              `/api/ga4?${new URLSearchParams({
                  startDate: range.startDate,
                  endDate: range.endDate,
                  metrics: "sessions",
                  dimensions: "sessionDefaultChannelGroup",
                  limit: "50",
                  propertyId: String(settings.ga4PropertyId),
                  customerId: id,
              }).toString()}`
        : null;

    const sheet = (range) =>
        `/api/custom-dashboards/aura/data?${new URLSearchParams({
            customerId: id,
            startDate: range.startDate,
            endDate: range.endDate,
        }).toString()}`;

    return { google, meta, ga4, sheet };
}

export const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
