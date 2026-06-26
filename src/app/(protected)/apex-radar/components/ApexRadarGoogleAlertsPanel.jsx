"use client";

import React from "react";
import { FiAlertCircle, FiAlertTriangle, FiBell } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { GOOGLE_ADS_ALERT_TYPES } from "@/lib/apexRadarGoogleAdsMonitor";

const TYPE_LABELS = {
    [GOOGLE_ADS_ALERT_TYPES.SPEND_DOD]: "Spend DoD",
    [GOOGLE_ADS_ALERT_TYPES.SPEND_STOPPED]: "Spend stopped",
    [GOOGLE_ADS_ALERT_TYPES.CONVERSION_TRACKING]: "Tracking",
};

function AlertIcon({ severity, type }) {
    if (severity === "critical" || type === GOOGLE_ADS_ALERT_TYPES.CONVERSION_TRACKING) {
        return <FiAlertCircle className="h-4 w-4" aria-hidden />;
    }
    return <FiAlertTriangle className="h-4 w-4" aria-hidden />;
}

export default function ApexRadarGoogleAlertsPanel({ alerts = [], loading = false }) {
    const count = alerts.length;

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
                            Preview of Google Ads monitor alerts for the filtered accounts below. These will feed
                            Slack notifications later.
                        </p>
                    </div>
                </div>
                <span
                    className={`apex-radar-alerts-panel__count${count ? " has-alerts" : ""}`}
                    aria-label={`${count} active warning${count === 1 ? "" : "s"}`}
                >
                    {count}
                </span>
            </div>

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
                            <div
                                className="apex-radar-alerts-item__icon"
                                aria-hidden
                            >
                                <AlertIcon severity={alert.severity} type={alert.type} />
                            </div>
                            <div className="apex-radar-alerts-item__main min-w-0">
                                <div className="apex-radar-alerts-item__meta">
                                    <span className="apex-radar-alerts-item__customer" title={alert.customerName}>
                                        {alert.customerName}
                                    </span>
                                    <span className="apex-radar-alerts-item__type">
                                        {TYPE_LABELS[alert.type] || alert.title}
                                    </span>
                                </div>
                                <p className="apex-radar-alerts-item__title">{alert.title}</p>
                                <p className="apex-radar-alerts-item__message">{alert.message}</p>
                            </div>
                            <div className="apex-radar-alerts-item__team">
                                <span className="apex-radar-alerts-item__team-label">Team</span>
                                <span className="apex-radar-alerts-item__team-names" title={
                                    alert.teamMemberNames?.length
                                        ? alert.teamMemberNames.join(", ")
                                        : undefined
                                }>
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
