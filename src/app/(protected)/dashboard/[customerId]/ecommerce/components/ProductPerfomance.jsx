"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import CobaltLoader from '@/components/ui/CobaltLoader';
import MetricCard from '@/components/dashboard/MetricCard';
import { FiPackage, FiDollarSign } from 'react-icons/fi';

export default function ProductPerfomance({ products = [], loading = false, inventoryLoading = false }) {
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState('totalRevenue');
    const [sortDir, setSortDir] = useState('desc');

    const formatCurrency = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString()} kr`);
    const formatCurrencyNoDecimals = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr`);
    const formatNumber = (n) => (n === undefined ? '—' : Number(n).toLocaleString());

    const filteredProducts = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = products.slice();
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
    }, [products, query, sortKey, sortDir]);

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

    const columns = [
        { key: 'productType', label: 'Category', sortable: true },
        { key: 'avgPrice', label: 'Avg. Price', sortable: true, numeric: true },
        { key: 'unitsSold', label: 'Units Sold', sortable: true, numeric: true },
        { key: 'ordersCount', label: 'Orders', sortable: true, numeric: true },
        { key: 'totalRevenue', label: 'Revenue', sortable: true, numeric: true },
        { key: 'inventoryStock', label: 'Inventory Stock', sortable: true, numeric: true },
        { key: 'inventoryValue', label: 'Inventory Value', sortable: true, numeric: true },
    ];

    return (
        <section className="apex-ecom-panel">
            <div className="apex-ecom-panel__head">
                <div>
                    <h2 className="apex-ecom-panel__title">Product Performance</h2>
                    <p className="apex-ecom-panel__subtitle">Top products by revenue for the selected period</p>
                </div>
            </div>

            <div className="apex-ecom-panel__toolbar">
                <input
                    type="search"
                    placeholder="Search products, vendor, category…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="apex-ecom-search"
                />
                <div className="apex-ecom-sort">
                    <span className="apex-ecom-sort__label">Sort by</span>
                    <select
                        value={sortKey}
                        onChange={e => { setSortKey(e.target.value); setSortDir('desc'); }}
                        className="apex-ecom-select"
                    >
                        <option value="productType">Category</option>
                        <option value="avgPrice">Avg. Price</option>
                        <option value="unitsSold">Units Sold</option>
                        <option value="ordersCount">Orders</option>
                        <option value="totalRevenue">Revenue</option>
                        <option value="inventoryStock">Inventory Stock</option>
                        <option value="inventoryValue">Inventory Value</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="apex-perf-btn"
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

                    <div className="apex-ecom-table-wrap">
                        <table className="apex-ecom-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    {columns.map(col => (
                                        <th
                                            key={col.key}
                                            className={`${col.numeric ? 'is-num' : ''} is-sortable`}
                                            onClick={() => toggleSort(col.key)}
                                        >
                                            {col.label}{sortIndicator(col.key)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((p, i) => (
                                    <tr key={p.productId || i}>
                                        <td>
                                            <div className="apex-ecom-table__product">
                                                <div className="apex-ecom-table__thumb">
                                                    {p.image ? (
                                                        <Image src={p.image} alt={p.title} fill sizes="44px" className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">—</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="apex-ecom-table__name">{p.title}</div>
                                                    <div className="apex-ecom-table__vendor">{p.vendor}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{p.productType || '—'}</td>
                                        <td className="is-num">{formatCurrency(p.avgPrice)}</td>
                                        <td className="is-num">{formatNumber(p.unitsSold)}</td>
                                        <td className="is-num">{formatNumber(p.ordersCount)}</td>
                                        <td className="is-num">{formatCurrencyNoDecimals(p.totalRevenue)}</td>
                                        <td className="is-num">
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
                                    <td colSpan={6} className="is-muted">Total</td>
                                    <td className="is-num">
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
