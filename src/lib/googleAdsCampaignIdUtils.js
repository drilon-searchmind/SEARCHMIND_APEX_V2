/** Normalize Google Ads campaign id for consistent keys (client-safe; no google-ads-api). */
export function normalizeGoogleAdsCampaignId(id) {
    if (id == null) return "";
    const s = String(id).trim();
    const tail = s.match(/(\d+)$/);
    return tail ? tail[1] : s;
}
