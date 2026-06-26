/**
 * Apex Radar — Google Ads monitor alerts (spend + conversion tracking).
 * Used for in-app notification preview before Slack integration.
 */

import { getGoogleApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import {
    APEX_RADAR_CONVERSION_ZERO_DAYS_THRESHOLD,
    APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD,
    meetsPriorDaySpendStoppedAlert,
    meetsSpendDodThreshold,
} from "@/lib/apexRadarFacebookOverview";

export const GOOGLE_ADS_ALERT_TYPES = {
    SPEND_DOD: "spend_dod",
    SPEND_STOPPED: "spend_stopped",
    CONVERSION_TRACKING: "conversion_tracking",
};

function fmtMoney(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n, digits = 1) {
    if (n == null || Number.isNaN(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(n)}%`;
}

/**
 * @param {object} row — overview row
 * @param {object} [opts]
 * @param {number} [opts.spendDodThresholdPct]
 * @param {number} [opts.conversionZeroDaysThreshold]
 * @param {string[]} [opts.teamMemberNames]
 * @returns {object[]}
 */
export function buildGoogleAdsMonitorAlerts(row, opts = {}) {
    const spendDodThresholdPct =
        opts.spendDodThresholdPct ?? APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD;
    const conversionZeroDaysThreshold =
        opts.conversionZeroDaysThreshold ?? APEX_RADAR_CONVERSION_ZERO_DAYS_THRESHOLD;
    const teamMemberNames = opts.teamMemberNames || [];
    const customerId = String(row.id ?? row.customerId ?? "");
    const customerName = row.entity || "Unnamed customer";
    const dod = row.spendDayOverDay || {};
    const tracking = row.conversionTracking || {};
    const googleSettings = getGoogleApexRadarSettings(row);
    const alerts = [];

    if (meetsSpendDodThreshold(row, spendDodThresholdPct)) {
        alerts.push({
            id: `${customerId}-${GOOGLE_ADS_ALERT_TYPES.SPEND_DOD}`,
            type: GOOGLE_ADS_ALERT_TYPES.SPEND_DOD,
            severity: "warning",
            customerId,
            customerName,
            teamMemberNames,
            title: "Day-over-day spend drop",
            message: `Spend fell ${fmtPct(dod.pctChangeFromPrior)} from ${dod.calendarDayBeforeYesterday} to ${dod.calendarYesterday} (${fmtMoney(dod.spendDayBeforeYesterday)} → ${fmtMoney(dod.spendYesterday)}). Threshold: ${fmtPct(spendDodThresholdPct, 0)} or lower.`,
        });
    }

    if (meetsPriorDaySpendStoppedAlert(row)) {
        alerts.push({
            id: `${customerId}-${GOOGLE_ADS_ALERT_TYPES.SPEND_STOPPED}`,
            type: GOOGLE_ADS_ALERT_TYPES.SPEND_STOPPED,
            severity: "warning",
            customerId,
            customerName,
            teamMemberNames,
            title: "Spend stopped after prior day",
            message: `No spend on ${dod.calendarYesterday} (UTC) after ${fmtMoney(dod.spendDayBeforeYesterday)} on ${dod.calendarDayBeforeYesterday}.`,
        });
    }

    if (googleSettings.trackingAlertsEnabled !== false) {
        const streak = tracking.consecutiveZeroConversionDays ?? 0;
        const hadSpend = tracking.hadSpendInStreak === true;
        if (
            streak >= conversionZeroDaysThreshold &&
            hadSpend &&
            tracking.streakEndDate
        ) {
            const dayLabel = streak === 1 ? "day" : "days";
            alerts.push({
                id: `${customerId}-${GOOGLE_ADS_ALERT_TYPES.CONVERSION_TRACKING}`,
                type: GOOGLE_ADS_ALERT_TYPES.CONVERSION_TRACKING,
                severity: "critical",
                customerId,
                customerName,
                teamMemberNames,
                title: "Conversion tracking",
                message: `No conversions for ${streak} consecutive UTC ${dayLabel} (through ${tracking.streakEndDate}) while spend was active. Alert threshold: ${conversionZeroDaysThreshold} ${conversionZeroDaysThreshold === 1 ? "day" : "days"}.`,
            });
        }
    }

    return alerts;
}

/**
 * @param {object[]} rows
 * @param {object} [opts] — passed to {@link buildGoogleAdsMonitorAlerts}
 * @param {(row: object) => string[]} [opts.getTeamMemberNames]
 * @returns {object[]}
 */
export function collectGoogleAdsMonitorAlerts(rows, opts = {}) {
    const { getTeamMemberNames, ...alertOpts } = opts;
    const out = [];
    for (const row of rows || []) {
        const teamMemberNames = getTeamMemberNames ? getTeamMemberNames(row) : [];
        out.push(...buildGoogleAdsMonitorAlerts(row, { ...alertOpts, teamMemberNames }));
    }
    return out.sort((a, b) => {
        const sev = { critical: 0, warning: 1, info: 2 };
        const sa = sev[a.severity] ?? 9;
        const sb = sev[b.severity] ?? 9;
        if (sa !== sb) return sa - sb;
        return String(a.customerName).localeCompare(String(b.customerName));
    });
}
