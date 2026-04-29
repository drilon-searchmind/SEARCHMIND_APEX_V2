"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiInfo, FiRefreshCw, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import ApexRadarOverviewTable from "../components/ApexRadarOverviewTable";
import ApexRadarAssignUsersModal from "../components/ApexRadarAssignUsersModal";
import ApexRadarFacebookSettingsModal from "../components/ApexRadarFacebookSettingsModal";
import ApexRadarCustomerTeamResyncModal from "../components/ApexRadarCustomerTeamResyncModal";
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
    const [customerSearch, setCustomerSearch] = useState("");
    const [resyncTeamOpen, setResyncTeamOpen] = useState(false);

    const { assignmentDetailMap, assignmentsLoading, setAssignmentsForAccount } = useApexRadarAssignments(channel);

    const customersById = useMemo(() => {
        const m = {};
        for (const c of customers || []) {
            m[String(c._id)] = c;
        }
        return m;
    }, [customers]);

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
                : facebookOverviewRows.filter((r) =>
                    (assignmentDetailMap[r.id]?.userIds || []).includes(userFilter)
                );

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

        return list;
    }, [isFacebook, userFilter, customerId, customer, assignmentDetailMap, facebookOverviewRows, customerSearch]);

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
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end gap-4">
                                <div className="flex-1 min-w-0 max-w-md">
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
                                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] disabled:opacity-60"
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
                                <div className="w-full sm:flex-1 sm:min-w-[200px] sm:max-w-md flex flex-col sm:flex-row gap-3 sm:items-end">
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <label
                                            htmlFor="apex-radar-customer-search"
                                            className="block text-xs font-semibold text-gray-500 mb-1.5"
                                        >
                                            Search customers
                                        </label>
                                        <div className="relative">
                                            <FiSearch
                                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                                aria-hidden
                                            />
                                            <input
                                                id="apex-radar-customer-search"
                                                type="search"
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                placeholder="Search properties…"
                                                autoComplete="off"
                                                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--color-primary-searchmind-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]/30"
                                                aria-label="Search customers"
                                            />
                                        </div>
                                        <p className="text-[0.7rem] text-gray-400 mt-1.5">
                                            Search for customers by name or ID.
                                        </p>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <label
                                            htmlFor="apex-radar-customer-search"
                                            className="block text-xs font-semibold text-gray-500 mb-1.5"
                                        >
                                            Resync users
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setResyncTeamOpen(true)}
                                            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800  hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] bg-[var(--color-primary-searchmind)] text-white"
                                        >
                                            <FiRefreshCw className="h-4 w-4 text-white" aria-hidden />
                                            Re-sync members
                                        </button>
                                        <p className="text-[0.7rem] text-gray-400 mt-1.5">
                                            Re-sync the users assigned to each account.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMetricsInfoOpen(true)}
                                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-[var(--color-primary-searchmind)] hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] self-start lg:self-center"
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
                            assignmentDetailMap={assignmentDetailMap}
                            customersById={customersById}
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
                            key={assignModalRow.id}
                            row={assignModalRow}
                            customer={customersById[assignModalRow.id]}
                            assignment={
                                assignmentDetailMap[assignModalRow.id] || {
                                    userIds: [],
                                    excludedClickUpMemberIds: [],
                                }
                            }
                            assignableUsers={internalUsers}
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
                            setFbOverviewRefreshKey((k) => k + 1);
                        }}
                    />

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
