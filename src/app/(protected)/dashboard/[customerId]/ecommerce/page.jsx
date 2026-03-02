"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import Spinner from '@/components/ui/Spinner';
import { FiPackage, FiUsers } from 'react-icons/fi';

import ProductPerfomance from './components/ProductPerfomance';
import CustomerPerformance from './components/CustomerPerformance';

const TABS = [
    { id: 'products', label: 'Product Performance', icon: FiPackage },
    { id: 'customers', label: 'Customer Performance', icon: FiUsers },
];

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
    return { startDate: defaultStart, endDate: defaultEnd };
};

export default function EcommercePage() {
    const params = useParams();
    const customerId = params?.customerId;
    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [productsLoading, setProductsLoading] = useState(true);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [segmentationLoading, setSegmentationLoading] = useState(false);
    const [extendedMetricsLoading, setExtendedMetricsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [products, setProducts] = useState([]);
    const [segmentation, setSegmentation] = useState(null);
    const [segmentationFetchedFor, setSegmentationFetchedFor] = useState(null);
    const [activeTab, setActiveTab] = useState('products');

    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

    const rangeKey = appliedRange.startDate && appliedRange.endDate ? `${appliedRange.startDate}-${appliedRange.endDate}` : null;

    useEffect(() => {
        if (!customerId || !appliedRange.startDate || !appliedRange.endDate) return;
        let cancelled = false;
        async function fetchProducts() {
            setProductsLoading(true);
            setInventoryLoading(false);
            setError(null);
            try {
                const productsRes = await fetch(`/api/shopify-products/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&fast=true`);
                const productsData = await productsRes.json();
                if (!cancelled) {
                    if (!productsRes.ok) console.warn('Products fetch failed:', productsData.error);
                    const list = productsData.products || [];
                    setProducts(list);

                    const productIds = list
                        .map(p => p.productId)
                        .filter(id => id && typeof id === 'string' && id.includes('Product'));
                    if (productIds.length > 0) {
                        setInventoryLoading(true);
                        try {
                            const invRes = await fetch(`/api/shopify-products/${customerId}/inventory`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ productIds }),
                            });
                            if (!cancelled && invRes.ok) {
                                const { inventory } = await invRes.json();
                                setProducts(prev =>
                                    prev.map(p => ({
                                        ...p,
                                        inventoryStock: inventory[p.productId]?.inventoryStock ?? p.inventoryStock ?? null,
                                        inventoryValue: inventory[p.productId]?.inventoryValue ?? p.inventoryValue ?? null,
                                    }))
                                );
                            }
                        } catch {
                            // Ignore; core product data already shown
                        } finally {
                            if (!cancelled) setInventoryLoading(false);
                        }
                    }
                }
            } catch (e) {
                if (!cancelled) setError(e.message || String(e));
            } finally {
                if (!cancelled) setProductsLoading(false);
            }
        }
        fetchProducts();
        return () => { cancelled = true; };
    }, [customerId, appliedRange.startDate, appliedRange.endDate]);

    useEffect(() => {
        if (!customerId || !appliedRange.startDate || !appliedRange.endDate || activeTab !== 'customers') return;
        if (segmentation && segmentationFetchedFor === rangeKey) {
            setExtendedMetricsLoading(false);
            return;
        }
        let cancelled = false;
        async function fetchSegmentation() {
            setSegmentationLoading(true);
            setError(null);
            try {
                const segmentationRes = await fetch(`/api/customer-segmentation/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&fast=true`);
                const segmentationData = await segmentationRes.json();
                if (!cancelled) {
                    if (!segmentationRes.ok) throw new Error(segmentationData?.error || 'Failed to fetch customer segmentation');
                    setSegmentation(segmentationRes.ok ? segmentationData : null);
                    setSegmentationFetchedFor(rangeKey);
                }
                setSegmentationLoading(false);
                setExtendedMetricsLoading(true);

                // Background fetch for LTV + net revenue (no fast mode)
                try {
                    const fullRes = await fetch(`/api/customer-segmentation/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}`);
                    const fullData = await fullRes.json();
                    if (!cancelled && fullRes.ok) {
                        setSegmentation((prev) => (prev ? {
                            ...prev,
                            ltv30: fullData.ltv30 ?? prev.ltv30,
                            ltv90: fullData.ltv90 ?? prev.ltv90,
                            ltv180: fullData.ltv180 ?? prev.ltv180,
                            ltv365: fullData.ltv365 ?? prev.ltv365,
                            // Don't overwrite revenue with 0 when we already have approximated values from fast load
                            ncaNetRevenue: fullData.ncaNetRevenue != null && (fullData.ncaNetRevenue > 0 || (prev.ncaNetRevenue ?? 0) === 0)
                                ? fullData.ncaNetRevenue
                                : (prev.ncaNetRevenue ?? fullData.ncaNetRevenue),
                            returningCustomerNetRevenue: fullData.returningCustomerNetRevenue != null && (fullData.returningCustomerNetRevenue > 0 || (prev.returningCustomerNetRevenue ?? 0) === 0)
                                ? fullData.returningCustomerNetRevenue
                                : (prev.returningCustomerNetRevenue ?? fullData.returningCustomerNetRevenue),
                            cac: fullData.cac ?? prev.cac,
                            adSpend: fullData.adSpend ?? prev.adSpend,
                        } : prev));
                    }
                } catch {
                    // Ignore background fetch errors; fast data already shown
                } finally {
                    if (!cancelled) setExtendedMetricsLoading(false);
                }
            } catch (e) {
                if (!cancelled) setError(e.message || String(e));
                setSegmentationLoading(false);
            }
        }
        fetchSegmentation();
        return () => { cancelled = true; };
    }, [customerId, appliedRange.startDate, appliedRange.endDate, activeTab, rangeKey]);

    if (!customerId) return null;

    return (
        <div className="space-y-6">
            <DashboardHeading
                title="Ecommerce"
                label="Ecommerce Dashboard"
                customerId={customerId}
                dateRange={appliedRange}
                loading={activeTab === 'products' ? productsLoading : segmentationLoading}
                dashboardType="ecommerce"
                dataSnapshot={{
                    products,
                    segmentation,
                    activeTab
                }}
                right={(
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={d => setTempRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setTempRange(r => ({ ...r, endDate: d }))}
                    />
                )}
                showPdfExport={false}
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

            {error ? (
                <div className="bg-white border border-red-100 rounded-xl p-6 text-red-600">Error: {error}</div>
            ) : (
                <>
                    {activeTab === 'products' && (
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
                            <ProductPerfomance products={products} loading={productsLoading} inventoryLoading={inventoryLoading} />
                        </div>
                    )}

                    {activeTab === 'customers' && (
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
                            <CustomerPerformance
                                segmentation={segmentation}
                                loading={segmentationLoading}
                                extendedMetricsLoading={extendedMetricsLoading}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}