"use client";

import React from "react";
import { FiX } from "react-icons/fi";

function Row({ group, metric, children }) {
    return (
        <tr>
            <td className="font-medium whitespace-nowrap">{group}</td>
            <td className="whitespace-nowrap">{metric}</td>
            <td className="leading-relaxed">{children}</td>
        </tr>
    );
}

export default function ApexRadarOverviewMetricsInfoModal({ onClose }) {
    return (
        <div
            className="apex-radar-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-metrics-info-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="apex-radar-modal apex-radar-modal--xl">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-metrics-info-title" className="apex-radar-modal__title">
                            Overview metrics
                        </h2>
                        <p className="apex-radar-modal__subtitle">
                            How numbers are computed and what they represent (Facebook / Meta data).
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="apex-radar-modal__close" aria-label="Close">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                <div className="apex-radar-modal__body">
                    <div className="apex-radar-modal-callout mb-4">
                        <p className="font-semibold text-[var(--color-ink)] mb-1">Date range</p>
                        <p>
                            The overview respects the date picker: <strong>end date</strong> is the reporting as-of day.
                            Rolling windows (2, 7, and 30 days) <strong>end on that date</strong> and only include days
                            inside your selected range. Month-to-date budget uses the{" "}
                            <strong>calendar month of the end date</strong>, from the first of that month through the end
                            date.
                        </p>
                    </div>

                    <div className="apex-radar-table-wrap">
                        <table className="apex-radar-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Metric</th>
                                    <th>Definition</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th colSpan={3} className="th-group text-left">
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
                                    <code>log10(weekly total)</code>; then mean and sample standard deviation of those
                                    logs. Floors: <code>10^(mean - 2*std)</code> (7d) and{" "}
                                    <code>10^(mean - std)</code> (30d). Highlighting when realized value is below the
                                    floor.
                                </Row>

                                <tr>
                                    <th colSpan={3} className="th-group text-left">
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
                                    <th colSpan={3} className="th-group text-left">
                                        Budget
                                    </th>
                                </tr>
                                <Row group="Budget" metric="Target">
                                    Monthly target budget from Apex Radar settings.
                                </Row>
                                <Row group="Budget" metric="Spend (realized)">
                                    Sum of spend from the <strong>first day of the calendar month</strong> of the end
                                    date through the end date.
                                </Row>
                                <Row group="Budget" metric="Spend (yesterday)">
                                    Spend on the overview <strong>end date</strong> (as-of day; default picker is
                                    typically yesterday).
                                </Row>
                                <Row group="Budget" metric="Pace">
                                    Realized month-to-date spend ÷ expected linear spend:{" "}
                                    <code>(target ÷ days in month) × (day of month - 1)</code>. Near 1 means close to an
                                    even spread through the month.
                                </Row>
                                <Row group="Budget" metric="Type">
                                    <strong>D</strong> = dynamic budget mode, <strong>S</strong> = static (from settings).
                                </Row>

                                <tr>
                                    <th colSpan={3} className="th-group text-left">
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
                <div className="apex-radar-modal__foot">
                    <button type="button" onClick={onClose} className="apex-perf-btn apex-perf-btn--primary">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
