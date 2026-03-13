import React, { useState } from "react";
import { useRouter } from "next/navigation";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";

const initialState = {
    customerName: "",
    customerType: "Shopify",
    isArchived: false,
    CustomerSettings: {
        metricPreference: "ROAS/POAS",
        customerStoreValutaCode: "DKK",
        customerClickupID: "",
        customerMetaID: "DK",
        customerMetaIDExclude: "",
        changeCurrency: true,
        changeCurrencyShopifyBillingCountryName: "",
        customerRevenueType: "total_sales",
        shopifyUrl: "",
        shopifyApiPassword: "",
        wooCommerceApiKey: "",
        wooCommerceApiSecret: "",
        wooCommerceApiUrl: "",
        magentoBaseUrl: "",
        magentoAccessToken: "",
        magentoConsumerKey: "",
        magentoConsumerSecret: "",
        magentoAccessTokenSecret: "",
        facebookAdAccountId: "",
        googleAdsCustomerId: "",
        googleSearchConsoleProperty: ""
    }
};

export default function CustomerCreateForm({ onSuccess }) {
    const [form, setForm] = useState(initialState);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // If the field is in CustomerSettings, update nested
        if (name in initialState.CustomerSettings) {
            setForm((prev) => ({
                ...prev,
                CustomerSettings: {
                    ...prev.CustomerSettings,
                    [name]: type === "checkbox" ? checked : value,
                },
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                [name]: type === "checkbox" ? checked : value,
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Only validate that customerName is required
        if (!form.customerName.trim()) {
            setError("Customer Name is required");
            return;
        }

        setSaving(true);
        try {
            // Only send required and filled fields, match schema
            const payload = {
                customerName: form.customerName.trim(),
                customerType: form.customerType,
                isArchived: form.isArchived,
                CustomerSettings: { ...form.CustomerSettings }
            };

            // Remove empty strings from CustomerSettings to avoid sending empty values
            Object.keys(payload.CustomerSettings).forEach(key => {
                if (payload.CustomerSettings[key] === "") {
                    delete payload.CustomerSettings[key];
                }
            });

            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to create customer");
            const data = await res.json();
            setForm(initialState);
            if (onSuccess) onSuccess();
            // Redirect to dashboard if customerId is available
            const customerId = data?._id || data?.customer?._id || data?.id;
            if (customerId) {
                router.push(`${baseUrl}/dashboard/${customerId}/performance-dashboard`);
            }
        } catch (err) {
            setError(err.message || "Failed to create customer");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Create New Customer</h5>
            <div>
                <FormLabel htmlFor="customerName" required>Customer Name</FormLabel>
                <FormInputText id="customerName" name="customerName" value={form.customerName} onChange={handleChange} required />
            </div>
            <div>
                <FormLabel htmlFor="customerType">Customer Type</FormLabel>
                <select id="customerType" name="customerType" value={form.customerType} onChange={handleChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                    <option value="Shopify">Shopify</option>
                    <option value="WooCommerce">WooCommerce</option>
                    <option value="Magento">Magento</option>
                    <option value="Other">Other</option>
                </select>
            </div>

            {/* Conditional fields based on customer type */}
            {form.customerType === "Shopify" && (
                <>
                    <div>
                        <FormLabel htmlFor="shopifyUrl">Shopify URL</FormLabel>
                        <FormInputText id="shopifyUrl" name="shopifyUrl" value={form.CustomerSettings.shopifyUrl} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="shopifyApiPassword">Shopify API Password</FormLabel>
                        <FormInputText id="shopifyApiPassword" name="shopifyApiPassword" value={form.CustomerSettings.shopifyApiPassword} onChange={handleChange} />
                    </div>
                </>
            )}

            {form.customerType === "WooCommerce" && (
                <>
                    <div>
                        <FormLabel htmlFor="wooCommerceApiKey">WooCommerce API Key</FormLabel>
                        <FormInputText id="wooCommerceApiKey" name="wooCommerceApiKey" value={form.CustomerSettings.wooCommerceApiKey} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="wooCommerceApiSecret">WooCommerce API Secret</FormLabel>
                        <FormInputText id="wooCommerceApiSecret" name="wooCommerceApiSecret" value={form.CustomerSettings.wooCommerceApiSecret} onChange={handleChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="wooCommerceApiUrl">WooCommerce API URL</FormLabel>
                        <FormInputText id="wooCommerceApiUrl" name="wooCommerceApiUrl" value={form.CustomerSettings.wooCommerceApiUrl} onChange={handleChange} placeholder="https://yourdomain.com/wp-json/wc/v3/" />
                    </div>
                </>
            )}

            {form.customerType === "Magento" && (
                <>
                    <div>
                        <FormLabel htmlFor="magentoBaseUrl">Magento Base URL</FormLabel>
                        <FormInputText id="magentoBaseUrl" name="magentoBaseUrl" value={form.CustomerSettings.magentoBaseUrl} onChange={handleChange} placeholder="https://yourdomain.com" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoConsumerKey">Consumer Key</FormLabel>
                        <FormInputText id="magentoConsumerKey" name="magentoConsumerKey" value={form.CustomerSettings.magentoConsumerKey} onChange={handleChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoConsumerSecret">Consumer Secret</FormLabel>
                        <FormInputText id="magentoConsumerSecret" name="magentoConsumerSecret" value={form.CustomerSettings.magentoConsumerSecret} onChange={handleChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoAccessToken">Access Token</FormLabel>
                        <FormInputText id="magentoAccessToken" name="magentoAccessToken" value={form.CustomerSettings.magentoAccessToken} onChange={handleChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoAccessTokenSecret">Access Token Secret</FormLabel>
                        <FormInputText id="magentoAccessTokenSecret" name="magentoAccessTokenSecret" value={form.CustomerSettings.magentoAccessTokenSecret} onChange={handleChange} type="password" placeholder="From System > Integrations" />
                    </div>
                </>
            )}
            <div>
                <FormLabel htmlFor="customerStoreValutaCode">Store Valuta Code</FormLabel>
                <FormInputText id="customerStoreValutaCode" name="customerStoreValutaCode" value={form.CustomerSettings.customerStoreValutaCode} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="customerMetaID">Meta ID</FormLabel>
                <FormInputText id="customerMetaID" name="customerMetaID" value={form.CustomerSettings.customerMetaID} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="facebookAdAccountId">Facebook Ad Account ID</FormLabel>
                <FormInputText id="facebookAdAccountId" name="facebookAdAccountId" value={form.CustomerSettings.facebookAdAccountId} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="googleAdsCustomerId">Google Ads Customer ID</FormLabel>
                <FormInputText id="googleAdsCustomerId" name="googleAdsCustomerId" value={form.CustomerSettings.googleAdsCustomerId} onChange={handleChange} />
            </div>
            {/* Optional fields */}
            <div>
                <FormLabel htmlFor="customerClickupID">ClickUp ID</FormLabel>
                <FormInputText id="customerClickupID" name="customerClickupID" value={form.CustomerSettings.customerClickupID} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="customerMetaIDExclude">Meta ID Exclude</FormLabel>
                <FormInputText id="customerMetaIDExclude" name="customerMetaIDExclude" value={form.CustomerSettings.customerMetaIDExclude} onChange={handleChange} />
            </div>
            <div className="flex items-center gap-2">
                <input id="changeCurrency" name="changeCurrency" type="checkbox" checked={form.CustomerSettings.changeCurrency} onChange={handleChange} className="rounded border-gray-300" />
                <FormLabel htmlFor="changeCurrency">Change Currency</FormLabel>
            </div>
            <div>
                <FormLabel htmlFor="changeCurrencyShopifyBillingCountryName">Change Currency Shopify Billing Country Name</FormLabel>
                <FormInputText id="changeCurrencyShopifyBillingCountryName" name="changeCurrencyShopifyBillingCountryName" value={form.CustomerSettings.changeCurrencyShopifyBillingCountryName} onChange={handleChange} />
            </div>
            <div className="flex items-center gap-2">
                <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={handleChange} className="rounded border-gray-300" />
                <FormLabel htmlFor="isArchived">Archived</FormLabel>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="flex justify-end mt-4">
                <FormButton type="submit" disabled={saving}>
                    {saving ? "Creating..." : "Create Customer"}
                </FormButton>
            </div>
        </form>
    );
}
