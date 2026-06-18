"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FiSettings } from "react-icons/fi";
import { fmt, getPnlRadialChartOptions } from "./pnlUtils";
import { getCobaltChartTokens } from "@/lib/charts/cobaltChartTheme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

function PnlGauge({ label, pct, total, fillColor }) {
    const rounded = Math.round(pct);

    return (
        <div className="apex-pnl-gauge">
            <p className="apex-pnl-gauge__label">{label}</p>
            <ReactApexChart
                options={getPnlRadialChartOptions(rounded, fillColor)}
                series={[rounded]}
                type="radialBar"
                height={180}
                width={180}
            />
            <p className="apex-pnl-gauge__total">{fmt(total)}</p>
        </div>
    );
}

export default function PnlChartsSidebar({
    appliedDateRange,
    customerId,
    staticExpenses,
    db1Pct,
    db2Pct,
    db3Pct,
    db1,
    db2,
    db3,
}) {
    const key = `charts-${appliedDateRange?.startDate}-${appliedDateRange?.endDate}`;
    const t = getCobaltChartTokens();

    return (
        <aside className="apex-pnl-aside" key={key}>
            <div className="apex-pnl-gauges">
                <h3 className="apex-pnl-gauges__title">Contribution margins</h3>
                <div className="apex-pnl-gauges__grid">
                    <PnlGauge
                        label="DB1"
                        pct={db1Pct}
                        total={db1}
                        fillColor={t.accentLight}
                    />
                    <PnlGauge
                        label="DB2"
                        pct={db2Pct}
                        total={db2}
                        fillColor={t.ink}
                    />
                    <PnlGauge
                        label="DB3"
                        pct={db3Pct}
                        total={db3}
                        fillColor={db3Pct < 0 ? '#c53030' : t.neutral}
                    />
                </div>
            </div>

            <div className="apex-pnl-static">
                <h3 className="apex-pnl-static__title">Static expenses</h3>
                <div className="apex-pnl-static__row">
                    <span>COGS %</span>
                    <span>{Math.round((staticExpenses.cogsPercentage || 0) * 100)}%</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Shipping / order</span>
                    <span>{fmt(staticExpenses.shippingCostPerOrder || 0)}</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Transaction %</span>
                    <span>{Math.round((staticExpenses.transactionCostPercentage || 0) * 100)}%</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Marketing Bureau</span>
                    <span>{fmt(staticExpenses.marketingBureauCost || 0)}</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Marketing Tooling</span>
                    <span>{fmt(staticExpenses.marketingToolingCost || 0)}</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Fixed Expenses</span>
                    <span>{fmt(staticExpenses.fixedExpenses || 0)}</span>
                </div>
                <Link
                    href={`/dashboard/${customerId}/config`}
                    className="apex-pnl-static__link"
                >
                    <span className="apex-perf-btn apex-perf-btn--ghost">
                        <FiSettings aria-hidden />
                        Adjust static expenses
                    </span>
                </Link>
            </div>
        </aside>
    );
}
