"use client";

import Spinner from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import MetricSection from "./MetricSection";
import { fmt } from "./pnlUtils";

export default function PnlLeftSection({
    loading,
    error,
    hasPrev,
    comparisonLabel,
    staticExpenses,
    days,
    fetchCogs = false,
    // Current
    grossSales,
    totalSalesDisplay,
    discounts,
    refunds,
    deliveryFees,
    taxes,
    totalSales,
    cogs,
    db1,
    shipping,
    transactionCosts,
    db2,
    marketingSpend,
    channelSpendTotals = {},
    marketingBureau,
    marketingTooling,
    db3,
    fixedExpenses,
    result,
    realizedROAS,
    breakEvenROAS,
    db1CTSDisplay,
    db2CTSDisplay,
    db3CTSDisplay,
    db1DGDisplay,
    db2DGDisplay,
    db3DGDisplay,
    // Visibility: only breakdown rows for integrations with meaningful spend
    visibleAdSpendChannels = [],
    primarySalesRevenueLabel = "Net Sales",
    // Previous
    grossSalesPrev,
    totalSalesDisplayPrev,
    discountsPrev,
    refundsPrev,
    deliveryFeesPrev,
    taxesPrev,
    totalSalesPrev,
    cogsPrev,
    db1Prev,
    shippingPrev,
    transactionCostsPrev,
    db2Prev,
    marketingSpendPrev,
    channelSpendTotalsPrev = {},
    marketingBureauPrev,
    marketingToolingPrev,
    db3Prev,
    fixedExpensesPrev,
    resultPrev,
}) {
    if (loading) {
        return (
            <div className="flex justify-center h-64">
                <Spinner size={40} color="#406969" />
            </div>
        );
    }
    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <div className="flex-1 flex flex-col gap-4">
            <MetricSection
                title="Net turnover (turnover - discount & return)"
                comparisonLabel={comparisonLabel}
                hasPrev={hasPrev}
                rows={[
                    {
                        label: "Gross sales",
                        tooltip: "Sum of all Shopify gross sales in the period.",
                        prevVal: grossSalesPrev,
                        currVal: grossSales,
                        zeroAsDash: false,
                    },
                    {
                        label: "Discounts",
                        tooltip: "Sum of all discounts from Shopify in the period.",
                        prevVal: discountsPrev,
                        currVal: discounts,
                        higherIsBetter: false,
                    },
                    {
                        label: "Refunds",
                        tooltip: "Sum of all returns/refunds from Shopify in the period.",
                        prevVal: refundsPrev,
                        currVal: refunds,
                        higherIsBetter: false,
                    },
                    {
                        label: "Delivery Fees",
                        tooltip: "Sum of all shipping charges from Shopify in the period.",
                        prevVal: deliveryFeesPrev,
                        currVal: deliveryFees,
                    },
                    {
                        label: "Taxes",
                        tooltip: "Sum of all taxes from Shopify in the period.",
                        prevVal: taxesPrev,
                        currVal: taxes,
                    },
                    {
                        label: primarySalesRevenueLabel,
                        tooltip:
                            "Matches performance-dashboard Total Sales (VAT setting + custom KPI replacement). All P&L calculations are based on this value.",
                        prevVal: totalSalesPrev,
                        currVal: totalSales,
                        bold: true,
                        zeroAsDash: false,
                    },
                ]}
            />
            <MetricSection
                title="DB1 (turnover - cost of goods sold)"
                comparisonLabel={comparisonLabel}
                hasPrev={hasPrev}
                rows={[
                    {
                        label: "COGS",
                        tooltip: fetchCogs
                            ? "COGS (from Shopify store) = Sum of cost_of_goods_sold per day"
                            : `COGS = Net sales × COGS percentage (${Math.round((staticExpenses.cogsPercentage || 0) * 100)}%)`,
                        prevVal: cogsPrev,
                        currVal: cogs,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Total, DB1",
                        tooltip: "Total DB1 = Net Sales - COGS",
                        prevVal: db1Prev,
                        currVal: db1,
                        bold: true,
                        zeroAsDash: false,
                    },
                ]}
                ctsDisplay={db1CTSDisplay}
                dgTooltip="DG-% = 1 - (COGS / net_sales) — i.e. 100% - DB1 CTS"
                dgDisplay={db1DGDisplay}
            />
            <MetricSection
                title="DB2 (DB1 - direct selling costs)"
                comparisonLabel={comparisonLabel}
                hasPrev={hasPrev}
                rows={[
                    {
                        label: "Shipping",
                        tooltip: `Shipping + pick & pack = Orders × (shipping ${fmt(staticExpenses.shippingCostPerOrder || 0)} + pick & pack ${fmt(staticExpenses.pickNPackCostPerOrder || 0)})`,
                        prevVal: shippingPrev,
                        currVal: shipping,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Transaction Costs",
                        tooltip: `Transaction Costs = Net sales * Transaction cost percentage (${Math.round((staticExpenses.transactionCostPercentage || 0) * 100)}%)`,
                        prevVal: transactionCostsPrev,
                        currVal: transactionCosts,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Total, DB2",
                        tooltip: "Total DB2 = DB1 - Shipping - Transaction Costs",
                        prevVal: db2Prev,
                        currVal: db2,
                        bold: true,
                        zeroAsDash: false,
                    },
                ]}
                ctsDisplay={db2CTSDisplay}
                dgTooltip="DG-% = DB1 DG-% - DB2 CTS — i.e. previous DG% minus (Shipping + Transaction Costs)/net_sales"
                dgDisplay={db2DGDisplay}
            />
            <MetricSection
                title="DB3 (DB2 - marketing costs)"
                comparisonLabel={comparisonLabel}
                hasPrev={hasPrev}
                rows={[
                    {
                        label: "Marketing spend (total)",
                        tooltip:
                            "Total paid media: sum of daily spend across connected advertising platforms.",
                        prevVal: marketingSpendPrev,
                        currVal: marketingSpend,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    ...visibleAdSpendChannels.map((c) => ({
                        label: `· ${c.label}`,
                        labelClassName: "text-xs text-gray-600 pl-2",
                        tooltip: `${c.label} — sum of daily spend in the period.`,
                        prevVal: channelSpendTotalsPrev[c.metricsDataKey] ?? 0,
                        currVal: channelSpendTotals[c.metricsDataKey] ?? 0,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    })),
                    {
                        label: "Marketing Bureau",
                        tooltip: "Marketing Bureau — monthly cost prorated per calendar day in the selected period.",
                        prevVal: marketingBureauPrev,
                        currVal: marketingBureau,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Marketing Tooling",
                        tooltip: "Marketing Tooling — monthly cost prorated per calendar day in the selected period.",
                        prevVal: marketingToolingPrev,
                        currVal: marketingTooling,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Total, DB3",
                        tooltip: "Total DB3 = DB2 - Marketing Spend - Marketing Bureau - Marketing Tooling",
                        prevVal: db3Prev,
                        currVal: db3,
                        bold: true,
                        zeroAsDash: false,
                    },
                ]}
                ctsDisplay={db3CTSDisplay}
                dgTooltip="DG-% = DB2 DG-% - DB3 CTS — i.e. previous DG% minus (Marketing Spend + Marketing Bureau + Marketing Tooling)/net_sales"
                dgDisplay={db3DGDisplay}
            />
            <MetricSection
                title="Result"
                comparisonLabel={comparisonLabel}
                hasPrev={hasPrev}
                rows={[
                    {
                        label: "Fixed Expenses",
                        tooltip: "Other fixed expenses — monthly cost prorated per calendar day in the selected period.",
                        prevVal: fixedExpensesPrev,
                        currVal: fixedExpenses,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Result",
                        tooltip: "Result (Net Profit) = Net Sales − COGS − shipping/pick & pack − transaction fees − marketing spend − bureau − tooling − fixed expenses. Matches performance-dashboard Net Profit.",
                        prevVal: resultPrev,
                        currVal: result,
                        bold: true,
                        zeroAsDash: false,
                    },
                ]}
            />
            <div className="flex gap-4 mt-6">
                <div className="flex-1 bg-[var(--color-primary-searchmind)] text-white rounded-lg p-4 flex flex-col items-center border border-gray-200 rounded-xl px-6 py-5">
                    <Tooltip content="Realized ROAS = Net Sales / total paid media spend (all connected ad platforms)">
                        <span className="flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Realized ROAS</div>
                            <div className="text-3xl font-bold text-white">{realizedROAS.toFixed(2)}</div>
                        </span>
                    </Tooltip>
                </div>
                <div className="flex-1 bg-[var(--color-primary-searchmind)] rounded-lg p-4 flex flex-col items-center border border-gray-200 rounded-xl px-6 py-5">
                    <Tooltip content="Break-even ROAS = Total Costs / total paid media spend (all connected ad platforms)">
                        <span className="flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Break-even ROAS</div>
                            <div className="text-3xl font-bold text-white">{breakEvenROAS.toFixed(2)}</div>
                        </span>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}
