import React, { useEffect, useState } from "react";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';
import ParentCustomerSelect from './ParentCustomerSelect';
import FormCreateParentCustomer from './FormCreateParentCustomer';


export default function GeneralSettingsForm({ form, onChange, saving, isExternalUser = false }) {

    const [parentCustomers, setParentCustomers] = useState([]);
    const [loadingParents, setLoadingParents] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (isExternalUser) return;
        async function fetchParentCustomers() {
            setLoadingParents(true);
            try {
                const res = await fetch('/api/parent-customers');
                if (!res.ok) throw new Error('Failed to fetch parent customers');
                const data = await res.json();
                setParentCustomers(data);
            } catch (err) {
                setParentCustomers([]);
            } finally {
                setLoadingParents(false);
            }
        }
        fetchParentCustomers();
    }, [isExternalUser]);


    const handleCreateParentCustomer = () => {
        setShowCreateModal(true);
    };

    const handleModalCancel = () => {
        setShowCreateModal(false);
    };

    const handleModalCreate = async ({ name }) => {
        setCreating(true);
        try {
            const res = await fetch('/api/parent-customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error('Failed to create parent customer');
            const newParent = await res.json();
            setParentCustomers((prev) => [...prev, newParent]);
            setShowCreateModal(false);
            pushGTMEvent(GTM_EVENTS.DASHBOARD_PARENT_CUSTOMER_CREATED, {
                eventData: {
                    parentCustomerId: newParent?._id != null ? String(newParent._id) : undefined,
                    parentCustomerName: typeof name === "string" ? name.trim() : "",
                },
            });
        } catch (err) {
            // Optionally show error
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); }}>
                <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">General Settings</h5>
                <div>
                    <FormLabel htmlFor="customerName" required>Customer Name</FormLabel>
                    <FormInputText id="customerName" name="customerName" value={form.customerName} onChange={onChange} required />
                </div>
                {!isExternalUser && (
                    <div>
                        <ParentCustomerSelect
                            parentCustomers={parentCustomers}
                            value={form.parentCustomer}
                            onChange={onChange}
                            onCreateClick={handleCreateParentCustomer}
                            disabled={loadingParents || saving}
                        />
                    </div>
                )}
                {!isExternalUser && (
                    <div>
                        <FormLabel htmlFor="businessCategory" required>Business Category</FormLabel>
                        <select id="businessCategory" name="businessCategory" value={form.businessCategory || "ecommerce"} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                            <option value="ecommerce">Ecommerce (store revenue)</option>
                            <option value="b2b">B2B (GA4 analytics)</option>
                        </select>
                    </div>
                )}
                {!isExternalUser && form.businessCategory !== "b2b" && (
                    <div>
                        <FormLabel htmlFor="customerType" required>Customer Type</FormLabel>
                        <select id="customerType" name="customerType" value={form.customerType} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                            <option value="Shopify">Shopify</option>
                            <option value="WooCommerce">WooCommerce</option>
                            <option value="Magento">Magento</option>
                            <option value="DanDomain">DanDomain (HostedShop)</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                )}
                {!isExternalUser && (
                    <div className="flex items-center gap-2">
                        <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={onChange} className="rounded border-gray-300" />
                        <FormLabel htmlFor="isArchived">Archived</FormLabel>
                    </div>
                )}
                <div>
                    <FormLabel htmlFor="revenueDisplayVat">Revenue display (VAT)</FormLabel>
                    <select
                        id="revenueDisplayVat"
                        name="revenueDisplayVat"
                        value={
                            form.revenueDisplayVat === "incl" ||
                            form.revenueDisplayVat === "incl_shopify"
                                ? form.revenueDisplayVat
                                : "excl"
                        }
                        onChange={onChange}
                        className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                    >
                        <option value="excl">Excl. VAT (store default)</option>
                        <option value="incl_shopify">Incl. VAT (from Shopify)</option>
                        <option value="incl">Incl. VAT (Danish 25%)</option>
                    </select>
                </div>
            </form>
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
                        <FormCreateParentCustomer
                            onCreate={handleModalCreate}
                            onCancel={handleModalCancel}
                            loading={creating}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
