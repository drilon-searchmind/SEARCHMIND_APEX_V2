"use client";

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import ToastProvider, { showToast } from '@/components/ui/ToastProvider';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import VerticalTabs from './components/VerticalTabs';
import GeneralSettingsForm from './components/GeneralSettingsForm';
import CustomerSettingsForm from './components/CustomerSettingsForm';
import StaticExpensesForm from './components/StaticExpensesForm';

export default function ConfigPage() {
    const { customerId } = useParams();
    const defaultFormState = {
        customerName: "",
        parentCustomer: "",
        customerType: "Shopify",
        isArchived: false,
        metricPreference: "ROAS/POAS",
        customerStoreValutaCode: "DKK",
        customerClickupID: "",
        customerMetaID: "DK",
        customerMetaIDExclude: "",
        changeCurrency: true,
        customerRevenueType: "total_sales",
        shopifyUrl: "",
        shopifyApiPassword: "",
        facebookAdAccountId: "",
        googleAdsCustomerId: "",
        CustomerStaticExpenses: {
            cogsPercentage: 0,
            shippingCostPerOrder: 0,
            transactionCostPercentage: 0,
            marketingBureauCost: 0,
            marketingToolingCost: 0,
            fixedExpenses: 0,
        },
    };

    const [form, setForm] = useState(defaultFormState);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        async function fetchCustomer() {
            setLoading(true);
            try {
                const res = await fetch(`/api/customers/${customerId}`);
                if (!res.ok) throw new Error('Failed to fetch customer');
                const data = await res.json();
                setForm({
                    ...defaultFormState,
                    ...data,
                    ...(data.CustomerSettings || {}),
                    CustomerStaticExpenses: {
                        ...defaultFormState.CustomerStaticExpenses,
                        ...(data.CustomerStaticExpenses || {}),
                    },
                });
            } catch (err) {
                showToast({ message: 'Failed to load customer', type: 'error', position: 'top-center' });
            } finally {
                setLoading(false);
            }
        }
        fetchCustomer();
    }, [customerId]);

    const handleChange = (e) => {
        const { name, value, type, checked, dataset } = e.target;
        if (dataset && dataset.group === 'CustomerStaticExpenses') {
            setForm((prev) => ({
                ...prev,
                CustomerStaticExpenses: {
                    ...prev.CustomerStaticExpenses,
                    [name]: type === 'number' ? Number(value) : value
                }
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault && e.preventDefault();
        setSaving(true);
        try {
            const {
                customerName,
                parentCustomer,
                customerType,
                isArchived,
                metricPreference,
                customerStoreValutaCode,
                customerClickupID,
                customerMetaID,
                customerMetaIDExclude,
                changeCurrency,
                customerRevenueType,
                shopifyUrl,
                shopifyApiPassword,
                facebookAdAccountId,
                googleAdsCustomerId,
                CustomerStaticExpenses,
            } = form;
            const res = await fetch(`/api/customers/${customerId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerName,
                        parentCustomer,
                        customerType,
                        isArchived,
                        CustomerSettings: {
                            metricPreference,
                            customerStoreValutaCode,
                            customerClickupID,
                            customerMetaID,
                            customerMetaIDExclude,
                            changeCurrency,
                            customerRevenueType,
                            shopifyUrl,
                            shopifyApiPassword,
                            facebookAdAccountId,
                            googleAdsCustomerId,
                        },
                        CustomerStaticExpenses,
                    })
                });
            if (!res.ok) throw new Error('Failed to update customer');
            showToast({ message: 'Settings updated successfully!', type: 'success', position: 'top-center' });
        } catch (err) {
            showToast({ message: err.message || 'Failed to update customer', type: 'error', position: 'top-center' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="w-full flex justify-center items-center min-h-[300px] text-gray-400">Loading...</div>;
    }

    const tabs = [
        {
            key: 'general',
            label: 'General Settings',
            content: <GeneralSettingsForm form={form} onChange={handleChange} saving={saving} />,
        },
        {
            key: 'customer',
            label: 'Customer Settings',
            content: <CustomerSettingsForm form={form} onChange={handleChange} saving={saving} />,
        },
        {
            key: 'expenses',
            label: 'Static Expenses',
            content: <StaticExpensesForm form={form} onChange={handleChange} saving={saving} />,
        },
    ];

    return (
        <div id='ConfigPage' className="w-full">
            <ToastProvider />
            <DashboardHeading title="Property Configuration" label={form.customerName || ""} />
            <div className="mt-8">
                <div className="bg-white border border-gray-200 rounded-xl p-0">
                    <VerticalTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        className="bg-[var(--color-primary-searchmind)] text-white px-6 py-2 rounded-lg font-semibold shadow-sm hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save All'}
                    </button>
                </div>
            </div>
        </div>
    );
}