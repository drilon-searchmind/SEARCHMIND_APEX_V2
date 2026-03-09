import React from "react";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const DARK_CHART_OVERRIDES = {
    chart: { foreColor: "#cbd5e1" },
    xaxis: { labels: { style: { colors: "#94a3b8" } } },
    yaxis: { labels: { style: { colors: "#94a3b8" } } },
    grid: { borderColor: "#2c353b", strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    tooltip: { theme: "dark" },
    legend: { labels: { colors: "#cbd5e1" } },
    colors: ["#C6ED62", "#60a5fa", "#94a3b8", "#cbd5e1", "#6ee7b7", "#f1f5f9"],
};

function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

export default function GraphCard({ title, chartOptions, chartSeries, chartType = "line", height = 300, children }) {
    // Toggle state (Period active by default)
    const [toggle, setToggle] = React.useState("Period");
    const [isDark, setIsDark] = React.useState(false);

    React.useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // Function to aggregate data by month
    const aggregateByMonth = React.useCallback((categories, seriesData) => {
        if (!categories || !seriesData || categories.length === 0) {
            return { categories: [], data: [] };
        }

        if (seriesData.length === 0) {
            return { categories: [], data: [] };
        }

        const monthlyData = {};

        categories.forEach((category, index) => {
            let monthKey;
            let sortKey;
            try {
                const date = new Date(category);
                if (!isNaN(date.getTime())) {
                    monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                } else {
                    monthKey = category;
                    sortKey = category;
                }
            } catch (e) {
                monthKey = category;
                sortKey = category;
            }

            if (!monthlyData[sortKey]) {
                monthlyData[sortKey] = {
                    label: monthKey,
                    values: []
                };
            }
            const value = Number(seriesData[index]) || 0;
            monthlyData[sortKey].values.push(value);
        });

        const sortedKeys = Object.keys(monthlyData).sort();
        const aggregatedCategories = sortedKeys.map(key => monthlyData[key].label);
        const aggregatedData = sortedKeys.map(key => {
            const values = monthlyData[key].values;
            const sum = values.reduce((acc, val) => acc + val, 0);
            return sum;
        });

        return { categories: aggregatedCategories, data: aggregatedData };
    }, []);

    // Process chart data based on toggle - always create fresh copies
    const processedData = React.useMemo(() => {
        // Create deep copies to prevent mutation
        let optionsCopy = JSON.parse(JSON.stringify(chartOptions));
        const seriesCopy = JSON.parse(JSON.stringify(chartSeries));

        if (isDark) {
            optionsCopy = deepMerge(optionsCopy, DARK_CHART_OVERRIDES);
            // Override per-series colors with dark-mode palette
            seriesCopy.forEach((s, i) => {
                s.color = DARK_CHART_OVERRIDES.colors[i % DARK_CHART_OVERRIDES.colors.length];
            });
        }
        
        if (toggle === "Monthly") {
            const categories = optionsCopy?.xaxis?.categories;
            const hasValidCategories = categories && Array.isArray(categories) && categories.length > 0;
            
            if (hasValidCategories && seriesCopy && seriesCopy.length > 0) {
                // Aggregate all series
                const aggregatedSeries = seriesCopy.map((series) => {
                    const result = aggregateByMonth(categories, series.data || []);
                    return {
                        ...series,
                        data: result.data
                    };
                });

                // Get aggregated categories from first series
                const aggregatedCategories = aggregateByMonth(categories, seriesCopy[0].data || []).categories;

                const processedOptions = {
                    ...optionsCopy,
                    chart: {
                        ...optionsCopy.chart,
                        type: 'bar',
                    },
                    xaxis: {
                        ...optionsCopy.xaxis,
                        categories: aggregatedCategories,
                        labels: {
                            ...optionsCopy.xaxis?.labels,
                            rotate: -45,
                        }
                    },
                    plotOptions: {
                        bar: {
                            borderRadius: 4,
                            columnWidth: '60%',
                        }
                    },
                    tooltip: {
                        ...optionsCopy.tooltip,
                        intersect: false,
                    }
                };

                return {
                    options: processedOptions,
                    series: aggregatedSeries,
                    type: 'bar'
                };
            }
        }
        
        // Return copies for Period view
        return {
            options: optionsCopy,
            series: seriesCopy,
            type: chartType
        };
    }, [toggle, chartOptions, chartSeries, chartType, aggregateByMonth, isDark]);

    return (
        <div className="bg-white dark:bg-[#181f23] rounded-xl border border-gray-200 dark:border-[#232a2f] p-6 flex flex-col justify-between h-full min-h-[320px]">
            <div className="mb-2 flex justify-between items-center">
                <h6 className="text-[var(--color-primary-searchmind)] dark:text-[#f1f5f9] mb-2 font-bold">{title}</h6>
                <div id="chartToggler">
                    <div className="flex border border-gray-200 dark:border-[#232a2f] bg-gray-100 dark:bg-[#232a2f] rounded-lg overflow-hidden">
                        <button
                            className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${toggle === 'Monthly' ? 'bg-white dark:bg-[#2c353b] text-[var(--color-primary-searchmind)] dark:text-[#f1f5f9] shadow-sm' : 'text-gray-500 dark:text-[#94a3b8] hover:text-[var(--color-primary-searchmind)] dark:hover:text-[#f1f5f9]'}`}
                            style={{ borderRadius: '8px 0 0 8px' }}
                            onClick={() => setToggle('Monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${toggle === 'Period' ? 'bg-white dark:bg-[#2c353b] text-[var(--color-primary-searchmind)] dark:text-[#f1f5f9] shadow-sm' : 'text-gray-500 dark:text-[#94a3b8] hover:text-[var(--color-primary-searchmind)] dark:hover:text-[#f1f5f9]'}`}
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
                        key={`chart-${toggle}`}
                        options={processedData.options}
                        series={processedData.series}
                        type={processedData.type}
                        height={height}
                        width="100%"
                    />
                </div>
            </div>
            {children && <div className="mt-2">{children}</div>}
        </div>
    );
}
