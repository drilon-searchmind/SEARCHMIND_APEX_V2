
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";

import Spinner from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PNLPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);
    const staticExpenses = customer?.CustomerStaticExpenses || {};

    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Handlers for DateRangePicker (controlled)
    const handleStartDateChange = (newStart) => {
        setDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Metrics state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [merged, setMerged] = useState(null);

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
                if (!res.ok) throw new Error('Failed to fetch merged data');
                const mergedData = await res.json();
                setMerged(mergedData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, dateRange]);

    // Calculations
    let totalSales = 0, orders = 0, cogs = 0, db1 = 0, shipping = 0, transactionCosts = 0, db2 = 0;
    let marketingSpend = 0, marketingBureau = 0, marketingTooling = 0, db3 = 0, fixedExpenses = 0, result = 0;
    let realizedROAS = 0, breakEvenROAS = 0, totalCosts = 0;
    // For circle charts (as % of total sales)
    let db1Pct = 0, db2Pct = 0, db3Pct = 0;
    // Days in picker
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((end - start) / msPerDay) + 1;

    if (merged && staticExpenses && days > 0) {
        totalSales = merged.shopifyDaily?.reduce((sum, d) => sum + (d.total_sales || 0), 0) || 0;
        orders = merged.shopifyDaily?.reduce((sum, d) => sum + (d.orders || 0), 0) || 0;
        const cogsPercentage = staticExpenses.cogsPercentage || 0;
        cogs = totalSales * cogsPercentage;
        db1 = totalSales - cogs;
        shipping = orders * (staticExpenses.shippingCostPerOrder || 0);
        transactionCosts = totalSales * (staticExpenses.transactionCostPercentage || 0);
        db2 = db1 - shipping - transactionCosts;
        marketingSpend = (merged.facebookDaily?.reduce((sum, d) => sum + (d.spend || 0), 0) || 0) + (merged.googleDaily?.reduce((sum, d) => sum + (d.spend || 0), 0) || 0);
        marketingBureau = (staticExpenses.marketingBureauCost || 0) / days;
        marketingTooling = (staticExpenses.marketingToolingCost || 0) / days;
        db3 = db2 - marketingSpend - marketingBureau - marketingTooling;
        fixedExpenses = (staticExpenses.fixedExpenses || 0) / days;
        result = db3 - fixedExpenses;
        totalCosts = cogs + shipping + transactionCosts + marketingSpend + marketingBureau + marketingTooling + fixedExpenses;
        realizedROAS = marketingSpend !== 0 ? totalSales / marketingSpend : 0;
        breakEvenROAS = marketingSpend !== 0 ? totalCosts / marketingSpend : 0;
        // Circle chart percentages (all as % of total sales)
        db1Pct = totalSales !== 0 ? (db1 / totalSales) * 100 : 0;
        db2Pct = totalSales !== 0 ? (db2 / totalSales) * 100 : 0;
        db3Pct = totalSales !== 0 ? (db3 / totalSales) * 100 : 0;
    }

    return (
        <div className="w-full">
            <DashboardHeading
                title="P&L Report"
                label={customer ? customer.customerName : ""}
                right={
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={e => handleStartDateChange(e.target.value)}
                            className="border rounded px-2 py-1 text-xs"
                        />
                        <span className="mx-1">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={e => handleEndDateChange(e.target.value)}
                            className="border rounded px-2 py-1 text-xs"
                        />
                    </div>
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
                            <div className="bg-white border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 transition-shadow">
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
                                        <span>Total Sales</span>
                                    </Tooltip>
                                    <span>{totalSales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                            </div>
                            {/* Section 2: DB1 */}
                            <div className="bg-white border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 transition-shadow">
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
                            <div className="bg-white border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 transition-shadow">
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
                            <div className="bg-white border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 transition-shadow">
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
                            <div className="bg-white border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 transition-shadow">
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
                                <div className="flex-1 bg-[var(--color-primary-searchmind)] text-white rounded-lg p-4 flex flex-col items-center border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5">
                                    <Tooltip content="Realized ROAS = Net Sales / Marketing Spend">
                                        <span className="flex flex-col items-center">
                                            <div className="text-xs text-gray-500 mb-1">Realized ROAS</div>
                                            <div className="text-3xl font-bold text-white">{realizedROAS.toFixed(2)}</div>
                                        </span>
                                    </Tooltip>
                                </div>
                                <div className="flex-1 bg-[var(--color-primary-searchmind)] rounded-lg p-4 flex flex-col items-center border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5">
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
                <div className="w-full md:w-1/3 flex flex-col gap-4">
                    {/* DB1 Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                        <h6 class="text-[var(--color-primary-searchmind)] mb-2 font-bold">DB1</h6>
                        <ReactApexChart
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
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
                        <div className="text-xs font-semibold mb-2 text-gray-500">Static Expenses</div>
                        <div className="flex justify-between text-sm"><span>COGS %</span><span>{((staticExpenses.cogsPercentage || 0) * 100).toFixed(2)}%</span></div>
                        <div className="flex justify-between text-sm"><span>Shipping/order</span><span>{(staticExpenses.shippingCostPerOrder || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
                        <div className="flex justify-between text-sm"><span>Transaction %</span><span>{((staticExpenses.transactionCostPercentage || 0) * 100).toFixed(2)}%</span></div>
                        <div className="flex justify-between text-sm"><span>Marketing Bureau</span><span>{(staticExpenses.marketingBureauCost || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
                        <div className="flex justify-between text-sm"><span>Marketing Tooling</span><span>{(staticExpenses.marketingToolingCost || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span></div>
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