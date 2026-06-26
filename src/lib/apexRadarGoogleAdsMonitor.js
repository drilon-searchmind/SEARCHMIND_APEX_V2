/**
 * @deprecated Import from `@/lib/apexRadarMonitorAlerts` instead.
 * Kept for backwards compatibility.
 */

import { getGoogleApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { APEX_RADAR_CHANNEL_GOOGLE_ADS } from "@/lib/apexRadarChannels";
import {
    APEX_RADAR_MONITOR_ALERT_TYPES,
    buildApexRadarMonitorAlerts,
    collectApexRadarMonitorAlerts,
} from "@/lib/apexRadarMonitorAlerts";

export const GOOGLE_ADS_ALERT_TYPES = APEX_RADAR_MONITOR_ALERT_TYPES;

export function buildGoogleAdsMonitorAlerts(row, opts = {}) {
    return buildApexRadarMonitorAlerts(row, {
        ...opts,
        channelKey: APEX_RADAR_CHANNEL_GOOGLE_ADS,
        getChannelSettings: getGoogleApexRadarSettings,
    });
}

export function collectGoogleAdsMonitorAlerts(rows, opts = {}) {
    return collectApexRadarMonitorAlerts(rows, {
        ...opts,
        channelKey: APEX_RADAR_CHANNEL_GOOGLE_ADS,
        getChannelSettings: getGoogleApexRadarSettings,
    });
}
