"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import { FiEye, FiRepeat, FiCreditCard, FiTrendingUp } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";

const NEW_COLOR = METRIC_CHART_PALETTE[0];
const RETURNING_COLOR = METRIC_CHART_PALETTE[1];

const isNum = (v) => v != null && Number.isFinite(Number(v));
const num = (v) => (isNum(v) ? Number(v) : 0);
const fmtInt = (v) => Math.round(num(v)).toLocaleString("da-DK");
const fmtRatio = (v) => num(v).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v, dp = 0) => `${(num(v) * 100).toLocaleString("da-DK", { maximumFractionDigits: dp })}%`;
const compact = (v) => {
    const n = num(v);
    const abs = Math.abs(n);
    if (abs >= 1e6) return `${(n / 1e6).toLocaleString("da-DK", { maximumFractionDigits: 1 })}m`;
    if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString("da-DK")}k`;
    return Math.round(n).toLocaleString("da-DK");
};

function Kpi({ label, icon: Icon, value, unit, caption, hero = false, cost = false, tag }) {
    return (
        <div className={`apex-ov-card apex-ov-kpi apex-ecom-kpi${hero ? " is-hero" : ""}`}>
            <div className="apex-ov-kpi__label">
                {hero ? null : (
                    <span className={`apex-ov-ic${cost ? " is-cost" : ""}`}>
                        <Icon aria-hidden />
                    </span>
                )}
                <span>{label}</span>
                {hero ? <FiEye className="apex-ov-kpi__eye" aria-hidden /> : null}
            </div>
            <div className="apex-ov-kpi__value">
                {value}
                {unit ? <small>{unit}</small> : null}
            </div>
            <div className="apex-ov-kpi__row">
                {tag}
                {caption ? <span className="apex-ov-vs">{caption}</span> : null}
            </div>
        </div>
    );
}

/**
 * Customers overview (DESIGN.md · Ecommerce view): new vs returning, acquisition cost and LTV
 * payback, all from the segmentation the Customers tab already loads.
 */
export default function CustomerOverview({ segmentation, ltvLoading }) {
    const d = segmentation || {};
    const firstOrders = num(d.firstOrdersCount);
    const totalOrders = num(d.totalOrders);
    const returning = Math.max(0, totalOrders - firstOrders);
    const adSpend = num(d.adSpend);
    const nCAC = firstOrders > 0 && adSpend > 0 ? adSpend / firstOrders : null;
    // Best available LTV window for the payback ratio (90 days once it has loaded)
    const ltvForRatio = isNum(d.ltv90) ? { v: Number(d.ltv90), label: "90 days" } : isNum(d.ltv30) ? { v: Number(d.ltv30), label: "30 days" } : null;
    const ratio = nCAC && ltvForRatio ? ltvForRatio.v / nCAC : null;

    const dailySeries = segmentation?.dailySeries;
    const chart = useMemo(() => {
        const rows = dailySeries || [];
        const categories = rows.map((r) => String(r.period).slice(0, 10));
        return {
            series: [
                { name: "New", data: rows.map((r) => num(r.newCustomers)) },
                { name: "Returning", data: rows.map((r) => num(r.returningCustomers)) },
            ],
            options: {
                chart: { stacked: true, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
                colors: [NEW_COLOR, RETURNING_COLOR],
                plotOptions: { bar: { columnWidth: "62%", borderRadius: 2, borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
                stroke: { width: 0 },
                fill: { opacity: 1 },
                states: { hover: { filter: { type: "none" } } },
                xaxis: {
                    categories,
                    tickAmount: 8,
                    labels: {
                        rotate: 0,
                        hideOverlappingLabels: true,
                        style: { colors: COMMERCE_CHART_CHROME.axisLabel },
                        formatter: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dayjs(v).format("D MMM") : v),
                    },
                    axisTicks: { show: false },
                    tooltip: { enabled: false },
                },
                yaxis: { min: 0, tickAmount: 4, forceNiceScale: true, labels: { formatter: (v) => fmtInt(v) } },
                grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
                dataLabels: { enabled: false },
                legend: { show: true, position: "top", horizontalAlign: "left" },
                tooltip: {
                    theme: "dark",
                    shared: true,
                    intersect: false,
                    x: { formatter: (v, { dataPointIndex } = {}) => (categories[dataPointIndex] ? dayjs(categories[dataPointIndex]).format("ddd, D MMM") : v) },
                    y: { formatter: (v) => `${fmtInt(v)} customers` },
                },
            },
        };
    }, [dailySeries]);

    const revNew = num(d.ncaNetRevenue);
    const revReturning = num(d.returningCustomerNetRevenue);
    const revTotal = num(d.totalNetRevenue) || revNew + revReturning;
    const newShare = revTotal > 0 ? revNew / revTotal : 0;

    const ltvs = [
        { key: "30", label: "LTV 30 days", v: d.ltv30 },
        { key: "90", label: "LTV 90 days", v: d.ltv90 },
        { key: "180", label: "LTV 180 days", v: d.ltv180 },
    ];
    const ltvScale = Math.max(...ltvs.map((l) => num(l.v)), nCAC || 0) * 1.08 || 1;

    return (
        <div className="apex-ecom-overview">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <Kpi
                    hero
                    label="New customers"
                    value={fmtInt(firstOrders)}
                    caption={totalOrders > 0 ? `${fmtPct(firstOrders / totalOrders)} of ${fmtInt(totalOrders)} orders were first orders` : null}
                />
                <Kpi
                    label="Returning customer orders"
                    icon={FiRepeat}
                    value={fmtInt(returning)}
                    caption={totalOrders > 0 ? `${fmtPct(returning / totalOrders)} of orders` : null}
                />
                <Kpi
                    label="New customer CAC"
                    icon={FiCreditCard}
                    cost
                    value={nCAC != null ? fmtInt(nCAC) : "-"}
                    unit={nCAC != null ? "kr." : null}
                    caption={nCAC != null ? "Paid media per first order" : "No paid media or first orders"}
                />
                <Kpi
                    label={`LTV / nCAC${ltvForRatio ? `, ${ltvForRatio.label}` : ""}`}
                    icon={FiTrendingUp}
                    value={ratio != null ? fmtRatio(ratio) : ltvLoading ? "..." : "-"}
                    tag={
                        ratio != null ? (
                            <span className={`apex-mk-tag ${ratio >= 1 ? "is-ok" : "is-bad"}`}>
                                {ratio >= 1 ? "Pays back" : "Not paid back yet"}
                            </span>
                        ) : null
                    }
                />
            </div>

            <div className="apex-ov-grid apex-ecom-split">
                <GraphCard
                    variant="cobalt"
                    hideChartToggle
                    title="New vs returning customers"
                    chartType="bar"
                    height={280}
                    chartOptions={chart.options}
                    chartSeries={chart.series}
                />

                <div className="apex-ecom-stack">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Revenue split</h3>
                            <span className="apex-ov-sub">{compact(revTotal)} kr.</span>
                        </div>
                        <div className="apex-ecom-split-bar" aria-hidden>
                            <i style={{ width: `${newShare * 100}%`, background: NEW_COLOR }} />
                            <i style={{ width: `${(1 - newShare) * 100}%`, background: RETURNING_COLOR }} />
                        </div>
                        <div className="apex-ecom-split-tiles">
                            <div className="apex-ecom-split-tile">
                                <small><i style={{ background: NEW_COLOR }} />New customers</small>
                                <b>{fmtInt(revNew)} kr.</b>
                                <span>{fmtPct(newShare)} of revenue</span>
                            </div>
                            <div className="apex-ecom-split-tile">
                                <small><i style={{ background: RETURNING_COLOR }} />Returning</small>
                                <b>{fmtInt(revReturning)} kr.</b>
                                <span>{fmtPct(1 - newShare)} of revenue</span>
                            </div>
                        </div>
                    </section>

                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Lifetime value</h3>
                            <span className="apex-ov-sub">{nCAC != null ? `Line marks nCAC ${fmtInt(nCAC)} kr.` : "Average per new customer"}</span>
                        </div>
                        <div className="apex-ecom-ltv">
                            {ltvs.map((l) => (
                                <div key={l.key} className="apex-ecom-ltv__row">
                                    <div className="apex-ecom-ltv__top">
                                        <span>{l.label}</span>
                                        <b>{isNum(l.v) ? `${fmtInt(l.v)} kr.` : ltvLoading ? "Calculating" : "-"}</b>
                                    </div>
                                    <div className="apex-ov-bar">
                                        <i style={{ width: `${isNum(l.v) ? (Number(l.v) / ltvScale) * 100 : 0}%`, background: NEW_COLOR }} />
                                        {nCAC != null ? <span className="apex-ecom-ltv__marker" style={{ left: `${(nCAC / ltvScale) * 100}%` }} /> : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
