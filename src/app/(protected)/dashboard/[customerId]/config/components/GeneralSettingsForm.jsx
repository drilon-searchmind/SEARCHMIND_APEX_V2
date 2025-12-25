import React from "react";
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';

export default function GeneralSettingsForm({ form, onChange, saving }) {
    return (
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); }}>
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">General Settings</h5>
            <div>
                <FormLabel htmlFor="customerName" required>Customer Name</FormLabel>
                <FormInputText id="customerName" name="customerName" value={form.customerName} onChange={onChange} required />
            </div>
            <div>
                <FormLabel htmlFor="customerType" required>Customer Type</FormLabel>
                <select id="customerType" name="customerType" value={form.customerType} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                    <option value="Shopify">Shopify</option>
                    <option value="WooCommerce">WooCommerce</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div className="flex items-center gap-2">
                <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={onChange} className="rounded border-gray-300" />
                <FormLabel htmlFor="isArchived">Archived</FormLabel>
            </div>
        </form>
    );
}
