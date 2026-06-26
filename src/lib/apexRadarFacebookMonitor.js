/**
 * Apex Radar — Meta PS (Facebook) monitor alerts.
 */

import { getFacebookApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";
import {
    APEX_RADAR_MONITOR_ALERT_TYPES,
    buildApexRadarMonitorAlerts,
    collectApexRadarMonitorAlerts,
} from "@/lib/apexRadarMonitorAlerts";

export const FACEBOOK_MONITOR_ALERT_TYPES = APEX_RADAR_MONITOR_ALERT_TYPES;

export function buildFacebookMonitorAlerts(row, opts = {}) {
    return buildApexRadarMonitorAlerts(row, {
        ...opts,
        channelKey: APEX_RADAR_CHANNEL_FACEBOOK,
        getChannelSettings: getFacebookApexRadarSettings,
    });
}

export function collectFacebookMonitorAlerts(rows, opts = {}) {
    return collectApexRadarMonitorAlerts(rows, {
        ...opts,
        channelKey: APEX_RADAR_CHANNEL_FACEBOOK,
        getChannelSettings: getFacebookApexRadarSettings,
    });
}
