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
                        label: "Gross turnover",
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
                        label: "Total Sales",
                        tooltip: "Total sales from Shopify (total_sales).",
                        prevVal: totalSalesDisplayPrev,
                        currVal: totalSalesDisplay,
                        zeroAsDash: false,
                    },
                    {
                        label: "Net Sales",
                        tooltip: "Net sales (net_sales). All P&L calculations are based on this value.",
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
                        tooltip: `COGS = Net sales * COGS percentage (${Math.round((staticExpenses.cogsPercentage || 0) * 100)}%)`,
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
                        tooltip: `Shipping = Orders * Shipping cost per order (${fmt(staticExpenses.shippingCostPerOrder || 0)})`,
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
                        label: "Marketing Spend",
                        tooltip: "Marketing Spend = Facebook Adspend + Google Adspend (sum of daily spends)",
                        prevVal: marketingSpendPrev,
                        currVal: marketingSpend,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Marketing Bureau",
                        tooltip: `Marketing Bureau = Total bureau cost / days (${days})`,
                        prevVal: marketingBureauPrev,
                        currVal: marketingBureau,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Marketing Tooling",
                        tooltip: `Marketing Tooling = Total tooling cost / days (${days})`,
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
                        tooltip: `Fixed Expenses = Total fixed expenses / days (${days})`,
                        prevVal: fixedExpensesPrev,
                        currVal: fixedExpenses,
                        zeroAsDash: false,
                        higherIsBetter: false,
                    },
                    {
                        label: "Result",
                        tooltip: "Result = DB3 - Fixed Expenses",
                        prevVal: resultPrev,
                        currVal: result,
                        bold: true,
                        zeroAsDash: false,
                    },
                ]}
            />
            <div className="flex gap-4 mt-6">
                <div className="flex-1 bg-[var(--color-primary-searchmind)] text-white rounded-lg p-4 flex flex-col items-center border border-gray-200 rounded-xl px-6 py-5">
                    <Tooltip content="Realized ROAS = Net Sales / Marketing Spend">
                        <span className="flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Realized ROAS</div>
                            <div className="text-3xl font-bold text-white">{realizedROAS.toFixed(2)}</div>
                        </span>
                    </Tooltip>
                </div>
                <div className="flex-1 bg-[var(--color-primary-searchmind)] rounded-lg p-4 flex flex-col items-center border border-gray-200 rounded-xl px-6 py-5">
                    <Tooltip content="Break-even ROAS = Total Costs / Marketing Spend">
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
