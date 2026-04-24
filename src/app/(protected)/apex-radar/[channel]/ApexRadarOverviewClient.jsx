"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiInfo } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import ApexRadarOverviewTable from "../components/ApexRadarOverviewTable";
import ApexRadarAssignUsersModal from "../components/ApexRadarAssignUsersModal";
import ApexRadarFacebookSettingsModal from "../components/ApexRadarFacebookSettingsModal";
import ApexRadarOverviewMetricsInfoModal from "../components/ApexRadarOverviewMetricsInfoModal";
import { buildCustomerOverviewRow } from "../lib/mockOverviewData";
import { APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_META } from "@/lib/apexRadarChannels";
import { useCustomers } from "@/hooks/useCustomers";
import { useInternalUsers } from "@/hooks/useInternalUsers";
import { useApexRadarAssignments } from "../hooks/useApexRadarAssignments";

function normName(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

export default function ApexRadarOverviewClient({ channel, customerId = null }) {
    const { customers, loading: customersLoading, fetchCustomers } = useCustomers();
    const { internalUsers, loading: internalUsersLoading } = useInternalUsers();
    const meta = APEX_RADAR_CHANNEL_META[channel];
    const isFacebook = channel === APEX_RADAR_CHANNEL_FACEBOOK;

    const customer = useMemo(
        () => (customerId ? customers.find((c) => String(c._id) === String(customerId)) : null),
        [customers, customerId]
    );

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;

    const [tempDateRange, setTempDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [appliedDateRange, setAppliedDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });

    const [userFilter, setUserFilter] = useState("all");
    const [assignModalRow, setAssignModalRow] = useState(null);
    const [apexSettingsRow, setApexSettingsRow] = useState(null);
    const [fbOverviewRefreshKey, setFbOverviewRefreshKey] = useState(0);
    const [metricsInfoOpen, setMetricsInfoOpen] = useState(false);

    const { assignmentMap, assignmentsLoading, setAssignmentsForAccount } = useApexRadarAssignments(channel);

    const [fbRows, setFbRows] = useState(null);
    const [fbLoading, setFbLoading] = useState(false);
    const [fbError, setFbError] = useState(null);

    useEffect(() => {
        if (!isFacebook || customersLoading) return undefined;

        let cancelled = false;
        (async () => {
            setFbLoading(true);
            setFbError(null);
            try {
                const params = new URLSearchParams({
                    startDate: appliedDateRange.startDate,
                    endDate: appliedDateRange.endDate,
                });
                if (customerId) params.set("customerId", String(customerId));
                const res = await fetch(`/api/apex-radar/facebook/overview?${params.toString()}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load Facebook overview");
                }
                if (!cancelled) {
                    setFbRows(Array.isArray(data.rows) ? data.rows : []);
                }
            } catch (e) {
                if (!cancelled) {
                    setFbError(e?.message || "Failed to load Facebook overview");
                    setFbRows(null);
                }
            } finally {
                if (!cancelled) setFbLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        isFacebook,
        customersLoading,
        appliedDateRange.startDate,
        appliedDateRange.endDate,
        customerId,
        fbOverviewRefreshKey,
    ]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedDateRange({ startDate, endDate });
    };

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

    const facebookOverviewRows = useMemo(() => {
        if (!isFacebook) return [];
        if (fbRows && fbRows.length > 0) return fbRows;
        return (customers || []).map((c) => buildCustomerOverviewRow(c));
    }, [isFacebook, customers, fbRows]);

    const teamFilterOptions = useMemo(
        () => [{ id: "all", name: "All team members" }, ...internalUsers],
        [internalUsers]
    );

    const filteredRows = useMemo(() => {
        if (!isFacebook) return [];

        let list =
            userFilter === "all"
                ? facebookOverviewRows
                : facebookOverviewRows.filter((r) => (assignmentMap[r.id] || []).includes(userFilter));

        if (customerId) {
            const idStr = String(customerId);
            const nameNorm = customer?.customerName ? normName(customer.customerName) : null;
            list = list.filter((r) => {
                if (r.customerId != null && String(r.customerId) === idStr) return true;
                if (nameNorm && r.entity && normName(r.entity) === nameNorm) return true;
                return false;
            });
        }

        return list;
    }, [isFacebook, userFilter, customerId, customer, assignmentMap, facebookOverviewRows]);

    /** Empty body while Meta overview is loading (first fetch); avoids placeholder dashes under the spinner. */
    const tableRowsForDisplay = useMemo(() => {
        if (!isFacebook) return [];
        if (fbLoading && fbRows == null && !fbError) return [];
        return filteredRows;
    }, [isFacebook, fbLoading, fbRows, fbError, filteredRows]);

    return (
        <div id="ApexRadarOverviewPage" className="w-full max-w-[1920px] mx-auto">
            <DashboardHeading
                title="Apex Radar Overview"
                label={headingLabel}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={appliedDateRange}
                loading={customersLoading}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={(v) => setTempDateRange((d) => ({ ...d, startDate: v }))}
                        onEndDateChange={(v) => setTempDateRange((d) => ({ ...d, endDate: v }))}
                    />
                }
            />

            {isFacebook ? (
                <>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <label
                                    htmlFor="apex-radar-user"
                                    className="block text-xs font-semibold text-gray-500 mb-1.5"
                                >
                                    Team members
                                </label>
                                <select
                                    id="apex-radar-user"
                                    value={userFilter}
                                    onChange={(e) => setUserFilter(e.target.value)}
                                    disabled={internalUsersLoading || assignmentsLoading}
                                    className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] disabled:opacity-60"
                                >
                                    {teamFilterOptions.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[0.7rem] text-gray-400 mt-1.5">
                                    Filter by who is assigned to each account (use + under Team members).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMetricsInfoOpen(true)}
                                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-[var(--color-primary-searchmind)] hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)]"
                                aria-label="How overview metrics are calculated"
                                title="How metrics are calculated"
                            >
                                <FiInfo className="h-4 w-4" aria-hidden />
                            </button>
                        </div>
                    </div>

                    {fbError ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
                            {fbError} — showing placeholder rows until the overview loads.
                        </div>
                    ) : null}

                    {customersLoading ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                            Loading customers…
                        </div>
                    ) : (
                        <ApexRadarOverviewTable
                            rows={tableRowsForDisplay}
                            loading={fbLoading}
                            assignmentMap={assignmentMap}
                            assignableUsers={internalUsers}
                            onAssignClick={(row) => setAssignModalRow(row)}
                            onApexSettingsClick={(row) => setApexSettingsRow(row)}
                        />
                    )}

                    {apexSettingsRow ? (
                        <ApexRadarFacebookSettingsModal
                            row={apexSettingsRow}
                            onClose={() => setApexSettingsRow(null)}
                            onSaved={() => {
                                fetchCustomers();
                                setFbOverviewRefreshKey((k) => k + 1);
                            }}
                        />
                    ) : null}

                    {assignModalRow ? (
                        <ApexRadarAssignUsersModal
                            row={assignModalRow}
                            selectedIds={assignmentMap[assignModalRow.id] || []}
                            assignableUsers={internalUsers}
                            onSave={(accountKey, userIds) => setAssignmentsForAccount(accountKey, userIds)}
                            onClose={() => setAssignModalRow(null)}
                        />
                    ) : null}

                    {metricsInfoOpen ? (
                        <ApexRadarOverviewMetricsInfoModal onClose={() => setMetricsInfoOpen(false)} />
                    ) : null}
                </>
            ) : (
                <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                    <h2 className="text-lg font-semibold text-gray-900">Google Ads overview</h2>
                    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                        This view is not wired up yet. The table, filters, and metrics will mirror the Facebook (PS)
                        overview once Google Ads data is available.
                        {customer?.customerName ? (
                            <span className="block mt-2 font-medium text-gray-700">{customer.customerName}</span>
                        ) : null}
                    </p>
                </div>
            )}
        </div>
    );
}
