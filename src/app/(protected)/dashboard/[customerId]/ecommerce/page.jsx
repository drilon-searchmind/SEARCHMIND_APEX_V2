"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import MetricCard from '@/components/dashboard/MetricCard';
import GraphCard from '@/components/dashboard/GraphCard';
import Spinner from '@/components/ui/Spinner';
import { FiShoppingCart, FiDollarSign, FiPackage, FiBarChart, FiBarChart2, FiUsers } from 'react-icons/fi';

import ProductPerfomance from './components/ProductPerfomance';
import CustomerPerformance from './components/CustomerPerformance';

const METRIC_OPTIONS = [
    { key: 'total_sales', label: 'Total Sales', icon: FiShoppingCart, isCurrency: true, color: '#1E2B2B' },
    { key: 'net_sales', label: 'Net Sales', icon: FiDollarSign, isCurrency: true, color: '#4F46E5' },
    { key: 'gross_sales', label: 'Gross Sales', icon: FiPackage, isCurrency: true, color: '#06B6D4' },
    { key: 'orders', label: 'Orders', icon: FiBarChart, isCurrency: false, color: '#C6ED62' },
];

const TABS = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'products', label: 'Product Performance', icon: FiPackage },
    { id: 'customers', label: 'Customer Performance', icon: FiUsers },
];

const defaultRange = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    return { startDate: defaultStart, endDate: defaultEnd };
};

export default function EcommercePage() {
    const params = useParams();
    const customerId = params?.customerId;
    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [shopifyDaily, setShopifyDaily] = useState([]);
    const [products, setProducts] = useState([]);
    const [segmentation, setSegmentation] = useState(null);
    const [selectedMetric, setSelectedMetric] = useState('total_sales');
    const [activeTab, setActiveTab] = useState('overview');

    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

    useEffect(() => {
        if (!customerId || !appliedRange.startDate || !appliedRange.endDate) return;
        let cancelled = false;
        async function fetchAllData() {
            setLoading(true);
            setError(null);
            try {
                const [shopifyRes, productsRes, segmentationRes] = await Promise.all([
                    fetch(`/api/merged-sources/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}`),
                    fetch(`/api/shopify-products/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}`),
                    fetch(`/api/customer-segmentation/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}`)
                ]);

                const shopifyData = await shopifyRes.json();
                const productsData = await productsRes.json();
                const segmentationData = await segmentationRes.json();

                if (!shopifyRes.ok) throw new Error(shopifyData.error || 'Failed to fetch Shopify data');
                if (!productsRes.ok) console.warn('Products fetch failed:', productsData.error);
                if (!segmentationRes.ok) console.warn('Segmentation fetch failed:', segmentationData.error);

                if (!cancelled) {
                    setShopifyDaily(shopifyData.shopifyDaily || []);
                    setProducts(productsData.products || []);
                    setSegmentation(segmentationRes.ok ? segmentationData : null);
                }
            } catch (e) {
                if (!cancelled) setError(e.message || String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchAllData();
        return () => { cancelled = true; };
    }, [customerId, appliedRange.startDate, appliedRange.endDate]);

    const totalSales = shopifyDaily.reduce((s, r) => s + (r.total_sales || 0), 0);
    const netSales = shopifyDaily.reduce((s, r) => s + (r.net_sales || 0), 0);
    const orders = shopifyDaily.reduce((s, r) => s + (r.orders || 0), 0);
    const avgOrder = orders > 0 ? totalSales / orders : 0;

    const categories = shopifyDaily.map(d => d.period);

    const metricSeriesData = shopifyDaily.map(d => {
        const v = d[selectedMetric];
        return (typeof v === 'number') ? v : (v ? Number(v) : 0);
    });

    const series = [{ name: METRIC_OPTIONS.find(m => m.key === selectedMetric)?.label || selectedMetric, data: metricSeriesData }];

    const selectedColor = METRIC_OPTIONS.find(m => m.key === selectedMetric)?.color || '#1E2B2B';

    const chartOptions = {
        chart: { id: 'ecom-sales', toolbar: { show: false } },
        stroke: { curve: 'smooth', width: 2 },
        markers: { size: 3 },
        colors: [selectedColor],
        xaxis: { categories, labels: { rotate: -45 } },
        grid: { strokeDashArray: 4 },
        tooltip: { y: { formatter: (val) => val !== undefined ? Number(val).toLocaleString() : val } }
    };

    const sumForKeys = (keys) => {
        if (!shopifyDaily || shopifyDaily.length === 0) return undefined;
        for (const key of keys) {
            const hasAny = shopifyDaily.some(r => r[key] !== undefined && r[key] !== null && r[key] !== '');
            if (!hasAny) continue;
            const sum = shopifyDaily.reduce((acc, r) => {
                const v = r[key];
                const n = (typeof v === 'number') ? v : (v ? Number(v) : 0);
                return acc + (isNaN(n) ? 0 : n);
            }, 0);
            return sum;
        }
        return undefined;
    };

    const summaryRows = [
        { label: 'Gross Sales', value: sumForKeys(['gross_sales', 'total_sales']) },
        { label: 'Discounts', value: sumForKeys(['discounts']) },
        { label: 'Returns', value: sumForKeys(['returns']) },
        { label: 'Net Sales', value: sumForKeys(['net_sales']) },
        { label: 'Shipping Charges', value: sumForKeys(['shipping_charges', 'shipping']) },
        { label: 'Taxes', value: sumForKeys(['taxes']) },
        { label: 'Total Sales', value: sumForKeys(['total_sales']) },
    ];

    const formatCurrency = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString()} kr`);

    const metricDisplayValue = (key) => {
        const val = (key === 'total_sales') ? totalSales : (key === 'net_sales') ? netSales : (key === 'orders') ? orders : (key === 'gross_sales') ? shopifyDaily.reduce((s, r) => s + (r.gross_sales || 0), 0) : undefined;
        if (val === undefined) return '—';
        const isCurrency = METRIC_OPTIONS.find(m => m.key === key)?.isCurrency;
        return isCurrency ? `${Number(val).toLocaleString()} kr` : Number(val).toLocaleString();
    };

    if (!customerId) return null;

    return (
        <div className="space-y-6">
            <DashboardHeading
                title="Ecommerce"
                label="Shopify"
                right={(
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={d => setTempRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setTempRange(r => ({ ...r, endDate: d }))}
                    />
                )}
            />

            {/* Horizontal Tabs */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="flex gap-8 px-6">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id
                                        ? 'border-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Icon className="text-base" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Spinner size={48} /></div>
            ) : error ? (
                <div className="bg-white border border-red-100 rounded-xl p-6 text-red-600">Error: {error}</div>
            ) : (
                <>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {METRIC_OPTIONS.map(opt => {
                                    const Icon = opt.icon;
                                    return (
                                        <div key={opt.key}
                                            className="cursor-pointer"
                                            tabIndex={0}
                                            role="button"
                                            onClick={() => setSelectedMetric(opt.key)}
                                            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedMetric(opt.key)}
                                        >
                                            <MetricCard
                                                label={opt.label}
                                                value={metricDisplayValue(opt.key)}
                                                icon={<Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                                isActive={selectedMetric === opt.key}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2">
                                    <div className="mb-0 mt-4 flex items-center gap-4">
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
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2">
                                    <GraphCard title={`${METRIC_OPTIONS.find(m => m.key === selectedMetric)?.label || selectedMetric} over time`} chartOptions={chartOptions} chartSeries={series} chartType="line" height={420} />
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                                        <h6 className="text-sm text-gray-500 mb-4">Summary</h6>
                                        <div className="space-y-2">
                                            {summaryRows.map((row) => (
                                                <div key={row.label} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                                    <div className="text-sm text-gray-700">{row.label}</div>
                                                    <div className="text-sm font-semibold text-gray-900">{formatCurrency(row.value)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Product Performance Tab */}
                    {activeTab === 'products' && (
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
                            <ProductPerfomance products={products} loading={false} />
                        </div>
                    )}

                    {/* Customer Performance Tab */}
                    {activeTab === 'customers' && (
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
                            <CustomerPerformance segmentation={segmentation} loading={false} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}