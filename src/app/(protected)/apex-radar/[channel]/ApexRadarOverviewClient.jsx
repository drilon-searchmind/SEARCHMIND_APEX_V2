"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiInfo, FiRefreshCw, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { getApexRadarLast30DaysRange } from "@/lib/apexRadarDateRange";
import ApexRadarOverviewTable from "../components/ApexRadarOverviewTable";
import ApexRadarAssignUsersModal from "../components/ApexRadarAssignUsersModal";
import ApexRadarFacebookSettingsModal from "../components/ApexRadarFacebookSettingsModal";
import ApexRadarGoogleSettingsModal from "../components/ApexRadarGoogleSettingsModal";
import ApexRadarCustomerTeamResyncModal from "../components/ApexRadarCustomerTeamResyncModal";
import ApexRadarOverviewMetricsInfoModal from "../components/ApexRadarOverviewMetricsInfoModal";
import { buildCustomerOverviewRow } from "../lib/mockOverviewData";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
} from "@/lib/apexRadarChannels";
import { useCustomers } from "@/hooks/useCustomers";
import { useInternalUsers } from "@/hooks/useInternalUsers";
import { useApexRadarAssignments } from "../hooks/useApexRadarAssignments";
import { getEffectiveApexRadarAssignmentUserIds } from "@/lib/apexRadarPaidSocialAssignments";
import {
    APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD,
    meetsSpendDodThreshold,
} from "@/lib/apexRadarFacebookOverview";

function normName(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

export default function ApexRadarOverviewClient({ channel, customerId = null }) {
    const { customers, loading: customersLoading, fetchCustomers } = useCustomers();
    const { internalUsers, loading: internalUsersLoading } = useInternalUsers();
    const meta = APEX_RADAR_CHANNEL_META[channel];
    const isGoogleAds = channel === APEX_RADAR_CHANNEL_GOOGLE_ADS;
    const supportsOverviewTable =
        channel === APEX_RADAR_CHANNEL_FACEBOOK || channel === APEX_RADAR_CHANNEL_GOOGLE_ADS;

    const customer = useMemo(
        () => (customerId ? customers.find((c) => String(c._id) === String(customerId)) : null),
        [customers, customerId]
    );

    const appliedDateRange = useMemo(() => getApexRadarLast30DaysRange(), []);

    const [userFilter, setUserFilter] = useState("all");
    const [assignModalRow, setAssignModalRow] = useState(null);
    const [apexSettingsRow, setApexSettingsRow] = useState(null);
    const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
    const [metricsInfoOpen, setMetricsInfoOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const [resyncTeamOpen, setResyncTeamOpen] = useState(false);
    const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
    /** Client-only DoD % threshold (session only; default matches server). */
    const [spendDodThresholdDraft, setSpendDodThresholdDraft] = useState("-90");
    const [dodVisibilityFilter, setDodVisibilityFilter] = useState("all");

    const { assignmentDetailMap, assignmentsLoading, setAssignmentsForAccount, refetchAssignments } =
        useApexRadarAssignments(channel);

    const customersById = useMemo(() => {
        const m = {};
        for (const c of customers || []) {
            m[String(c._id)] = c;
        }
        return m;
    }, [customers]);

    const [overviewRows, setOverviewRows] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [overviewError, setOverviewError] = useState(null);

    useEffect(() => {
        if (!supportsOverviewTable || customersLoading) return undefined;

        const overviewUrl =
            channel === APEX_RADAR_CHANNEL_FACEBOOK
                ? "/api/apex-radar/facebook/overview"
                : channel === APEX_RADAR_CHANNEL_GOOGLE_ADS
                  ? "/api/apex-radar/google-ads/overview"
                  : null;

        let cancelled = false;
        (async () => {
            setOverviewLoading(true);
            setOverviewError(null);
            try {
                const params = new URLSearchParams({
                    startDate: appliedDateRange.startDate,
                    endDate: appliedDateRange.endDate,
                });
                if (customerId) params.set("customerId", String(customerId));
                const res = await fetch(`${overviewUrl}?${params.toString()}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(
                        data.error ||
                            (channel === APEX_RADAR_CHANNEL_FACEBOOK
                                ? "Failed to load Facebook overview"
                                : "Failed to load Google Ads overview")
                    );
                }
                if (!cancelled) {
                    setOverviewRows(Array.isArray(data.rows) ? data.rows : []);
                }
            } catch (e) {
                if (!cancelled) {
                    setOverviewError(e?.message || "Failed to load overview");
                    setOverviewRows(null);
                }
            } finally {
                if (!cancelled) setOverviewLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        supportsOverviewTable,
        channel,
        customersLoading,
        appliedDateRange.startDate,
        appliedDateRange.endDate,
        customerId,
        overviewRefreshKey,
    ]);

    const headingLabel = useMemo(() => {
        if (!meta) return "Portfolio";
        if (customerId && customer?.customerName) {
            return `${meta.label}, ${customer.customerName}`;
        }
        if (customerId && !customer) {
            return `${meta.label}, Property`;
        }
        return meta.label;
    }, [meta, customerId, customer]);

    const portfolioOverviewRows = useMemo(() => {
        if (!supportsOverviewTable) return [];
        if (overviewRows && overviewRows.length > 0) return overviewRows;
        return (customers || []).map((c) => buildCustomerOverviewRow(c, channel));
    }, [supportsOverviewTable, customers, overviewRows, channel]);

    const teamFilterOptions = useMemo(
        () => [{ id: "all", name: "All team members" }, ...internalUsers],
        [internalUsers]
    );

    const normalizedDodDraft = String(spendDodThresholdDraft).trim().replace(",", ".");
    let spendDodThresholdPct = APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD;
    if (
        normalizedDodDraft !== "" &&
        normalizedDodDraft !== "-" &&
        normalizedDodDraft !== "+"
    ) {
        const parsed = Number.parseFloat(normalizedDodDraft);
        if (Number.isFinite(parsed)) spendDodThresholdPct = parsed;
    }

    const filteredRows = (() => {
        if (!supportsOverviewTable) return [];

        let list =
            userFilter === "all"
                ? portfolioOverviewRows
                : portfolioOverviewRows.filter((r) => {
                      const cust = customersById[r.id];
                      const detail = assignmentDetailMap[r.id] || {
                          userIds: [],
                          paidSocialExcludedUserIds: [],
                      };
                      return getEffectiveApexRadarAssignmentUserIds(detail, cust, internalUsers, channel).includes(
                          userFilter
                      );
                  });

        if (customerId) {
            const idStr = String(customerId);
            const nameNorm = customer?.customerName ? normName(customer.customerName) : null;
            list = list.filter((r) => {
                if (r.customerId != null && String(r.customerId) === idStr) return true;
                if (nameNorm && r.entity && normName(r.entity) === nameNorm) return true;
                return false;
            });
        }

        const q = normName(customerSearch);
        if (q) {
            list = list.filter((r) => {
                const name = normName(r.entity);
                if (name.includes(q)) return true;
                const idStr = String(r.id ?? r.customerId ?? "").toLowerCase();
                if (idStr.includes(q)) return true;
                return false;
            });
        }

        if (dodVisibilityFilter === "alerts") {
            list = list.filter((r) => meetsSpendDodThreshold(r, spendDodThresholdPct));
        }

        return list;
    })();

    /** Empty table body while overview is loading (first fetch); avoids placeholder dashes under the spinner. */
    const tableRowsForDisplay = useMemo(() => {
        if (!supportsOverviewTable) return [];
        if (overviewLoading && overviewRows == null && !overviewError) return [];
        return filteredRows;
    }, [supportsOverviewTable, overviewLoading, overviewRows, overviewError, filteredRows]);

    return (
        <div id="ApexRadarOverviewPage" className="w-full max-w-[1920px] mx-auto apex-radar-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Apex Radar Overview"
                label={headingLabel}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={appliedDateRange}
                loading={customersLoading}
            />

            {supportsOverviewTable ? (
                <>
                    <div className="apex-radar-panel apex-radar-panel--padded mb-6">
                        <div className="apex-radar-toolbar">
                            <div className="apex-radar-toolbar__fields">
                                <div className="apex-radar-toolbar__field apex-radar-form">
                                    <label htmlFor="apex-radar-user" className="apex-radar-field-label">
                                        Team members
                                    </label>
                                    <select
                                        id="apex-radar-user"
                                        value={userFilter}
                                        onChange={(e) => setUserFilter(e.target.value)}
                                        disabled={internalUsersLoading || assignmentsLoading}
                                    >
                                        {teamFilterOptions.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="apex-radar-field-hint">
                                        Filter by who is assigned to each account
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-1 min-w-0">
                                    <div className="flex-1 min-w-0 apex-radar-form">
                                        <label htmlFor="apex-radar-customer-search" className="apex-radar-field-label">
                                            Search customers
                                        </label>
                                        <div className="apex-radar-search-wrap">
                                            <FiSearch className="h-4 w-4" aria-hidden />
                                            <input
                                                id="apex-radar-customer-search"
                                                type="search"
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                placeholder="Search properties…"
                                                autoComplete="off"
                                                aria-label="Search customers"
                                            />
                                        </div>
                                        <p className="apex-radar-field-hint">
                                            Search for customers by name or ID.
                                        </p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="apex-radar-field-label" id="apex-radar-resync-label">
                                            Re-sync ClickUp teams
                                        </span>
                                        <button
                                            type="button"
                                            id="apex-radar-resync-button"
                                            aria-labelledby="apex-radar-resync-label"
                                            onClick={() => setResyncTeamOpen(true)}
                                            className="apex-perf-btn apex-perf-btn--primary w-full sm:w-auto"
                                        >
                                            <FiRefreshCw className="h-4 w-4" aria-hidden />
                                            Re-sync members
                                        </button>
                                        <p className="apex-radar-field-hint">Resync ClickUp.</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMetricsInfoOpen(true)}
                                className="apex-radar-icon-btn self-start lg:self-center"
                                aria-label="How overview metrics are calculated"
                                title="How metrics are calculated"
                            >
                                <FiInfo className="h-4 w-4" aria-hidden />
                            </button>
                        </div>

                        <div className="mt-4 border-t border-[var(--color-rule)] pt-2">
                            <button
                                type="button"
                                id="apex-radar-more-settings-trigger"
                                aria-expanded={moreSettingsOpen}
                                aria-controls="apex-radar-more-settings-panel"
                                onClick={() => setMoreSettingsOpen((o) => !o)}
                                className="apex-radar-collapse-trigger"
                            >
                                <span>More settings</span>
                                <FiChevronDown
                                    className={`h-4 w-4 shrink-0 transition-transform ${moreSettingsOpen ? "rotate-180" : ""}`}
                                    aria-hidden
                                />
                            </button>
                            {moreSettingsOpen ? (
                                <div
                                    id="apex-radar-more-settings-panel"
                                    role="region"
                                    aria-labelledby="apex-radar-more-settings-trigger"
                                    className="apex-radar-collapse-panel"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                                        <div className="min-w-0 flex-1 sm:max-w-xs apex-radar-form">
                                            <label htmlFor="apex-radar-dod-threshold" className="apex-radar-field-label">
                                                DoD spend alert threshold (% change)
                                            </label>
                                            <input
                                                id="apex-radar-dod-threshold"
                                                type="text"
                                                inputMode="decimal"
                                                value={spendDodThresholdDraft}
                                                onChange={(e) => setSpendDodThresholdDraft(e.target.value)}
                                                placeholder="-90"
                                                aria-describedby="apex-radar-dod-threshold-hint"
                                            />
                                            <p id="apex-radar-dod-threshold-hint" className="apex-radar-field-hint">
                                                Highlights when day-over-day change is at or below this value
                                            </p>
                                        </div>
                                        <div className="min-w-0 shrink-0 sm:min-w-[220px]">
                                            <span className="apex-radar-field-label" id="apex-radar-dod-view-label">
                                                Spend DoD view
                                            </span>
                                            <div
                                                role="group"
                                                aria-labelledby="apex-radar-dod-view-label"
                                                className="apex-radar-segmented"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setDodVisibilityFilter("all")}
                                                    aria-pressed={dodVisibilityFilter === "all"}
                                                    className={`apex-radar-segmented__btn${dodVisibilityFilter === "all" ? " is-active" : ""}`}
                                                >
                                                    All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDodVisibilityFilter("alerts")}
                                                    aria-pressed={dodVisibilityFilter === "alerts"}
                                                    className={`apex-radar-segmented__btn${dodVisibilityFilter === "alerts" ? " is-active" : ""}`}
                                                >
                                                    Meets threshold
                                                </button>
                                            </div>
                                            <p className="apex-radar-field-hint">
                                                Show every account or only those at or below the threshold above.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {overviewError ? (
                        <div className="apex-radar-alert mb-4">
                            {overviewError} — showing placeholder rows until the overview loads.
                        </div>
                    ) : null}

                    {customersLoading ? (
                        <CobaltLoader variant="block" title="Loading customers" />
                    ) : (
                        <ApexRadarOverviewTable
                            rows={tableRowsForDisplay}
                            loading={overviewLoading}
                            assignmentDetailMap={assignmentDetailMap}
                            customersById={customersById}
                            assignableUsers={internalUsers}
                            spendDodThresholdPct={spendDodThresholdPct}
                            channel={channel}
                            onAssignClick={(row) => setAssignModalRow(row)}
                            onApexSettingsClick={(row) => setApexSettingsRow(row)}
                        />
                    )}

                    {apexSettingsRow ? (
                        isGoogleAds ? (
                            <ApexRadarGoogleSettingsModal
                                row={apexSettingsRow}
                                onClose={() => setApexSettingsRow(null)}
                                onSaved={() => {
                                    fetchCustomers();
                                    setOverviewRefreshKey((k) => k + 1);
                                }}
                            />
                        ) : (
                            <ApexRadarFacebookSettingsModal
                                row={apexSettingsRow}
                                onClose={() => setApexSettingsRow(null)}
                                onSaved={() => {
                                    fetchCustomers();
                                    setOverviewRefreshKey((k) => k + 1);
                                }}
                            />
                        )
                    ) : null}

                    {assignModalRow ? (
                        <ApexRadarAssignUsersModal
                            key={`assign-${channel}-${assignModalRow.id}_${(assignmentDetailMap[assignModalRow.id]?.userIds || []).join("-")}_${(assignmentDetailMap[assignModalRow.id]?.paidSocialExcludedUserIds || []).join("-")}_${internalUsers.length}`}
                            row={assignModalRow}
                            customer={customersById[assignModalRow.id]}
                            assignment={
                                assignmentDetailMap[assignModalRow.id] || {
                                    userIds: [],
                                    paidSocialExcludedUserIds: [],
                                }
                            }
                            assignableUsers={internalUsers}
                            channel={channel}
                            onSave={(accountKey, detail) =>
                                setAssignmentsForAccount(accountKey, detail)
                            }
                            onClose={() => setAssignModalRow(null)}
                        />
                    ) : null}

                    <ApexRadarCustomerTeamResyncModal
                        open={resyncTeamOpen}
                        onClose={() => setResyncTeamOpen(false)}
                        customers={customers}
                        onSynced={async () => {
                            fetchCustomers();
                            try {
                                await refetchAssignments();
                            } catch (e) {
                                console.error("refetchAssignments:", e);
                            }
                            setOverviewRefreshKey((k) => k + 1);
                        }}
                    />

                    {metricsInfoOpen ? (
                        <ApexRadarOverviewMetricsInfoModal onClose={() => setMetricsInfoOpen(false)} />
                    ) : null}
                </>
            ) : (
                <div className="apex-radar-empty apex-radar-empty-panel">
                    <h2 className="apex-radar-section__title">Apex Radar</h2>
                    <p className="apex-radar-section__subtitle mt-2 max-w-md mx-auto">
                        This channel is not available. Open Facebook (PS) or Google Ads from the Apex Radar menu.
                    </p>
                </div>
            )}
        </div>
    );
}
