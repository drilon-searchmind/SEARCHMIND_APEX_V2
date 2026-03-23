"use client";

import React from "react";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { FiSettings, FiShoppingBag, FiPackage, FiDatabase, FiFacebook, FiTrendingUp, FiSearch, FiMail } from "react-icons/fi";

function SettingsSection({ title, icon: Icon, children }) {
    return (
        <div className="mb-8 last:mb-0 bg-gray-50 p-8 rounded-xl border border-gray-200">
            <h6 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-[var(--color-primary-searchmind)]" />}
                {title}
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
        </div>
    );
}

function FormField({ id, name, label, value, onChange, type = "text", placeholder, required }) {
    return (
        <div>
            <FormLabel htmlFor={id} required={required}>
                {label}
            </FormLabel>
            <FormInputText
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                type={type}
                placeholder={placeholder}
            />
        </div>
    );
}

function FormSelect({ id, name, label, value, onChange, options }) {
    return (
        <div>
            <FormLabel htmlFor={id}>{label}</FormLabel>
            <select
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function FormCheckbox({ id, name, label, checked, onChange }) {
    return (
        <div className="flex items-center gap-2">
            <input
                id={id}
                name={name}
                type="checkbox"
                checked={checked || false}
                onChange={onChange}
                className="rounded border-gray-300"
            />
            <FormLabel htmlFor={id}>{label}</FormLabel>
        </div>
    );
}

export default function CustomerSettingsForm({ form, onChange, saving, customerType }) {
    return (
        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
            {/* General */}
            <SettingsSection title="General" icon={FiSettings}>
                <FormSelect
                    id="metricPreference"
                    name="metricPreference"
                    label="Metric Preference"
                    value={form.metricPreference}
                    onChange={onChange}
                    options={[
                        { value: "ROAS/POAS", label: "ROAS/POAS" },
                        { value: "Spendshare", label: "Spendshare" },
                    ]}
                />
                <FormSelect
                    id="customerRevenueType"
                    name="customerRevenueType"
                    label="Revenue Type"
                    value={form.customerRevenueType}
                    onChange={onChange}
                    options={[
                        { value: "total_sales", label: "Total Sales" },
                        { value: "net_sales", label: "Net Sales" },
                        { value: "custom_1", label: "Custom 1 (Netto + Refunds + Delivery Fees)" },
                    ]}
                />
                <FormField
                    id="customerStoreValutaCode"
                    name="customerStoreValutaCode"
                    label="Store Valuta Code"
                    value={form.customerStoreValutaCode}
                    onChange={onChange}
                />
                <FormField
                    id="customerClickupID"
                    name="customerClickupID"
                    label="ClickUp ID"
                    value={form.customerClickupID}
                    onChange={onChange}
                />
                <FormCheckbox
                    id="fetchCogsFromStore"
                    name="fetchCogsFromStore"
                    label="Fetch COGS From Store"
                    checked={form.fetchCogsFromStore}
                    onChange={onChange}
                />
                <FormCheckbox
                    id="changeCurrency"
                    name="changeCurrency"
                    label="Change Currency"
                    checked={form.changeCurrency}
                    onChange={onChange}
                />
            </SettingsSection>

            {/* Shopify */}
            {customerType === "Shopify" && (
                <SettingsSection title="Shopify" icon={FiShoppingBag}>
                    <FormField
                        id="shopifyUrl"
                        name="shopifyUrl"
                        label="Shopify URL"
                        value={form.shopifyUrl}
                        onChange={onChange}
                        placeholder="https://your-store.myshopify.com"
                    />
                    <FormField
                        id="shopifyApiPassword"
                        name="shopifyApiPassword"
                        label="Shopify API Password"
                        value={form.shopifyApiPassword}
                        onChange={onChange}
                        type="password"
                        placeholder="From Apps > Develop apps > API credentials"
                    />
                    <FormField
                        id="changeCurrencyShopifyBillingCountryName"
                        name="changeCurrencyShopifyBillingCountryName"
                        label="Billing country include (optional)"
                        value={form.changeCurrencyShopifyBillingCountryName}
                        onChange={onChange}
                        placeholder="e.g. Sweden,Denmark,Norway"
                    />
                    <FormField
                        id="changeCurrencyShopifyBillingCountryExclude"
                        name="changeCurrencyShopifyBillingCountryExclude"
                        label="Billing country exclude (optional)"
                        value={form.changeCurrencyShopifyBillingCountryExclude}
                        onChange={onChange}
                        placeholder="e.g. France,Spain to exclude"
                    />
                </SettingsSection>
            )}

            {/* WooCommerce */}
            {customerType === "WooCommerce" && (
                <SettingsSection title="WooCommerce" icon={FiPackage}>
                    <FormField
                        id="wooCommerceApiKey"
                        name="wooCommerceApiKey"
                        label="WooCommerce API Key"
                        value={form.wooCommerceApiKey}
                        onChange={onChange}
                    />
                    <FormField
                        id="wooCommerceApiSecret"
                        name="wooCommerceApiSecret"
                        label="WooCommerce API Secret"
                        value={form.wooCommerceApiSecret}
                        onChange={onChange}
                        type="password"
                    />
                    <FormField
                        id="wooCommerceApiUrl"
                        name="wooCommerceApiUrl"
                        label="WooCommerce API URL"
                        value={form.wooCommerceApiUrl}
                        onChange={onChange}
                        placeholder="https://yourdomain.com/wp-json/wc/v3/"
                    />
                </SettingsSection>
            )}

            {/* Magento */}
            {customerType === "Magento" && (
                <SettingsSection title="Magento" icon={FiDatabase}>
                    <FormField
                        id="magentoBaseUrl"
                        name="magentoBaseUrl"
                        label="Magento Base URL"
                        value={form.magentoBaseUrl}
                        onChange={onChange}
                        placeholder="https://yourdomain.com"
                    />
                    <FormField
                        id="magentoConsumerKey"
                        name="magentoConsumerKey"
                        label="Consumer Key"
                        value={form.magentoConsumerKey}
                        onChange={onChange}
                        type="password"
                        placeholder="From System > Integrations"
                    />
                    <FormField
                        id="magentoConsumerSecret"
                        name="magentoConsumerSecret"
                        label="Consumer Secret"
                        value={form.magentoConsumerSecret}
                        onChange={onChange}
                        type="password"
                        placeholder="From System > Integrations"
                    />
                    <FormField
                        id="magentoAccessToken"
                        name="magentoAccessToken"
                        label="Access Token"
                        value={form.magentoAccessToken}
                        onChange={onChange}
                        type="password"
                        placeholder="From System > Integrations"
                    />
                    <FormField
                        id="magentoAccessTokenSecret"
                        name="magentoAccessTokenSecret"
                        label="Access Token Secret"
                        value={form.magentoAccessTokenSecret}
                        onChange={onChange}
                        type="password"
                        placeholder="From System > Integrations"
                    />
                    <FormField
                        id="magentoStoreCode"
                        name="magentoStoreCode"
                        label="Currency filter (optional)"
                        value={form.magentoStoreCode}
                        onChange={onChange}
                        placeholder="e.g. DKK to include only DK store orders"
                    />
                </SettingsSection>
            )}

            {/* Meta */}
            <SettingsSection title="Meta" icon={FiFacebook}>
                <FormField
                    id="facebookAdAccountId"
                    name="facebookAdAccountId"
                    label="Facebook Ad Account ID"
                    value={form.facebookAdAccountId}
                    onChange={onChange}
                    placeholder="e.g. act_123456789"
                />
                <FormField
                    id="customerMetaID"
                    name="customerMetaID"
                    label="Meta ID include (optional)"
                    value={form.customerMetaID}
                    onChange={onChange}
                    placeholder="e.g. DK,SE,NO — empty = all countries"
                />
                <FormField
                    id="customerMetaIDExclude"
                    name="customerMetaIDExclude"
                    label="Meta ID exclude (optional)"
                    value={form.customerMetaIDExclude}
                    onChange={onChange}
                    placeholder="e.g. FR,ES to exclude"
                />
            </SettingsSection>

            {/* Google Ads */}
            <SettingsSection title="Google Ads" icon={FiTrendingUp}>
                <FormField
                    id="googleAdsCustomerId"
                    name="googleAdsCustomerId"
                    label="Google Ads Customer ID"
                    value={form.googleAdsCustomerId}
                    onChange={onChange}
                    placeholder="e.g. 123-456-7890"
                />
                <FormField
                    id="googleAdsCountryFilter"
                    name="googleAdsCountryFilter"
                    label="Country include (optional)"
                    value={form.googleAdsCountryFilter}
                    onChange={onChange}
                    placeholder="e.g. Germany,Denmark,Norway or DE,DK,NO"
                />
                <FormField
                    id="googleAdsCountryExclude"
                    name="googleAdsCountryExclude"
                    label="Country exclude (optional)"
                    value={form.googleAdsCountryExclude}
                    onChange={onChange}
                    placeholder="e.g. France,Spain to exclude from results"
                />
            </SettingsSection>

            {/* SEO */}
            <SettingsSection title="SEO" icon={FiSearch}>
                <FormField
                    id="googleSearchConsoleProperty"
                    name="googleSearchConsoleProperty"
                    label="Google Search Console Property"
                    value={form.googleSearchConsoleProperty}
                    onChange={onChange}
                    placeholder="e.g. sc-domain:yourdomain.com"
                />
                <FormField
                    id="ga4PropertyId"
                    name="ga4PropertyId"
                    label="GA4 Property ID"
                    value={form.ga4PropertyId}
                    onChange={onChange}
                    placeholder="e.g. 123456789"
                />
            </SettingsSection>

            {/* Email (Klaviyo) */}
            <SettingsSection title="Email (Klaviyo)" icon={FiMail}>
                <FormField
                    id="klaviyoPrivateApiKey"
                    name="klaviyoPrivateApiKey"
                    label="Klaviyo Private API Key"
                    value={form.klaviyoPrivateApiKey}
                    onChange={onChange}
                    type="password"
                    placeholder="pk_xxxxxxxx (from Klaviyo Settings > API Keys)"
                />
            </SettingsSection>
        </form>
    );
}
