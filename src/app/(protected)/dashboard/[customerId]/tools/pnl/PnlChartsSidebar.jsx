"use client";

import dynamic from "next/dynamic";
import { fmt } from "./pnlUtils";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

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

    return (
        <div className="w-full md:w-1/3 flex flex-col gap-4" key={key}>
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                <h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold text-sm">DB1</h6>
                <ReactApexChart
                    key={`db1-${key}`}
                    options={{
                        chart: { type: "radialBar", sparkline: { enabled: true } },
                        plotOptions: {
                            radialBar: {
                                startAngle: -100,
                                endAngle: 100,
                                hollow: { size: "70%" },
                                track: { background: "#f3f4f6", strokeWidth: "100%" },
                                dataLabels: {
                                    name: { show: false },
                                    value: {
                                        offsetY: 10,
                                        fontSize: "32px",
                                        fontWeight: 700,
                                        color: "#213834",
                                        formatter: (val) => `${val}%`,
                                    },
                                },
                            },
                        },
                        stroke: { lineCap: "round" },
                        fill: { colors: ["#406969"] },
                        labels: ["DB1"],
                    }}
                    series={[Math.round(db1Pct)]}
                    type="radialBar"
                    height={250}
                    width={250}
                />
                <p className="mt-5 text-gray-500 text-sm">Total DB1: {fmt(db1)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                <h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold text-sm">DB2</h6>
                <ReactApexChart
                    key={`db2-${key}`}
                    options={{
                        chart: { type: "radialBar", sparkline: { enabled: true } },
                        plotOptions: {
                            radialBar: {
                                startAngle: -100,
                                endAngle: 100,
                                hollow: { size: "70%" },
                                track: { background: "#f3f4f6", strokeWidth: "100%" },
                                dataLabels: {
                                    name: { show: false },
                                    value: {
                                        offsetY: 10,
                                        fontSize: "32px",
                                        fontWeight: 700,
                                        color: "#213834",
                                        formatter: (val) => `${val}%`,
                                    },
                                },
                            },
                        },
                        stroke: { lineCap: "round" },
                        fill: { colors: ["#C6ED62"] },
                        labels: ["DB2"],
                    }}
                    series={[Math.round(db2Pct)]}
                    type="radialBar"
                    height={250}
                    width={250}
                />
                <p className="mt-5 text-gray-500 text-sm">Total DB2: {fmt(db2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
                <h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold text-sm">DB3</h6>
                <ReactApexChart
                    key={`db3-${key}`}
                    options={{
                        chart: { type: "radialBar", sparkline: { enabled: true } },
                        plotOptions: {
                            radialBar: {
                                startAngle: -100,
                                endAngle: 100,
                                hollow: { size: "70%" },
                                track: { background: "#f3f4f6", strokeWidth: "100%" },
                                dataLabels: {
                                    name: { show: false },
                                    value: {
                                        offsetY: 10,
                                        fontSize: "32px",
                                        fontWeight: 700,
                                        color: db3Pct < 0 ? "#F87171" : "#213834",
                                        formatter: (val) => `${val}%`,
                                    },
                                },
                            },
                        },
                        stroke: { lineCap: "round" },
                        fill: { colors: [db3Pct < 0 ? "#F87171" : "#406969"] },
                        labels: ["DB3"],
                    }}
                    series={[Math.round(db3Pct)]}
                    type="radialBar"
                    height={250}
                    width={250}
                />
                <p className="mt-5 text-gray-500 text-sm">Total DB3: {fmt(db3)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-2">
                <div className="text-xs font-semibold mb-2 text-gray-500">Static Expenses</div>
                <div className="flex justify-between text-sm">
                    <span>COGS %</span>
                    <span>{Math.round((staticExpenses.cogsPercentage || 0) * 100)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Shipping/order</span>
                    <span>{fmt(staticExpenses.shippingCostPerOrder || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Transaction %</span>
                    <span>{Math.round((staticExpenses.transactionCostPercentage || 0) * 100)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Marketing Bureau</span>
                    <span>{fmt(staticExpenses.marketingBureauCost || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Marketing Tooling</span>
                    <span>{fmt(staticExpenses.marketingToolingCost || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Fixed Expenses</span>
                    <span>{fmt(staticExpenses.fixedExpenses || 0)}</span>
                </div>
                <div className="pt-2">
                    <a
                        href={`/dashboard/${customerId}/config`}
                        className="mt-4 text-sm underline hover:text-[var(--color-primary-searchmind-lighter)] text-center flex items-center justify-center gap-1 text-blue-500"
                    >
                        <span className="text-gray-500 flex items-center gap-1">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-4 h-4"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149-.894c-.09-.542-.56-.94-1.11-.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.149-.894c-.071-.424-.384-.764-.781-.93-.397-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.142-.854-.108-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.774-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
                                />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Adjust your static expenses here.
                        </span>
                    </a>
                </div>
            </div>
        </div>
    );
}
