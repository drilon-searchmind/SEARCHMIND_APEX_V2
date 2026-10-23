"use client";

import React from "react";
import {
    FiArrowUpRight,
    FiArrowDownRight,
    FiEye,
    FiDollarSign,
    FiBarChart2,
    FiPieChart,
    FiPercent,
    FiCreditCard,
    FiTruck,
    FiShoppingBag,
    FiUserCheck,
    FiTag,
} from "react-icons/fi";
import ComparisonPeriodPopover from "@/components/dashboard/ComparisonPeriodPopover";

/** Where each overview KPI lands in the commerce layout (DESIGN.md · Dashboard overview). */
const HERO_KEY = "revenue";
const TOP_KEYS = ["roas", "poas", "ebit_pct"];
const COST_KEYS = ["total_expenses", "variable_costs", "spendshare"];
const TILE_KEYS = ["aov", "cac"];
/** Overview KPIs intentionally left out of this block. */
const HIDDEN_KEYS = new Set(["additional_fees"]);

/** Cost metrics use the red icon bubble. */
const COST_METRIC_KEYS = new Set(["total_expenses", "variable_costs", "additional_fees", "transaction_fee"]);

const ICONS = {
    revenue: FiDollarSign,
    roas: FiBarChart2,
    poas: FiPieChart,
    ebit_pct: FiPercent,
    total_expenses: FiCreditCard,
    variable_costs: FiTruck,
    spendshare: FiPieChart,
    aov: FiShoppingBag,
    cac: FiUserCheck,
};

/** "292.922 kr." -> ["292.922", "kr."], "20.5%" -> ["20,5", "%"] */
function splitUnit(value) {
    const s = String(value ?? "-").trim();
    const kr = s.match(/^(.*?)\s*kr\.?$/);
    if (kr) return [kr[1], "kr."];
    const pct = s.match(/^(.*?)\s*%$/);
    if (pct) return [pct[1].replace(".", ","), "%"];
    return [s.replace(/^(-?\d+)\.(\d+)$/, "$1,$2"), null];
}

function Value({ value }) {
    const [num, unit] = splitUnit(value);
    return (
        <>
            {num}
            {unit ? <small>{unit}</small> : null}
        </>
    );
}

function Delta({ metric }) {
    if (metric?.change === undefined) return null;
    const n = Number(metric.change);
    const tone = metric.changeType === "up" ? "is-up" : metric.changeType === "down" ? "is-down" : "is-flat";
    const signed = Number.isFinite(n)
        ? `${n > 0 ? "+" : ""}${String(metric.change).replace(".", ",")}%`
        : `${metric.change}%`;
    return (
        <span className={`apex-ov-delta ${tone}`}>
            {n < 0 ? <FiArrowDownRight aria-hidden /> : <FiArrowUpRight aria-hidden />}
            {signed}
        </span>
    );
}

function MetricIcon({ metricKey }) {
    const Icon = ICONS[metricKey] || FiTag;
    return (
        <span className={`apex-ov-ic${COST_METRIC_KEYS.has(metricKey) ? " is-cost" : ""}`}>
            <Icon aria-hidden />
        </span>
    );
}

/** Clickable surface that toggles the metric in the chart and shows the comparison popover. */
function Selectable({ metric, active, onToggle, comparisonMethod, className, children }) {
    return (
        <ComparisonPeriodPopover
            comparisonMethod={comparisonMethod}
            changePrevValue={metric.changePrevValue}
            changeAbsolute={metric.changeAbsolute}
            extraContent={metric.popOverContent}
            className="min-w-0"
        >
            <div
                role="button"
                tabIndex={0}
                aria-pressed={active}
                className={`${className}${active ? " is-active" : ""}`}
                onClick={() => onToggle(metric.key)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle(metric.key);
                    }
                }}
            >
                {children}
            </div>
        </ComparisonPeriodPopover>
    );
}

function KpiCard({ metric, hero = false, vsText, ...rest }) {
    return (
        <Selectable metric={metric} className={`apex-ov-card apex-ov-kpi${hero ? " is-hero" : ""}`} {...rest}>
            <div className="apex-ov-kpi__label">
                {hero ? null : <MetricIcon metricKey={metric.key} />}
                <span>{metric.label}</span>
                {hero ? <FiEye className="apex-ov-kpi__eye" aria-hidden /> : null}
            </div>
            <div className="apex-ov-kpi__value">
                <Value value={metric.value} />
            </div>
            <div className="apex-ov-kpi__row">
                <Delta metric={metric} />
                {vsText && metric.change !== undefined ? <span className="apex-ov-vs">{vsText}</span> : null}
            </div>
        </Selectable>
    );
}

export default function OverviewKeyMetrics({ metrics, metricsData, selectedMetrics, onToggleMetric, comparisonMethod }) {
    const byKey = new Map(metrics.map((m) => [m.key, m]));
    const vsText = comparisonMethod ? `vs ${String(comparisonMethod).toLowerCase()}` : null;
    const shared = { onToggle: onToggleMetric, comparisonMethod };
    const isActive = (key) => selectedMetrics.includes(key);

    const hero = byKey.get(HERO_KEY) || null;
    const top = TOP_KEYS.map((k) => byKey.get(k)).filter(Boolean);
    const costs = COST_KEYS.map((k) => byKey.get(k)).filter(Boolean);
    const placed = new Set([HERO_KEY, ...TOP_KEYS, ...COST_KEYS]);
    // Anything not slotted above (e.g. Transaction Fee) still shows, as a ratio tile
    const tiles = [
        ...TILE_KEYS.map((k) => byKey.get(k)).filter(Boolean),
        ...metrics.filter((m) => !placed.has(m.key) && !TILE_KEYS.includes(m.key) && !HIDDEN_KEYS.has(m.key)),
    ];

    const totalExpenses = byKey.get("total_expenses");
    const costRows = costs.filter((m) => m.key !== "total_expenses");
    const netRevenue = Number(metricsData?.revenue) || 0;
    const totalExpensesNum = Number(metricsData?.total_expenses) || 0;
    const barShare = (key) => {
        if (key === "variable_costs") return totalExpensesNum > 0 ? (Number(metricsData?.variable_costs) || 0) / totalExpensesNum : 0;
        if (key === "spendshare") return Number(metricsData?.spendshare) || 0;
        return 0;
    };
    const barCaption = (key) => {
        const share = (barShare(key) * 100).toLocaleString("da-DK", { maximumFractionDigits: 1 });
        if (key === "variable_costs") return `${share}% of total expenses`;
        if (key === "spendshare") return "Ad spend as a share of net revenue";
        return null;
    };

    return (
        <section className="apex-ov" aria-labelledby="apex-ov-title">
            <div className="apex-ov__head">
                <h3 id="apex-ov-title" className="apex-perf-section-label">Key metrics</h3>
                <span className="apex-ov-sub">Click a metric to add it to the chart</span>
            </div>

            <div className={`apex-ov-grid ${hero ? "apex-ov-grid--hero" : "apex-ov-grid--kpis"}`}>
                {hero ? <KpiCard metric={hero} hero vsText={vsText} active={isActive(hero.key)} {...shared} /> : null}
                {top.map((m) => (
                    <KpiCard key={m.key} metric={m} vsText={vsText} active={isActive(m.key)} {...shared} />
                ))}
            </div>

            {(costs.length > 0 || tiles.length > 0) && (
                <div className={`apex-ov-grid ${costs.length && tiles.length ? "apex-ov-grid--2-1" : ""}`}>
                    {costs.length > 0 ? (
                        <div className="apex-ov-card apex-ov-costs">
                            <div className="apex-ov-card__head">
                                <h3>Costs</h3>
                                <span className="apex-ov-sub">Selected period</span>
                            </div>
                            {totalExpenses ? (
                                <Selectable
                                    metric={totalExpenses}
                                    className="apex-ov-costs__total"
                                    active={isActive(totalExpenses.key)}
                                    {...shared}
                                >
                                    <div className="apex-ov-costs__total-label">
                                        <MetricIcon metricKey="total_expenses" />
                                        {totalExpenses.label}
                                    </div>
                                    <div className="apex-ov-kpi__value">
                                        <Value value={totalExpenses.value} />
                                    </div>
                                    <div className="apex-ov-kpi__row">
                                        <Delta metric={totalExpenses} />
                                        {netRevenue > 0 && totalExpensesNum > 0 ? (
                                            <span className="apex-ov-vs">
                                                {((totalExpensesNum / netRevenue) * 100).toLocaleString("da-DK", {
                                                    maximumFractionDigits: 1,
                                                })}
                                                % of net revenue
                                            </span>
                                        ) : null}
                                    </div>
                                </Selectable>
                            ) : null}
                            <div className="apex-ov-split">
                                {costRows.map((m) => (
                                    <Selectable
                                        key={m.key}
                                        metric={m}
                                        className="apex-ov-split__row"
                                        active={isActive(m.key)}
                                        {...shared}
                                    >
                                        <div className="apex-ov-split__top">
                                            <span className="apex-ov-split__name">
                                                <MetricIcon metricKey={m.key} />
                                                {m.label}
                                            </span>
                                            <span className="apex-ov-split__val">
                                                <b>
                                                    <Value value={m.value} />
                                                </b>
                                                <Delta metric={m} />
                                            </span>
                                        </div>
                                        <div className="apex-ov-bar" aria-hidden>
                                            <i style={{ width: `${Math.min(100, Math.max(0, barShare(m.key) * 100))}%` }} />
                                        </div>
                                        <div className="apex-ov-split__cap">{barCaption(m.key)}</div>
                                    </Selectable>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {tiles.length > 0 ? (
                        <div className="apex-ov-card">
                            <div className="apex-ov-card__head">
                                <h3>Key ratios</h3>
                            </div>
                            <div className="apex-ov-tiles">
                                {tiles.map((m) => (
                                    <Selectable
                                        key={m.key}
                                        metric={m}
                                        className="apex-ov-tile"
                                        active={isActive(m.key)}
                                        {...shared}
                                    >
                                        <span className="apex-ov-tile__ic">
                                            {React.createElement(ICONS[m.key] || FiTag, { "aria-hidden": true })}
                                        </span>
                                        <b>
                                            <Value value={m.value} />
                                        </b>
                                        <small>{m.label}</small>
                                        <Delta metric={m} />
                                    </Selectable>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </section>
    );
}
