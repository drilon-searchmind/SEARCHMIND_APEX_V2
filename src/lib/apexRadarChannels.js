/** URL segment for Meta / Facebook (PS) */
export const APEX_RADAR_CHANNEL_FACEBOOK = "facebook";

/** URL segment for Google Ads */
export const APEX_RADAR_CHANNEL_GOOGLE_ADS = "google-ads";

export const APEX_RADAR_CHANNELS = [APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_GOOGLE_ADS];

export const APEX_RADAR_CHANNEL_META = {
    [APEX_RADAR_CHANNEL_FACEBOOK]: {
        label: "Facebook (PS)",
        shortLabel: "PS",
        description: "Meta ads & performance",
    },
    [APEX_RADAR_CHANNEL_GOOGLE_ADS]: {
        label: "Google Ads",
        shortLabel: "GAds",
        description: "Search & Performance Max",
    },
};

export function isValidApexRadarChannel(slug) {
    return APEX_RADAR_CHANNELS.includes(String(slug || ""));
}

/**
 * @param {string} pathname
 * @returns {string | null}
 */
export function getApexRadarChannelFromPathname(pathname) {
    const m = String(pathname || "").match(/^\/apex-radar\/([^/?#]+)/);
    if (!m) return null;
    const seg = m[1];
    return isValidApexRadarChannel(seg) ? seg : null;
}

/**
 * @returns {{ isApexRadar: boolean, channel: string | null, customerId: string | null }}
 */
export function parseApexRadarPath(pathname) {
    const raw = String(pathname || "");
    if (!raw.startsWith("/apex-radar")) {
        return { isApexRadar: false, channel: null, customerId: null };
    }
    const parts = raw.split("/").filter(Boolean);
    if (parts.length < 2) {
        return { isApexRadar: true, channel: null, customerId: null };
    }
    const seg = parts[1];
    if (!isValidApexRadarChannel(seg)) {
        return { isApexRadar: true, channel: null, customerId: null };
    }
    const customerId = parts.length >= 3 ? parts[2] : null;
    return { isApexRadar: true, channel: seg, customerId };
}

/** Overview URL for a channel; optional customer scopes the table to one property. */
export function apexRadarOverviewHref(channel, customerId = null) {
    if (!channel) return "/apex-radar";
    if (customerId) return `/apex-radar/${channel}/${customerId}`;
    return `/apex-radar/${channel}`;
}

/**
 * Performance Investigator requires a property (customer) in the path.
 * @returns {string | null} null if channel or customerId is missing/invalid
 */
export function apexRadarPerformanceInvestigatorHref(channel, customerId) {
    if (!isValidApexRadarChannel(channel) || !customerId) return null;
    return `/apex-radar/${channel}/${String(customerId)}/performance-investigator`;
}
