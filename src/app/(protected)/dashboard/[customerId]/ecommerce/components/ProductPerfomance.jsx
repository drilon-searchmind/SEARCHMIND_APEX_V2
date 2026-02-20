"use client";

import React, { useState, useMemo } from 'react';
import Spinner from '@/components/ui/Spinner';
import Image from 'next/image';
import MetricCard from '@/components/dashboard/MetricCard';
import { FiPackage, FiDollarSign } from 'react-icons/fi';

export default function ProductPerfomance({ products = [], loading = false, inventoryLoading = false }) {
    // Table controls
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState('totalRevenue'); // default sort by revenue
    const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

    const formatCurrency = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString()} kr`);
    const formatCurrencyNoDecimals = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} kr`);
    const formatNumber = (n) => (n === undefined ? '—' : Number(n).toLocaleString());

    // Filtered and sorted products
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
        // Sorting
        const comparator = (a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const empty = (v) => v === undefined || v === null;
            if (empty(aVal) && empty(bVal)) return 0;
            if (empty(aVal)) return 1;
            if (empty(bVal)) return -1;
            // Numeric
            if (typeof aVal === 'number' || typeof bVal === 'number') {
                return Number(aVal) - Number(bVal);
            }
            // String
            return String(aVal).localeCompare(String(bVal));
        };
        list.sort((a, b) => (sortDir === 'asc' ? comparator(a, b) : -comparator(a, b)));
        return list;
    }, [products, query, sortKey, sortDir]);

    const toggleSort = (key) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Product Performance</h3>
                    <p className="text-sm text-gray-400">Top products by revenue</p>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full max-w-md">
                    <input
                        type="text"
                        placeholder="Search products, vendor, category..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Sort:</span>
                    <select
                        value={sortKey}
                        onChange={e => { setSortKey(e.target.value); setSortDir('desc'); }}
                        className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white"
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
                        onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="px-2 py-1 border border-gray-200 rounded-md bg-white text-sm"
                    >
                        {sortDir === 'asc' ? '↑' : '↓'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-48"><Spinner size={40} /></div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-8">No product data for the selected range</div>
            ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <MetricCard
                        label="Inventory Stock"
                        value={inventoryLoading && filteredProducts.every(p => p.inventoryStock == null)
                            ? <Spinner size={20} className="inline-block" />
                            : filteredProducts.reduce((s, p) => s + ((p.inventoryStock != null && !isNaN(p.inventoryStock)) ? p.inventoryStock : 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                    />
                    <MetricCard
                        label="Inventory Value"
                        value={inventoryLoading && filteredProducts.every(p => p.inventoryValue == null)
                            ? <Spinner size={20} className="inline-block" />
                            : filteredProducts.reduce((s, p) => s + ((p.inventoryValue != null && !isNaN(p.inventoryValue)) ? p.inventoryValue : 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                        unit={inventoryLoading && filteredProducts.every(p => p.inventoryValue == null) ? undefined : 'kr'}
                        icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                    />
                </div>
                <div className="overflow-auto" style={{ maxHeight: 800 }}>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left">Product</th>
                                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('productType')}>
                                    Category {sortKey === 'productType' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('avgPrice')}>
                                    Avg. Price {sortKey === 'avgPrice' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('unitsSold')}>
                                    Units Sold {sortKey === 'unitsSold' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('ordersCount')}>
                                    Orders {sortKey === 'ordersCount' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('totalRevenue')}>
                                    Revenue {sortKey === 'totalRevenue' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('inventoryStock')}>
                                    Inventory Stock {sortKey === 'inventoryStock' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('inventoryValue')}>
                                    Inventory Value {sortKey === 'inventoryValue' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((p, i) => (
                                <tr key={p.productId || i} className="border-b last:border-b-0">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 relative rounded overflow-hidden bg-gray-100">
                                                {p.image ? (
                                                    <Image src={p.image} alt={p.title} fill sizes="48px" className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">🖼️</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{p.title}</div>
                                                <div className="text-xs text-gray-400">{p.vendor}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">{p.productType || '-'}</td>
                                    <td className="px-4 py-4 text-right">{formatCurrency(p.avgPrice)}</td>
                                    <td className="px-4 py-4 text-right">{formatNumber(p.unitsSold)}</td>
                                    <td className="px-4 py-4 text-right">{formatNumber(p.ordersCount)}</td>
                                    <td className="px-4 py-4 text-right font-semibold">{formatCurrency(p.totalRevenue)}</td>
                                    <td className="px-4 py-4 text-right">{inventoryLoading && p.inventoryStock == null ? <Spinner size={16} className="inline-block" /> : (p.inventoryStock != null ? formatNumber(p.inventoryStock) : '—')}</td>
                                    <td className="px-4 py-4 text-right">{inventoryLoading && p.inventoryValue == null ? <Spinner size={16} className="inline-block" /> : (p.inventoryValue != null ? formatCurrency(p.inventoryValue) : '—')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-[var(--color-primary-searchmind)] text-white font-semibold border-t-2 z-10">
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-right text-gray-400">Total</td>
                                <td className="px-4 py-3 text-right">{formatCurrencyNoDecimals(filteredProducts.reduce((s, p) => s + (p.totalRevenue || 0), 0))}</td>
                                <td className="px-4 py-3 text-right">{inventoryLoading && filteredProducts.every(p => p.inventoryStock == null) ? <Spinner size={16} className="inline-block" /> : filteredProducts.reduce((s, p) => s + ((p.inventoryStock != null && !isNaN(p.inventoryStock)) ? p.inventoryStock : 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                <td className="px-4 py-3 text-right">{inventoryLoading && filteredProducts.every(p => p.inventoryValue == null) ? <Spinner size={16} className="inline-block" /> : formatCurrencyNoDecimals(filteredProducts.reduce((s, p) => s + ((p.inventoryValue != null && !isNaN(p.inventoryValue)) ? p.inventoryValue : 0), 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                </>
            )}
        </div>
    );
}