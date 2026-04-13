"use client";

import React from "react";
import { formatAssignedUsersList } from "../lib/mockOverviewData";

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

const thGroup = "px-2 py-2 text-center text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200";
const thSub = "px-2 py-2 text-left text-[0.65rem] font-semibold text-gray-600 bg-gray-50 border border-gray-200 whitespace-nowrap max-w-[140px]";
const tdBase = "px-2 py-2 text-xs text-gray-900 border border-gray-100 tabular-nums";
const tdEntity =
    "px-3 py-2 text-xs font-medium text-gray-900 border border-gray-100 bg-gray-50/80 sticky left-0 z-30 min-w-[200px] max-w-[240px]";
const tdTeamMember =
    "px-3 py-2 text-xs text-gray-800 border border-gray-100 bg-gray-50/80 sticky z-20 left-[200px] min-w-[120px] max-w-[200px] align-top";

const alertBg = "bg-[#fde8e8]";

function Cell({ children, warn }) {
    return <td className={`${tdBase} ${warn ? alertBg : ""}`}>{children}</td>;
}

export default function ApexRadarOverviewTable({ rows, assignmentMap = {}, onAssignClick }) {
    if (!rows?.length) {
        return (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                No rows match your filters.
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full border-collapse text-left">
                    <thead>
                        <tr>
                            <th
                                rowSpan={2}
                                className={`${thGroup} text-left sticky left-0 z-30 bg-gray-200 min-w-[200px]`}
                            >
                                Account
                            </th>
                            <th
                                rowSpan={2}
                                className={`${thGroup} text-left sticky left-[200px] z-30 bg-gray-200 min-w-[120px]`}
                            >
                                Team members
                            </th>
                            <th colSpan={5} className={thGroup}>
                                Value
                            </th>
                            <th colSpan={4} className={thGroup}>
                                Targets
                            </th>
                            <th colSpan={5} className={thGroup}>
                                Budget
                            </th>
                            <th colSpan={5} className={thGroup}>
                                Ad performance
                            </th>
                        </tr>
                        <tr>
                            <th className={thSub}>Conv. (2d)</th>
                            <th className={thSub}>Value (7d)</th>
                            <th className={thSub}>Min. value (7d)</th>
                            <th className={thSub}>Value (30d)</th>
                            <th className={thSub}>Min. value (30d)</th>
                            <th className={thSub}>Type</th>
                            <th className={thSub}>Target</th>
                            <th className={thSub}>Actual (7d)</th>
                            <th className={thSub}>Actual (30d)</th>
                            <th className={thSub}>Target</th>
                            <th className={thSub}>Spend</th>
                            <th className={thSub}>Spend (yesterday)</th>
                            <th className={thSub}>Pace</th>
                            <th className={thSub}>Type</th>
                            <th className={thSub}># Fatigue</th>
                            <th className={thSub}>CTR (7d)</th>
                            <th className={thSub}>CTR (30d)</th>
                            <th className={thSub}>Freq (7d)</th>
                            <th className={thSub}>Freq (30d)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const a = row.alerts || {};
                            const assignedIds = assignmentMap[row.id] || [];
                            const teamLabel = formatAssignedUsersList(assignedIds);
                            return (
                                <tr key={row.id} className="hover:bg-gray-50/80">
                                    <td className={`${tdEntity} truncate`} title={row.entity}>
                                        {row.entity}
                                    </td>
                                    <td className={tdTeamMember} title={teamLabel === "—" ? undefined : teamLabel}>
                                        <div className="flex flex-row gap-2 items-start justify-between">
                                            <span className="line-clamp-2 leading-snug">{teamLabel}</span>
                                            <button
                                                type="button"
                                                onClick={() => onAssignClick?.(row)}
                                                aria-label={`Assign team members for ${row.entity}`}
                                                className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-[var(--color-primary-searchmind)] text-white font-medium leading-none shadow-sm transition hover:bg-[var(--color-primary-searchmind-hover)] hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] focus-visible:ring-offset-1 text-xs"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </td>
                                    <Cell warn={false}>{fmtInt(row.value?.conversions2d)}</Cell>
                                    <Cell warn={a.value7dBelowMin}>{fmtMoney(row.value?.value7d)}</Cell>
                                    <Cell warn={false}>{fmtMoney(row.value?.minExpectedValue7d)}</Cell>
                                    <Cell warn={a.value30dBelowMin}>{fmtMoney(row.value?.value30d)}</Cell>
                                    <Cell warn={false}>{fmtMoney(row.value?.minExpectedValue30d)}</Cell>
                                    <Cell warn={false}>{row.targets?.targetType}</Cell>
                                    <Cell warn={false}>{fmtDecimal(row.targets?.target, 2)}</Cell>
                                    <Cell warn={a.target7dMiss}>{fmtDecimal(row.targets?.actual7d, 2)}</Cell>
                                    <Cell warn={a.target30dMiss}>{fmtDecimal(row.targets?.actual30d, 2)}</Cell>
                                    <Cell warn={false}>{fmtMoney(row.budget?.targetBudget)}</Cell>
                                    <Cell warn={false}>{fmtMoney(row.budget?.realizedBudget)}</Cell>
                                    <Cell warn={false}>{fmtMoney(row.budget?.spendYesterday)}</Cell>
                                    <Cell warn={a.budgetPaceOff}>{fmtDecimal(row.budget?.budgetPace, 2)}</Cell>
                                    <Cell warn={false}>{row.budget?.budgetType}</Cell>
                                    <Cell warn={a.highAdFatigue}>{fmtInt(row.ads?.adFatigue)}</Cell>
                                    <Cell warn={false}>{fmtPct(row.ads?.ctr7d)}</Cell>
                                    <Cell warn={false}>{fmtPct(row.ads?.ctr30d)}</Cell>
                                    <Cell warn={false}>{fmtDecimal(row.ads?.freq7d, 2)}</Cell>
                                    <Cell warn={false}>{fmtDecimal(row.ads?.freq30d, 2)}</Cell>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
