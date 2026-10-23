"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import ProductPerfomance from './components/ProductPerfomance';
import CustomerPerformance from './components/CustomerPerformance';
import { FiPackage, FiUsers } from 'react-icons/fi';
import { useCustomers } from '@/hooks/useCustomers';
import { useBusinessCategory } from '@/hooks/useBusinessCategory';
import {
    useDashboardFilters,
    buildShopifyMarketFilterProps,
    buildAdSpendPlatformFilterProps,
} from '@/hooks/useDashboardHubShared';
import { pushDashboardDateRangeApplied, pushGTMEvent, GTM_EVENTS } from '@root/lib/gtmFunctions';
import {
    adSpendChannelsForShopifyMarketsFilterUi,
    adSpendChannelsForSpendTotals,
} from '@/lib/mergeAdSpendDaily';
import { formatAvgDaysToSoldOutDisplay, sortProductsByNetSales } from '@/lib/shopifyProductsApi';
import { buildSalesFingerprint } from '@/lib/shopifyEcommerceCacheShared';
import {
    mergeClientProductInventoryCache,
    readClientInventoryTotalsCache,
    readClientProductInventoryCache,
    writeClientInventoryTotalsCache,
} from '@/lib/ecommerceClientCache';
import { useDashboardDataOptional } from '@/contexts/DashboardDataContext';
import './ecommerce.css';

const TABS = [
    { id: 'products', label: 'Product performance', icon: FiPackage },
    { id: 'customers', label: 'Customer performance', icon: FiUsers },
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
    const shared = useDashboardDataOptional();

    useEffect(() => {
        if (isB2B && customerId) {
            router.replace(`/dashboard/${customerId}/analytics`);
        }
    }, [isB2B, customerId, router]);

    const filters = useDashboardFilters(customer, customerId);
    const {
        shopifyMarketsFeatureOn,
        appliedExcludedPlatforms,
        mergedSourcesQuerySuffix,
    } = filters;

    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);

    const resolvedAppliedRange = shared?.appliedDateRange ?? appliedRange;
    const resolvedTempRange = shared?.tempDateRange ?? tempRange;

    useEffect(() => {
        if (!shared) return;
        setAppliedRange(shared.appliedDateRange);
        setTempRange(shared.tempDateRange);
    }, [shared, shared?.appliedDateRange, shared?.tempDateRange]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryTotals, setInventoryTotals] = useState(null);
    const [inventoryTotalsLoading, setInventoryTotalsLoading] = useState(false);
    const [segmentationLoading, setSegmentationLoading] = useState(false);
    const [ltvLoading, setLtvLoading] = useState(false);
    const [ltvError, setLtvError] = useState(null);
    const [error, setError] = useState(null);
    const [products, setProducts] = useState([]);
    const [periodSummary, setPeriodSummary] = useState(null);
    const [catalogPageInfo, setCatalogPageInfo] = useState(null);
    const [catalogTotalCount, setCatalogTotalCount] = useState(null);
    const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
    const [catalogLoadingAll, setCatalogLoadingAll] = useState(false);
    /** Matches last successful products fetch (customer + date range + market suffix). */
    const [productsLoadedKey, setProductsLoadedKey] = useState(null);
    const productsFetchCancelledRef = useRef(false);
    const salesFingerprintRef = useRef(null);
    const CATALOG_PAGE_SIZE = 100;
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

    const handleDateRangeApply = (payload) => {
        pushDashboardDateRangeApplied({
            page: 'ecommerce',
            customerId,
            startDate: payload.startDate,
            endDate: payload.endDate,
        });
        if (shared?.handleDateRangeApply) {
            shared.handleDateRangeApply(payload);
        } else {
            setAppliedRange({ startDate: payload.startDate, endDate: payload.endDate });
        }
    };

    const rangeKey =
        appliedRange.startDate && appliedRange.endDate
            ? `${appliedRange.startDate}-${appliedRange.endDate}-${mergedSourcesQuerySuffix || 'all'}`
            : null;

    const productsFetchKey =
        customerId && rangeKey ? `${customerId}|${rangeKey}` : null;

    const productsViewLoading =
        activeTab === 'products' &&
        Boolean(productsFetchKey) &&
        (productsLoading || productsLoadedKey !== productsFetchKey);

    const mergeProductInventory = useCallback((inventory, arrivalsOnly = false) => {
        setProducts((prev) =>
            prev.map((p) => {
                const inv = inventory[p.productId];
                if (!inv) return p;
                const inventoryStock = arrivalsOnly
                    ? p.inventoryStock
                    : (inv.inventoryStock != null ? inv.inventoryStock : p.inventoryStock ?? null);
                const inventoryValue = arrivalsOnly
                    ? p.inventoryValue
                    : (inv.inventoryValue != null ? inv.inventoryValue : p.inventoryValue ?? null);
                return {
                    ...p,
                    inventoryStock,
                    inventoryValue,
                    incomingQuantity: arrivalsOnly
                        ? p.incomingQuantity
                        : (inv.incomingQuantity ?? p.incomingQuantity ?? null),
                    expectedArrivalDate:
                        inv.expectedArrivalDate ?? p.expectedArrivalDate ?? null,
                    avgDaysToSoldOut: formatAvgDaysToSoldOutDisplay(
                        inventoryStock,
                        p.unitsSold60d
                    ).days,
                };
            })
        );
    }, []);

    const rememberSalesFingerprint = useCallback(
        (summary) => {
            if (!summary || !appliedRange.startDate || !appliedRange.endDate) return null;
            const fp = buildSalesFingerprint(
                summary,
                appliedRange.startDate,
                appliedRange.endDate
            );
            salesFingerprintRef.current = fp;
            return fp;
        },
        [appliedRange.startDate, appliedRange.endDate]
    );

    const fetchInventoryTotalsForRange = useCallback(
        async (periodSummaryFromProducts, cancelledCheck) => {
            if (
                !customerId ||
                !appliedRange.startDate ||
                !appliedRange.endDate ||
                cancelledCheck()
            ) {
                return;
            }
            const fp =
                rememberSalesFingerprint(periodSummaryFromProducts) ||
                salesFingerprintRef.current;

            const clientCached = readClientInventoryTotalsCache(
                customerId,
                appliedRange.startDate,
                appliedRange.endDate,
                fp
            );
            if (clientCached && !cancelledCheck()) {
                setInventoryTotals(clientCached);
                setInventoryTotalsLoading(false);
            } else if (!cancelledCheck()) {
                setInventoryTotalsLoading(true);
            }

            try {
                const params = new URLSearchParams({
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                });
                const res = await fetch(
                    `/api/shopify-products/${customerId}/inventory/totals?${params.toString()}`
                );
                if (cancelledCheck()) return;
                const data = await res.json();
                if (!cancelledCheck() && res.ok && data.totals) {
                    setInventoryTotals(data.totals);
                    const writeFp = data.salesFingerprint || fp;
                    if (writeFp) salesFingerprintRef.current = writeFp;
                    writeClientInventoryTotalsCache(
                        customerId,
                        appliedRange.startDate,
                        appliedRange.endDate,
                        writeFp,
                        data.totals
                    );
                }
            } catch (e) {
                console.warn('Store inventory totals fetch failed:', e);
            } finally {
                if (!cancelledCheck()) setInventoryTotalsLoading(false);
            }
        },
        [customerId, appliedRange.startDate, appliedRange.endDate, rememberSalesFingerprint]
    );

    const fetchInventoryForProductIds = useCallback(
        async (productIds, cancelledCheck) => {
            const ids = productIds
                .filter((id) => id && typeof id === 'string' && id.includes('Product'));
            if (ids.length === 0) return;

            const fp = salesFingerprintRef.current;
            const { hits, misses } = readClientProductInventoryCache(
                customerId,
                appliedRange.startDate,
                appliedRange.endDate,
                fp,
                ids
            );
            if (Object.keys(hits).length && !cancelledCheck()) {
                mergeProductInventory(hits, false);
            }

            const idsToFetch = misses.length ? misses : [];
            const needsNetwork = idsToFetch.length > 0;

            if (needsNetwork) setInventoryLoading(true);
            try {
                if (needsNetwork) {
                    const invRes = await fetch(`/api/shopify-products/${customerId}/inventory`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productIds: idsToFetch,
                            startDate: appliedRange.startDate,
                            endDate: appliedRange.endDate,
                            salesFingerprint: fp,
                        }),
                    });
                    if (!cancelledCheck() && invRes.ok) {
                        const data = await invRes.json();
                        const { inventory } = data;
                        mergeProductInventory(inventory, false);
                        if (data.salesFingerprint) {
                            salesFingerprintRef.current = data.salesFingerprint;
                        }
                        mergeClientProductInventoryCache(
                            customerId,
                            appliedRange.startDate,
                            appliedRange.endDate,
                            salesFingerprintRef.current,
                            inventory
                        );
                    }
                }
                if (!cancelledCheck()) {
                    fetch(`/api/shopify-products/${customerId}/inventory`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productIds: ids,
                            startDate: appliedRange.startDate,
                            endDate: appliedRange.endDate,
                            salesFingerprint: fp,
                            arrivalsOnly: true,
                        }),
                    })
                        .then((r) => (r.ok ? r.json() : null))
                        .then((data) => {
                            if (!cancelledCheck() && data?.inventory) {
                                mergeProductInventory(data.inventory, true);
                            }
                        })
                        .catch(() => {});
                }
            } catch {
                // Ignore; core product data already shown
            } finally {
                if (!cancelledCheck() && needsNetwork) setInventoryLoading(false);
            }
        },
        [
            customerId,
            appliedRange.startDate,
            appliedRange.endDate,
            mergeProductInventory,
        ]
    );

    const applyProductsPagePayload = useCallback((payload, { append = false } = {}) => {
        const list = payload.products || [];
        setProducts((prev) => {
            const merged = append ? [...prev, ...list] : list;
            return sortProductsByNetSales(merged);
        });
        if (payload.periodSummary) {
            setPeriodSummary(payload.periodSummary);
            rememberSalesFingerprint(payload.periodSummary);
        }
        setCatalogPageInfo(
            payload.catalogPageInfo || { hasNextPage: false, endCursor: null, salesOffset: 0 }
        );
        if (payload.catalogTotalCount != null) setCatalogTotalCount(payload.catalogTotalCount);
        return list;
    }, [rememberSalesFingerprint]);

    const buildProductsQuery = useCallback(
        (pageInfo = null) => {
            const params = new URLSearchParams({
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
                pageSize: String(CATALOG_PAGE_SIZE),
            });
            if (pageInfo?.endCursor) params.set('catalogCursor', pageInfo.endCursor);
            if (pageInfo?.salesOffset != null && pageInfo.salesOffset > 0) {
                params.set('salesOffset', String(pageInfo.salesOffset));
            }
            return `/api/shopify-products/${customerId}?${params.toString()}`;
        },
        [customerId, appliedRange.startDate, appliedRange.endDate]
    );

    useEffect(() => {
        if (!customerId || !appliedRange.startDate || !appliedRange.endDate || activeTab !== 'products') return;
        productsFetchCancelledRef.current = false;
        const cancelledCheck = () => productsFetchCancelledRef.current;

        async function fetchProducts() {
            setProductsLoading(true);
            setCatalogLoadingMore(false);
            setCatalogLoadingAll(false);
            setInventoryLoading(false);
            setError(null);
            setProducts([]);
            setPeriodSummary(null);
            setCatalogPageInfo(null);
            setCatalogTotalCount(null);
            setInventoryTotals(null);
            salesFingerprintRef.current = null;
            try {
                const productsRes = await fetch(buildProductsQuery());
                if (cancelledCheck()) return;
                const productsData = await productsRes.json();
                if (cancelledCheck()) return;
                if (!productsRes.ok) {
                    console.warn('Products fetch failed:', productsData.error);
                    setError(productsData.error || 'Failed to load products');
                }
                const list = applyProductsPagePayload(productsData);
                setProductsLoadedKey(productsFetchKey);
                setProductsLoading(false);

                fetchInventoryTotalsForRange(productsData.periodSummary, cancelledCheck);

                const productIds = list.map((p) => p.productId);
                await fetchInventoryForProductIds(productIds, cancelledCheck);
            } catch (e) {
                if (!cancelledCheck()) {
                    setError(e.message || String(e));
                    setProductsLoadedKey(productsFetchKey);
                    setProductsLoading(false);
                }
            }
        }
        fetchProducts();
        return () => {
            productsFetchCancelledRef.current = true;
        };
    }, [
        customerId,
        appliedRange.startDate,
        appliedRange.endDate,
        activeTab,
        productsFetchKey,
        buildProductsQuery,
        applyProductsPagePayload,
        fetchInventoryForProductIds,
        fetchInventoryTotalsForRange,
    ]);

    const fetchNextCatalogPage = useCallback(
        async (pageInfo, cancelledCheck) => {
            if (!pageInfo?.hasNextPage) return { list: [], pageInfo };
            const productsRes = await fetch(buildProductsQuery(pageInfo));
            if (cancelledCheck()) return { list: [], pageInfo };
            const productsData = await productsRes.json();
            if (!productsRes.ok) {
                console.warn('Catalog page fetch failed:', productsData.error);
                return { list: [], pageInfo };
            }
            const list = applyProductsPagePayload(productsData, { append: true });
            const nextInfo = productsData.catalogPageInfo || pageInfo;
            const productIds = list.map((p) => p.productId);
            await fetchInventoryForProductIds(productIds, cancelledCheck);
            return { list, pageInfo: nextInfo };
        },
        [buildProductsQuery, applyProductsPagePayload, fetchInventoryForProductIds]
    );

    const loadMoreCatalogProducts = useCallback(async () => {
        if (catalogLoadingMore || catalogLoadingAll || productsLoading || !catalogPageInfo?.hasNextPage) {
            return;
        }
        setCatalogLoadingMore(true);
        const cancelledCheck = () => productsFetchCancelledRef.current;
        try {
            await fetchNextCatalogPage(catalogPageInfo, cancelledCheck);
        } catch (e) {
            console.warn('Load more products failed:', e);
        } finally {
            if (!cancelledCheck()) setCatalogLoadingMore(false);
        }
    }, [
        catalogLoadingMore,
        catalogLoadingAll,
        productsLoading,
        catalogPageInfo,
        fetchNextCatalogPage,
    ]);

    const loadAllCatalogProducts = useCallback(async () => {
        if (
            catalogLoadingAll ||
            catalogLoadingMore ||
            productsLoading ||
            !catalogPageInfo?.hasNextPage
        ) {
            return;
        }
        setCatalogLoadingAll(true);
        const cancelledCheck = () => productsFetchCancelledRef.current;
        let pageInfo = catalogPageInfo;
        try {
            while (pageInfo?.hasNextPage && !cancelledCheck()) {
                setCatalogLoadingMore(true);
                const result = await fetchNextCatalogPage(pageInfo, cancelledCheck);
                pageInfo = result.pageInfo;
            }
        } catch (e) {
            console.warn('Load all products failed:', e);
        } finally {
            if (!cancelledCheck()) {
                setCatalogLoadingMore(false);
                setCatalogLoadingAll(false);
            }
        }
    }, [
        catalogLoadingAll,
        catalogLoadingMore,
        productsLoading,
        catalogPageInfo,
        fetchNextCatalogPage,
    ]);

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
        <div id="EcommercePage" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Ecommerce"
                label={customer ? customer.customerName : 'Ecommerce Dashboard'}
                customerId={customerId}
                dateRange={resolvedAppliedRange}
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
                        startDate={resolvedTempRange.startDate}
                        endDate={resolvedTempRange.endDate}
                        onStartDateChange={d => setTempRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setTempRange(r => ({ ...r, endDate: d }))}
                    />
                )}
                showPdfExport={false}
                shopifyMarketFilter={buildShopifyMarketFilterProps(filters)}
                adSpendPlatformFilter={buildAdSpendPlatformFilterProps(filters)}
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
                            loading={productsViewLoading}
                            inventoryLoading={inventoryLoading}
                            inventoryTotals={inventoryTotals}
                            inventoryTotalsLoading={inventoryTotalsLoading}
                            periodSummary={periodSummary}
                            catalogTotalCount={catalogTotalCount}
                            catalogHasMore={Boolean(catalogPageInfo?.hasNextPage)}
                            catalogLoadingMore={catalogLoadingMore}
                            catalogLoadingAll={catalogLoadingAll}
                            onLoadMoreCatalog={loadMoreCatalogProducts}
                            onLoadAllCatalog={loadAllCatalogProducts}
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
