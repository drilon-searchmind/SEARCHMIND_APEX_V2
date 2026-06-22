"use client";

import React from "react";
import Link from "next/link";
import { FiAlertCircle, FiAlertTriangle, FiSettings } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { formatApexRadarTeamAssignmentLabel } from "@/lib/apexRadarTeamAssignmentsFormat";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    apexRadarPerformanceInvestigatorHref,
} from "@/lib/apexRadarChannels";
import {
    APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD,
    meetsSpendDodThreshold,
} from "@/lib/apexRadarFacebookOverview";

const COL_COUNT = 24;

function fmtInt(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function fmtDecimal(n, digits = 2) {
    if (n == null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(n);
}

function fmtPct(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return `${fmtDecimal(n, 2)}%`;
}

function Cell({ children, warn, className = "" }) {
    return (
        <td className={`td-num${warn ? " td-warn" : ""}${className ? ` ${className}` : ""}`}>
            {children}
        </td>
    );
}

function TableHead() {
    return (
        <thead>
            <tr>
                <th rowSpan={2} className="is-sticky-left text-left td-entity">
                    Account
                </th>
                <th rowSpan={2} className="is-sticky-left-2 text-left">
                    Team members
                </th>
                <th colSpan={5} className="th-group">
                    Value
                </th>
                <th colSpan={4} className="th-group">
                    Targets
                </th>
                <th colSpan={5} className="th-group">
                    Budget
                </th>
                <th colSpan={5} className="th-group">
                    Ad performance
                </th>
                <th colSpan={3} className="th-group">
                    Spend day-over-day
                </th>
            </tr>
            <tr>
                <th className="th-sub">Conv. (2d)</th>
                <th className="th-sub">Value (7d)</th>
                <th className="th-sub">Min. value (7d)</th>
                <th className="th-sub">Value (30d)</th>
                <th className="th-sub">Min. value (30d)</th>
                <th className="th-sub">Type</th>
                <th className="th-sub">Target</th>
                <th className="th-sub">Actual (7d)</th>
                <th className="th-sub">Actual (30d)</th>
                <th className="th-sub">Target</th>
                <th className="th-sub">Spend</th>
                <th className="th-sub">Spend (range end)</th>
                <th className="th-sub">Pace</th>
                <th className="th-sub">Type</th>
                <th className="th-sub"># Fatigue</th>
                <th className="th-sub">CTR (7d)</th>
                <th className="th-sub">CTR (30d)</th>
                <th className="th-sub">Freq (7d)</th>
                <th className="th-sub">Freq (30d)</th>
                <th className="th-sub">Spend (yest. UTC)</th>
                <th className="th-sub">Spend (prior UTC)</th>
                <th className="th-sub">DoD change %</th>
            </tr>
        </thead>
    );
}

export default function ApexRadarOverviewTable({
    rows,
    assignmentDetailMap = {},
    customersById = {},
    onAssignClick,
    onApexSettingsClick,
    assignableUsers = [],
    loading = false,
    spendDodThresholdPct = APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD,
    channel = null,
}) {
    const showSpinnerOnly = loading && (!rows || rows.length === 0);
    const showOverlay = loading && rows && rows.length > 0;
    const loadingLabel =
        channel === APEX_RADAR_CHANNEL_FACEBOOK
            ? "Meta"
            : channel === APEX_RADAR_CHANNEL_GOOGLE_ADS
              ? "Google Ads"
              : "Apex Radar";

    if (!loading && !rows?.length) {
        return (
            <div className="apex-radar-empty apex-radar-empty-panel">
                No rows match your filters.
            </div>
        );
    }

    return (
        <div className="relative apex-radar-table-wrap">
            <div className="overflow-x-auto">
                <table className="apex-radar-table min-w-[1200px]">
                    <TableHead />
                    <tbody>
                        {showSpinnerOnly ? (
                            <tr>
                                <td colSpan={COL_COUNT} className="p-0">
                                    <CobaltLoader variant="block" title={`Loading ${loadingLabel} metrics`} />
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => {
                                const a = row.alerts || {};
                                const detail = assignmentDetailMap[row.id] || {
                                    userIds: [],
                                    paidSocialExcludedUserIds: [],
                                };
                                const cust = customersById[row.id] || null;
                                const teamLabel = formatApexRadarTeamAssignmentLabel(
                                    detail,
                                    cust,
                                    assignableUsers,
                                    channel
                                );
                                const platformError =
                                    channel === APEX_RADAR_CHANNEL_GOOGLE_ADS
                                        ? row.apexRadarMeta?.googleError
                                        : row.apexRadarMeta?.facebookError;
                                const valueIsConversions = row.targets?.targetType === "CPA";
                                const fmtValueMetric = (n) =>
                                    valueIsConversions ? fmtInt(n) : fmtMoney(n);
                                const dod = row.spendDayOverDay || {};
                                const dodWarn = meetsSpendDodThreshold(row, spendDodThresholdPct);
                                const dodTitle =
                                    dodWarn &&
                                    dod.calendarYesterday &&
                                    dod.calendarDayBeforeYesterday &&
                                    dod.pctChangeFromPrior != null
                                        ? `${fmtDecimal(dod.pctChangeFromPrior, 1)}% vs prior UTC day (${dod.calendarDayBeforeYesterday} → ${dod.calendarYesterday}); change is at or below alert threshold (${fmtDecimal(spendDodThresholdPct, 1)}%).`
                                        : undefined;
                                const piHref =
                                    channel === APEX_RADAR_CHANNEL_FACEBOOK ||
                                    channel === APEX_RADAR_CHANNEL_GOOGLE_ADS
                                        ? apexRadarPerformanceInvestigatorHref(channel, row.id)
                                        : null;

                                return (
                                    <tr key={row.id}>
                                        <td
                                            className="is-sticky-left td-entity"
                                            title={row.entity}
                                        >
                                            <div className="flex items-center gap-1 min-w-0">
                                                {platformError ? (
                                                    <span
                                                        className="shrink-0 text-amber-600"
                                                        title={platformError}
                                                        aria-label={`Data source error: ${platformError}`}
                                                    >
                                                        <FiAlertCircle className="h-3.5 w-3.5" aria-hidden />
                                                    </span>
                                                ) : dodWarn ? (
                                                    <span
                                                        className="shrink-0 text-[var(--color-error,oklch(50%_0.15_25))]"
                                                        title={dodTitle}
                                                        aria-label={`Spend day-over-day change is at or below ${fmtDecimal(spendDodThresholdPct, 1)} percent versus the prior UTC calendar day`}
                                                    >
                                                        <FiAlertTriangle className="h-3.5 w-3.5" aria-hidden />
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 w-3.5" aria-hidden />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => onApexSettingsClick?.(row)}
                                                    className="apex-radar-settings-btn"
                                                    aria-label={`Apex Radar settings for ${row.entity}`}
                                                >
                                                    <FiSettings className="h-3.5 w-3.5" aria-hidden />
                                                </button>
                                                {piHref ? (
                                                    <Link
                                                        href={piHref}
                                                        className="apex-radar-link min-w-0 truncate"
                                                        title={`Open Performance Investigator — ${row.entity}`}
                                                        prefetch={false}
                                                    >
                                                        {row.entity}
                                                    </Link>
                                                ) : (
                                                    <span className="truncate">{row.entity}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td
                                            className="is-sticky-left-2 td-team"
                                            title={teamLabel === "—" ? undefined : teamLabel}
                                        >
                                            <div className="flex flex-row gap-1.5 items-start justify-between">
                                                <span className="line-clamp-2 leading-snug">{teamLabel}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onAssignClick?.(row)}
                                                    aria-label={`Assign team members for ${row.entity}`}
                                                    className="apex-radar-assign-btn"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </td>
                                        <Cell>{fmtInt(row.value?.conversions2d)}</Cell>
                                        <Cell warn={a.value7dBelowMin}>
                                            {fmtValueMetric(row.value?.value7d)}
                                        </Cell>
                                        <Cell>{fmtValueMetric(row.value?.minExpectedValue7d)}</Cell>
                                        <Cell warn={a.value30dBelowMin}>
                                            {fmtValueMetric(row.value?.value30d)}
                                        </Cell>
                                        <Cell>{fmtValueMetric(row.value?.minExpectedValue30d)}</Cell>
                                        <Cell>{row.targets?.targetType}</Cell>
                                        <Cell>{fmtDecimal(row.targets?.target, 2)}</Cell>
                                        <Cell warn={a.target7dMiss}>
                                            {fmtDecimal(row.targets?.actual7d, 2)}
                                        </Cell>
                                        <Cell warn={a.target30dMiss}>
                                            {fmtDecimal(row.targets?.actual30d, 2)}
                                        </Cell>
                                        <Cell>{fmtMoney(row.budget?.targetBudget)}</Cell>
                                        <Cell>{fmtMoney(row.budget?.realizedBudget)}</Cell>
                                        <Cell>{fmtMoney(row.budget?.spendYesterday)}</Cell>
                                        <Cell warn={a.budgetPaceOff}>
                                            {fmtDecimal(row.budget?.budgetPace, 2)}
                                        </Cell>
                                        <Cell>{row.budget?.budgetType}</Cell>
                                        <Cell warn={a.highAdFatigue}>{fmtInt(row.ads?.adFatigue)}</Cell>
                                        <Cell>{fmtPct(row.ads?.ctr7d)}</Cell>
                                        <Cell>{fmtPct(row.ads?.ctr30d)}</Cell>
                                        <Cell>{fmtDecimal(row.ads?.freq7d, 2)}</Cell>
                                        <Cell>{fmtDecimal(row.ads?.freq30d, 2)}</Cell>
                                        <Cell warn={dodWarn}>{fmtMoney(dod.spendYesterday)}</Cell>
                                        <Cell warn={dodWarn}>{fmtMoney(dod.spendDayBeforeYesterday)}</Cell>
                                        <Cell warn={dodWarn}>
                                            {(() => {
                                                const p = dod.pctChangeFromPrior;
                                                if (p == null || !Number.isFinite(p)) return "—";
                                                const sign = p > 0 ? "+" : "";
                                                return `${sign}${fmtDecimal(p, 1)}%`;
                                            })()}
                                        </Cell>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {showOverlay ? (
                <div className="apex-radar-table-overlay" role="status" aria-live="polite" aria-busy="true">
                    <CobaltLoader variant="inline" title="Updating metrics" />
                </div>
            ) : null}
        </div>
    );
}
