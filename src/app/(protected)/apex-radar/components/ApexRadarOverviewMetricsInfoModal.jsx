"use client";

import React from "react";
import { FiX } from "react-icons/fi";

const tableClass = "w-full text-xs border-collapse";
const thGroup = "px-3 py-2 text-left font-semibold text-gray-900 bg-gray-100 border border-gray-200";
const th = "px-3 py-2 text-left font-semibold text-gray-700 bg-gray-50 border border-gray-200 whitespace-nowrap";
const td = "px-3 py-2 text-gray-600 border border-gray-100 align-top leading-relaxed";

function Row({ group, metric, children }) {
    return (
        <tr className="hover:bg-gray-50/60">
            <td className={`${td} font-medium text-gray-800 whitespace-nowrap`}>{group}</td>
            <td className={`${td} text-gray-800 whitespace-nowrap`}>{metric}</td>
            <td className={td}>{children}</td>
        </tr>
    );
}

/**
 * Explains overview table metrics (aligned with Meta insights + customer Apex Radar settings).
 */
export default function ApexRadarOverviewMetricsInfoModal({ onClose }) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-metrics-info-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-4xl max-h-[min(90vh,780px)] rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-lg">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 id="apex-metrics-info-title" className="text-lg font-semibold text-gray-900">
                            Overview metrics
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            How numbers are computed and what they represent (Facebook / Meta data).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto flex-1">
                    <div className="rounded-lg border border-[var(--color-primary-searchmind)]/20 bg-[var(--color-primary-searchmind)]/5 px-3 py-2.5 mb-4 text-xs text-gray-700">
                        <p className="font-semibold text-gray-900 mb-1">Date range</p>
                        <p>
                            The overview respects the date picker: <strong>end date</strong> is the reporting as-of day.
                            Rolling windows (2, 7, and 30 days) <strong>end on that date</strong> and only include days
                            inside your selected range. Month-to-date budget uses the{" "}
                            <strong>calendar month of the end date</strong>, from the first of that month through the end
                            date.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className={tableClass}>
                            <thead>
                                <tr>
                                    <th className={th} scope="col">
                                        Category
                                    </th>
                                    <th className={th} scope="col">
                                        Metric
                                    </th>
                                    <th className={th} scope="col">
                                        Definition
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th className={thGroup} colSpan={3} scope="colgroup">
                                        Value
                                    </th>
                                </tr>
                                <Row group="Value" metric="Conv. (2d)">
                                    Sum of purchase-related conversions (Meta purchase action types used in Apex Radar)
                                    for the last two days ending on the end date, clipped to the selected range.
                                </Row>
                                <Row group="Value" metric="Value (7d) / (30d)">
                                    <strong>ROAS:</strong> sum of conversion value over the last 7 or 30 days.{" "}
                                    <strong>CPA:</strong> sum of conversions over those periods (not revenue).
                                </Row>
                                <Row group="Value" metric="Min. value (7d) / (30d)">
                                    Baseline from roughly a year of <strong>weekly</strong> totals of the same series
                                    (revenue for ROAS, conversions for CPA). Per week:{" "}
                                    <code className="bg-gray-100 px-1 rounded">log10(weekly total)</code>; then mean and
                                    sample standard deviation of those logs. Floors:{" "}
                                    <code className="bg-gray-100 px-1 rounded">10^(mean - 2*std)</code> (7d) and{" "}
                                    <code className="bg-gray-100 px-1 rounded">10^(mean - std)</code> (30d). Highlighting
                                    when realized value is below the floor.
                                </Row>

                                <tr>
                                    <th className={thGroup} colSpan={3} scope="colgroup">
                                        Targets
                                    </th>
                                </tr>
                                <Row group="Targets" metric="Type / Target">
                                    From each customer&apos;s Apex Radar settings (ROAS vs CPA and the target number).
                                </Row>
                                <Row group="Targets" metric="Actual (7d) / (30d)">
                                    <strong>ROAS:</strong> sum of conversion value ÷ sum of spend over the window.{" "}
                                    <strong>CPA:</strong> sum of spend ÷ sum of conversions over the window.
                                </Row>
                                <Row group="Targets" metric="Highlighting">
                                    <strong>ROAS:</strong> worse when actual is below target. <strong>CPA:</strong> worse
                                    when actual is above target (higher cost per conversion).
                                </Row>

                                <tr>
                                    <th className={thGroup} colSpan={3} scope="colgroup">
                                        Budget
                                    </th>
                                </tr>
                                <Row group="Budget" metric="Target">
                                    Monthly target budget from Apex Radar settings.
                                </Row>
                                <Row group="Budget" metric="Spend (realized)">
                                    Sum of spend from the <strong>first day of the calendar month</strong> of the end date
                                    through the end date.
                                </Row>
                                <Row group="Budget" metric="Spend (yesterday)">
                                    Spend on the overview <strong>end date</strong> (as-of day; default picker is
                                    typically yesterday).
                                </Row>
                                <Row group="Budget" metric="Pace">
                                    Realized month-to-date spend ÷ expected linear spend:{" "}
                                    <code className="bg-gray-100 px-1 rounded">
                                        (target ÷ days in month) × (day of month - 1)
                                    </code>
                                    . Near 1 means close to an even spread through the month.
                                </Row>
                                <Row group="Budget" metric="Type">
                                    <strong>D</strong> = dynamic budget mode, <strong>S</strong> = static (from
                                    settings).
                                </Row>

                                <tr>
                                    <th className={thGroup} colSpan={3} scope="colgroup">
                                        Ad performance
                                    </th>
                                </tr>
                                <Row group="Ad performance" metric="CTR / Frequency">
                                    Impression-weighted aggregates over the same 7-day and 30-day windows (Meta account
                                    insights).
                                </Row>
                                <Row group="Ad performance" metric="# Fatigue">
                                    Placeholder for a future metric; not populated yet.
                                </Row>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="flex items-center justify-end px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-searchmind)] focus-visible:ring-offset-1"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
