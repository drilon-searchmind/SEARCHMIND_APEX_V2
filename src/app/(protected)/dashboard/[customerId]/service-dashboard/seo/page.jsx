"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import MetricCard from '@/components/dashboard/MetricCard';
import GraphCard from '@/components/dashboard/GraphCard';
import Spinner from '@/components/ui/Spinner';
import SEOKeywordSettings from '@/components/seo/SEOKeywordSettings';
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
    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');

    // If today is the 1st of the month, use 1st as both start and end
    // Otherwise, use 1st as start and yesterday as end
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
    return {
        startDate: defaultStart,
        endDate: defaultEnd,
    };
};

export default function SEODashboardPage() {
    const params = useParams();
    const customerId = params.customerId;
    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [urls, setUrls] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState(['clicks']);

    // Ensure at least one metric is always selected
    useEffect(() => {
        if (selectedMetrics.length === 0) {
            setSelectedMetrics(['clicks']);
        }
    }, [selectedMetrics]);
    const [siteUrl, setSiteUrl] = useState('');

    // Keyword filtering state
    const [keywordFilter, setKeywordFilter] = useState('all'); // 'all', 'brand', 'exact:id', 'partial:id'
    const [brandKeywords, setBrandKeywords] = useState([]);
    const [exactGroups, setExactGroups] = useState([]);
    const [partialGroups, setPartialGroups] = useState([]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

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

    // Fetch keyword groups for filtering
    useEffect(() => {
        if (!customerId) return;
        fetchKeywordGroups();
    }, [customerId]);

    async function fetchKeywordGroups() {
        try {
            // Fetch brand keywords
            const brandRes = await fetch(`/api/seo-keywords/brand/${customerId}`);
            const brandData = await brandRes.json();
            if (brandData.success && brandData.data?.keywords) {
                setBrandKeywords(brandData.data.keywords);
            } else {
                setBrandKeywords([]);
            }

            // Fetch exact groups
            const exactRes = await fetch(`/api/seo-keywords/exact/${customerId}`);
            const exactData = await exactRes.json();
            if (exactData.success) {
                setExactGroups(exactData.data);
            } else {
                setExactGroups([]);
            }

            // Fetch partial groups
            const partialRes = await fetch(`/api/seo-keywords/partial/${customerId}`);
            const partialData = await partialRes.json();
            if (partialData.success) {
                setPartialGroups(partialData.data);
            } else {
                setPartialGroups([]);
            }
        } catch (error) {
            console.error('Error fetching keyword groups:', error);
        }
    }

    // Callback to refresh keyword groups when they're updated
    const handleKeywordGroupsUpdate = () => {
        fetchKeywordGroups();
    };

    useEffect(() => {
        if (!siteUrl) return;
        fetchData();
        // eslint-disable-next-line
    }, [appliedRange.startDate, appliedRange.endDate, siteUrl]);

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/seo-dashboard/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteUrl, startDate: appliedRange.startDate, endDate: appliedRange.endDate }),
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

    // Filter keywords based on selected group
    const filteredKeywords = React.useMemo(() => {
        if (keywordFilter === 'all') return keywords;

        if (keywordFilter === 'brand') {
            if (brandKeywords.length === 0) return [];
            return keywords.filter(row => {
                const keyword = (row.keys?.[0] || '').toLowerCase();
                return brandKeywords.some(brand => keyword.includes(brand.toLowerCase()));
            });
        }

        if (keywordFilter.startsWith('exact:')) {
            const groupId = keywordFilter.split(':')[1];
            const group = exactGroups.find(g => g._id === groupId);
            if (!group || !group.keywords.length) return [];
            const groupKeywordsLower = group.keywords.map(k => k.toLowerCase());
            return keywords.filter(row => {
                const keyword = (row.keys?.[0] || '').toLowerCase();
                return groupKeywordsLower.includes(keyword);
            });
        }

        if (keywordFilter.startsWith('partial:')) {
            const groupId = keywordFilter.split(':')[1];
            const group = partialGroups.find(g => g._id === groupId);
            if (!group || !group.keywords.length) return [];
            return keywords.filter(row => {
                const keyword = (row.keys?.[0] || '').toLowerCase();
                return group.keywords.some(partial => keyword.includes(partial.toLowerCase()));
            });
        }

        return keywords;
    }, [keywords, keywordFilter, brandKeywords, exactGroups, partialGroups]);

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
    const chartSeries = selectedMetrics.map(metricKey => chartDataMap[metricKey]);
    const chartOptions = {
        chart: { id: 'seo-metrics', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: {
            categories: metrics?.map(r => r.keys?.[0]) || [],
            labels: { rotate: -45 },
            axisTicks: { show: true },
            axisBorder: { show: true },
        },
        colors: selectedMetrics.map(metricKey => chartDataMap[metricKey].color),
        stroke: { curve: 'smooth', width: 2 },
        legend: { show: true, position: 'top' },
        tooltip: { shared: true },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
    };

    return (
        <div className="mx-auto">
            <DashboardHeading
                title="SEO Dashboard"
                label={siteUrl || 'No property set'}
                customerId={customerId}
                dateRange={appliedRange}
                loading={loading}
                dashboardType="seo-dashboard"
                dataSnapshot={{
                    metrics,
                    keywords,
                    urls,
                    selectedMetrics,
                    totalClicks,
                    totalImpressions,
                    avgCtr,
                    avgPosition,
                    siteUrl
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={d => setTempRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setTempRange(r => ({ ...r, endDate: d }))}
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
                                    aria-pressed={selectedMetrics.includes(opt.key)}
                                    onClick={() => setSelectedMetrics(prev => {
                                        if (prev.includes(opt.key)) {
                                            // Don't allow deselecting if it's the only selected metric
                                            return prev.length > 1 ? prev.filter(m => m !== opt.key) : prev;
                                        } else {
                                            return [...prev, opt.key];
                                        }
                                    })}
                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedMetrics(prev => {
                                        if (prev.includes(opt.key)) {
                                            // Don't allow deselecting if it's the only selected metric
                                            return prev.length > 1 ? prev.filter(m => m !== opt.key) : prev;
                                        } else {
                                            return [...prev, opt.key];
                                        }
                                    })}
                                    style={{ outline: 'none' }}
                                >
                                    <MetricCard
                                        label={opt.label}
                                        value={value}
                                        unit={unit}
                                        icon={<Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        isActive={selectedMetrics.includes(opt.key)}
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
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${selectedMetrics.includes(opt.key) ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                                    onClick={() => setSelectedMetrics(prev => {
                                        if (prev.includes(opt.key)) {
                                            // Don't allow deselecting if it's the only selected metric
                                            return prev.length > 1 ? prev.filter(m => m !== opt.key) : prev;
                                        } else {
                                            return [...prev, opt.key];
                                        }
                                    })}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <GraphCard
                            title={selectedMetrics.length === 1 ? chartDataMap[selectedMetrics[0]].name + ' Over Time' : 'Multiple SEO Metrics Over Time'}
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                        />
                    </div>

                    {/* Top Keywords */}
                    <div className="mb-8">
                        <div className="border border-gray-200 rounded-xl bg-white p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Top Keywords</h2>
                                
                                {/* Keyword Filter Dropdown */}
                                <div className="flex items-center gap-2">
                                    <label htmlFor="keyword-filter" className="text-sm text-gray-600">Filter by:</label>
                                    <select
                                        id="keyword-filter"
                                        value={keywordFilter}
                                        onChange={(e) => setKeywordFilter(e.target.value)}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="all">All Keywords</option>
                                        {brandKeywords.length > 0 && (
                                            <option value="brand">Brand Keywords ({brandKeywords.length})</option>
                                        )}
                                        {exactGroups.length > 0 && (
                                            <optgroup label="Exact Match Groups">
                                                {exactGroups.map(group => (
                                                    <option key={group._id} value={`exact:${group._id}`}>
                                                        {group.name} ({group.keywords.length})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {partialGroups.length > 0 && (
                                            <optgroup label="Partial Match Groups">
                                                {partialGroups.map(group => (
                                                    <option key={group._id} value={`partial:${group._id}`}>
                                                        {group.name} ({group.keywords.length})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Keyword</th>
                                            <th className="px-4 py-2 text-right">Clicks</th>
                                            <th className="px-4 py-2 text-right">Impressions</th>
                                            <th className="px-4 py-2 text-right">CTR</th>
                                            <th className="px-4 py-2 text-right">Avg. Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredKeywords.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-4">
                                                {keywordFilter === 'all' ? 'No data' : 'No keywords match this filter'}
                                            </td></tr>
                                        ) : filteredKeywords.map((row, i) => (
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
                        <div className="border border-gray-200 rounded-xl bg-white p-6">
                            <h2 className="text-lg font-semibold mb-2">Top URLs</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
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

                    {/* SEO Keyword Settings */}
                    <SEOKeywordSettings customerId={customerId} onKeywordsUpdate={handleKeywordGroupsUpdate} />
                </>
            )}
        </div>
    );
}