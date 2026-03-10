"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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

const TAB_IDS = ['products', 'customers'];

export default function EcommercePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const customerId = params?.customerId;
    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [productsLoading, setProductsLoading] = useState(false);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [segmentationLoading, setSegmentationLoading] = useState(false);
    const [ltvLoading, setLtvLoading] = useState(false);
    const [ltvError, setLtvError] = useState(null);
    const [error, setError] = useState(null);
    const [products, setProducts] = useState([]);
    const [segmentation, setSegmentation] = useState(null);
    const [segmentationFetchedFor, setSegmentationFetchedFor] = useState(null);
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTabState] = useState(() =>
        TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'products'
    );

    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        router.replace(url.pathname + url.search, { scroll: false });
    };

    // Sync tab from URL (e.g. on refresh or browser back/forward)
    useEffect(() => {
        const t = searchParams.get('tab');
        if (t && TAB_IDS.includes(t)) setActiveTabState(t);
    }, [searchParams]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

    const rangeKey = appliedRange.startDate && appliedRange.endDate ? `${appliedRange.startDate}-${appliedRange.endDate}` : null;

    useEffect(() => {
        if (!customerId || !appliedRange.startDate || !appliedRange.endDate || activeTab !== 'products') return;
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
    }, [customerId, appliedRange.startDate, appliedRange.endDate, activeTab]);

    useEffect(() => {
        if (!customerId || !appliedRange.startDate || !appliedRange.endDate || activeTab !== 'customers') return;
        if (segmentation && segmentationFetchedFor === rangeKey) {
            setLtvLoading(false); // Cached data - no background LTV fetch
            return;
        }
        let cancelled = false;
        async function fetchSegmentation() {
            setSegmentationLoading(true);
            setError(null);
            setLtvError(null);
            try {
                // 1. Try ShopifyQL first (fast: new/returning + merged-sources)
                const shopifyqlRes = await fetch(
                    `/api/customer-segmentation-shopifyql/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&full=true`
                );
                const shopifyqlData = await shopifyqlRes.json();

                if (!cancelled) {
                    if (shopifyqlRes.ok) {
                        console.log('[Customer Performance] ShopifyQL data loaded (fast path)', {
                            newCustomers: shopifyqlData.newCustomers,
                            returningCustomers: shopifyqlData.returningCustomers,
                            totalOrders: shopifyqlData.totalOrders,
                        });
                        setSegmentation(shopifyqlData);
                        setSegmentationFetchedFor(rangeKey);
                        setSegmentationLoading(false);
                        // 2. Background: fetch full LTV (slow). Only merge ltv30/90/180 - never overwrite other data.
                        setLtvLoading(true);
                        setLtvError(null);
                        console.log('[Customer Performance] LTV background fetch started…');
                        try {
                            const ltvRes = await fetch(
                                `/api/customer-segmentation/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&extendForLtv=true`
                            );
                            const ltvData = await ltvRes.json();
                            if (!cancelled) {
                                if (ltvRes.ok && !ltvData.error) {
                                    setLtvError(null);
                                    console.log('[Customer Performance] LTV background fetch completed', {
                                        ltv30: ltvData.ltv30,
                                        ltv90: ltvData.ltv90,
                                        ltv180: ltvData.ltv180,
                                    });
                                    const ltvOnly = {
                                        ltv30: ltvData.ltv30,
                                        ltv90: ltvData.ltv90,
                                        ltv180: ltvData.ltv180,
                                    };
                                    setSegmentation((prev) =>
                                        prev && prev.source === 'shopifyql'
                                            ? { ...prev, ...ltvOnly }
                                            : prev
                                    );
                                } else {
                                    const errMsg = ltvData?.error || (ltvRes.ok ? null : 'Failed to load LTV');
                                    setLtvError(errMsg);
                                    console.warn('[Customer Performance] LTV fetch returned error', {
                                        ok: ltvRes.ok,
                                        error: errMsg,
                                    });
                                }
                            }
                        } catch (ltvErr) {
                            if (!cancelled) {
                                setLtvError(ltvErr?.message || 'Failed to load LTV');
                                console.warn('[Customer Performance] LTV background fetch failed:', ltvErr);
                            }
                        } finally {
                            if (!cancelled) setLtvLoading(false);
                        }
                        return;
                    }
                    // 3. Fallback: full customer-segmentation (when ShopifyQL fails)
                    const res = await fetch(
                        `/api/customer-segmentation/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&extendForLtv=true`
                    );
                    const data = await res.json();
                    if (!cancelled) {
                        if (!res.ok) throw new Error(data?.error || 'Failed to fetch customer segmentation');
                        setSegmentation(data);
                        setSegmentationFetchedFor(rangeKey);
                    }
                }
            } catch (e) {
                if (!cancelled) setError(e.message || String(e));
            } finally {
                if (!cancelled) setSegmentationLoading(false);
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
                        <div className="relative">
                            {segmentationLoading && (
                                <div className="sticky top-10 mt-10 z-50 flex items-center justify-center gap-3 py-4 px-6 w-full min-h-[72px] bg-white/60 backdrop-blur-xl border-b border-white/20 dark:border-gray-700/50 shadow-lg">
                                    <Spinner size={24} />
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        Fetching data for LTV last 180 days, calculating and crunching numbers…
                                    </span>
                                </div>
                            )}
                            <div className={segmentationLoading ? 'pointer-events-none select-none blur-md transition-all duration-300' : 'transition-all duration-300'}>
                                <CustomerPerformance
                                    segmentation={segmentation}
                                    loading={segmentationLoading}
                                    ltvLoading={ltvLoading}
                                    ltvError={ltvError}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}