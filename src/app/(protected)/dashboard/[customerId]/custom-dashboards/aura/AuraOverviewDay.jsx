"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import AuraFilterStatus from "./AuraFilterStatus";
import { useCustomers } from "@/hooks/useCustomers";
import { useUser } from "@/contexts/UserContext";
import { useAuraFilter } from "./useAuraFilter";
import { useAuraMonthData } from "./useAuraMonthData";
import { MONTH_NAMES } from "./auraSheetLogic";
import { compareTotals, dailyTotals, monthDailyRows, monthDates } from "./auraDailyLogic";
import AuraMonthPicker from "./AuraMonthPicker";
import { nf0, nf2 } from "./HeroKpi";

const COLUMNS = [
    { key: "conversions", label: "Conversions", fmt: nf0, lowerIsBetter: false },
    { key: "ppc", label: "PPC Cost", fmt: nf2, lowerIsBetter: true },
    { key: "ps", label: "PS Cost", fmt: nf2, lowerIsBetter: true },
    { key: "other", label: "Other Cost", fmt: nf0, lowerIsBetter: true },
    { key: "total", label: "Spend Total", fmt: nf2, lowerIsBetter: true },
    { key: "cac", label: "CAC", fmt: nf2, lowerIsBetter: true },
];

const fmtDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const show = (fmt, v) => (v == null ? "" : fmt.format(v));

/** Daily table of one month. Cells are shaded by how large the value is within its column, weekends are marked. */
function DailyTable({ rows, caption }) {
    const max = useMemo(() => {
        const out = {};
        for (const c of COLUMNS) out[c.key] = Math.max(0, ...rows.map((r) => (r.empty ? 0 : r[c.key] || 0)));
        return out;
    }, [rows]);
    return (
        <div className="aura-table-wrap">
            <table className="aura-table">
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr>
                        <th scope="col">Date</th>
                        {COLUMNS.map((c) => (
                            <th key={c.key} scope="col" className="is-num">
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.date}>
                            <th scope="row" className={r.weekend ? "is-weekend" : undefined}>
                                {fmtDate(r.date)}
                            </th>
                            {COLUMNS.map((c) => {
                                const v = r.empty ? null : r[c.key];
                                const heat = v != null && max[c.key] > 0 ? Math.round((v / max[c.key]) * 100) : 0;
                                return (
                                    <td key={c.key} className="is-num" style={heat ? { "--heat": `${heat}%` } : undefined}>
                                        {show(c.fmt, v)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Delta({ value, fmt, lowerIsBetter }) {
    if (value == null) return <span>N/A</span>;
    if (Math.abs(value) < 0.005) return <span>{fmt.format(0)}</span>;
    const up = value > 0;
    const good = lowerIsBetter ? !up : up;
    return (
        <span className={good ? "is-good" : "is-bad"}>
            {fmt.format(Math.abs(value))}
            {up ? <FiArrowUp aria-label="up" /> : <FiArrowDown aria-label="down" />}
        </span>
    );
}

/**
 * Overview day (sheet tab "Overview Day"): the daily table of a month with a totals block against the same days
 * of the year before (Index = this year as % of last year, Dif = difference), and last year's daily table.
 */
export default function AuraOverviewDay() {
    const params = useParams();
    const { customers } = useCustomers();
    const isAdmin = useUser()?.isAdmin === true;
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = customer?._id;

    const now = new Date();
    const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
    const { year, month } = period;
    const { filter, loaded } = useAuraFilter(customerId);
    const { data, error, loading } = useAuraMonthData({
        customerId,
        year: year,
        month: month,
        filter,
        enabled: loaded,
    });

    const view = (() => {
        if (!data) return null;
        const build = (year, block) =>
            monthDailyRows({
                year,
                month: month,
                elapsed: data.elapsed,
                googleRows: block.google,
                metaRows: block.meta,
                conversions: block.sheet.conversions,
                otherCost: block.sheet.otherCost,
            });
        const rows = build(year, data.current);
        const lastRows = build(year - 1, data.previous);
        const totals = dailyTotals(rows);
        const lastTotals = dailyTotals(lastRows);
        return { rows, lastRows, totals, lastTotals, ...compareTotals(totals, lastTotals) };
    })();

    const dates = monthDates(period.year, period.month);

    return (
        <div id="AuraOverviewDay" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Aura Overview day"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={{ startDate: dates[0], endDate: dates[dates.length - 1] }}
                loading={loading}
                dashboardType="custom-aura-overview-day"
                dataSnapshot={{ cost: view?.totals.total ?? 0 }}
                right={<AuraMonthPicker year={period.year} month={period.month} onChange={setPeriod} />}
            />

            {loaded ? <AuraFilterStatus customerId={customerId} filter={filter} /> : null}

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading daily overview" request="GET /api/google-ppc-dashboard" />
                </div>
            ) : error ? (
                isAdmin ? <div className="apex-ppc-error">{error}</div> : null
            ) : view ? (
                <>
                    {isAdmin && data.errors.length > 0 ? (
                        <p className="apex-ppc-chart-note aura-admin-note">Admin only. {data.errors.join("; ")}</p>
                    ) : null}
                    {!filter.enabled ? (
                        <p className="apex-ppc-chart-note">
                            Cost includes every campaign on the connected ad accounts. The old sheet only counted the Emob
                            campaigns: switch on the campaign filter under Data inputs and choose the Emob preset to match it.
                        </p>
                    ) : null}

                    <section className="aura-table-wrap aura-totals" aria-label="Totals against last year">
                        <table className="aura-table aura-table--totals">
                            <thead>
                                <tr>
                                    <th scope="col" />
                                    {COLUMNS.map((c) => (
                                        <th key={c.key} scope="col" className="is-num">
                                            {c.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th scope="row">Total {period.year}</th>
                                    {COLUMNS.map((c) => (
                                        <td key={c.key} className="is-num is-strong">{show(c.fmt, view.totals[c.key])}</td>
                                    ))}
                                </tr>
                                <tr>
                                    <th scope="row">Last year</th>
                                    {COLUMNS.map((c) => (
                                        <td key={c.key} className="is-num">{show(c.fmt, view.lastTotals[c.key])}</td>
                                    ))}
                                </tr>
                                <tr>
                                    <th scope="row">Index</th>
                                    {COLUMNS.map((c) => (
                                        <td key={c.key} className="is-num">{show(nf0, view.index[c.key])}</td>
                                    ))}
                                </tr>
                                <tr>
                                    <th scope="row">Dif</th>
                                    {COLUMNS.map((c) => (
                                        <td key={c.key} className="is-num">
                                            <Delta value={view.dif[c.key]} fmt={c.fmt} lowerIsBetter={c.lowerIsBetter} />
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    <h2 className="aura-table-title">{MONTH_NAMES[period.month]} {period.year}</h2>
                    <DailyTable rows={view.rows} caption={`Daily overview ${period.year}`} />

                    <h2 className="aura-table-title">{period.year - 1}</h2>
                    <DailyTable rows={view.lastRows} caption={`Daily overview ${period.year - 1}`} />
                    <p className="apex-ppc-chart-note">
                        PPC = Google Ads, PS = Meta, Other = campaign budgets saved under Data inputs spread over their days.
                        Totals and last year cover the same finished days. CAC = spend total / conversions.
                    </p>
                </>
            ) : null}
        </div>
    );
}
