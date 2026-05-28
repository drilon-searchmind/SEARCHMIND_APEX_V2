import React, { useState } from "react";
import { useRouter } from "next/navigation";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";
import { defaultSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { defaultRedditSettings } from "@/lib/redditCustomerSettings";
import {
    getDefaultCustomerCreateFormState,
    customerCreateFormCustomerSettingsKeys,
} from "@/lib/customerCreateFormState";

function cloneFormState(source) {
    return JSON.parse(JSON.stringify(source));
}

export default function CustomerCreateForm({
    onSuccess,
    initialValues,
    heading = "Create New Customer",
    submitLabel = "Create Customer",
    submittingLabel = "Creating...",
}) {
    const [form, setForm] = useState(() =>
        cloneFormState(initialValues ?? getDefaultCustomerCreateFormState())
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (typeof name === "string" && name.startsWith("reddit.")) {
            const field = name.slice("reddit.".length);
            setForm((prev) => ({
                ...prev,
                CustomerSettings: {
                    ...prev.CustomerSettings,
                    reddit: {
                        ...defaultRedditSettings(),
                        ...prev.CustomerSettings.reddit,
                        [field]: type === "checkbox" ? checked : value,
                    },
                },
            }));
            return;
        }
        if (typeof name === "string" && name.startsWith("snapchat.")) {
            const field = name.slice("snapchat.".length);
            setForm((prev) => ({
                ...prev,
                CustomerSettings: {
                    ...prev.CustomerSettings,
                    snapchat: {
                        ...defaultSnapchatSettings(),
                        ...prev.CustomerSettings.snapchat,
                        [field]: type === "checkbox" ? checked : value,
                    },
                },
            }));
            return;
        }
        // If the field is in CustomerSettings, update nested
        if (customerCreateFormCustomerSettingsKeys().has(name)) {
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
            setForm(cloneFormState(getDefaultCustomerCreateFormState()));
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
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">{heading}</h5>
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
                    <div className="flex items-center gap-2">
                        <input
                            id="shopifyMarketsEnabled"
                            name="shopifyMarketsEnabled"
                            type="checkbox"
                            checked={form.CustomerSettings.shopifyMarketsEnabled === true}
                            onChange={handleChange}
                            className="rounded border-gray-300"
                        />
                        <FormLabel htmlFor="shopifyMarketsEnabled">Enable Shopify Markets (revenue by market; needs read_markets scope)</FormLabel>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="shopifyOnlineStoreOnly"
                            name="shopifyOnlineStoreOnly"
                            type="checkbox"
                            checked={form.CustomerSettings.shopifyOnlineStoreOnly === true}
                            onChange={handleChange}
                            className="rounded border-gray-300"
                        />
                        <FormLabel htmlFor="shopifyOnlineStoreOnly">Online Store only (exclude POS and other channels)</FormLabel>
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
            <div>
                <FormLabel htmlFor="pinterestAdAccountId">Pinterest ad account ID</FormLabel>
                <FormInputText id="pinterestAdAccountId" name="pinterestAdAccountId" value={form.CustomerSettings.pinterestAdAccountId} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.organizationId">Snapchat organization ID</FormLabel>
                <FormInputText
                    id="snapchat.organizationId"
                    name="snapchat.organizationId"
                    value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.organizationId) || ""}
                    onChange={handleChange}
                    placeholder="Business organization UUID (not ad account)"
                />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.adAccountId">Snapchat ad account UUID</FormLabel>
                <FormInputText
                    id="snapchat.adAccountId"
                    name="snapchat.adAccountId"
                    value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.adAccountId) || ""}
                    onChange={handleChange}
                    placeholder="Ads Manager ad account UUID (for dashboards)"
                />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.clientId">Snapchat OAuth client ID</FormLabel>
                <FormInputText id="snapchat.clientId" name="snapchat.clientId" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.clientId) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.accessToken">Snapchat Marketing API access token</FormLabel>
                <FormInputText id="snapchat.accessToken" name="snapchat.accessToken" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.accessToken) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.clientSecret">Snapchat OAuth client secret (optional)</FormLabel>
                <FormInputText id="snapchat.clientSecret" name="snapchat.clientSecret" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.clientSecret) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.refreshToken">Snapchat OAuth refresh token (optional)</FormLabel>
                <FormInputText id="snapchat.refreshToken" name="snapchat.refreshToken" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.refreshToken) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="snapchat.conversionsApiToken">Snapchat Conversions API token</FormLabel>
                <FormInputText id="snapchat.conversionsApiToken" name="snapchat.conversionsApiToken" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.conversionsApiToken) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="reddit.appId">Reddit app ID</FormLabel>
                <FormInputText id="reddit.appId" name="reddit.appId" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.appId) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="reddit.appSecret">Reddit app secret</FormLabel>
                <FormInputText id="reddit.appSecret" name="reddit.appSecret" type="password" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.appSecret) || ""} onChange={handleChange} />
            </div>
            <div>
                <FormLabel htmlFor="reddit.accountId">Reddit Ads account ID</FormLabel>
                <FormInputText id="reddit.accountId" name="reddit.accountId" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.accountId) || ""} onChange={handleChange} placeholder="t2_…" />
            </div>
            <div>
                <FormLabel htmlFor="reddit.accessToken">Reddit Ads access token (optional)</FormLabel>
                <FormInputText id="reddit.accessToken" name="reddit.accessToken" type="password" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.accessToken) || ""} onChange={handleChange} />
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
                <FormLabel htmlFor="changeCurrencyShopifyBillingCountryName">Shopify billing country include (optional)</FormLabel>
                <FormInputText id="changeCurrencyShopifyBillingCountryName" name="changeCurrencyShopifyBillingCountryName" value={form.CustomerSettings.changeCurrencyShopifyBillingCountryName} onChange={handleChange} placeholder="e.g. Sweden,Denmark,Norway" />
            </div>
            <div>
                <FormLabel htmlFor="changeCurrencyShopifyBillingCountryExclude">Shopify billing country exclude (optional)</FormLabel>
                <FormInputText id="changeCurrencyShopifyBillingCountryExclude" name="changeCurrencyShopifyBillingCountryExclude" value={form.CustomerSettings.changeCurrencyShopifyBillingCountryExclude} onChange={handleChange} placeholder="e.g. France,Spain" />
            </div>
            <div className="flex items-center gap-2">
                <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={handleChange} className="rounded border-gray-300" />
                <FormLabel htmlFor="isArchived">Archived</FormLabel>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="flex justify-end mt-4">
                <FormButton type="submit" disabled={saving}>
                    {saving ? submittingLabel : submitLabel}
                </FormButton>
            </div>
        </form>
    );
}
