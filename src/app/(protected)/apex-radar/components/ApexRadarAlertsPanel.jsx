"use client";

import React, { useCallback, useState } from "react";
import { FiAlertCircle, FiAlertTriangle, FiBell, FiSend, FiUsers } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { APEX_RADAR_ALERT_TYPE_LABELS, APEX_RADAR_MONITOR_ALERT_TYPES } from "@/lib/apexRadarMonitorAlerts";
import {
    APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL,
    getApexRadarSlackWarningsChannelForDisplay,
} from "@/lib/apexRadarChannels";

function AlertIcon({ severity, type }) {
    if (severity === "critical" || type === APEX_RADAR_MONITOR_ALERT_TYPES.CONVERSION_TRACKING) {
        return <FiAlertCircle className="h-4 w-4" aria-hidden />;
    }
    return <FiAlertTriangle className="h-4 w-4" aria-hidden />;
}

export default function ApexRadarAlertsPanel({
    alerts = [],
    loading = false,
    platformLabel = "Apex Radar",
    channel,
    slackChannelName = getApexRadarSlackWarningsChannelForDisplay(channel),
}) {
    const count = alerts.length;
    const slackChannelLabel = `#${String(slackChannelName || APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL).replace(/^#/, "")}`;
    const [slackSending, setSlackSending] = useState(false);
    const [slackFeedback, setSlackFeedback] = useState(null);

    const handleSendDm = useCallback(async () => {
        setSlackSending(true);
        setSlackFeedback(null);
        try {
            const res = await fetch("/api/apex-radar/slack/active-warnings/dm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alerts, platformLabel, channel }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Failed to send Slack DMs");
            }

            const parts = [];
            if (data.dmSentCount) {
                parts.push(`DM sent to ${data.dmSentCount} user${data.dmSentCount === 1 ? "" : "s"}`);
            }
            if (data.skipped?.length) {
                parts.push(`${data.skipped.length} skipped`);
            }
            if (data.unassignedAlertCount) {
                parts.push(`${data.unassignedAlertCount} unassigned`);
            }
            const channelLabel = data.channelName ? `#${data.channelName}` : slackChannelLabel;
            parts.push(`summary posted to ${channelLabel}`);

            setSlackFeedback({
                type: "success",
                message: parts.join(" · ") || "DM delivery complete.",
            });
        } catch (err) {
            setSlackFeedback({
                type: "error",
                message: err?.message || "Could not send Slack DMs.",
            });
        } finally {
            setSlackSending(false);
        }
    }, [alerts, platformLabel, channel, slackChannelLabel]);

    return (
        <section
            className="apex-radar-panel apex-radar-alerts-panel"
            aria-labelledby="apex-radar-alerts-heading"
        >
            <div className="apex-radar-alerts-panel__head">
                <div className="flex items-center gap-2 min-w-0">
                    <FiBell className="h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
                    <div className="min-w-0">
                        <h2 id="apex-radar-alerts-heading" className="apex-radar-section__title">
                            Active warnings
                        </h2>
                        <p className="apex-radar-section__subtitle">
                            {platformLabel} monitor alerts for the filtered accounts below.{" "}
                            <span className="font-medium text-[var(--color-ink-2)]">DM Users</span> sends
                            warnings to assignees and posts a delivery summary to{" "}
                            <span className="font-medium text-[var(--color-ink-2)]">{slackChannelLabel}</span>.
                        </p>
                    </div>
                </div>
                <div className="apex-radar-alerts-panel__actions">
                    <button
                        type="button"
                        className="apex-radar-alerts-panel__slack-btn"
                        onClick={handleSendDm}
                        disabled={loading || slackSending}
                        title="Send warnings as DMs to assigned team members and post delivery summary to Slack"
                    >
                        {slackSending ? (
                            <FiSend className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                        ) : (
                            <FiUsers className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {slackSending ? "Sending…" : "DM Users"}
                    </button>
                    <span
                        className={`apex-radar-alerts-panel__count${count ? " has-alerts" : ""}`}
                        aria-label={`${count} active warning${count === 1 ? "" : "s"}`}
                    >
                        {count}
                    </span>
                </div>
            </div>

            {slackFeedback ? (
                <div
                    className={`apex-radar-alerts-panel__feedback is-${slackFeedback.type}`}
                    role="status"
                >
                    {slackFeedback.message}
                </div>
            ) : null}

            {loading ? (
                <div className="apex-radar-alerts-panel__body">
                    <CobaltLoader variant="inline" title="Checking for warnings" />
                </div>
            ) : count === 0 ? (
                <div className="apex-radar-alerts-panel__empty">
                    No active warnings for the current filters.
                </div>
            ) : (
                <ul className="apex-radar-alerts-list">
                    {alerts.map((alert) => (
                        <li
                            key={alert.id}
                            className={`apex-radar-alerts-item is-${alert.severity || "warning"}`}
                        >
                            <div className="apex-radar-alerts-item__icon" aria-hidden>
                                <AlertIcon severity={alert.severity} type={alert.type} />
                            </div>
                            <div className="apex-radar-alerts-item__main min-w-0">
                                <div className="apex-radar-alerts-item__meta">
                                    <span className="apex-radar-alerts-item__customer" title={alert.customerName}>
                                        {alert.customerName}
                                    </span>
                                    <span className="apex-radar-alerts-item__type">
                                        {APEX_RADAR_ALERT_TYPE_LABELS[alert.type] || alert.title}
                                    </span>
                                </div>
                                <p className="apex-radar-alerts-item__title">{alert.title}</p>
                                <p className="apex-radar-alerts-item__message">{alert.message}</p>
                            </div>
                            <div className="apex-radar-alerts-item__team">
                                <span className="apex-radar-alerts-item__team-label">Team</span>
                                <span
                                    className="apex-radar-alerts-item__team-names"
                                    title={
                                        alert.teamMemberNames?.length
                                            ? alert.teamMemberNames.join(", ")
                                            : undefined
                                    }
                                >
                                    {alert.teamMemberNames?.length
                                        ? alert.teamMemberNames.join(", ")
                                        : "—"}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
