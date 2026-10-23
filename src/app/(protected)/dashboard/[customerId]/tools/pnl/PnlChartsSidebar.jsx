"use client";

import Link from "next/link";
import { FiSettings } from "react-icons/fi";
import { fmt } from "./pnlUtils";

/** Static expense settings behind the P&L (contribution margins live in PnlOverview). */
export default function PnlChartsSidebar({ customerId, staticExpenses }) {
    return (
        <aside className="apex-pnl-aside">
            <div className="apex-pnl-static">
                <h3 className="apex-pnl-static__title">Static expenses</h3>
                <div className="apex-pnl-static__row">
                    <span>COGS %</span>
                    <span>{Math.round((staticExpenses.cogsPercentage || 0) * 100)}%</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Shipping per order</span>
                    <span>{fmt(staticExpenses.shippingCostPerOrder || 0)}</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Transaction %</span>
                    <span>{Math.round((staticExpenses.transactionCostPercentage || 0) * 100)}%</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Marketing bureau</span>
                    <span>{fmt(staticExpenses.marketingBureauCost || 0)}</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Marketing tooling</span>
                    <span>{fmt(staticExpenses.marketingToolingCost || 0)}</span>
                </div>
                <div className="apex-pnl-static__row">
                    <span>Fixed expenses</span>
                    <span>{fmt(staticExpenses.fixedExpenses || 0)}</span>
                </div>
                <Link href={`/dashboard/${customerId}/config`} className="apex-pnl-static__link">
                    <span className="apex-perf-btn apex-perf-btn--ghost">
                        <FiSettings aria-hidden />
                        Adjust static expenses
                    </span>
                </Link>
            </div>
        </aside>
    );
}
