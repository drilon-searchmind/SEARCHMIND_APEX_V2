
"use client";


import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import MetricCard from '@/components/dashboard/MetricCard';
import GraphCard from '@/components/dashboard/GraphCard';
import Spinner from '@/components/ui/Spinner';
import { FiMousePointer, FiEye, FiPercent, FiTrendingUp } from 'react-icons/fi';



const METRIC_OPTIONS = [
    { key: 'clicks', label: 'Clicks', icon: FiMousePointer },
    { key: 'impressions', label: 'Impressions', icon: FiEye },
    { key: 'ctr', label: 'CTR', icon: FiPercent },
    { key: 'position', label: 'Avg. Position', icon: FiTrendingUp },
];

function formatNumber(n) {
    return n?.toLocaleString('da-DK') ?? '-';
}

function calcCtr(clicks, impressions) {
    if (!impressions) return 0;
    return ((clicks / impressions) * 100).toFixed(2);
}

function calcAvgPosition(rows) {
    if (!rows?.length) return 0;
    const sum = rows.reduce((acc, r) => acc + (r.position || 0), 0);
    return (sum / rows.length).toFixed(2);
}

const defaultRange = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    return {
        startDate: defaultStart,
        endDate: defaultEnd,
    };
};


export default function SEODashboardPage() {
    const params = useParams();
    const customerId = params.customerId;
    const [range, setRange] = useState(defaultRange());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [urls, setUrls] = useState([]);
    const [selectedMetric, setSelectedMetric] = useState('clicks');
    const [siteUrl, setSiteUrl] = useState('');

    useEffect(() => {
        // Fetch customer settings
        async function fetchCustomer() {
            if (!customerId) return;
            try {
                const res = await fetch(`/api/customers/${customerId}`);
                if (!res.ok) throw new Error('Failed to fetch customer');
                const customer = await res.json();
                setSiteUrl(customer?.CustomerSettings?.googleSearchConsoleProperty || '');
            } catch (e) {
                setSiteUrl('');
            }
        }
        fetchCustomer();
    }, [customerId]);

    useEffect(() => {
        if (!siteUrl) return;
        fetchData();
        // eslint-disable-next-line
    }, [range.startDate, range.endDate, siteUrl]);

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/seo-dashboard/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteUrl, startDate: range.startDate, endDate: range.endDate }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'API error');
            setMetrics(data.metrics?.rows || []);
            setKeywords(data.keywords?.rows || []);
            setUrls(data.urls?.rows || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    // Aggregate main metrics
    const totalClicks = metrics?.reduce((acc, r) => acc + (r.clicks || 0), 0) || 0;
    const totalImpressions = metrics?.reduce((acc, r) => acc + (r.impressions || 0), 0) || 0;
    const avgCtr = calcCtr(totalClicks, totalImpressions);
    const avgPosition = calcAvgPosition(metrics);

    // Chart data for toggling
    const chartDataMap = {
        clicks: {
            name: 'Clicks',
            data: metrics?.map(r => r.clicks) || [],
            color: '#1E2B2B',
        },
        impressions: {
            name: 'Impressions',
            data: metrics?.map(r => r.impressions) || [],
            color: '#D6CDB6',
        },
        ctr: {
            name: 'CTR',
            data: metrics?.map(r => calcCtr(r.clicks, r.impressions)) || [],
            color: '#406969',
        },
        position: {
            name: 'Avg. Position',
            data: metrics?.map(r => r.position?.toFixed(2) ?? 0) || [],
            color: '#C6ED62',
        },
    };
    const chartSeries = [chartDataMap[selectedMetric]];
    const chartOptions = {
        chart: { id: 'seo-metrics', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: {
            categories: metrics?.map(r => r.keys?.[0]) || [],
            labels: { rotate: -45 },
            axisTicks: { show: true },
            axisBorder: { show: true },
        },
        colors: [chartDataMap[selectedMetric].color],
        stroke: { curve: 'smooth', width: 2 },
        legend: { position: 'top' },
        tooltip: { shared: true },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <DashboardHeading
                title="SEO Dashboard"
                label={siteUrl || 'No property set'}
                right={
                    <DateRangePicker
                        startDate={range.startDate}
                        endDate={range.endDate}
                        onStartDateChange={d => setRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setRange(r => ({ ...r, endDate: d }))}
                    />
                }
            />

            {loading ? (
                <div className="flex justify-center items-center h-64"><Spinner size={48} /></div>
            ) : error ? (
                <div className="text-red-500 text-center py-8">{error}</div>
            ) : (
                <>
                    {/* Metrics cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-6 mb-8">
                        {METRIC_OPTIONS.map(opt => {
                            let value, unit;
                            if (opt.key === 'clicks') value = formatNumber(totalClicks);
                            if (opt.key === 'impressions') value = formatNumber(totalImpressions);
                            if (opt.key === 'ctr') { value = avgCtr; unit = '%'; }
                            if (opt.key === 'position') value = avgPosition;
                            const Icon = opt.icon;
                            return (
                                <div
                                    key={opt.key}
                                    className="cursor-pointer"
                                    tabIndex={0}
                                    role="button"
                                    aria-pressed={selectedMetric === opt.key}
                                    onClick={() => setSelectedMetric(opt.key)}
                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedMetric(opt.key)}
                                    style={{ outline: 'none' }}
                                >
                                    <MetricCard
                                        label={opt.label}
                                        value={value}
                                        unit={unit}
                                        icon={<Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        isActive={selectedMetric === opt.key}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Chart with toggles */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-2">
                            {METRIC_OPTIONS.map(opt => (
                                <button
                                    key={opt.key}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${selectedMetric === opt.key ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                                    onClick={() => setSelectedMetric(opt.key)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <GraphCard
                            title={chartDataMap[selectedMetric].name + ' Over Time'}
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                        />
                    </div>

                    {/* Top Keywords */}
                    <div className="mb-8">
                        <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 p-6">
                            <h2 className="text-lg font-semibold mb-2">Top Keywords</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Keyword</th>
                                            <th className="px-4 py-2 text-right">Clicks</th>
                                            <th className="px-4 py-2 text-right">Impressions</th>
                                            <th className="px-4 py-2 text-right">CTR</th>
                                            <th className="px-4 py-2 text-right">Avg. Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {keywords.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-4">No data</td></tr>
                                        ) : keywords.map((row, i) => (
                                            <tr key={i} className="border-b last:border-b-0">
                                                <td className="px-4 py-2">{row.keys?.[0]}</td>
                                                <td className="px-4 py-2 text-right">{formatNumber(row.clicks)}</td>
                                                <td className="px-4 py-2 text-right">{formatNumber(row.impressions)}</td>
                                                <td className="px-4 py-2 text-right">{calcCtr(row.clicks, row.impressions)}%</td>
                                                <td className="px-4 py-2 text-right">{row.position?.toFixed(2) ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Top URLs */}
                    <div>
                        <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 p-6">
                            <h2 className="text-lg font-semibold mb-2">Top URLs</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left">URL</th>
                                            <th className="px-4 py-2 text-right">Clicks</th>
                                            <th className="px-4 py-2 text-right">Impressions</th>
                                            <th className="px-4 py-2 text-right">CTR</th>
                                            <th className="px-4 py-2 text-right">Avg. Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {urls.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-4">No data</td></tr>
                                        ) : urls.map((row, i) => (
                                            <tr key={i} className="border-b last:border-b-0">
                                                <td className="px-4 py-2"><a href={row.keys?.[0]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{row.keys?.[0]}</a></td>
                                                <td className="px-4 py-2 text-right">{formatNumber(row.clicks)}</td>
                                                <td className="px-4 py-2 text-right">{formatNumber(row.impressions)}</td>
                                                <td className="px-4 py-2 text-right">{calcCtr(row.clicks, row.impressions)}%</td>
                                                <td className="px-4 py-2 text-right">{row.position?.toFixed(2) ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}