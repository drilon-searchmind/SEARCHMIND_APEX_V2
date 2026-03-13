
import React, { useEffect, useState } from "react";
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';
import ParentCustomerSelect from './ParentCustomerSelect';
import FormCreateParentCustomer from './FormCreateParentCustomer';


export default function GeneralSettingsForm({ form, onChange, saving }) {

    const [parentCustomers, setParentCustomers] = useState([]);
    const [loadingParents, setLoadingParents] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
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
    }, []);


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
                <div>
                    <ParentCustomerSelect
                        parentCustomers={parentCustomers}
                        value={form.parentCustomer}
                        onChange={onChange}
                        onCreateClick={handleCreateParentCustomer}
                        disabled={loadingParents || saving}
                    />
                </div>
                <div>
                    <FormLabel htmlFor="customerType" required>Customer Type</FormLabel>
                    <select id="customerType" name="customerType" value={form.customerType} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                        <option value="Shopify">Shopify</option>
                        <option value="WooCommerce">WooCommerce</option>
                        <option value="Magento">Magento</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={onChange} className="rounded border-gray-300" />
                    <FormLabel htmlFor="isArchived">Archived</FormLabel>
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
