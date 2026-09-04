/** URL segment for Meta / Facebook (PS) */
export const APEX_RADAR_CHANNEL_FACEBOOK = "facebook";

/** URL segment for Google Ads */
export const APEX_RADAR_CHANNEL_GOOGLE_ADS = "google-ads";

export const APEX_RADAR_CHANNELS = [APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_GOOGLE_ADS];

/** Default Slack warnings channel for PPC / Google Ads. */
export const APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL = "apex-radar-workspace";

/** Default Slack warnings channel for Meta PS. */
export const APEX_RADAR_SLACK_PS_WARNINGS_CHANNEL = "apex-radar-workspace-ps";

/**
 * Client-safe Slack channel name for UI labels (env overrides apply server-side only).
 * @param {string} [channel]
 */
export function getApexRadarSlackWarningsChannelForDisplay(channel) {
    if (String(channel || "") === APEX_RADAR_CHANNEL_FACEBOOK) {
        return APEX_RADAR_SLACK_PS_WARNINGS_CHANNEL;
    }
    if (String(channel || "") === APEX_RADAR_CHANNEL_GOOGLE_ADS) {
        return APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL;
    }
    return APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL;
}

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

/** Dedicated CS (Client Strategists) section — not a PPC channel. */
export const APEX_RADAR_CS_PATH = "cs";
export const APEX_RADAR_CS_HREF = "/apex-radar/cs";

export function apexRadarCsHref(customerId = null) {
    if (customerId) return `${APEX_RADAR_CS_HREF}/${String(customerId)}`;
    return APEX_RADAR_CS_HREF;
}

/**
 * @returns {{ isApexRadar: boolean, channel: string | null, customerId: string | null, isCs: boolean }}
 */
export function parseApexRadarPath(pathname) {
    const raw = String(pathname || "");
    if (!raw.startsWith("/apex-radar")) {
        return { isApexRadar: false, channel: null, customerId: null, isCs: false };
    }
    const parts = raw.split("/").filter(Boolean);
    if (parts.length < 2) {
        return { isApexRadar: true, channel: null, customerId: null, isCs: false };
    }
    const seg = parts[1];
    if (seg === APEX_RADAR_CS_PATH) {
        const customerId = parts.length >= 3 ? parts[2] : null;
        return { isApexRadar: true, channel: null, customerId, isCs: true };
    }
    if (!isValidApexRadarChannel(seg)) {
        return { isApexRadar: true, channel: null, customerId: null, isCs: false };
    }
    const customerId = parts.length >= 3 ? parts[2] : null;
    return { isApexRadar: true, channel: seg, customerId, isCs: false };
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
