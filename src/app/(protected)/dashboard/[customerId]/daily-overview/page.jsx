'use client';

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import { useCustomers } from '@/hooks/useCustomers';
import { useParams } from 'next/navigation';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { useState, useMemo } from 'react';
import { useDailyOverviewData } from './useDailyOverviewData';
import DailyMetricsTable from './DailyMetricsTable';
import RowComparisonPopover from './RowComparisonPopover';
import LastYearPeriodTable from './LastYearPeriodTable';
import MetricToggleBar from './MetricToggleBar';
import { DEFAULT_VISIBLE_METRICS } from './metricConfig';
import GraphCard from '@/components/dashboard/GraphCard';
import { pushDashboardDateRangeApplied } from '@root/lib/gtmFunctions';

const DailyOverviewPage = () => {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;

    const [tempDateRange, setTempDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [appliedDateRange, setAppliedDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: 'daily_overview',
            customerId: params.customerId,
            startDate,
            endDate,
        });
        setAppliedDateRange({ startDate, endDate });
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
    };

    const {
        rows,
        rowsPrev,
        rowsLastYear,
        loading,
        loadingLastYear,
        error,
        revenueTypeState,
        customerMetricPreference,
    } = useDailyOverviewData(customer, appliedDateRange);

    const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
    const [hoveredRowTable, setHoveredRowTable] = useState(null);
    const [hoveredRowPosition, setHoveredRowPosition] = useState({
        top: 0,
        left: 0,
    });
    const [tableWidth, setTableWidth] = useState(null);

    const handleRowHover = ({ index, tableType, position, tableWidth: w }) => {
        setHoveredRowIndex(index);
        setHoveredRowTable(tableType);
        setHoveredRowPosition(position);
        setTableWidth(w);
    };
    const handleRowHoverLeave = () => {
        setHoveredRowIndex(null);
        setHoveredRowTable(null);
        setTableWidth(null);
    };

    const [visibleMetrics, setVisibleMetrics] = useState(DEFAULT_VISIBLE_METRICS);
    const handleMetricToggle = (key) => {
        setVisibleMetrics((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            const count = Object.values(next).filter(Boolean).length;
            if (count === 0) return prev;
            return next;
        });
    };

    const [showTrendChart, setShowTrendChart] = useState(false);

    const trendChartSeries = useMemo(() => {
        if (!rows?.length) return [];
        return [
            {
                name: 'Net Revenue',
                data: rows.map((r) => Math.round(r.netRevenue || 0)),
                color: '#406969',
            },
            {
                name: 'Spend',
                data: rows.map((r) =>
                    Math.round((r.ppcCost || 0) + (r.psCost || 0))
                ),
                color: '#D6CDB6',
            },
            {
                name: 'Net Profit',
                data: rows.map((r) => Math.round(r.netProfit ?? 0)),
                color: '#1E2B2B',
            },
        ];
    }, [rows]);

    const trendChartOptions = useMemo(
        () => ({
            chart: {
                id: 'daily-overview-trend',
                toolbar: { show: false },
                fontFamily: 'Outfit, sans-serif',
            },
            xaxis: {
                categories: rows?.map((r) => r.date) || [],
                labels: { rotate: -45 },
                axisTicks: { show: true },
                axisBorder: { show: true },
            },
            stroke: { curve: 'smooth', width: 2 },
            legend: { show: true, position: 'top' },
            tooltip: { shared: true },
            grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            dataLabels: { enabled: false },
        }),
        [rows]
    );

    return (
        <div id="DailyOverviewPage" className="w-full">
            <DashboardHeading
                title="Daily Overview"
                label={customer ? customer.customerName : ''}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="daily-overview"
                dataSnapshot={{
                    dailyRows: rows,
                    previousPeriodRows: rowsPrev,
                    lastYearRows: rowsLastYear,
                    metricPreference: customerMetricPreference,
                    revenueType: revenueTypeState,
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

            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-5">
                    <MetricToggleBar
                        visibleMetrics={visibleMetrics}
                        onToggle={handleMetricToggle}
                        showTrendChart={showTrendChart}
                        onTrendChartToggle={() => setShowTrendChart((v) => !v)}
                    />
                    <h3 className="text-lg font-semibold">Daily Metrics</h3>
                </div>
                {showTrendChart && rows?.length > 0 && (
                    <div className="mb-6">
                        <GraphCard
                            title="Net Revenue, Spend & Net Profit Over Time"
                            chartOptions={trendChartOptions}
                            chartSeries={trendChartSeries}
                            chartType="line"
                            height={320}
                        />
                    </div>
                )}
                <DailyMetricsTable
                    rows={rows}
                    rowsPrev={rowsPrev}
                    rowsLastYear={rowsLastYear}
                    loading={loading}
                    error={error}
                    visibleMetrics={visibleMetrics}
                    onRowHover={handleRowHover}
                    onRowHoverLeave={handleRowHoverLeave}
                />
            </div>

            <RowComparisonPopover
                visible={false}
                position={hoveredRowPosition}
                tableWidth={tableWidth}
                hoveredRowTable={hoveredRowTable}
                hoveredRowIndex={hoveredRowIndex}
                rows={rows}
                rowsLastYear={rowsLastYear}
                visibleMetrics={visibleMetrics}
            />

            <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-5">Last Year Period</h3>
                <LastYearPeriodTable
                    rowsLastYear={rowsLastYear}
                    rows={rows}
                    loading={loadingLastYear}
                    visibleMetrics={visibleMetrics}
                    onRowHover={handleRowHover}
                    onRowHoverLeave={handleRowHoverLeave}
                />
            </div>
        </div>
    );
};

export default DailyOverviewPage;
