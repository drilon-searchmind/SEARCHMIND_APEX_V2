import React from "react";
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';

export default function CustomerSettingsForm({ form, onChange, saving }) {
    return (
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); }}>
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Customer Settings</h5>
            <div>
                <FormLabel htmlFor="metricPreference" required>Metric Preference</FormLabel>
                <select id="metricPreference" name="metricPreference" value={form.metricPreference} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                    <option value="ROAS/POAS">ROAS/POAS</option>
                    <option value="Spendshare">Spendshare</option>
                </select>
            </div>
            <div>
                <FormLabel htmlFor="customerStoreValutaCode">Store Valuta Code</FormLabel>
                <FormInputText id="customerStoreValutaCode" name="customerStoreValutaCode" value={form.customerStoreValutaCode} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="customerClickupID">ClickUp ID</FormLabel>
                <FormInputText id="customerClickupID" name="customerClickupID" value={form.customerClickupID} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="customerMetaID">Meta ID</FormLabel>
                <FormInputText id="customerMetaID" name="customerMetaID" value={form.customerMetaID} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="customerMetaIDExclude">Meta ID Exclude</FormLabel>
                <FormInputText id="customerMetaIDExclude" name="customerMetaIDExclude" value={form.customerMetaIDExclude} onChange={onChange} />
            </div>
            <div className="flex items-center gap-2">
                <input id="changeCurrency" name="changeCurrency" type="checkbox" checked={form.changeCurrency} onChange={onChange} className="rounded border-gray-300" />
                <FormLabel htmlFor="changeCurrency">Change Currency</FormLabel>
            </div>
            <div>
                <FormLabel htmlFor="customerRevenueType">Revenue Type</FormLabel>
                <select id="customerRevenueType" name="customerRevenueType" value={form.customerRevenueType} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                    <option value="total_sales">Total Sales</option>
                    <option value="net_sales">Net Sales</option>
                </select>
            </div>
            <div>
                <FormLabel htmlFor="shopifyUrl">Shopify URL</FormLabel>
                <FormInputText id="shopifyUrl" name="shopifyUrl" value={form.shopifyUrl} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="shopifyApiPassword">Shopify API Password</FormLabel>
                <FormInputText id="shopifyApiPassword" name="shopifyApiPassword" value={form.shopifyApiPassword} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="facebookAdAccountId">Facebook Ad Account ID</FormLabel>
                <FormInputText id="facebookAdAccountId" name="facebookAdAccountId" value={form.facebookAdAccountId} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="googleAdsCustomerId">Google Ads Customer ID</FormLabel>
                <FormInputText id="googleAdsCustomerId" name="googleAdsCustomerId" value={form.googleAdsCustomerId} onChange={onChange} />
            </div>
        </form>
    );
}
