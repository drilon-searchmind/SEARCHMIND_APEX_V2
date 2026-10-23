"use client";

import { useMemo } from "react";
import { FiEye, FiShoppingBag, FiPackage, FiLayers, FiArchive, FiDollarSign, FiTruck, FiAlertTriangle } from "react-icons/fi";
import { METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtInt = (v) => Math.round(num(v)).toLocaleString("da-DK");
const fmtRatio = (v) => num(v).toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct = (v, dp = 1) => `${(num(v) * 100).toLocaleString("da-DK", { maximumFractionDigits: dp })}%`;
const compact = (v) => {
    const n = num(v);
    const abs = Math.abs(n);
    if (abs >= 1e6) return `${(n / 1e6).toLocaleString("da-DK", { maximumFractionDigits: 1 })}m`;
    if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString("da-DK")}k`;
    return Math.round(n).toLocaleString("da-DK");
};

const TOP_N = 8;
const CATEGORY_N = 6;
/** Same thresholds as the catalog table's days-to-sold-out pills. */
const CRITICAL_DAYS = 15;
const WATCH_DAYS = 30;

function Kpi({ label, icon: Icon, value, unit, caption, hero = false, pending = false }) {
    return (
        <div className={`apex-ov-card apex-ov-kpi apex-ecom-kpi${hero ? " is-hero" : ""}`}>
            <div className="apex-ov-kpi__label">
                {hero ? null : (
                    <span className="apex-ov-ic">
                        <Icon aria-hidden />
                    </span>
                )}
                <span>{label}</span>
                {hero ? <FiEye className="apex-ov-kpi__eye" aria-hidden /> : null}
            </div>
            <div className="apex-ov-kpi__value">
                {pending ? <span className="apex-ecom-inline-spinner" role="status" aria-label="Loading" /> : value}
                {!pending && unit ? <small>{unit}</small> : null}
            </div>
            {caption ? (
                <div className="apex-ov-kpi__row">
                    <span className="apex-ov-vs">{caption}</span>
                </div>
            ) : null}
        </div>
    );
}

/**
 * Products overview (DESIGN.md · Ecommerce view): KPIs, top products, net sales by category and a
 * stock watch, all from the catalog and period summary the Products tab already loads.
 */
export default function ProductOverview({
    summary,
    products,
    catalogTotalCount,
    inventoryTotals,
    inventoryPending,
    inventoryLoading,
}) {
    const sales = num(summary.totalSalesExVat);
    const orders = num(summary.totalOrders);
    const units = num(summary.totalUnits);

    const data = useMemo(() => {
        const list = (products || []).filter((p) => num(p.totalRevenue) > 0);
        const productSales = list.reduce((s, p) => s + num(p.totalRevenue), 0);
        const top = [...list].sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue)).slice(0, TOP_N);

        const byCat = new Map();
        for (const p of list) {
            const cat = (p.productType || "").trim() || "Uncategorised";
            byCat.set(cat, (byCat.get(cat) || 0) + num(p.totalRevenue));
        }
        const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
        const shownCats = cats.slice(0, CATEGORY_N);
        const otherCats = cats.slice(CATEGORY_N).reduce((s, [, v]) => s + v, 0);
        if (otherCats > 0) shownCats.push([`Other (${cats.length - CATEGORY_N})`, otherCats]);

        const withDays = (products || []).filter((p) => p.avgDaysToSoldOut != null && Number.isFinite(Number(p.avgDaysToSoldOut)));
        const critical = withDays.filter((p) => p.avgDaysToSoldOut < CRITICAL_DAYS).sort((a, b) => a.avgDaysToSoldOut - b.avgDaysToSoldOut);
        const watch = withDays.filter((p) => p.avgDaysToSoldOut >= CRITICAL_DAYS && p.avgDaysToSoldOut <= WATCH_DAYS);

        return { productSales, top, cats: shownCats, catMax: shownCats[0]?.[1] || 0, critical, watch };
    }, [products]);

    const stock = inventoryTotals ? num(inventoryTotals.inventoryStock) : null;
    const stockValue = inventoryTotals ? num(inventoryTotals.inventoryValue) : null;
    const incoming = inventoryTotals ? num(inventoryTotals.incomingQuantity) : null;

    return (
        <div className="apex-ecom-overview">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <Kpi
                    hero
                    label="Total sales excl. VAT"
                    value={fmtInt(sales)}
                    unit="kr."
                    caption={`${fmtInt(orders)} orders, ${fmtInt(units)} units sold`}
                />
                <Kpi label="Orders" icon={FiShoppingBag} value={fmtInt(orders)} caption="Selected period" />
                <Kpi
                    label="Average order value"
                    icon={FiDollarSign}
                    value={orders > 0 ? fmtInt(sales / orders) : "-"}
                    unit={orders > 0 ? "kr." : null}
                    caption="Total sales excl. VAT per order"
                />
                <Kpi
                    label="Units per order"
                    icon={FiLayers}
                    value={orders > 0 ? fmtRatio(units / orders) : "-"}
                    caption={`${fmtInt(catalogTotalCount ?? products.length)} products in catalog`}
                />
            </div>

            <div className="apex-ov-grid apex-ecom-kpis-3">
                <Kpi
                    label="Inventory stock"
                    icon={FiArchive}
                    value={fmtInt(stock)}
                    unit="units"
                    caption="Full catalog"
                    pending={inventoryPending}
                />
                <Kpi
                    label="Inventory value"
                    icon={FiPackage}
                    value={compact(stockValue)}
                    unit="kr."
                    caption="Full catalog"
                    pending={inventoryPending}
                />
                <Kpi
                    label="Incoming stock"
                    icon={FiTruck}
                    value={fmtInt(incoming)}
                    unit="units"
                    caption="Open transfers and purchase orders"
                    pending={inventoryPending}
                />
            </div>

            <div className="apex-ov-grid apex-ecom-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Top products</h3>
                        <span className="apex-ov-sub">By net sales, selected period</span>
                    </div>
                    <div className="apex-mk-tbl-wrap">
                        <table className="apex-mk-tbl">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th>Units</th>
                                    <th>Net sales</th>
                                    <th>Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.top.map((p, i) => (
                                    <tr key={p.id || p.handle || i}>
                                        <td>
                                            <span className="apex-ecom-top__name" title={p.title}>
                                                <span className="apex-ecom-top__rank">{i + 1}</span>
                                                <span className="apex-ecom-top__text">{p.title}</span>
                                            </span>
                                        </td>
                                        <td className="apex-mk-muted">{p.productType || "-"}</td>
                                        <td>{fmtInt(p.unitsSold)}</td>
                                        <td>{fmtInt(p.totalRevenue)} kr.</td>
                                        <td>{data.productSales > 0 ? fmtPct(num(p.totalRevenue) / data.productSales, 0) : "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="apex-mk-note">Share is of product net sales (excludes shipping income).</p>
                </section>

                <div className="apex-ecom-stack">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Net sales by category</h3>
                        </div>
                        <div className="apex-ecom-cats">
                            {data.cats.map(([name, value], i) => (
                                <div key={name} className="apex-ecom-cat">
                                    <div className="apex-ecom-cat__top">
                                        <span title={name}>{name}</span>
                                        <b>{compact(value)}</b>
                                    </div>
                                    <div className="apex-ov-bar">
                                        <i
                                            style={{
                                                width: `${data.catMax > 0 ? (value / data.catMax) * 100 : 0}%`,
                                                background: METRIC_CHART_PALETTE[i % METRIC_CHART_PALETTE.length],
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Stock watch</h3>
                            <span className="apex-ov-sub">Days to sold out</span>
                        </div>
                        {inventoryLoading && !data.critical.length && !data.watch.length ? (
                            <p className="apex-mk-note apex-ecom-stock__empty">Loading inventory for loaded products</p>
                        ) : (
                            <>
                                <div className="apex-ecom-stock__counts">
                                    <div className="apex-ecom-stock__count is-bad">
                                        <b>{data.critical.length}</b>
                                        <small>Under {CRITICAL_DAYS} days</small>
                                    </div>
                                    <div className="apex-ecom-stock__count is-warn">
                                        <b>{data.watch.length}</b>
                                        <small>{CRITICAL_DAYS} to {WATCH_DAYS} days</small>
                                    </div>
                                </div>
                                {data.critical.slice(0, 4).map((p, i) => (
                                    <div key={p.id || p.handle || i} className="apex-ecom-stock__row">
                                        <FiAlertTriangle aria-hidden />
                                        <span className="apex-ecom-top__text" title={p.title}>{p.title}</span>
                                        <span className="apex-mk-tag is-bad">{Math.round(p.avgDaysToSoldOut)} days</span>
                                    </div>
                                ))}
                                {!data.critical.length ? (
                                    <p className="apex-mk-note apex-ecom-stock__empty">No loaded products sell out within {CRITICAL_DAYS} days.</p>
                                ) : null}
                            </>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
