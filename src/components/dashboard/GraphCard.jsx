import React from "react";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function GraphCard({ title, chartOptions, chartSeries, chartType = "line", children }) {
    // Toggle state (YTD active by default)
    const [toggle, setToggle] = React.useState("YTD");
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-between h-full min-h-[320px]">
            <div className="mb-2 flex justify-between items-center">
                <h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">{title}</h6>
                <div id="chartToggler">
                    <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                        <button
                            className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${toggle === 'YTD' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                            style={{ borderRadius: '8px 0 0 8px' }}
                            onClick={() => setToggle('YTD')}
                        >
                            YTD
                        </button>
                        <button
                            className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${toggle === 'Period' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                            style={{ borderRadius: '0 8px 8px 0' }}
                            onClick={() => setToggle('Period')}
                        >
                            Period
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center w-full">
                <div style={{ width: '100%' }}>
                    <ReactApexChart
                        options={chartOptions}
                        series={chartSeries}
                        type={chartType}
                        height={300}
                        width="100%"
                    />
                </div>
            </div>
            {children && <div className="mt-2">{children}</div>}
        </div>
    );
}
