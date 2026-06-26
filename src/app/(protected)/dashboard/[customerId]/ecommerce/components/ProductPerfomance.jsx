"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import CobaltLoader from '@/components/ui/CobaltLoader';
import MetricCard from '@/components/dashboard/MetricCard';
import { FiPackage, FiDollarSign } from 'react-icons/fi';
import {
    formatAvgDaysToSoldOutDisplay,
    SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS,
} from '@/lib/shopifyProductsApi';

export default function ProductPerfomance({ products = [], loading = false, inventoryLoading = false }) {
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState('totalRevenue');
    const [sortDir, setSortDir] = useState('desc');

    const formatCurrency = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString()} kr`);
    const formatCurrencyNoDecimals = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr`);
    const formatNumber = (n) => (n === undefined ? '—' : Number(n).toLocaleString());

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
        const totalRevenue = filteredProducts.reduce((s, p) => s + (Number(p.totalRevenue) || 0), 0);
        const totalUnits = filteredProducts.reduce((s, p) => s + (Number(p.unitsSold) || 0), 0);
        const totalOrders = filteredProducts.reduce((s, p) => s + (Number(p.ordersCount) || 0), 0);
        return {
            count: filteredProducts.length,
            totalRevenue,
            totalUnits,
            totalOrders,
        };
    }, [filteredProducts]);

    const inventoryStockTotal = filteredProducts.reduce(
        (s, p) => s + ((p.inventoryStock != null && !isNaN(p.inventoryStock)) ? p.inventoryStock : 0),
        0
    );
    const inventoryValueTotal = filteredProducts.reduce(
        (s, p) => s + ((p.inventoryValue != null && !isNaN(p.inventoryValue)) ? p.inventoryValue : 0),
        0
    );
    const inventoryPending = inventoryLoading && filteredProducts.every(p => p.inventoryStock == null);

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
            { key: 'totalRevenue', label: 'Revenue', sortable: true, numeric: true },
        ],
        velocity: [
            { key: 'unitsSold60d', label: 'Units (60d)', sortable: true, numeric: true },
            { key: 'avgDaysToSoldOut', label: 'Days to sold out', sortable: true, numeric: true },
        ],
        inventory: [
            { key: 'inventoryStock', label: 'Stock', sortable: true, numeric: true },
            { key: 'inventoryValue', label: 'Value', sortable: true, numeric: true },
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
        if (p.soldOutLabel === 'No sales (60d)') return 'is-muted-value';
        if (p.avgDaysToSoldOut == null) return '';
        if (p.avgDaysToSoldOut < 15) return 'is-critical';
        if (p.avgDaysToSoldOut <= 30) return 'is-warn';
        return '';
    };

    return (
        <section className="apex-ecom-panel">
            <div className="apex-ecom-panel__head">
                <div>
                    <h2 className="apex-ecom-panel__title">Product Performance</h2>
                    <p className="apex-ecom-panel__subtitle">
                        Units sold and revenue follow your selected date range. Avg. days to sold out always
                        uses the last {SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS} days of sales velocity and current
                        inventory stock.
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
                    {!loading && filteredProducts.length > 0 ? (
                        <span className="apex-ecom-result-count">
                            {filteredProducts.length.toLocaleString()} product
                            {filteredProducts.length === 1 ? '' : 's'}
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
            ) : filteredProducts.length === 0 ? (
                <div className="apex-ecom-empty">No product data for the selected range</div>
            ) : (
                <>
                    <div className="apex-ecom-summary">
                        <div className="apex-ecom-summary__item">
                            <span className="apex-ecom-summary__label">Products</span>
                            <span className="apex-ecom-summary__value">{summary.count.toLocaleString()}</span>
                        </div>
                        <div className="apex-ecom-summary__item">
                            <span className="apex-ecom-summary__label">Total revenue</span>
                            <span className="apex-ecom-summary__value">{formatCurrencyNoDecimals(summary.totalRevenue)}</span>
                        </div>
                        <div className="apex-ecom-summary__item">
                            <span className="apex-ecom-summary__label">Units sold</span>
                            <span className="apex-ecom-summary__value">{summary.totalUnits.toLocaleString()}</span>
                        </div>
                        <div className="apex-ecom-summary__item">
                            <span className="apex-ecom-summary__label">Orders</span>
                            <span className="apex-ecom-summary__value">{summary.totalOrders.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <MetricCard
                            variant="cobalt"
                            label="Inventory Stock"
                            value={inventoryPending
                                ? '…'
                                : inventoryStockTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            icon={<FiPackage />}
                        />
                        <MetricCard
                            variant="cobalt"
                            label="Inventory Value"
                            value={inventoryPending
                                ? '…'
                                : inventoryValueTotal.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                            unit={inventoryPending ? undefined : 'kr'}
                            icon={<FiDollarSign />}
                        />
                    </div>

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
                                        Velocity · 60 days
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
                                                    ? '…'
                                                    : p.soldOutLabel}
                                            </span>
                                        </td>
                                        <td className="is-num td-group-start">
                                            {inventoryLoading && p.inventoryStock == null
                                                ? '…'
                                                : (p.inventoryStock != null ? formatNumber(p.inventoryStock) : '—')}
                                        </td>
                                        <td className="is-num">
                                            {inventoryLoading && p.inventoryValue == null
                                                ? '…'
                                                : (p.inventoryValue != null ? formatCurrencyNoDecimals(p.inventoryValue) : '—')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6} className="is-muted is-sticky-product">
                                        Total · filtered
                                    </td>
                                    <td className="is-num td-group-start">—</td>
                                    <td className="is-num">—</td>
                                    <td className="is-num td-group-start">
                                        {inventoryPending
                                            ? '…'
                                            : inventoryStockTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="is-num">
                                        {inventoryPending
                                            ? '…'
                                            : formatCurrencyNoDecimals(inventoryValueTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}
