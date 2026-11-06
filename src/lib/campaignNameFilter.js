/**
 * Optional campaign name filter shared by the ad platform fetches (Google Ads, Meta).
 * Terms are comma separated and matched case-insensitively as "name contains term".
 * A campaign is kept when it contains ANY include term (no include terms = keep all)
 * and contains NO exclude term.
 */

/** "Emob, Permission" -> ["emob", "permission"] */
export function parseCampaignTerms(value) {
    return String(value || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
}

/** True when an include or exclude term is set, so callers can skip the filtering path entirely. */
export function hasCampaignFilter(include, exclude) {
    return parseCampaignTerms(include).length > 0 || parseCampaignTerms(exclude).length > 0;
}

export function matchesCampaignFilter(campaignName, include, exclude) {
    const name = String(campaignName || "").toLowerCase();
    const inc = parseCampaignTerms(include);
    const exc = parseCampaignTerms(exclude);
    if (exc.some((t) => name.includes(t))) return false;
    return inc.length === 0 || inc.some((t) => name.includes(t));
}
