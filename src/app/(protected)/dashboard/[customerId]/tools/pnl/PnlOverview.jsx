"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { FiArrowUpRight, FiArrowDownRight, FiEye, FiDollarSign, FiPieChart, FiCreditCard } from "react-icons/fi";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

/** Waterfall colours (DESIGN.md · Chart palette): subtotals ink, costs soft red, result by sign. */
const SUBTOTAL = "#121A13";
const COST = "#E9B1AC";
const POSITIVE = "#2F8434";
const NEGATIVE = "#C2423B";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtInt = (v) => Math.round(num(v)).toLocaleString("da-DK");
const fmtKr = (v) => `${fmtInt(v)} kr.`;
const fmtRatio = (v) => num(v).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => `${num(v).toLocaleString("da-DK", { maximumFractionDigits: 1 })}%`;
const compact = (v) => {
    const n = num(v);
    const abs = Math.abs(n);
    if (abs >= 1e6) return `${(n / 1e6).toLocaleString("da-DK", { maximumFractionDigits: 1 })}m`;
    if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString("da-DK")}k`;
    return Math.round(n).toLocaleString("da-DK");
};

/** "Year over year" -> "vs last year", "Previous period" -> "vs previous period", etc. */
function vsCaption(comparisonLabel) {
    const label = String(comparisonLabel).toLowerCase();
    if (label.includes("year")) return "vs last year";
    if (label.includes("month")) return "vs previous month";
    if (label.includes("period")) return "vs previous period";
    return `vs ${label}`;
}

function Delta({ cur, prev, goodUp = true }) {
    if (prev == null || !Number.isFinite(Number(prev)) || Number(prev) === 0) return null;
    // Divide by |prev| so a loss shrinking toward zero reads as an improvement
    const pct = ((num(cur) - num(prev)) / Math.abs(num(prev))) * 100;
    const good = goodUp ? pct >= 0 : pct <= 0;
    return (
        <span className={`apex-ov-delta ${good ? "is-up" : "is-down"}`}>
            {pct < 0 ? <FiArrowDownRight aria-hidden /> : <FiArrowUpRight aria-hidden />}
            {`${pct > 0 ? "+" : ""}${pct.toLocaleString("da-DK", { maximumFractionDigits: 1 })}%`}
        </span>
    );
}

function Kpi({ label, value, cur, prev, goodUp = true, caption, icon: Icon, cost = false, hero = false }) {
    return (
        <div className={`apex-ov-card apex-ov-kpi apex-pnl-kpi${hero ? " is-hero" : ""}`}>
            <div className="apex-ov-kpi__label">
                {hero ? null : (
                    <span className={`apex-ov-ic${cost ? " is-cost" : ""}`}>
                        <Icon aria-hidden />
                    </span>
                )}
                <span>{label}</span>
                {hero ? <FiEye className="apex-ov-kpi__eye" aria-hidden /> : null}
            </div>
            <div className={`apex-ov-kpi__value${num(value) < 0 ? " is-neg" : ""}`}>
                {fmtInt(value)}
                <small>kr.</small>
            </div>
            <div className="apex-ov-kpi__row">
                <Delta cur={cur} prev={prev} goodUp={goodUp} />
                {caption ? <span className="apex-ov-vs">{caption}</span> : null}
            </div>
        </div>
    );
}

/** One-sentence lede for the heading. */
export function pnlLede(pnl) {
    if (!pnl || pnl.loading || pnl.error) return null;
    const net = num(pnl.totalSales);
    const share = net !== 0 ? (num(pnl.result) / net) * 100 : 0;
    const verdict = num(pnl.result) >= 0 ? "a net result of" : "a net loss of";
    return `The period closed at ${verdict} ${fmtKr(Math.abs(num(pnl.result)))}, ${fmtPct(share)} of ${pnl.primarySalesRevenueLabel || "net sales"}. Realized ROAS ${fmtRatio(pnl.realizedROAS)} against break-even ${fmtRatio(pnl.breakEvenROAS)}.`;
}

export default function PnlOverview({ pnl, comparisonLabel }) {
    const vs = pnl.hasPrev && comparisonLabel ? vsCaption(comparisonLabel) : null;
    const marketing = num(pnl.marketingSpend) + num(pnl.marketingBureau) + num(pnl.marketingTooling);
    const marketingPrev = pnl.hasPrev
        ? num(pnl.marketingSpendPrev) + num(pnl.marketingBureauPrev) + num(pnl.marketingToolingPrev)
        : null;
    const net = num(pnl.totalSales);
    const salesLabel = pnl.primarySalesRevenueLabel || "Net sales";

    const waterfall = useMemo(() => {
        // Subtotals come straight from the P&L so the chart always matches the statement;
        // the first step is whatever separates net sales from DB1 (cost of goods).
        const steps = [
            { label: [salesLabel], total: true, v: net },
            { label: ["COGS"], v: num(pnl.db1) - net },
            { label: ["DB1"], total: true, v: num(pnl.db1) },
            { label: ["Shipping"], v: -num(pnl.shipping) },
            { label: ["Transaction", "costs"], v: -num(pnl.transactionCosts) },
            { label: ["DB2"], total: true, v: num(pnl.db2) },
            { label: ["Ad spend"], v: -num(pnl.marketingSpend) },
            { label: ["Bureau"], v: -num(pnl.marketingBureau) },
            { label: ["Tooling"], v: -num(pnl.marketingTooling) },
            { label: ["DB3"], total: true, v: num(pnl.db3) },
            { label: ["Fixed", "expenses"], v: -num(pnl.fixedExpenses) },
            { label: ["Result"], total: true, v: num(pnl.result), isResult: true },
        ].filter((s) => s.total || Math.round(s.v) !== 0);

        let run = 0;
        const data = steps.map((s) => {
            let from;
            let to;
            if (s.total) {
                from = 0;
                to = s.v;
                run = s.v;
            } else {
                from = run;
                to = run + s.v;
                run = to;
            }
            const fillColor = s.isResult ? (s.v >= 0 ? POSITIVE : NEGATIVE) : s.total ? SUBTOTAL : s.v >= 0 ? POSITIVE : COST;
            return { x: s.label, y: [Math.min(from, to), Math.max(from, to)], fillColor, value: s.v, total: !!s.total };
        });

        const base = getCobaltChartBaseOptions();
        const options = {
            ...base,
            chart: { ...base.chart, type: "rangeBar", toolbar: { show: false }, zoom: { enabled: false } },
            plotOptions: { bar: { horizontal: false, columnWidth: "58%", borderRadius: 3 } },
            dataLabels: { enabled: false },
            legend: { show: false },
            grid: { ...base.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            xaxis: {
                ...base.xaxis,
                type: "category",
                labels: { ...base.xaxis.labels, rotate: 0, hideOverlappingLabels: false, trim: false },
                axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
            },
            yaxis: { tickAmount: 4, forceNiceScale: true, labels: { formatter: compact } },
            states: { hover: { filter: { type: "darken", value: 0.9 } } },
            tooltip: {
                ...base.tooltip,
                theme: "dark",
                custom: ({ dataPointIndex }) => {
                    const d = data[dataPointIndex];
                    if (!d) return "";
                    const name = Array.isArray(d.x) ? d.x.join(" ") : d.x;
                    const sign = !d.total && d.value < 0 ? "-" : "";
                    return `<div class="apex-pnl-tip"><span>${name}</span><b>${sign}${fmtKr(Math.abs(d.value))}</b></div>`;
                },
            },
        };
        return { series: [{ name: "P&L", data: data.map(({ x, y, fillColor }) => ({ x, y, fillColor })) }], options };
    }, [pnl, net, salesLabel]);

    const margins = [
        { key: "db1", label: "DB1", sub: "after cost of goods", pct: num(pnl.db1Pct), amount: pnl.db1 },
        { key: "db2", label: "DB2", sub: "after shipping and fees", pct: num(pnl.db2Pct), amount: pnl.db2 },
        { key: "db3", label: "DB3", sub: "after marketing", pct: num(pnl.db3Pct), amount: pnl.db3 },
    ];
    const roasOk = num(pnl.realizedROAS) >= num(pnl.breakEvenROAS);

    return (
        <>
            <div className="apex-ov-grid apex-ov-grid--hero apex-pnl-row">
                <Kpi
                    hero
                    label="Net result"
                    value={pnl.result}
                    cur={pnl.result}
                    prev={pnl.hasPrev ? pnl.resultPrev : null}
                    caption={vs || "Bottom-line profit for the period"}
                />
                <Kpi
                    label={salesLabel}
                    icon={FiDollarSign}
                    value={net}
                    cur={net}
                    prev={pnl.hasPrev ? pnl.totalSalesPrev : null}
                    caption={vs}
                />
                <Kpi
                    label="DB1 (gross profit)"
                    icon={FiPieChart}
                    value={pnl.db1}
                    cur={pnl.db1}
                    prev={pnl.hasPrev ? pnl.db1Prev : null}
                    caption={`${fmtPct(pnl.db1Pct)} margin`}
                />
                <Kpi
                    label="Marketing cost"
                    icon={FiCreditCard}
                    cost
                    value={marketing}
                    cur={marketing}
                    prev={marketingPrev}
                    goodUp={false}
                    caption={net !== 0 ? `${fmtPct((marketing / net) * 100)} of ${salesLabel}` : null}
                />
            </div>

            <div className="apex-ov-grid apex-pnl-split apex-pnl-row">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>From sales to result</h3>
                        <div className="apex-pnl-legend">
                            <span><i style={{ background: SUBTOTAL }} />Subtotal</span>
                            <span><i style={{ background: COST }} />Cost</span>
                            <span><i style={{ background: POSITIVE }} />Result</span>
                        </div>
                    </div>
                    <div className="apex-pnl-waterfall">
                        <ReactApexChart
                            key={`wf-${waterfall.series[0].data.length}-${Math.round(net)}`}
                            options={waterfall.options}
                            series={waterfall.series}
                            type="rangeBar"
                            height={300}
                            width="100%"
                        />
                    </div>
                    <p className="apex-mk-note">Subtotals match the P&amp;L statement below. Marketing cost includes bureau and tooling.</p>
                </section>

                <section className="apex-ov-card apex-pnl-margins">
                    <div className="apex-ov-card__head">
                        <h3>Contribution margins</h3>
                        <span className="apex-ov-sub">Share of {salesLabel}</span>
                    </div>
                    <div className="apex-pnl-margin-list">
                        {margins.map((mg) => (
                            <div key={mg.key} className="apex-pnl-margin">
                                <div className="apex-pnl-margin__top">
                                    <span>
                                        <b>{mg.label}</b> <small>{mg.sub}</small>
                                    </span>
                                    <span className={mg.pct < 0 ? "is-neg" : undefined}>{fmtPct(mg.pct)}</span>
                                </div>
                                <div className="apex-ov-bar">
                                    <i
                                        style={{
                                            width: `${Math.min(100, Math.max(0, mg.pct))}%`,
                                            background: mg.pct < 0 ? NEGATIVE : POSITIVE,
                                        }}
                                    />
                                </div>
                                <div className="apex-pnl-margin__amt">{fmtKr(mg.amount)}</div>
                            </div>
                        ))}
                    </div>
                    <div className="apex-pnl-tiles">
                        <div className="apex-pnl-tile">
                            <small>Realized ROAS</small>
                            <b>{fmtRatio(pnl.realizedROAS)}</b>
                            <span className={`apex-mk-tag ${roasOk ? "is-ok" : "is-bad"}`}>
                                {roasOk ? "Above break-even" : "Below break-even"}
                            </span>
                        </div>
                        <div className="apex-pnl-tile">
                            <small>Break-even ROAS</small>
                            <b>{fmtRatio(pnl.breakEvenROAS)}</b>
                            <span className="apex-pnl-tile__hint">Covers all costs</span>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
