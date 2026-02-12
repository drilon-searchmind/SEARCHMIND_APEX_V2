
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PNLPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);
    const staticExpenses = customer?.CustomerStaticExpenses || {};
    const [revenueTypeState, setRevenueTypeState] = useState(customer?.CustomerSettings?.customerRevenueType || 'total_sales');

    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');

    // If today is the 1st of the month, use 1st as both start and end
    // Otherwise, use 1st as start and yesterday as end
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
    
    // Separate temp (input) and applied (fetch-triggered) date ranges
    const [tempDateRange, setTempDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [appliedDateRange, setAppliedDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Handlers for DateRangePicker (controlled)
    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedDateRange({ startDate, endDate });
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Metrics state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [merged, setMerged] = useState(null);

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}`);
                if (!res.ok) throw new Error('Failed to fetch merged data');
                const mergedData = await res.json();
                setMerged(mergedData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedDateRange]);

    // ***
    // *** P&L CALCULATION STRUCTURE
    // ***
    // *** This section calculates a Profit & Loss statement using a multi-level contribution margin approach:
    // ***
    // *** LEVEL 1 (DB1): Revenue - Cost of Goods Sold
    // *** LEVEL 2 (DB2): DB1 - Direct Selling Costs (Shipping + Transaction Fees)
    // *** LEVEL 3 (DB3): DB2 - Marketing Costs (Ad Spend + Bureau + Tooling)
    // *** RESULT: DB3 - Fixed Expenses (Net Profit/Loss)
    // ***
    // *** All calculations are performed for the selected date range period.
    // *** Monthly/annual static expenses are prorated to daily amounts based on days in period.
    // ***
    // Calculations
    // ***
    // *** FIELD: totalSales
    // *** TYPE: Revenue Metric (Non-calculated aggregation)
    // *** EXPLANATION: Sum of all Shopify daily revenue values for the selected period
    // *** FORMULA: Σ(shopifyDaily[revenueType]) where revenueType is from CustomerSettings (default: 'total_sales')
    // *** SOURCE: Aggregated from merged.shopifyDaily array
    // ***
    let totalSales = 0, orders = 0, cogs = 0, db1 = 0, shipping = 0, transactionCosts = 0, db2 = 0;
    
    // ***
    // *** FIELD: orders
    // *** TYPE: Count Metric (Non-calculated aggregation)
    // *** EXPLANATION: Total number of orders from Shopify in the selected period
    // *** FORMULA: Σ(shopifyDaily.orders)
    // *** SOURCE: Aggregated from merged.shopifyDaily array
    // ***
    let marketingSpend = 0, marketingBureau = 0, marketingTooling = 0, db3 = 0, fixedExpenses = 0, result = 0;
    
    // ***
    // *** FIELD: realizedROAS, breakEvenROAS, totalCosts
    // *** TYPE: Performance Metrics (Calculated ratios)
    // *** EXPLANATION: ROAS metrics and total cost aggregation (see individual calculations below)
    // ***
    let realizedROAS = 0, breakEvenROAS = 0, totalCosts = 0;
    
    // ***
    // *** FIELD: db1Pct, db2Pct, db3Pct
    // *** TYPE: Percentage Metrics (For circle charts visualization)
    // *** EXPLANATION: Each DB level expressed as percentage of total sales
    // *** FORMULA: (DBx / totalSales) × 100
    // *** PURPOSE: Visual representation in radial bar charts
    // ***
    let db1Pct = 0, db2Pct = 0, db3Pct = 0;
    
    // ***
    // *** FIELD: days
    // *** TYPE: Period Calculation
    // *** EXPLANATION: Number of days in the selected date range (inclusive)
    // *** FORMULA: (endDate - startDate) + 1
    // *** PURPOSE: Used to prorate monthly static expenses to daily amounts
    // *** EXAMPLE: Jan 1 to Jan 5 = 5 days (not 4)
    // ***
    const start = new Date(appliedDateRange.startDate);
    const end = new Date(appliedDateRange.endDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((end - start) / msPerDay) + 1;

    if (merged && staticExpenses && days > 0) {
        // Revenue type logic
        const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
        
        // ***
        // *** FIELD: totalSales (calculation)
        // *** FORMULA: Σ(shopifyDaily[revenueType]) for all days in period
        // *** NOTE: revenueType can be 'total_sales', 'net_sales', or other Shopify revenue field
        // ***
        totalSales = merged.shopifyDaily?.reduce((sum, d) => sum + (d[revenueType] || 0), 0) || 0;
        
        // ***
        // *** FIELD: orders (calculation)
        // *** FORMULA: Σ(shopifyDaily.orders) for all days in period
        // ***
        orders = merged.shopifyDaily?.reduce((sum, d) => sum + (d.orders || 0), 0) || 0;
        
        // ***
        // *** FIELD: cogs (Cost of Goods Sold)
        // *** TYPE: Calculated Cost
        // *** EXPLANATION: Direct costs attributable to production of goods sold
        // *** FORMULA: totalSales × cogsPercentage
        // *** EXAMPLE: If totalSales = 100,000 DKK and COGS% = 0.40 (40%), then cogs = 40,000 DKK
        // *** SOURCE: cogsPercentage from CustomerStaticExpenses (stored as decimal, e.g., 0.40 = 40%)
        // ***
        const cogsPercentage = staticExpenses.cogsPercentage || 0;
        cogs = totalSales * cogsPercentage;
        
        // ***
        // *** FIELD: db1 (Deckungsbeitrag 1 / Contribution Margin 1)
        // *** TYPE: Calculated Profitability Metric
        // *** EXPLANATION: Gross profit after subtracting cost of goods sold
        // *** FORMULA: totalSales - cogs
        // *** INTERPRETATION: Revenue remaining after direct product costs
        // ***
        db1 = totalSales - cogs;
        
        // ***
        // *** FIELD: shipping
        // *** TYPE: Calculated Cost
        // *** EXPLANATION: Total shipping costs based on number of orders
        // *** FORMULA: orders × shippingCostPerOrder
        // *** EXAMPLE: If 100 orders × 25 DKK/order = 2,500 DKK
        // *** SOURCE: shippingCostPerOrder from CustomerStaticExpenses
        // ***
        shipping = orders * (staticExpenses.shippingCostPerOrder || 0);
        
        // ***
        // *** FIELD: transactionCosts
        // *** TYPE: Calculated Cost
        // *** EXPLANATION: Payment processing fees (e.g., credit card fees, PayPal fees)
        // *** FORMULA: totalSales × transactionCostPercentage
        // *** EXAMPLE: If totalSales = 100,000 DKK and transaction% = 0.025 (2.5%), then transactionCosts = 2,500 DKK
        // *** SOURCE: transactionCostPercentage from CustomerStaticExpenses (stored as decimal)
        // ***
        transactionCosts = totalSales * (staticExpenses.transactionCostPercentage || 0);
        
        // ***
        // *** FIELD: db2 (Deckungsbeitrag 2 / Contribution Margin 2)
        // *** TYPE: Calculated Profitability Metric
        // *** EXPLANATION: Profit after direct selling costs (shipping + transaction fees)
        // *** FORMULA: db1 - shipping - transactionCosts
        // *** INTERPRETATION: Revenue remaining after COGS and direct selling expenses
        // ***
        db2 = db1 - shipping - transactionCosts;
        
        // ***
        // *** FIELD: marketingSpend
        // *** TYPE: Calculated Cost (Aggregated from multiple sources)
        // *** EXPLANATION: Total advertising spend across Facebook and Google Ads
        // *** FORMULA: Σ(facebookDaily.spend) + Σ(googleDaily.spend)
        // *** SOURCE: Aggregated from merged.facebookDaily and merged.googleDaily arrays
        // *** NOTE: This is actual ad spend, not including agency/tooling costs
        // ***
        marketingSpend = (merged.facebookDaily?.reduce((sum, d) => sum + (d.spend || 0), 0) || 0) + (merged.googleDaily?.reduce((sum, d) => sum + (d.spend || 0), 0) || 0);
        
        // ***
        // *** FIELD: marketingBureau
        // *** TYPE: Calculated Cost (Prorated)
        // *** EXPLANATION: Daily prorated marketing agency/bureau costs
        // *** FORMULA: marketingBureauCost / days
        // *** EXAMPLE: If monthly bureau cost = 30,000 DKK and period = 15 days, then marketingBureau = 2,000 DKK/day
        // *** SOURCE: marketingBureauCost from CustomerStaticExpenses (typically monthly/annual amount)
        // *** PURPOSE: Allocates fixed monthly costs proportionally to the selected period
        // ***
        marketingBureau = (staticExpenses.marketingBureauCost || 0) / days;
        
        // ***
        // *** FIELD: marketingTooling
        // *** TYPE: Calculated Cost (Prorated)
        // *** EXPLANATION: Daily prorated marketing tool costs (e.g., analytics tools, ad platforms)
        // *** FORMULA: marketingToolingCost / days
        // *** EXAMPLE: If monthly tooling cost = 5,000 DKK and period = 10 days, then marketingTooling = 500 DKK/day
        // *** SOURCE: marketingToolingCost from CustomerStaticExpenses (typically monthly/annual amount)
        // *** PURPOSE: Allocates fixed monthly costs proportionally to the selected period
        // ***
        marketingTooling = (staticExpenses.marketingToolingCost || 0) / days;
        
        // ***
        // *** FIELD: db3 (Deckungsbeitrag 3 / Contribution Margin 3)
        // *** TYPE: Calculated Profitability Metric
        // *** EXPLANATION: Profit after all marketing costs (ad spend + bureau + tooling)
        // *** FORMULA: db2 - marketingSpend - marketingBureau - marketingTooling
        // *** INTERPRETATION: Revenue remaining after COGS, direct selling costs, and all marketing expenses
        // *** NOTE: Can be negative if marketing costs exceed db2
        // ***
        db3 = db2 - marketingSpend - marketingBureau - marketingTooling;
        
        // ***
        // *** FIELD: fixedExpenses
        // *** TYPE: Calculated Cost (Prorated)
        // *** EXPLANATION: Daily prorated fixed overhead costs (rent, salaries, utilities, etc.)
        // *** FORMULA: fixedExpenses / days
        // *** EXAMPLE: If monthly fixed expenses = 50,000 DKK and period = 20 days, then fixedExpenses = 2,500 DKK/day
        // *** SOURCE: fixedExpenses from CustomerStaticExpenses (typically monthly/annual amount)
        // *** PURPOSE: Allocates fixed monthly costs proportionally to the selected period
        // ***
        fixedExpenses = (staticExpenses.fixedExpenses || 0) / days;
        
        // ***
        // *** FIELD: result (Net Profit/Loss)
        // *** TYPE: Calculated Profitability Metric (Final)
        // *** EXPLANATION: Final profit or loss after all costs and expenses
        // *** FORMULA: db3 - fixedExpenses
        // *** INTERPRETATION: Bottom line profit/loss for the selected period
        // *** NOTE: Can be negative (loss) if total costs exceed revenue
        // ***
        result = db3 - fixedExpenses;
        
        // ***
        // *** FIELD: totalCosts
        // *** TYPE: Calculated Cost (Aggregation)
        // *** EXPLANATION: Sum of all costs and expenses
        // *** FORMULA: cogs + shipping + transactionCosts + marketingSpend + marketingBureau + marketingTooling + fixedExpenses
        // *** PURPOSE: Used for break-even ROAS calculation
        // ***
        totalCosts = cogs + shipping + transactionCosts + marketingSpend + marketingBureau + marketingTooling + fixedExpenses;
        
        // ***
        // *** FIELD: realizedROAS (Return on Ad Spend)
        // *** TYPE: Calculated Performance Ratio
        // *** EXPLANATION: Revenue generated per 1 DKK spent on marketing
        // *** FORMULA: totalSales / marketingSpend (if marketingSpend > 0, else 0)
        // *** EXAMPLE: If totalSales = 100,000 DKK and marketingSpend = 20,000 DKK, then realizedROAS = 5.0
        // *** INTERPRETATION: A ROAS of 5.0 means 5 DKK revenue per 1 DKK ad spend
        // *** NOTE: Only calculated when marketingSpend > 0 to avoid division by zero
        // ***
        realizedROAS = marketingSpend !== 0 ? totalSales / marketingSpend : 0;
        
        // ***
        // *** FIELD: breakEvenROAS
        // *** TYPE: Calculated Performance Ratio
        // *** EXPLANATION: Minimum ROAS needed to break even (cover all costs)
        // *** FORMULA: totalCosts / marketingSpend (if marketingSpend > 0, else 0)
        // *** EXAMPLE: If totalCosts = 80,000 DKK and marketingSpend = 20,000 DKK, then breakEvenROAS = 4.0
        // *** INTERPRETATION: A break-even ROAS of 4.0 means you need 4 DKK revenue per 1 DKK ad spend to break even
        // *** PURPOSE: Helps determine if current marketing spend is profitable
        // *** NOTE: Only calculated when marketingSpend > 0 to avoid division by zero
        // ***
        breakEvenROAS = marketingSpend !== 0 ? totalCosts / marketingSpend : 0;
        
        // ***
        // *** FIELD: db1Pct, db2Pct, db3Pct (Circle chart percentages)
        // *** TYPE: Calculated Percentage Metrics
        // *** EXPLANATION: Each DB level expressed as percentage of total sales for visualization
        // *** FORMULA: (DBx / totalSales) × 100 (if totalSales > 0, else 0)
        // *** EXAMPLE: If db1 = 60,000 DKK and totalSales = 100,000 DKK, then db1Pct = 60%
        // *** PURPOSE: Used in radial bar charts to show DB margins as % of revenue
        // *** NOTE: Only calculated when totalSales > 0 to avoid division by zero
        // ***
        db1Pct = totalSales !== 0 ? (db1 / totalSales) * 100 : 0;
        db2Pct = totalSales !== 0 ? (db2 / totalSales) * 100 : 0;
        db3Pct = totalSales !== 0 ? (db3 / totalSales) * 100 : 0;
    }

    return (
        <div className="w-full">
            <DashboardHeading
                title="P&L Report"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="pnl"
                dataSnapshot={{
                    totalSales,
                    orders,
                    cogs,
                    db1,
                    db2,
                    db3,
                    shipping,
                    transactionCosts,
                    marketingSpend,
                    marketingBureau,
                    marketingTooling,
                    fixedExpenses,
                    result,
                    realizedROAS,
                    breakEvenROAS,
                    totalCosts,
                    db1Pct,
                    db2Pct,
                    db3Pct,
                    staticExpenses,
                    days
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                    />
                }
            />
            <div className="flex flex-col md:flex-row gap-8 mt-4">
                {/* Left: Table as Cards */}
                <div className="flex-1 flex flex-col gap-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                    ) : error ? (
                        <div className="text-red-500">{error}</div>
                    ) : (
                        <>
                            {/* Section 1: Net turnover */}
                            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 transition-shadow">
                                <div className="font-bold text-gray-700 mb-1">Net turnover (turnover - discount & return)</div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Gross turnover</span>
                                    <Tooltip content="Sum of all Shopify total sales in the period.">
                                        <span>{totalSales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b py-1 text-gray-400"><span>Discounts</span><span>-</span></div>
                                <div className="flex justify-between border-b py-1 text-gray-400"><span>Refunds</span><span>-</span></div>
                                <div className="flex justify-between border-b py-1 text-gray-400"><span>Delivery Fees</span><span>-</span></div>
                                <div className="flex justify-between border-b py-1 text-gray-400"><span>Taxes</span><span>-</span></div>
                                <div className="flex justify-between border-b-2 font-bold py-1">
                                    <Tooltip content="Total sales = Gross turnover (Shopify total sales)">
                                        <span>Total Sales ({customer?.CustomerSettings?.customerRevenueType})</span>
                                    </Tooltip>
                                    <span>{totalSales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                            </div>
                            {/* Section 2: DB1 */}
                            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 transition-shadow">
                                <div className="font-bold text-gray-700 mb-1">DB1 (turnover - cost of goods sold)</div>
                                <div className="flex justify-between border-b py-1">
                                    <span>COGS</span>
                                    <Tooltip content={`COGS = Net sales * COGS percentage (${(staticExpenses.cogsPercentage * 100).toFixed(2)}%)`}>
                                        <span>{cogs.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b-2 font-bold py-1">
                                    <Tooltip content="Total DB1 = Net Sales - COGS">
                                        <span>Total, DB1</span>
                                    </Tooltip>
                                    <span>{db1.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                            </div>
                            {/* Section 3: DB2 */}
                            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 transition-shadow">
                                <div className="font-bold text-gray-700 mb-1">DB2 (DB1 - direct selling costs)</div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Shipping</span>
                                    <Tooltip content={`Shipping = Orders * Shipping cost per order (${staticExpenses.shippingCostPerOrder || 0})`}>
                                        <span>{shipping.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Transaction Costs</span>
                                    <Tooltip content={`Transaction Costs = Net sales * Transaction cost percentage (${(staticExpenses.transactionCostPercentage * 100).toFixed(2)}%)`}>
                                        <span>{transactionCosts.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b-2 font-bold py-1">
                                    <Tooltip content="Total DB2 = DB1 - Shipping - Transaction Costs">
                                        <span>Total, DB2</span>
                                    </Tooltip>
                                    <span>{db2.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                            </div>
                            {/* Section 4: DB3 */}
                            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 transition-shadow">
                                <div className="font-bold text-gray-700 mb-1">DB3 (DB2 - marketing costs)</div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Marketing Spend</span>
                                    <Tooltip content="Marketing Spend = Facebook Adspend + Google Adspend (sum of daily spends)">
                                        <span>{marketingSpend.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Marketing Bureau</span>
                                    <Tooltip content={`Marketing Bureau = Total bureau cost / days (${days})`}>
                                        <span>{marketingBureau.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Marketing Tooling</span>
                                    <Tooltip content={`Marketing Tooling = Total tooling cost / days (${days})`}>
                                        <span>{marketingTooling.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b-2 font-bold py-1">
                                    <Tooltip content="Total DB3 = DB2 - Marketing Spend - Marketing Bureau - Marketing Tooling">
                                        <span>Total, DB3</span>
                                    </Tooltip>
                                    <span>{db3.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                            </div>
                            {/* Section 5: Result */}
                            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 transition-shadow">
                                <div className="font-bold text-gray-700 mb-1">Result</div>
                                <div className="flex justify-between border-b py-1">
                                    <span>Fixed Expenses</span>
                                    <Tooltip content={`Fixed Expenses = Total fixed expenses / days (${days})`}>
                                        <span>{fixedExpenses.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                    </Tooltip>
                                </div>
                                <div className="flex justify-between border-b-2 font-bold py-1">
                                    <Tooltip content="Result = DB3 - Fixed Expenses">
                                        <span>Result</span>
                                    </Tooltip>
                                    <span>{result.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                            </div>
                            {/* Bottom: ROAS */}
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
                        </>
                    )}
                </div>
                {/* Right: Circle charts */}
                <div className="w-full md:w-1/3 flex flex-col gap-4" key={`charts-${appliedDateRange.startDate}-${appliedDateRange.endDate}`}>
                    {/* DB1 Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                        <h6 class="text-[var(--color-primary-searchmind)] mb-2 font-bold">DB1</h6>
                        <ReactApexChart
                            key={`db1-${appliedDateRange.startDate}-${appliedDateRange.endDate}`}
                            options={{
                                chart: { type: 'radialBar', sparkline: { enabled: true } },
                                plotOptions: {
                                    radialBar: {
                                        startAngle: -100,
                                        endAngle: 100,
                                        hollow: { size: '70%' },
                                        track: { background: '#f3f4f6', strokeWidth: '100%' },
                                        dataLabels: {
                                            name: { show: false },
                                            value: {
                                                offsetY: 10,
                                                fontSize: '32px',
                                                fontWeight: 700,
                                                color: '#213834',
                                                formatter: val => `${val}%`,
                                            },
                                        },
                                    },
                                },
                                stroke: { lineCap: 'round' },
                                fill: { colors: ['#406969'] },
                                labels: ['DB1'],
                            }}
                            series={[Number(db1Pct.toFixed(2))]}
                            type="radialBar"
                            height={250}
                            width={250}
                        />
                        <p className="mt-5 text-gray-500">Total DB1: {db1.toFixed(2)}</p>
                    </div>
                    {/* DB2 Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                        <h6 class="text-[var(--color-primary-searchmind)] mb-2 font-bold">DB2</h6>
                        <ReactApexChart
                            key={`db2-${appliedDateRange.startDate}-${appliedDateRange.endDate}`}
                            options={{
                                chart: { type: 'radialBar', sparkline: { enabled: true } },
                                plotOptions: {
                                    radialBar: {
                                        startAngle: -100,
                                        endAngle: 100,
                                        hollow: { size: '70%' },
                                        track: { background: '#f3f4f6', strokeWidth: '100%' },
                                        dataLabels: {
                                            name: { show: false },
                                            value: {
                                                offsetY: 10,
                                                fontSize: '32px',
                                                fontWeight: 700,
                                                color: '#213834',
                                                formatter: val => `${val}%`,
                                            },
                                        },
                                    },
                                },
                                stroke: { lineCap: 'round' },
                                fill: { colors: ['#C6ED62'] },
                                labels: ['DB2'],
                            }}
                            series={[Number(db2Pct.toFixed(2))]}
                            type="radialBar"
                            height={250}
                            width={250}
                        />
                        <p className="mt-5 text-gray-500">Total DB2: {db2.toFixed(2)}</p>
                    </div>
                    {/* DB3 Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                        <h6 class="text-[var(--color-primary-searchmind)] mb-2 font-bold">DB3</h6>
                        <ReactApexChart
                            key={`db3-${appliedDateRange.startDate}-${appliedDateRange.endDate}`}
                            options={{
                                chart: { type: 'radialBar', sparkline: { enabled: true } },
                                plotOptions: {
                                    radialBar: {
                                        startAngle: -100,
                                        endAngle: 100,
                                        hollow: { size: '70%' },
                                        track: { background: '#f3f4f6', strokeWidth: '100%' },
                                        dataLabels: {
                                            name: { show: false },
                                            value: {
                                                offsetY: 10,
                                                fontSize: '32px',
                                                fontWeight: 700,
                                                color: db3Pct < 0 ? '#F87171' : '#213834',
                                                formatter: val => `${val}%`,
                                            },
                                        },
                                    },
                                },
                                stroke: { lineCap: 'round' },
                                fill: { colors: [db3Pct < 0 ? '#F87171' : '#406969'] },
                                labels: ['DB3'],
                            }}
                            series={[Number(db3Pct.toFixed(2))]}
                            type="radialBar"
                            height={250}
                            width={250}
                        />
                        <p className="mt-5 text-gray-500">Total DB3: {db3.toFixed(2)}</p>
                    </div>
                    {/* Static Expenses Card */}
                    {/* ***
                        *** SECTION: Static Expenses Display
                        *** TYPE: Configuration Values (Non-calculated)
                        *** EXPLANATION: Shows the raw static expense values from CustomerStaticExpenses
                        *** PURPOSE: Allows users to see what expense rates/amounts are being used in calculations
                        *** SOURCE: customer.CustomerStaticExpenses object
                        *** NOTE: These are the base values used in calculations above (prorated for period)
                        *** */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
                        <div className="text-xs font-semibold mb-2 text-gray-500">Static Expenses</div>
                        {/* *** FIELD: COGS % (display) - Percentage used in cogs calculation *** */}
                        <div className="flex justify-between text-sm"><span>COGS %</span><span>{((staticExpenses.cogsPercentage || 0) * 100).toFixed(2)}%</span></div>
                        {/* *** FIELD: Shipping/order (display) - Cost per order used in shipping calculation *** */}
                        <div className="flex justify-between text-sm"><span>Shipping/order</span><span>{(staticExpenses.shippingCostPerOrder || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
                        {/* *** FIELD: Transaction % (display) - Percentage used in transactionCosts calculation *** */}
                        <div className="flex justify-between text-sm"><span>Transaction %</span><span>{((staticExpenses.transactionCostPercentage || 0) * 100).toFixed(2)}%</span></div>
                        {/* *** FIELD: Marketing Bureau (display) - Monthly/annual cost, prorated in marketingBureau calculation *** */}
                        <div className="flex justify-between text-sm"><span>Marketing Bureau</span><span>{(staticExpenses.marketingBureauCost || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
                        {/* *** FIELD: Marketing Tooling (display) - Monthly/annual cost, prorated in marketingTooling calculation *** */}
                        <div className="flex justify-between text-sm"><span>Marketing Tooling</span><span>{(staticExpenses.marketingToolingCost || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
                        {/* *** FIELD: Fixed Expenses (display) - Monthly/annual cost, prorated in fixedExpenses calculation *** */}
                        <div className="flex justify-between text-sm"><span>Fixed Expenses</span><span>{(staticExpenses.fixedExpenses || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
                        <div className="pt-2">
                            <a href={`/dashboard/${customer?._id}/config`} className="mt-4 text-sm underline hover:text-[var(--color-primary-searchmind-lighter)] text-center flex items-center justify-center gap-1 text-blue-500">
                                <span className="text-gray-500 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.149-.894c-.071-.424-.384-.764-.781-.93-.397-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.142-.854-.108-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.774-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Adjust your static expenses here.
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}