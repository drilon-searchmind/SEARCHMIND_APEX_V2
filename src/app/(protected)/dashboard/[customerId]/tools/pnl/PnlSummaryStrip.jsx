"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import { fmt } from "./pnlUtils";

export default function PnlSummaryStrip({ result, realizedROAS, breakEvenROAS, loading }) {
    if (loading) return null;

    return (
        <div className="apex-pnl-summary">
            <div className="apex-pnl-summary__card is-primary">
                <Tooltip content="Result (Net Profit) = Net Sales − COGS − shipping/pick & pack − transaction fees − marketing spend − bureau − tooling − fixed expenses. Matches performance-dashboard Net Profit.">
                    <p className="apex-pnl-summary__label">Net result</p>
                </Tooltip>
                <p className="apex-pnl-summary__value">{fmt(result)}</p>
                <p className="apex-pnl-summary__hint">Bottom-line profit for the selected period</p>
            </div>
            <div className="apex-pnl-summary__card">
                <Tooltip content="Realized ROAS = Net Sales / total paid media spend (all connected ad platforms)">
                    <p className="apex-pnl-summary__label">Realized ROAS</p>
                </Tooltip>
                <p className="apex-pnl-summary__value">{realizedROAS.toFixed(2)}</p>
                <p className="apex-pnl-summary__hint">Net sales per kr. spent on ads</p>
            </div>
            <div className="apex-pnl-summary__card">
                <Tooltip content="Break-even ROAS = Total Costs / total paid media spend (all connected ad platforms)">
                    <p className="apex-pnl-summary__label">Break-even ROAS</p>
                </Tooltip>
                <p className="apex-pnl-summary__value">{breakEvenROAS.toFixed(2)}</p>
                <p className="apex-pnl-summary__hint">Minimum ROAS to cover all costs</p>
            </div>
        </div>
    );
}
