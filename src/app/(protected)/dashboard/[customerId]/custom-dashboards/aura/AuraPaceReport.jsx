"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import CampaignFilterBar from "../components/CampaignFilterBar";
import { useCustomers } from "@/hooks/useCustomers";
import { useUser } from "@/contexts/UserContext";
import { FILTER_CHANNELS, FILTER_PRESETS } from "./auraFilter";
import { useAuraFilter } from "./useAuraFilter";
import { useAuraMonthData } from "./useAuraMonthData";
import { monthDailyRows, monthDates, paceReport } from "./auraDailyLogic";
import { MONTH_NAMES } from "./auraSheetLogic";
import AuraMonthPicker from "./AuraMonthPicker";
import { nf0, nf2 } from "./HeroKpi";

const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const COLORS = ["#131313", "#16a34a"];

function lineChart({ dates, actual, target, actualName, targetName }) {
    return {
        options: {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            colors: COLORS,
            stroke: { width: [3, 2], curve: "straight", dashArray: [0, 6] },
            markers: { size: 0 },
            xaxis: { categories: dates.map(fmtDay), tickAmount: Math.min(8, dates.length), labels: { rotate: 0 } },
            yaxis: { min: 0, labels: { formatter: (v) => nf0.format(v) } },
            dataLabels: { enabled: false },
            legend: { show: true, position: "top" },
            grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } } },
            tooltip: { theme: "light", shared: true, y: { formatter: (v) => (v == null ? "No data" : nf0.format(v)) } },
        },
        series: [
            { name: actualName, data: actual },
            { name: targetName, data: target },
        ],
    };
}

/**
 * Pace report (sheet tab "Pace"): how the month is going against its budget and customer goal.
 * Cost and conversions are cumulative from the 1st to yesterday, budget and goal are spread evenly over the month.
 * Budget and goal come from Custom > Data inputs > Goals.
 */
export default function AuraPaceReport() {
    const params = useParams();
    const { customers } = useCustomers();
    const isAdmin = useUser()?.isAdmin === true;
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = customer?._id;

    const now = new Date();
    const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
    const { year, month } = period;
    const { filter, loaded, apply } = useAuraFilter(customerId);
    const { data, error, loading } = useAuraMonthData({
        customerId,
        year: period.year,
        month: period.month,
        filter,
        enabled: loaded,
    });

    const report = (() => {
        if (!data) return null;
        const rows = monthDailyRows({
            year: year,
            month: month,
            elapsed: data.elapsed,
            googleRows: data.current.google,
            metaRows: data.current.meta,
            conversions: data.current.sheet.conversions,
            otherCost: data.current.sheet.otherCost,
        });
        const goalRow = data.current.sheet.goals?.[month] || { goal: 0, budget: 0 };
        return { rows, ...paceReport({ rows, budget: goalRow.budget, goal: goalRow.goal, elapsed: data.elapsed }) };
    })();

    const dates = monthDates(period.year, period.month);
    const charts = report
        ? {
              cost: lineChart({
                  dates,
                  actual: report.lines.map((l) => (l.cost == null ? null : Math.round(l.cost))),
                  target: report.lines.map((l) => (report.budget > 0 ? Math.round(l.budget) : null)),
                  actualName: "Cost",
                  targetName: "Budget",
              }),
              customers: lineChart({
                  dates,
                  actual: report.lines.map((l) => l.customers),
                  target: report.lines.map((l) => (report.goal > 0 ? Math.round(l.goal * 10) / 10 : null)),
                  actualName: "Conversions",
                  targetName: "Goal",
              }),
          }
        : null;

    const missingTargets = report && !(report.budget > 0 && report.goal > 0);
    const asOf = data ? (data.elapsed > 0 ? dates[data.elapsed - 1] : null) : null;
    const pace = (v) => (v == null ? "N/A" : nf2.format(v));

    return (
        <div id="AuraPaceReport" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Aura Pace report"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={{ startDate: dates[0], endDate: dates[dates.length - 1] }}
                loading={loading}
                dashboardType="custom-aura-pace"
                dataSnapshot={{ cost: report?.costToDate ?? 0 }}
                right={<AuraMonthPicker year={period.year} month={period.month} onChange={setPeriod} />}
            />

            {loaded ? (
                <CampaignFilterBar key={customerId} value={filter} onApply={apply} channels={FILTER_CHANNELS} presets={FILTER_PRESETS} />
            ) : null}

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading pace" request="GET /api/google-ppc-dashboard" />
                </div>
            ) : error ? (
                isAdmin ? <div className="apex-ppc-error">{error}</div> : null
            ) : report ? (
                <>
                    {isAdmin && data.errors.length > 0 ? (
                        <p className="apex-ppc-chart-note aura-admin-note">Admin only. {data.errors.join("; ")}</p>
                    ) : null}
                    {!filter.enabled ? (
                        <p className="apex-ppc-chart-note">
                            Cost includes every campaign on the connected ad accounts. The old sheet only counted the Emob
                            campaigns: switch on the campaign filter and choose the Emob preset to match it.
                        </p>
                    ) : null}
                    {missingTargets ? (
                        <p className="apex-ppc-chart-note">
                            Budget or goal is missing for {MONTH_NAMES[period.month]}. Add them under Data inputs, Goals.
                        </p>
                    ) : null}

                    <section className="aura-pace" aria-label="Pace figures">
                        <div className="aura-pace__group">
                            <dl>
                                <div><dt>{asOf ? "Up to" : "Date"}</dt><dd>{asOf ? fmtDay(asOf) : "Not started"}</dd></div>
                                <div><dt>Budget</dt><dd>{nf0.format(report.budget)}</dd></div>
                            </dl>
                        </div>
                        <div className="aura-pace__group">
                            <dl>
                                <div><dt>Suggested daily adjustment</dt><dd>{report.adjustment == null ? "N/A" : nf0.format(report.adjustment)}</dd></div>
                                <div><dt>Pace</dt><dd>{pace(report.costPace)}</dd></div>
                            </dl>
                        </div>
                        <div className="aura-pace__group">
                            <dl>
                                <div><dt>Goal</dt><dd>{nf0.format(report.goal)}</dd></div>
                                <div><dt>Pace</dt><dd>{pace(report.customerPace)}</dd></div>
                            </dl>
                        </div>
                    </section>

                    <div className="aura-pace-charts">
                        <GraphCard variant="cobalt" title="Cost against budget" chartOptions={charts.cost.options} chartSeries={charts.cost.series} height={320} hideChartToggle />
                        <GraphCard variant="cobalt" title="Conversions against goal" chartOptions={charts.customers.options} chartSeries={charts.customers.series} height={320} hideChartToggle />
                    </div>
                    <p className="apex-ppc-chart-note">
                        Cost = Google Ads + Meta + Other. Pace is the month to date divided by the evenly spread budget (or goal)
                        for the finished days, so 1 is on plan. Suggested daily adjustment is the sheet&apos;s formula, copied as is.
                    </p>
                </>
            ) : null}
        </div>
    );
}
