"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import ProductPerfomance from './components/ProductPerfomance';
import CustomerPerformance from './components/CustomerPerformance';
import { FiPackage, FiUsers } from 'react-icons/fi';
import { useCustomers } from '@/hooks/useCustomers';
import { useBusinessCategory } from '@/hooks/useBusinessCategory';
import { useShopifyMarketsFilter } from '@/hooks/useShopifyMarketsFilter';
import { useAdSpendPlatformsFilter } from '@/hooks/useAdSpendPlatformsFilter';
import { pushDashboardDateRangeApplied, pushGTMEvent, GTM_EVENTS } from '@root/lib/gtmFunctions';
import { formatAvgDaysToSoldOutDisplay } from '@/lib/shopifyProductsApi';
import './ecommerce.css';

const TABS = [
    { id: 'products', label: 'Product Performance', icon: FiPackage },
    { id: 'customers', label: 'Customer Performance', icon: FiUsers },
];

const defaultRange = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
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
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === customerId);
    const { isB2B } = useBusinessCategory(customer);

    useEffect(() => {
        if (isB2B && customerId) {
            router.replace(`/dashboard/${customerId}/analytics`);
        }
    }, [isB2B, customerId, router]);

    const {
        shopifyMarketsFeatureOn,
        shopifyMarkets,
        shopifyMarketsLoading,
        excludedShopifyMarkets,
        appliedExcludedShopifyMarkets,
        toggleShopifyMarket,
        applyShopifyMarketFilters,
        syncDraftFromAppliedMarkets,
        marketQuerySuffix,
        draftFilterAdSpendByMarket,
        appliedFilterAdSpendByMarket,
        setDraftFilterAdSpendByMarket,
    } = useShopifyMarketsFilter(customer, customerId);

    const {
        adSpendFilterUiChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    } = useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn);

    const mergedSourcesQuerySuffix = `${marketQuerySuffix}${spendQuerySuffix}`;

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

    const visibleAdSpendChannels = useMemo(() => {
        if (!customer?.CustomerSettings || !segmentation?.adSpendByChannel) return null;
        if (shopifyMarketsFeatureOn && customer?.CustomerSettings?.shopifyMarketsEnabled === true) {
            return adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings).filter(
                (c) => appliedExcludedPlatforms[c.id] !== true
            );
        }
        return adSpendChannelsForSpendTotals(
            customer.CustomerSettings,
            segmentation.adSpendByChannel
        );
    }, [customer?.CustomerSettings, segmentation?.adSpendByChannel, shopifyMarketsFeatureOn, appliedExcludedPlatforms]);

    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        pushGTMEvent(GTM_EVENTS.ECOMMERCE_TAB_CHANGED, {
            eventData: { customerId: String(customerId), tab },
        });
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        router.replace(url.pathname + url.search, { scroll: false });
    };

    useEffect(() => {
        const t = searchParams.get('tab');
        if (t && TAB_IDS.includes(t)) setActiveTabState(t);
    }, [searchParams]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: 'ecommerce',
            customerId,
            startDate,
            endDate,
        });
        setAppliedRange({ startDate, endDate });
    };

    const rangeKey =
        appliedRange.startDate && appliedRange.endDate
            ? `${appliedRange.startDate}-${appliedRange.endDate}-${mergedSourcesQuerySuffix || 'all'}`
            : null;

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
                                    prev.map(p => {
                                        const inventoryStock =
                                            inventory[p.productId]?.inventoryStock ?? p.inventoryStock ?? null;
                                        const inventoryValue =
                                            inventory[p.productId]?.inventoryValue ?? p.inventoryValue ?? null;
                                        return {
                                            ...p,
                                            inventoryStock,
                                            inventoryValue,
                                            avgDaysToSoldOut: formatAvgDaysToSoldOutDisplay(
                                                inventoryStock,
                                                p.unitsSold60d
                                            ).days,
                                        };
                                    })
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
            setLtvLoading(false);
            return;
        }
        let cancelled = false;
        async function fetchSegmentation() {
            setSegmentationLoading(true);
            setError(null);
            setLtvError(null);
            try {
                const shopifyqlRes = await fetch(
                    `/api/customer-segmentation-shopifyql/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&full=true${mergedSourcesQuerySuffix}`
                );
                const shopifyqlData = await shopifyqlRes.json();

                if (!cancelled) {
                    if (shopifyqlRes.ok) {
                        setSegmentation(shopifyqlData);
                        setSegmentationFetchedFor(rangeKey);
                        setSegmentationLoading(false);
                        setLtvLoading(true);
                        setLtvError(null);
                        try {
                            const ltvRes = await fetch(
                                `/api/customer-segmentation/${customerId}?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}&extendForLtv=true`
                            );
                            const ltvData = await ltvRes.json();
                            if (!cancelled) {
                                if (ltvRes.ok && !ltvData.error) {
                                    setLtvError(null);
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
                                }
                            }
                        } catch (ltvErr) {
                            if (!cancelled) {
                                setLtvError(ltvErr?.message || 'Failed to load LTV');
                            }
                        } finally {
                            if (!cancelled) setLtvLoading(false);
                        }
                        return;
                    }
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
    }, [customerId, appliedRange.startDate, appliedRange.endDate, activeTab, rangeKey, mergedSourcesQuerySuffix]);

    if (!customerId) return null;

    const pageLoading = activeTab === 'products' ? productsLoading : segmentationLoading;

    return (
        <div id="EcommercePage" className="cobalt-perf w-full" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Ecommerce"
                label={customer ? customer.customerName : 'Ecommerce Dashboard'}
                customerId={customerId}
                dateRange={appliedRange}
                loading={pageLoading}
                dashboardType="ecommerce"
                dataSnapshot={{
                    products,
                    segmentation,
                    activeTab
                }}
                right={(
                    <DateRangePicker
                        variant="cobalt"
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={d => setTempRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setTempRange(r => ({ ...r, endDate: d }))}
                    />
                )}
                showPdfExport={false}
                shopifyMarketFilter={
                    shopifyMarketsFeatureOn
                        ? {
                              loading: shopifyMarketsLoading,
                              options: shopifyMarkets,
                              excludedMarkets: excludedShopifyMarkets,
                              appliedExcludedMarkets: appliedExcludedShopifyMarkets,
                              onToggleMarket: toggleShopifyMarket,
                              onMenuWillOpen: syncDraftFromAppliedMarkets,
                              onApplyMarkets: applyShopifyMarketFilters,
                              filterAdSpendByMarket: draftFilterAdSpendByMarket,
                              appliedFilterAdSpendByMarket,
                              onFilterAdSpendByMarketChange: setDraftFilterAdSpendByMarket,
                          }
                        : null
                }
                adSpendPlatformFilter={
                    shopifyMarketsFeatureOn && adSpendFilterUiChannels.length > 0
                        ? {
                              options: adSpendFilterUiChannels.map((c) => ({
                                  id: c.id,
                                  label: c.label,
                              })),
                              excludedPlatforms: draftExcludedPlatforms,
                              appliedExcludedPlatforms,
                              onTogglePlatform: toggleAdSpendPlatformDraft,
                              onMenuWillOpen: syncDraftFromAppliedSpend,
                              onApplySpend: applyAdSpendPlatformFilters,
                          }
                        : null
                }
            />

            <nav className="apex-ecom-tabs" aria-label="Ecommerce views">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`apex-ecom-tabs__btn${activeTab === tab.id ? ' is-active' : ''}`}
                            aria-current={activeTab === tab.id ? 'page' : undefined}
                        >
                            <Icon aria-hidden />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {error ? (
                <div className="apex-ecom-error mt-4">Error: {error}</div>
            ) : (
                <>
                    {activeTab === 'products' && (
                        <ProductPerfomance
                            products={products}
                            loading={productsLoading}
                            inventoryLoading={inventoryLoading}
                        />
                    )}

                    {activeTab === 'customers' && (
                        <>
                            {ltvLoading && segmentation && (
                                <div className="apex-ecom-loading-banner">
                                    <span className="apex-ecom-loading-banner__text">
                                        Calculating LTV for 90 and 180 day windows…
                                    </span>
                                </div>
                            )}
                            <CustomerPerformance
                                segmentation={segmentation}
                                loading={segmentationLoading}
                                ltvLoading={ltvLoading}
                                ltvError={ltvError}
                                visibleAdSpendChannels={visibleAdSpendChannels}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
