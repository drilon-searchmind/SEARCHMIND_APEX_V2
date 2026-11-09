/**
 * Optional campaign name filter shared by the ad platform fetches (Google Ads, Meta).
 * Terms are matched case-insensitively as "name contains term". A term that starts with "=" is an exact
 * campaign name instead ("=SM | Brand" only matches a campaign called exactly that).
 * A campaign is kept when it contains ANY include term (no include terms = keep all)
 * and contains NO exclude term.
 *
 * Terms are separated by commas. When the text contains a line break, lines are the separator instead,
 * so exact campaign names that contain a comma still work.
 */

/** "Emob, Permission" -> ["emob", "permission"] */
export function parseCampaignTerms(value) {
    const text = String(value || "");
    return text
        .split(text.includes("\n") ? "\n" : ",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
}

/** True when an include or exclude term is set, so callers can skip the filtering path entirely. */
export function hasCampaignFilter(include, exclude) {
    return parseCampaignTerms(include).length > 0 || parseCampaignTerms(exclude).length > 0;
}

const termMatches = (name, term) => (term.startsWith("=") ? name === term.slice(1).trim() : name.includes(term));

export function matchesCampaignFilter(campaignName, include, exclude) {
    const name = String(campaignName || "").trim().toLowerCase();
    const inc = parseCampaignTerms(include);
    const exc = parseCampaignTerms(exclude);
    if (exc.some((t) => termMatches(name, t))) return false;
    return inc.length === 0 || inc.some((t) => termMatches(name, t));
}

/**
 * Builds the exclude text sent to the APIs from the typed terms (comma separated) and exact campaign names.
 * With exact names the result is line separated, otherwise it stays the plain comma separated text.
 */
export function buildExcludeText(terms, exactNames = []) {
    const typed = String(terms || "").trim();
    const exact = (exactNames || []).map((n) => String(n).trim()).filter(Boolean);
    if (exact.length === 0) return typed;
    const typedTerms = parseCampaignTerms(typed);
    return [...typedTerms, ...exact.map((n) => `=${n}`)].join("\n");
}
