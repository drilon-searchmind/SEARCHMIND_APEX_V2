"use client";

import DashboardHeading from '@/components/dashboard/DashboardHeading'
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';
import ToastProvider, { showToast } from '@/components/ui/ToastProvider';
import { useParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'



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
};

const ConfigPage = () => {
    const params = useParams();
    const customerId = params.customerId;
    const [form, setForm] = useState(defaultFormState);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch customer data on mount
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
                });
            } catch (err) {
                showToast({ message: 'Failed to load customer', type: 'error', position: 'top-center' });
            } finally {
                setLoading(false);
            }
        }
        fetchCustomer();
    }, [customerId]);

    // Handlers
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Save handler (PUT)
    const handleSave = async (e) => {
        e.preventDefault();
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
            } = form;
            const res = await fetch(`/api/customers/${customerId}`, {
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
                    }
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
    return (
        <div id='ConfigPage' className="w-full">
            <ToastProvider />
            <DashboardHeading title="Property Configuration" label={form.customerName || ""} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                {/* General Settings Card */}
                <form className="bg-white rounded-xl border border-gray-200 py-6 px-8 flex flex-col gap-4 min-h-[320px]" onSubmit={handleSave}>
                    <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">General Settings</h5>
                    <div>
                        <FormLabel htmlFor="customerName" required>Customer Name</FormLabel>
                        <FormInputText id="customerName" name="customerName" value={form.customerName} onChange={handleChange} required />
                    </div>
                    <div>
                        <FormLabel htmlFor="customerType" required>Customer Type</FormLabel>
                        <select id="customerType" name="customerType" value={form.customerType} onChange={handleChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                            <option value="Shopify">Shopify</option>
                            <option value="WooCommerce">WooCommerce</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={handleChange} className="rounded border-gray-300" />
                        <FormLabel htmlFor="isArchived">Archived</FormLabel>
                    </div>
                    <div>
                        <FormButton>{saving ? 'Saving...' : 'Save Settings'}</FormButton>
                    </div>
                </form>

                {/* Customer Settings Card */}
                <form className="bg-white rounded-xl border border-gray-200 py-6 px-8 flex flex-col gap-4 min-h-[320px]" onSubmit={handleSave}>
                    <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Customer Settings</h5>
                    <div>
                        <FormLabel htmlFor="metricPreference" required>Metric Preference</FormLabel>
                        <select id="metricPreference" name="metricPreference" value={form.metricPreference} onChange={handleChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                            <option value="ROAS/POAS">ROAS/POAS</option>
                            <option value="Spendshare">Spendshare</option>
                        </select>
                    </div>
                    <div>
                        <FormLabel htmlFor="customerStoreValutaCode">Store Valuta Code</FormLabel>
                        <FormInputText id="customerStoreValutaCode" name="customerStoreValutaCode" value={form.customerStoreValutaCode} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="customerClickupID">ClickUp ID</FormLabel>
                        <FormInputText id="customerClickupID" name="customerClickupID" value={form.customerClickupID} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="customerMetaID">Meta ID</FormLabel>
                        <FormInputText id="customerMetaID" name="customerMetaID" value={form.customerMetaID} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="customerMetaIDExclude">Meta ID Exclude</FormLabel>
                        <FormInputText id="customerMetaIDExclude" name="customerMetaIDExclude" value={form.customerMetaIDExclude} onChange={handleChange} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input id="changeCurrency" name="changeCurrency" type="checkbox" checked={form.changeCurrency} onChange={handleChange} className="rounded border-gray-300" />
                        <FormLabel htmlFor="changeCurrency">Change Currency</FormLabel>
                    </div>
                    <div>
                        <FormLabel htmlFor="customerRevenueType">Revenue Type</FormLabel>
                        <select id="customerRevenueType" name="customerRevenueType" value={form.customerRevenueType} onChange={handleChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                            <option value="total_sales">Total Sales</option>
                            <option value="net_sales">Net Sales</option>
                        </select>
                    </div>
                    <div>
                        <FormLabel htmlFor="shopifyUrl">Shopify URL</FormLabel>
                        <FormInputText id="shopifyUrl" name="shopifyUrl" value={form.shopifyUrl} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="shopifyApiPassword">Shopify API Password</FormLabel>
                        <FormInputText id="shopifyApiPassword" name="shopifyApiPassword" value={form.shopifyApiPassword} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="facebookAdAccountId">Facebook Ad Account ID</FormLabel>
                        <FormInputText id="facebookAdAccountId" name="facebookAdAccountId" value={form.facebookAdAccountId} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="googleAdsCustomerId">Google Ads Customer ID</FormLabel>
                        <FormInputText id="googleAdsCustomerId" name="googleAdsCustomerId" value={form.googleAdsCustomerId} onChange={handleChange} />
                    </div>
                    <div>
                        <FormButton>{saving ? 'Saving...' : 'Save Settings'}</FormButton>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ConfigPage