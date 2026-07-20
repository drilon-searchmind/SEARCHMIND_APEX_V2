import React, { useState } from "react";
import { useRouter } from "next/navigation";
import FormLabel from "@/components/form/FormLabel";
import FormInputText from "@/components/form/FormInputText";
import FormButton from "@/components/form/FormButton";
import { defaultSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { defaultRedditSettings } from "@/lib/redditCustomerSettings";
import { defaultDanDomainSettings } from "@/lib/danDomainCustomerSettings";
import { defaultDanDomainOriginalSettings } from "@/lib/danDomainOriginalCustomerSettings";
import {
    getDefaultCustomerCreateFormState,
    customerCreateFormCustomerSettingsKeys,
} from "@/lib/customerCreateFormState";

function cloneFormState(source) {
    return JSON.parse(JSON.stringify(source));
}

const APEX_HOME_INPUT =
    "apex-home__form-input mt-2 shadow-none h-11 w-full rounded-[14px] border appearance-none px-4 py-2.5 text-sm bg-white text-[var(--apex-ink)] border-[var(--apex-hairline-strong)] placeholder:text-[var(--apex-ink-muted)] focus:outline-none focus:border-[var(--apex-dark-green)] focus:ring-2 focus:ring-[oklch(45%_0.04_165/0.2)]";

const APEX_HOME_SELECT =
    "apex-home__form-select mt-2 h-11 w-full rounded-[14px] border px-4 py-2.5 text-sm text-[var(--apex-ink)] border-[var(--apex-hairline-strong)] bg-white focus:outline-none focus:border-[var(--apex-dark-green)] focus:ring-2 focus:ring-[oklch(45%_0.04_165/0.2)]";

const DEFAULT_INPUT =
    "mt-2 shadow-none h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-hidden focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20";

const DEFAULT_SELECT =
    "mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20";

export default function CustomerCreateForm({
    onSuccess,
    initialValues,
    heading = "Create New Customer",
    submitLabel = "Create Customer",
    submittingLabel = "Creating...",
    variant,
    hideHeading = false,
}) {
    const isApexHome = variant === "apex-home";
    const labelClass = isApexHome ? "apex-home__form-label" : undefined;
    const inputClass = isApexHome ? APEX_HOME_INPUT : DEFAULT_INPUT;
    const selectClass = isApexHome ? APEX_HOME_SELECT : DEFAULT_SELECT;
    const checkClass = isApexHome
        ? "apex-home__form-check rounded border-[var(--apex-hairline-strong)]"
        : "rounded border-gray-300";
    const formClass = isApexHome ? "apex-home__create-form flex flex-col gap-4" : "flex flex-col gap-4";
    const errorClass = isApexHome ? "apex-home__form-error" : "text-red-500 text-sm";
    const [form, setForm] = useState(() =>
        cloneFormState(initialValues ?? getDefaultCustomerCreateFormState())
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (typeof name === "string" && name.startsWith("danDomain.")) {
            const field = name.slice("danDomain.".length);
            setForm((prev) => ({
                ...prev,
                CustomerSettings: {
                    ...prev.CustomerSettings,
                    danDomain: {
                        ...defaultDanDomainSettings(),
                        ...prev.CustomerSettings.danDomain,
                        [field]: type === "checkbox" ? checked : value,
                    },
                },
            }));
            return;
        }
        if (typeof name === "string" && name.startsWith("danDomainOriginal.")) {
            const field = name.slice("danDomainOriginal.".length);
            setForm((prev) => ({
                ...prev,
                CustomerSettings: {
                    ...prev.CustomerSettings,
                    danDomainOriginal: {
                        ...defaultDanDomainOriginalSettings(),
                        ...prev.CustomerSettings.danDomainOriginal,
                        [field]: type === "checkbox" ? checked : value,
                    },
                },
            }));
            return;
        }
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
                businessCategory: form.businessCategory || "ecommerce",
                customerType: form.businessCategory === "b2b" ? "Other" : form.customerType,
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
        <form className={formClass} onSubmit={handleSubmit}>
            {!hideHeading && heading && (
                <h5 className={isApexHome ? "apex-home__form-heading" : "text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2"}>
                    {heading}
                </h5>
            )}
            <div>
                <FormLabel className={labelClass} htmlFor="customerName" required>Customer Name</FormLabel>
                <FormInputText id="customerName" name="customerName" value={form.customerName} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="businessCategory">Business Category</FormLabel>
                <select id="businessCategory" name="businessCategory" value={form.businessCategory || "ecommerce"} onChange={handleChange} className={selectClass}>
                    <option value="ecommerce">Ecommerce (Shopify / WooCommerce / Magento)</option>
                    <option value="b2b">B2B (GA4 analytics)</option>
                </select>
            </div>
            {form.businessCategory !== "b2b" && (
            <div>
                <FormLabel className={labelClass} htmlFor="customerType">Customer Type</FormLabel>
                <select id="customerType" name="customerType" value={form.customerType} onChange={handleChange} className={selectClass}>
                    <option value="Shopify">Shopify</option>
                    <option value="WooCommerce">WooCommerce</option>
                    <option value="Magento">Magento</option>
                    <option value="DanDomain">DanDomain (HostedShop)</option>
                    <option value="DanDomainOriginal">DanDomain Original (WEBAPI)</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            )}

            {form.businessCategory === "b2b" && (
                <div>
                <FormLabel className={labelClass} htmlFor="ga4PropertyId">GA4 Property ID</FormLabel>
                <FormInputText id="ga4PropertyId" name="ga4PropertyId" value={form.CustomerSettings.ga4PropertyId || ""} onChange={handleChange} placeholder="e.g. 123456789" className={inputClass} />
                </div>
            )}

            {/* Conditional fields based on customer type */}
            {form.businessCategory !== "b2b" && form.customerType === "Shopify" && (
                <>
                    <div>
                        <FormLabel className={labelClass} htmlFor="shopifyUrl">Shopify URL</FormLabel>
                        <FormInputText id="shopifyUrl" name="shopifyUrl" value={form.CustomerSettings.shopifyUrl} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="shopifyApiPassword">Shopify API Password</FormLabel>
                        <FormInputText id="shopifyApiPassword" name="shopifyApiPassword" value={form.CustomerSettings.shopifyApiPassword} onChange={handleChange} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="shopifyMarketsEnabled"
                            name="shopifyMarketsEnabled"
                            type="checkbox"
                            checked={form.CustomerSettings.shopifyMarketsEnabled === true}
                            onChange={handleChange}
                            className={inputClass}
                            className={checkClass}
                        />
                        <FormLabel className={labelClass} htmlFor="shopifyMarketsEnabled">Enable Shopify Markets (revenue by market; needs read_markets scope)</FormLabel>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="shopifyOnlineStoreOnly"
                            name="shopifyOnlineStoreOnly"
                            type="checkbox"
                            checked={form.CustomerSettings.shopifyOnlineStoreOnly === true}
                            onChange={handleChange}
                            className={inputClass}
                            className={checkClass}
                        />
                        <FormLabel className={labelClass} htmlFor="shopifyOnlineStoreOnly">Online Store only (exclude POS and other channels)</FormLabel>
                    </div>
                </>
            )}

            {form.businessCategory !== "b2b" && form.customerType === "WooCommerce" && (
                <>
                    <div>
                        <FormLabel className={labelClass} htmlFor="wooCommerceApiKey">WooCommerce API Key</FormLabel>
                        <FormInputText id="wooCommerceApiKey" name="wooCommerceApiKey" value={form.CustomerSettings.wooCommerceApiKey} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="wooCommerceApiSecret">WooCommerce API Secret</FormLabel>
                        <FormInputText id="wooCommerceApiSecret" name="wooCommerceApiSecret" value={form.CustomerSettings.wooCommerceApiSecret} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="wooCommerceApiUrl">WooCommerce API URL</FormLabel>
                        <FormInputText id="wooCommerceApiUrl" name="wooCommerceApiUrl" value={form.CustomerSettings.wooCommerceApiUrl} onChange={handleChange} placeholder="https://yourdomain.com/wp-json/wc/v3/" className={inputClass} />
                    </div>
                </>
            )}

            {form.businessCategory !== "b2b" && form.customerType === "Magento" && (
                <>
                    <div>
                        <FormLabel className={labelClass} htmlFor="magentoBaseUrl">Magento Base URL</FormLabel>
                        <FormInputText id="magentoBaseUrl" name="magentoBaseUrl" value={form.CustomerSettings.magentoBaseUrl} onChange={handleChange} placeholder="https://yourdomain.com" className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="magentoConsumerKey">Consumer Key</FormLabel>
                        <FormInputText id="magentoConsumerKey" name="magentoConsumerKey" value={form.CustomerSettings.magentoConsumerKey} onChange={handleChange} type="password" className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="magentoConsumerSecret">Consumer Secret</FormLabel>
                        <FormInputText id="magentoConsumerSecret" name="magentoConsumerSecret" value={form.CustomerSettings.magentoConsumerSecret} onChange={handleChange} type="password" className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="magentoAccessToken">Access Token</FormLabel>
                        <FormInputText id="magentoAccessToken" name="magentoAccessToken" value={form.CustomerSettings.magentoAccessToken} onChange={handleChange} type="password" className={inputClass} />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="magentoAccessTokenSecret">Access Token Secret</FormLabel>
                        <FormInputText id="magentoAccessTokenSecret" name="magentoAccessTokenSecret" value={form.CustomerSettings.magentoAccessTokenSecret} onChange={handleChange} type="password" className={inputClass} />
                    </div>
                </>
            )}

            {form.businessCategory !== "b2b" && form.customerType === "DanDomain" && (
                <>
                    <div>
                        <FormLabel className={labelClass} htmlFor="danDomain.shopHost">Shop host</FormLabel>
                        <FormInputText
                            id="danDomain.shopHost"
                            name="danDomain.shopHost"
                            value={(form.CustomerSettings.danDomain && form.CustomerSettings.danDomain.shopHost) || ""}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="e.g. shop99999.mywebshop.io (not webshop.dandomain.dk admin URL)"
                        />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="danDomain.clientId">Client ID</FormLabel>
                        <FormInputText
                            id="danDomain.clientId"
                            name="danDomain.clientId"
                            value={(form.CustomerSettings.danDomain && form.CustomerSettings.danDomain.clientId) || ""}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="HostedShop API client_id"
                        />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="danDomain.clientSecret">Client Secret</FormLabel>
                        <FormInputText
                            id="danDomain.clientSecret"
                            name="danDomain.clientSecret"
                            type="password"
                            value={(form.CustomerSettings.danDomain && form.CustomerSettings.danDomain.clientSecret) || ""}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="HostedShop API client_secret"
                        />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="danDomain.accessToken">Access Token</FormLabel>
                        <FormInputText
                            id="danDomain.accessToken"
                            name="danDomain.accessToken"
                            type="password"
                            value={(form.CustomerSettings.danDomain && form.CustomerSettings.danDomain.accessToken) || ""}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="HostedShop API access_token"
                        />
                    </div>
                </>
            )}

            {form.businessCategory !== "b2b" && form.customerType === "DanDomainOriginal" && (
                <>
                    <div>
                        <FormLabel className={labelClass} htmlFor="danDomainOriginal.shopAdminUrl">Shop admin URL</FormLabel>
                        <FormInputText
                            id="danDomainOriginal.shopAdminUrl"
                            name="danDomainOriginal.shopAdminUrl"
                            value={(form.CustomerSettings.danDomainOriginal && form.CustomerSettings.danDomainOriginal.shopAdminUrl) || ""}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="e.g. https://ajengros.dk"
                        />
                    </div>
                    <div>
                        <FormLabel className={labelClass} htmlFor="danDomainOriginal.apiKey">WEBAPI key</FormLabel>
                        <FormInputText
                            id="danDomainOriginal.apiKey"
                            name="danDomainOriginal.apiKey"
                            type="password"
                            value={(form.CustomerSettings.danDomainOriginal && form.CustomerSettings.danDomainOriginal.apiKey) || ""}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="OrderService API key from DanDomain admin"
                        />
                    </div>
                </>
            )}
            <div>
                <FormLabel className={labelClass} htmlFor="customerStoreValutaCode">Store Valuta Code</FormLabel>
                <FormInputText id="customerStoreValutaCode" name="customerStoreValutaCode" value={form.CustomerSettings.customerStoreValutaCode} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="customerMetaID">Meta ID</FormLabel>
                <FormInputText id="customerMetaID" name="customerMetaID" value={form.CustomerSettings.customerMetaID} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="facebookAdAccountId">Facebook Ad Account ID</FormLabel>
                <FormInputText id="facebookAdAccountId" name="facebookAdAccountId" value={form.CustomerSettings.facebookAdAccountId} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="googleAdsCustomerId">Google Ads Customer ID</FormLabel>
                <FormInputText
                    id="googleAdsCustomerId"
                    name="googleAdsCustomerId"
                    value={form.CustomerSettings.googleAdsCustomerId}
                    onChange={handleChange}
                    placeholder="e.g. 7969227273 or comma-separated IDs"
                    className={inputClass}
                />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="pinterestAdAccountId">Pinterest ad account ID</FormLabel>
                <FormInputText id="pinterestAdAccountId" name="pinterestAdAccountId" value={form.CustomerSettings.pinterestAdAccountId} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.organizationId">Snapchat organization ID</FormLabel>
                <FormInputText
                    id="snapchat.organizationId"
                    name="snapchat.organizationId"
                    value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.organizationId) || ""}
                    onChange={handleChange}
                    placeholder="Business organization UUID (not ad account)"
                    className={inputClass}
                />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.adAccountId">Snapchat ad account UUID</FormLabel>
                <FormInputText
                    id="snapchat.adAccountId"
                    name="snapchat.adAccountId"
                    value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.adAccountId) || ""}
                    onChange={handleChange}
                    placeholder="Ads Manager ad account UUID (for dashboards)"
                    className={inputClass}
                />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.clientId">Snapchat OAuth client ID</FormLabel>
                <FormInputText id="snapchat.clientId" name="snapchat.clientId" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.clientId) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.accessToken">Snapchat Marketing API access token</FormLabel>
                <FormInputText id="snapchat.accessToken" name="snapchat.accessToken" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.accessToken) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.clientSecret">Snapchat OAuth client secret (optional)</FormLabel>
                <FormInputText id="snapchat.clientSecret" name="snapchat.clientSecret" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.clientSecret) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.refreshToken">Snapchat OAuth refresh token (optional)</FormLabel>
                <FormInputText id="snapchat.refreshToken" name="snapchat.refreshToken" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.refreshToken) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="snapchat.conversionsApiToken">Snapchat Conversions API token</FormLabel>
                <FormInputText id="snapchat.conversionsApiToken" name="snapchat.conversionsApiToken" type="password" value={(form.CustomerSettings.snapchat && form.CustomerSettings.snapchat.conversionsApiToken) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="reddit.appId">Reddit app ID</FormLabel>
                <FormInputText id="reddit.appId" name="reddit.appId" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.appId) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="reddit.appSecret">Reddit app secret</FormLabel>
                <FormInputText id="reddit.appSecret" name="reddit.appSecret" type="password" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.appSecret) || ""} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="reddit.accountId">Reddit Ads account ID</FormLabel>
                <FormInputText id="reddit.accountId" name="reddit.accountId" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.accountId) || ""} onChange={handleChange} placeholder="t2_…" className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="reddit.accessToken">Reddit Ads access token (optional)</FormLabel>
                <FormInputText id="reddit.accessToken" name="reddit.accessToken" type="password" value={(form.CustomerSettings.reddit && form.CustomerSettings.reddit.accessToken) || ""} onChange={handleChange} className={inputClass} />
            </div>
            {/* Optional fields */}
            <div>
                <FormLabel className={labelClass} htmlFor="customerClickupID">ClickUp ID</FormLabel>
                <FormInputText id="customerClickupID" name="customerClickupID" value={form.CustomerSettings.customerClickupID} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="customerMetaIDExclude">Meta ID Exclude</FormLabel>
                <FormInputText id="customerMetaIDExclude" name="customerMetaIDExclude" value={form.CustomerSettings.customerMetaIDExclude} onChange={handleChange} className={inputClass} />
            </div>
            <div className="flex items-center gap-2">
                <input id="changeCurrency" name="changeCurrency" type="checkbox" checked={form.CustomerSettings.changeCurrency} onChange={handleChange} className={checkClass} />
                <FormLabel className={labelClass} htmlFor="changeCurrency">Change Currency</FormLabel>
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="changeCurrencyShopifyBillingCountryName">Shopify billing country include (optional)</FormLabel>
                <FormInputText id="changeCurrencyShopifyBillingCountryName" name="changeCurrencyShopifyBillingCountryName" value={form.CustomerSettings.changeCurrencyShopifyBillingCountryName} onChange={handleChange} placeholder="e.g. Sweden,Denmark,Norway" />
            </div>
            <div>
                <FormLabel className={labelClass} htmlFor="changeCurrencyShopifyBillingCountryExclude">Shopify billing country exclude (optional)</FormLabel>
                <FormInputText id="changeCurrencyShopifyBillingCountryExclude" name="changeCurrencyShopifyBillingCountryExclude" value={form.CustomerSettings.changeCurrencyShopifyBillingCountryExclude} onChange={handleChange} placeholder="e.g. France,Spain" />
            </div>
            <div className="flex items-center gap-2">
                <input id="isArchived" name="isArchived" type="checkbox" checked={form.isArchived} onChange={handleChange} className={checkClass} />
                <FormLabel className={labelClass} htmlFor="isArchived">Archived</FormLabel>
            </div>
            {error && <div className={errorClass}>{error}</div>}
            <div className={isApexHome ? "apex-home__form-actions" : "flex justify-end mt-4"}>
                <FormButton type="submit" disabled={saving} className={isApexHome ? "apex-home__form-submit" : ""}>
                    {saving ? submittingLabel : submitLabel}
                </FormButton>
            </div>
        </form>
    );
}
