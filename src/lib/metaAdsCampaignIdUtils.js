/** Normalize Meta (Facebook) campaign id for consistent exclusion keys. */
export function normalizeMetaAdsCampaignId(id) {
    if (id == null) return "";
    return String(id).trim();
}
