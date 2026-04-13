"use client";

import React, { useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import ApexRadarOverviewTable from "../components/ApexRadarOverviewTable";
import ApexRadarAssignUsersModal from "../components/ApexRadarAssignUsersModal";
import { MOCK_INTERNAL_USERS, MOCK_OVERVIEW_ROWS } from "../lib/mockOverviewData";
import { APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_META } from "@/lib/apexRadarChannels";
import { useCustomers } from "@/hooks/useCustomers";
import { useApexRadarAssignments } from "../hooks/useApexRadarAssignments";

function normName(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

export default function ApexRadarOverviewClient({ channel, customerId = null }) {
    const { customers } = useCustomers();
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

    const { assignmentMap, setAssignmentsForAccount } = useApexRadarAssignments(channel);

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

    const filteredRows = useMemo(() => {
        let list =
            userFilter === "all"
                ? MOCK_OVERVIEW_ROWS
                : MOCK_OVERVIEW_ROWS.filter((r) => (assignmentMap[r.id] || []).includes(userFilter));

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
    }, [userFilter, customerId, customer, assignmentMap]);

    return (
        <div id="ApexRadarOverviewPage" className="w-full max-w-[1920px] mx-auto">
            <DashboardHeading
                title="Apex Radar Overview"
                label={headingLabel}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={appliedDateRange}
                loading={false}
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
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
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
                                    className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                                >
                                    {MOCK_INTERNAL_USERS.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                                                               <p className="text-[0.7rem] text-gray-400 mt-1.5">
                                    Filter by who is assigned to each account (use + under Team members). Assignments
                                    are stored in this browser only until the API is wired.
                                </p>
                            </div>
                        </div>
                    </div>

                    <ApexRadarOverviewTable
                        rows={filteredRows}
                        assignmentMap={assignmentMap}
                        onAssignClick={(row) => setAssignModalRow(row)}
                    />

                    {assignModalRow ? (
                        <ApexRadarAssignUsersModal
                            row={assignModalRow}
                            selectedIds={assignmentMap[assignModalRow.id] || []}
                            onSave={(accountKey, userIds) => setAssignmentsForAccount(accountKey, userIds)}
                            onClose={() => setAssignModalRow(null)}
                        />
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
