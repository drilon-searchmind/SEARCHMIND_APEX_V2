"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import CobaltLoader from '@/components/ui/CobaltLoader';
import { FiPackage } from 'react-icons/fi';
import ProductOverview from './ProductOverview';
import {
    formatAvgDaysToSoldOutDisplay,
    SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS,
} from '@/lib/shopifyProductsApi';

function EcomInlineSpinner({ className = '', label = 'Loading' }) {
    return (
        <span
            className={`apex-ecom-inline-spinner${className ? ` ${className}` : ''}`}
            role="status"
            aria-label={label}
        />
    );
}

function EcomLoadingCell({ pending, children }) {
    if (pending) {
        return (
            <span className="apex-ecom-loading-cell">
                <EcomInlineSpinner label="Loading" />
            </span>
        );
    }
    return children;
}

export default function ProductPerfomance({
    products = [],
    loading = false,
    inventoryLoading = false,
    periodSummary = null,
    catalogTotalCount = null,
    catalogHasMore = false,
    catalogLoadingMore = false,
    catalogLoadingAll = false,
    onLoadMoreCatalog,
    onLoadAllCatalog,
    inventoryTotals = null,
    inventoryTotalsLoading = false,
}) {
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState('totalRevenue');
    const [sortDir, setSortDir] = useState('desc');

    const formatCurrency = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString()} kr`);
    const formatCurrencyNoDecimals = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr`);
    const formatNumber = (n) => (n === undefined ? '—' : Number(n).toLocaleString());

    const formatExpectedArrival = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const inventoryRowPending = (p) => inventoryLoading && p.inventoryStock == null;

    const incomingArrivalTitle = (p) => {
        if (inventoryRowPending(p)) return 'Loading inventory…';
        const incoming = Number(p.incomingQuantity) || 0;
        if (incoming <= 0) {
            return 'No incoming units in Shopify (incoming appears when transfers or purchase orders are in progress).';
        }
        if (p.expectedArrivalDate) {
            return `${incoming.toLocaleString()} units incoming · expected ${formatExpectedArrival(p.expectedArrivalDate)}`;
        }
        return `${incoming.toLocaleString()} units incoming · no expected arrival date in Shopify shipments`;
    };

    const enrichedProducts = useMemo(
        () =>
            products.map((p) => {
                const unitsSold60d = Number(p.unitsSold60d) || 0;
                const soldOut = formatAvgDaysToSoldOutDisplay(p.inventoryStock, unitsSold60d);
                return {
                    ...p,
                    unitsSold60d,
                    avgDaysToSoldOut: soldOut.days,
                    soldOutLabel: soldOut.label,
                    soldOutTitle: soldOut.title,
                };
            }),
        [products]
    );

    const filteredProducts = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = enrichedProducts.slice();
        if (q) {
            list = list.filter(p => (
                (p.title || '').toLowerCase().includes(q) ||
                (p.vendor || '').toLowerCase().includes(q) ||
                (p.handle || '').toLowerCase().includes(q) ||
                (p.productType || '').toLowerCase().includes(q)
            ));
        }
        const comparator = (a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const empty = (v) => v === undefined || v === null;
            if (empty(aVal) && empty(bVal)) return 0;
            if (empty(aVal)) return 1;
            if (empty(bVal)) return -1;
            if (typeof aVal === 'number' || typeof bVal === 'number') {
                return Number(aVal) - Number(bVal);
            }
            return String(aVal).localeCompare(String(bVal));
        };
        list.sort((a, b) => (sortDir === 'asc' ? comparator(a, b) : -comparator(a, b)));
        return list;
    }, [enrichedProducts, query, sortKey, sortDir]);

    const summary = useMemo(() => {
        const loadedCount = products.length;
        const productNetSales = filteredProducts.reduce(
            (s, p) => s + (Number(p.totalRevenue) || 0),
            0
        );
        const usePeriod = periodSummary && !query.trim();
        return {
            loadedCount,
            filteredCount: filteredProducts.length,
            totalSalesExVat: usePeriod
                ? Number(periodSummary.totalSalesExVat) || 0
                : productNetSales,
            totalUnits: usePeriod
                ? Number(periodSummary.netItemsSold) || 0
                : filteredProducts.reduce((s, p) => s + (Number(p.unitsSold) || 0), 0),
            totalOrders: usePeriod
                ? Number(periodSummary.orders) || 0
                : filteredProducts.reduce((s, p) => s + (Number(p.ordersCount) || 0), 0),
            productNetSalesSum: productNetSales,
            periodNetSales: periodSummary ? Number(periodSummary.netSales) || 0 : null,
        };
    }, [filteredProducts, products.length, periodSummary, query]);

    // Overview always describes the whole store for the period, independent of the search box
    const overviewSummary = useMemo(() => ({
        totalSalesExVat: periodSummary
            ? Number(periodSummary.totalSalesExVat) || 0
            : enrichedProducts.reduce((s, p) => s + (Number(p.totalRevenue) || 0), 0),
        totalUnits: periodSummary
            ? Number(periodSummary.netItemsSold) || 0
            : enrichedProducts.reduce((s, p) => s + (Number(p.unitsSold) || 0), 0),
        totalOrders: periodSummary
            ? Number(periodSummary.orders) || 0
            : enrichedProducts.reduce((s, p) => s + (Number(p.ordersCount) || 0), 0),
    }), [periodSummary, enrichedProducts]);
    // Store-wide inventory totals (catalog table footer)
    const storeInventoryStock =
        inventoryTotals != null ? Number(inventoryTotals.inventoryStock) || 0 : null;
    const storeInventoryValue =
        inventoryTotals != null ? Number(inventoryTotals.inventoryValue) || 0 : null;
    const storeIncomingQuantity =
        inventoryTotals != null ? Number(inventoryTotals.incomingQuantity) || 0 : null;
    const storeInventoryPending = inventoryTotalsLoading && inventoryTotals == null;

    const toggleSort = (key) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const sortIndicator = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

    const columns = {
        sales: [
            { key: 'avgPrice', label: 'Avg. price', sortable: true, numeric: true },
            { key: 'unitsSold', label: 'Units sold', sortable: true, numeric: true },
            { key: 'ordersCount', label: 'Orders', sortable: true, numeric: true },
            { key: 'totalRevenue', label: 'Net sales', sortable: true, numeric: true },
        ],
        velocity: [
            { key: 'unitsSold60d', label: `Units (${SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS}d)`, sortable: true, numeric: true },
            { key: 'avgDaysToSoldOut', label: 'Days to sold out', sortable: true, numeric: true },
        ],
        inventory: [
            { key: 'inventoryStock', label: 'Stock', sortable: true, numeric: true },
            { key: 'inventoryValue', label: 'Value', sortable: true, numeric: true },
            { key: 'incomingQuantity', label: 'Incoming', sortable: true, numeric: true },
            { key: 'expectedArrivalDate', label: 'Expected arrival', sortable: true, numeric: false },
        ],
    };

    const allSortColumns = [
        { key: 'productType', label: 'Category' },
        ...columns.sales,
        ...columns.velocity,
        ...columns.inventory,
    ];

    const soldOutCellClass = (p) => {
        if (inventoryLoading && p.inventoryStock == null) return 'is-pending';
        if (p.soldOutLabel === `No sales (${SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS}d)`) return 'is-muted-value';
        if (p.avgDaysToSoldOut == null) return '';
        if (p.avgDaysToSoldOut < 15) return 'is-critical';
        if (p.avgDaysToSoldOut <= 30) return 'is-warn';
        return '';
    };

    return (
        <>
        {!loading && products.length > 0 ? (
            <ProductOverview
                summary={overviewSummary}
                products={enrichedProducts}
                catalogTotalCount={catalogTotalCount}
                inventoryTotals={inventoryTotals}
                inventoryPending={storeInventoryPending}
                inventoryLoading={inventoryLoading}
            />
        ) : null}
        <section className="apex-ecom-panel">
            <div className="apex-ecom-panel__head">
                <div>
                    <h2 className="apex-ecom-panel__title">Product catalog</h2>
                    <p className="apex-ecom-panel__subtitle">
                        Full Shopify catalog with sales for your date range (ShopifyQL, same filters as Overview).
                        Store totals match Overview total sales excl. VAT; per-product net sales exclude shipping.
                        Avg. days to sold out uses the last {SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS} days of velocity.
                        Products load highest net sales first, then the rest of the catalog. Inventory
                        totals reflect your full store; per-row stock loads with each page.
                    </p>
                </div>
            </div>

            <div className="apex-ecom-panel__toolbar">
                <div className="apex-ecom-panel__toolbar-start">
                    <input
                        type="search"
                        placeholder="Search products, vendor, category…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="apex-ecom-search"
                        aria-label="Search products"
                    />
                    {!loading && products.length > 0 ? (
                        <span className="apex-ecom-result-count">
                            {query.trim()
                                ? `${filteredProducts.length.toLocaleString()} matching`
                                : catalogTotalCount != null
                                  ? `${summary.loadedCount.toLocaleString()} of ${catalogTotalCount.toLocaleString()} loaded`
                                  : `${summary.loadedCount.toLocaleString()} loaded`}
                        </span>
                    ) : null}
                </div>
                <div className="apex-ecom-sort">
                    <span className="apex-ecom-sort__label">Sort by</span>
                    <select
                        value={sortKey}
                        onChange={e => { setSortKey(e.target.value); setSortDir('desc'); }}
                        className="apex-ecom-select"
                        aria-label="Sort products by"
                    >
                        {allSortColumns.map((col) => (
                            <option key={col.key} value={col.key}>
                                {col.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="apex-perf-btn apex-ecom-sort__dir"
                        aria-label="Toggle sort direction"
                    >
                        {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading products"
                        request="GET /api/shopify-products"
                    />
                </div>
            ) : products.length === 0 ? (
                <div className="apex-ecom-empty">No products in this Shopify store</div>
            ) : filteredProducts.length === 0 ? (
                <div className="apex-ecom-empty">No products match your search</div>
            ) : (
                <>
                    <div className="apex-ecom-table-wrap apex-ecom-table-wrap--products">
                        <table className="apex-ecom-table">
                            <thead>
                                <tr className="apex-ecom-table__group-row">
                                    <th rowSpan={2} className="is-sticky-product th-product">
                                        Product
                                    </th>
                                    <th rowSpan={2} className="is-sortable" onClick={() => toggleSort('productType')} aria-sort={sortKey === 'productType' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        Category{sortIndicator('productType')}
                                    </th>
                                    <th colSpan={columns.sales.length} className="th-group th-group--sales">
                                        Sales · date range
                                    </th>
                                    <th colSpan={columns.velocity.length} className="th-group th-group--velocity">
                                        Velocity · {SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS} days
                                    </th>
                                    <th colSpan={columns.inventory.length} className="th-group th-group--inventory">
                                        Inventory
                                    </th>
                                </tr>
                                <tr className="apex-ecom-table__subhead-row">
                                    {columns.sales.map((col) => (
                                        <th
                                            key={col.key}
                                            className="th-sub is-num is-sortable"
                                            onClick={() => toggleSort(col.key)}
                                            aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {col.label}{sortIndicator(col.key)}
                                        </th>
                                    ))}
                                    {columns.velocity.map((col) => (
                                        <th
                                            key={col.key}
                                            className="th-sub is-num is-sortable"
                                            onClick={() => toggleSort(col.key)}
                                            aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {col.label}{sortIndicator(col.key)}
                                        </th>
                                    ))}
                                    {columns.inventory.map((col) => (
                                        <th
                                            key={col.key}
                                            className="th-sub is-num is-sortable"
                                            onClick={() => toggleSort(col.key)}
                                            aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {col.label}{sortIndicator(col.key)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((p, i) => (
                                    <tr key={p.productId || i}>
                                        <td className="is-sticky-product td-product">
                                            <div className="apex-ecom-table__product">
                                                <div className="apex-ecom-table__thumb">
                                                    {p.image ? (
                                                        <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />
                                                    ) : (
                                                        <div className="apex-ecom-table__thumb-fallback" aria-hidden>
                                                            <FiPackage />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="apex-ecom-table__name" title={p.title}>{p.title}</div>
                                                    {p.vendor ? (
                                                        <div className="apex-ecom-table__vendor">{p.vendor}</div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="td-category">{p.productType || '—'}</td>
                                        <td className="is-num">{formatCurrency(p.avgPrice)}</td>
                                        <td className="is-num">{formatNumber(p.unitsSold)}</td>
                                        <td className="is-num">{formatNumber(p.ordersCount)}</td>
                                        <td className="is-num is-emphasis">{formatCurrencyNoDecimals(p.totalRevenue)}</td>
                                        <td className="is-num td-group-start">{formatNumber(p.unitsSold60d)}</td>
                                        <td className={`is-num apex-ecom-table__sold-out ${soldOutCellClass(p)}`}>
                                            <span
                                                className="apex-ecom-table__sold-out-pill"
                                                title={
                                                    inventoryLoading && p.inventoryStock == null
                                                        ? 'Loading inventory…'
                                                        : p.soldOutTitle
                                                }
                                            >
                                                {inventoryLoading && p.inventoryStock == null
                                                    ? <EcomInlineSpinner label="Loading days to sold out" />
                                                    : p.soldOutLabel}
                                            </span>
                                        </td>
                                        <td className="is-num td-group-start">
                                            <EcomLoadingCell pending={inventoryLoading && p.inventoryStock == null}>
                                                {p.inventoryStock != null ? formatNumber(p.inventoryStock) : '—'}
                                            </EcomLoadingCell>
                                        </td>
                                        <td className="is-num">
                                            <EcomLoadingCell pending={inventoryLoading && p.inventoryValue == null}>
                                                {p.inventoryValue != null
                                                    ? formatCurrencyNoDecimals(p.inventoryValue)
                                                    : '—'}
                                            </EcomLoadingCell>
                                        </td>
                                        <td className="is-num" title={incomingArrivalTitle(p)}>
                                            <EcomLoadingCell pending={inventoryRowPending(p)}>
                                                {p.incomingQuantity != null ? formatNumber(p.incomingQuantity) : '—'}
                                            </EcomLoadingCell>
                                        </td>
                                        <td
                                            className="is-num apex-ecom-table__arrival"
                                            title={incomingArrivalTitle(p)}
                                        >
                                            <EcomLoadingCell pending={inventoryRowPending(p)}>
                                                {Number(p.incomingQuantity) > 0
                                                    ? formatExpectedArrival(p.expectedArrivalDate)
                                                    : '—'}
                                            </EcomLoadingCell>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6} className="is-muted is-sticky-product">
                                        Inventory · all products
                                    </td>
                                    <td className="is-num td-group-start">—</td>
                                    <td className="is-num">—</td>
                                    <td className="is-num td-group-start">
                                        {storeInventoryPending ? (
                                            <EcomInlineSpinner label="Loading inventory stock total" />
                                        ) : (
                                            (storeInventoryStock ?? 0).toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })
                                        )}
                                    </td>
                                    <td className="is-num">
                                        {storeInventoryPending ? (
                                            <EcomInlineSpinner label="Loading inventory value total" />
                                        ) : (
                                            formatCurrencyNoDecimals(storeInventoryValue ?? 0)
                                        )}
                                    </td>
                                    <td className="is-num">
                                        {storeInventoryPending ? (
                                            <EcomInlineSpinner label="Loading incoming stock total" />
                                        ) : (
                                            (storeIncomingQuantity ?? 0).toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })
                                        )}
                                    </td>
                                    <td className="is-num">—</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {catalogHasMore ? (
                        <div className="apex-ecom-panel__toolbar mt-4 justify-center apex-ecom-catalog-actions">
                            <button
                                type="button"
                                className="apex-perf-btn"
                                disabled={catalogLoadingMore || catalogLoadingAll || loading}
                                onClick={() => onLoadMoreCatalog?.()}
                            >
                                {catalogLoadingMore && !catalogLoadingAll ? (
                                    <>
                                        <EcomInlineSpinner className="apex-ecom-inline-spinner--btn" label="Loading" />
                                        Loading more…
                                    </>
                                ) : (
                                    `Load more (${summary.loadedCount.toLocaleString()} loaded${
                                        catalogTotalCount != null
                                            ? ` of ${catalogTotalCount.toLocaleString()}`
                                            : ''
                                    })`
                                )}
                            </button>
                            <button
                                type="button"
                                className="apex-perf-btn apex-perf-btn--secondary"
                                disabled={catalogLoadingMore || catalogLoadingAll || loading}
                                onClick={() => onLoadAllCatalog?.()}
                            >
                                {catalogLoadingAll ? (
                                    <>
                                        <EcomInlineSpinner className="apex-ecom-inline-spinner--btn" label="Loading" />
                                        Loading all products…
                                    </>
                                ) : (
                                    `Load all${
                                        catalogTotalCount != null
                                            ? ` (${catalogTotalCount.toLocaleString()})`
                                            : ''
                                    }`
                                )}
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </section>
        </>
    );
}
