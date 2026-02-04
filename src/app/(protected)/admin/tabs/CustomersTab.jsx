"use client";

import React from "react";
import FormButton from "@/components/form/FormButton";
import Link from "next/link";
import { FiCheck, FiX, FiShoppingBag, FiUsers, FiTrendingUp, FiSearch, FiBarChart2 } from "react-icons/fi";

const TABS = [
    { id: 'existing', label: 'Existing Customers' },
    { id: 'missing', label: 'Missing Customers' },
];

export default function CustomersTab() {
    const [activeTab, setActiveTab] = React.useState('existing');
    const [search, setSearch] = React.useState("");
    const [existingItems, setExistingItems] = React.useState([]);
    const [missingItems, setMissingItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    // Fetch existing customers
    React.useEffect(() => {
        if (activeTab === 'existing') {
            setLoading(true);
            fetch('/api/customers')
                .then(res => res.ok ? res.json() : [])
                .then(data => setExistingItems(Array.isArray(data) ? data : []))
                .catch(() => setExistingItems([]))
                .finally(() => setLoading(false));
        }
    }, [activeTab]);

    // Fetch missing customers
    React.useEffect(() => {
        if (activeTab === 'missing') {
            setLoading(true);
            fetch('/api/admin/missing-customers')
                .then(res => res.ok ? res.json() : [])
                .then(data => setMissingItems(Array.isArray(data) ? data : []))
                .catch(() => setMissingItems([]))
                .finally(() => setLoading(false));
        }
    }, [activeTab]);

    const filteredExisting = existingItems.filter(c => (c.customerName || '').toLowerCase().includes(search.toLowerCase()));
    const filteredMissing = missingItems.filter(c => (c.clickup_name || '').toLowerCase().includes(search.toLowerCase()));

    // Helper function to check if a field exists and is not "0"
    const hasField = (customer, fieldPath) => {
        const paths = fieldPath.split('.');
        let value = customer;
        for (const path of paths) {
            value = value?.[path];
            if (value === undefined || value === null) return false;
        }
        // Check if value exists, is not empty, and is not "0" (string or number)
        if (value === '' || value === null || value === undefined) return false;
        if (value === '0' || value === 0) return false;
        return true;
    };

    // Helper to render checkmark icon
    const CheckIcon = ({ hasValue }) => (
        hasValue ? (
            <FiCheck className="text-green-600" size={18} />
        ) : (
            <FiX className="text-red-600" size={18} />
        )
    );

    return (
        <div className="flex flex-col gap-4">
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Customers</h5>

            {/* Tabs */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="flex gap-8 px-6">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSearch(""); // Clear search when switching tabs
                            }}
                            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder={`Search ${activeTab === 'existing' ? 'existing' : 'missing'} customers...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mt-0 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                />
            </div>

            {/* Existing Customers Table */}
            {activeTab === 'existing' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Name</th>
                                <th className="px-4 py-2 text-left">Type</th>
                                <th className="px-4 py-2 text-left">Archived</th>
                                <th className="px-4 py-2 text-center">
                                    <div className="flex items-center gap-1">
                                        <FiUsers className="text-gray-600" size={16} />
                                        <span>Meta ID</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-center">
                                    <div className="flex items-center gap-1">
                                        <FiShoppingBag className="text-gray-600" size={16} />
                                        <span>Shopify/WooCommerce</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-center">
                                    <div className="flex items-center gap-1">
                                        <FiUsers className="text-gray-600" size={16} />
                                        <span>Facebook</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-center">
                                    <div className="flex items-center gap-1">
                                        <FiTrendingUp className="text-gray-600" size={16} />
                                        <span>Google Ads</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-center">
                                    <div className="flex items-center gap-1">
                                        <FiSearch className="text-gray-600" size={16} />
                                        <span>Search Console</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-center">
                                    <div className="flex items-center gap-1">
                                        <FiBarChart2 className="text-gray-600" size={16} />
                                        <span>GA4</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="px-4 py-4 text-gray-400" colSpan={10}>Loading...</td></tr>
                            ) : filteredExisting.length === 0 ? (
                                <tr><td className="px-4 py-4 text-gray-400" colSpan={10}>No customers</td></tr>
                            ) : filteredExisting.map(c => {
                                const isWooCommerce = c.customerType === 'WooCommerce';
                                const hasShopifyWooCommerce = isWooCommerce
                                    ? hasField(c, 'CustomerSettings.wooCommerceApiKey')
                                    : hasField(c, 'CustomerSettings.shopifyUrl');

                                return (
                                    <tr key={c._id} className="border-b last:border-b-0">
                                        <td className="px-4 py-2">{c.customerName}</td>
                                        <td className="px-4 py-2">{c.customerType}</td>
                                        <td className="px-4 py-2">
                                            <span
                                                className={`
                                                    inline-flex rounded-lg px-5 py-0.5 text-xs font-medium 
                                                    ${c.isArchived ? '' : 'bg-orange-50 text-orange-700'}
                                                `}>
                                                {c.isArchived ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <CheckIcon hasValue={hasField(c, 'CustomerSettings.customerMetaID')} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <CheckIcon hasValue={hasShopifyWooCommerce} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <CheckIcon hasValue={hasField(c, 'CustomerSettings.facebookAdAccountId')} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <CheckIcon hasValue={hasField(c, 'CustomerSettings.googleAdsCustomerId')} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <CheckIcon hasValue={hasField(c, 'CustomerSettings.googleSearchConsoleProperty')} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <CheckIcon hasValue={hasField(c, 'CustomerSettings.ga4PropertyId')} />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Link href={`/dashboard/${c._id}/config`}>
                                                <FormButton borderType="outline" buttonSize="small">Config</FormButton>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Missing Customers Table */}
            {activeTab === 'missing' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">ClickUp ID</th>
                                <th className="px-4 py-2 text-left">ClickUp Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="px-4 py-4 text-gray-400" colSpan={2}>Loading...</td></tr>
                            ) : filteredMissing.length === 0 ? (
                                <tr><td className="px-4 py-4 text-gray-400" colSpan={2}>No missing customers</td></tr>
                            ) : filteredMissing.map((c, idx) => (
                                <tr key={c.clickup_id || idx} className="border-b last:border-b-0">
                                    <td className="px-4 py-2 font-mono text-xs">{c.clickup_id}</td>
                                    <td className="px-4 py-2">{c.clickup_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
