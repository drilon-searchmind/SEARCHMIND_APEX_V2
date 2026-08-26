"use client";

import React, { useEffect, useState } from "react";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { FiSettings, FiShoppingBag, FiPackage, FiDatabase, FiGlobe, FiFacebook, FiTrendingUp, FiSearch, FiMail, FiImage, FiLayers, FiZap, FiMessageCircle } from "react-icons/fi";

function SettingsSection({ title, icon: Icon, children, sectionId }) {
    return (
        <section
            id={sectionId}
            className={`apex-config-section${sectionId ? " scroll-mt-24" : ""}`}
        >
            <div className="apex-config-section__panel">
                <h6 className="apex-config-section__head">
                    {Icon && <Icon className="w-4 h-4" />}
                    {title}
                </h6>
                <div className="apex-config-section__grid">{children}</div>
            </div>
        </section>
    );
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function TableOfContents({ items }) {
    return (
        <nav aria-label="On this page" className="apex-config-toc">
            <p className="apex-config-toc__label">On this page</p>
            <ul className="apex-config-toc__list">
                {items.map(({ id, label }) => (
                    <li key={id}>
                        <button
                            type="button"
                            onClick={() => scrollToSection(id)}
                            className="apex-config-toc__btn"
                        >
                            {label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

function FormField({ id, name, label, value, onChange, type = "text", placeholder, required, disabled }) {
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
                disabled={disabled}
            />
        </div>
    );
}

function FormSelect({ id, name, label, value, onChange, options }) {
    return (
        <div>
            <FormLabel htmlFor={id}>{label}</FormLabel>
            <select id={id} name={name} value={value} onChange={onChange}>
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
        <div className="apex-config-checkbox-row">
            <input
                id={id}
                name={name}
                type="checkbox"
                checked={checked || false}
                onChange={onChange}
            />
            <FormLabel htmlFor={id}>{label}</FormLabel>
        </div>
    );
}

import GoogleAdsMarketMappingSection from "./GoogleAdsMarketMappingSection";
import { parseGoogleAdsCustomerIds } from "@/lib/googleAdsCustomerIdUtils";

/** DOM ids for config sections — avoid `#google-ads` etc. (ad blockers hide those). */
const CONFIG_SECTION = {
    general: "config-general",
    storePlatform: "config-store-platform",
    meta: "config-meta",
    googleAds: "config-google-ads",
    merchantCenter: "config-merchant-center",
    pinterestAds: "config-pinterest-ads",
    snapchatAds: "config-snapchat-ads",
    redditAds: "config-reddit-ads",
    microsoftAds: "config-microsoft-ads",
    seo: "config-seo",
    email: "config-email",
};

function Ga4SetupHint() {
    const [serviceAccountEmail, setServiceAccountEmail] = useState("");

    useEffect(() => {
        fetch("/api/ga4/setup-info")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.serviceAccountEmail) setServiceAccountEmail(data.serviceAccountEmail);
            })
            .catch(() => {});
    }, []);

    return (
        <div className="apex-config-hint apex-config-hint--info apex-config-col-full">
            <p className="font-medium mb-1">GA4 access setup</p>
            <p className="mb-2">
                APEX reads GA4 via a Google service account. In Google Analytics, open{" "}
                <strong>Admin → Property access management</strong> and add this email as{" "}
                <strong>Viewer</strong> on the client&apos;s property:
            </p>
            {serviceAccountEmail ? (
                <code>{serviceAccountEmail}</code>
            ) : (
                <p className="apex-config-field-hint">Service account email not configured on server.</p>
            )}
            <p className="apex-config-field-hint mt-2">
                Use the numeric Property ID (Admin → Property settings), not the G-XXXX Measurement ID.
            </p>
        </div>
    );
}

export default function CustomerSettingsForm({
    form,
    onChange,
    saving,
    customerType,
    customerId,
    onGoogleAdsMarketMappingChange,
}) {
    const shopifyMarketsOn = customerType === "Shopify" && form.shopifyMarketsEnabled === true;
    const storeSection =
        customerType === "Shopify"
            ? { id: CONFIG_SECTION.storePlatform, label: "Shopify" }
            : customerType === "WooCommerce"
              ? { id: CONFIG_SECTION.storePlatform, label: "WooCommerce" }
              : customerType === "Magento"
                ? { id: CONFIG_SECTION.storePlatform, label: "Magento" }
                : customerType === "DanDomain"
                  ? { id: CONFIG_SECTION.storePlatform, label: "DanDomain (HostedShop)" }
                  : customerType === "DanDomainOriginal"
                    ? { id: CONFIG_SECTION.storePlatform, label: "DanDomain Original (WEBAPI)" }
                    : null;

    const tocItems = [
        { id: CONFIG_SECTION.general, label: "General" },
        ...(storeSection ? [storeSection] : []),
        { id: CONFIG_SECTION.meta, label: "Meta" },
        { id: CONFIG_SECTION.googleAds, label: "Google Ads" },
        { id: CONFIG_SECTION.merchantCenter, label: "Merchant Center" },
        { id: CONFIG_SECTION.pinterestAds, label: "Pinterest Ads" },
        { id: CONFIG_SECTION.snapchatAds, label: "Snapchat Ads" },
        { id: CONFIG_SECTION.redditAds, label: "Reddit Ads" },
        { id: CONFIG_SECTION.microsoftAds, label: "Microsoft Ads" },
        { id: CONFIG_SECTION.seo, label: "SEO" },
        { id: CONFIG_SECTION.email, label: "Email" },
    ];

    return (
        <form className="apex-config-form" onSubmit={(e) => e.preventDefault()}>
            <TableOfContents items={tocItems} />

            {/* General */}
            <SettingsSection title="General" icon={FiSettings} sectionId={CONFIG_SECTION.general}>
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
                <SettingsSection title="Shopify" icon={FiShoppingBag} sectionId={CONFIG_SECTION.storePlatform}>
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
                    <FormCheckbox
                        id="shopifyMarketsEnabled"
                        name="shopifyMarketsEnabled"
                        label="Shopify Markets — filter revenue by market on dashboards"
                        checked={form.shopifyMarketsEnabled}
                        onChange={onChange}
                    />
                    <FormCheckbox
                        id="shopifyOnlineStoreOnly"
                        name="shopifyOnlineStoreOnly"
                        label="Online Store only — exclude POS and other sales channels from Shopify revenue"
                        checked={form.shopifyOnlineStoreOnly}
                        onChange={onChange}
                    />
                    {shopifyMarketsOn ? (
                        <p className="apex-config-col-full apex-config-field-hint leading-snug">
                            Shopify Analytics revenue uses the full store (billing-country include/exclude below is ignored).
                            Listing markets requires the Admin API scope read_markets.
                        </p>
                    ) : null}
                    <FormField
                        id="changeCurrencyShopifyBillingCountryName"
                        name="changeCurrencyShopifyBillingCountryName"
                        label="Billing country include (optional)"
                        value={form.changeCurrencyShopifyBillingCountryName}
                        onChange={onChange}
                        placeholder="e.g. Sweden,Denmark,Norway"
                        disabled={shopifyMarketsOn}
                    />
                    <FormField
                        id="changeCurrencyShopifyBillingCountryExclude"
                        name="changeCurrencyShopifyBillingCountryExclude"
                        label="Billing country exclude (optional)"
                        value={form.changeCurrencyShopifyBillingCountryExclude}
                        onChange={onChange}
                        placeholder="e.g. France,Spain to exclude"
                        disabled={shopifyMarketsOn}
                    />
                </SettingsSection>
            )}

            {/* WooCommerce */}
            {customerType === "WooCommerce" && (
                <SettingsSection title="WooCommerce" icon={FiPackage} sectionId={CONFIG_SECTION.storePlatform}>
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
                <SettingsSection title="Magento" icon={FiDatabase} sectionId={CONFIG_SECTION.storePlatform}>
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

            {/* DanDomain (HostedShop) */}
            {customerType === "DanDomain" && (
                <SettingsSection title="DanDomain (HostedShop)" icon={FiGlobe} sectionId={CONFIG_SECTION.storePlatform}>
                    <FormField
                        id="danDomain.shopHost"
                        name="danDomain.shopHost"
                        label="Shop host"
                        value={form.danDomain?.shopHost || ""}
                        onChange={onChange}
                        placeholder="e.g. shop99999.mywebshop.io (not webshop.dandomain.dk admin URL)"
                    />
                    <FormField
                        id="danDomain.clientId"
                        name="danDomain.clientId"
                        label="Client ID"
                        value={form.danDomain?.clientId || ""}
                        onChange={onChange}
                        placeholder="HostedShop API client_id"
                    />
                    <FormField
                        id="danDomain.clientSecret"
                        name="danDomain.clientSecret"
                        label="Client Secret"
                        value={form.danDomain?.clientSecret || ""}
                        onChange={onChange}
                        type="password"
                        placeholder="HostedShop API client_secret"
                    />
                    <FormField
                        id="danDomain.accessToken"
                        name="danDomain.accessToken"
                        label="Access Token"
                        value={form.danDomain?.accessToken || ""}
                        onChange={onChange}
                        type="password"
                        placeholder="Optional if client id + secret are set (OAuth)"
                    />
                </SettingsSection>
            )}

            {/* DanDomain Original (legacy WEBAPI) */}
            {customerType === "DanDomainOriginal" && (
                <SettingsSection title="DanDomain Original (WEBAPI)" icon={FiGlobe} sectionId={CONFIG_SECTION.storePlatform}>
                    <FormField
                        id="danDomainOriginal.shopAdminUrl"
                        name="danDomainOriginal.shopAdminUrl"
                        label="Shop admin URL"
                        value={form.danDomainOriginal?.shopAdminUrl || ""}
                        onChange={onChange}
                        placeholder="e.g. https://ajengros.dk"
                    />
                    <FormField
                        id="danDomainOriginal.apiKey"
                        name="danDomainOriginal.apiKey"
                        label="WEBAPI key"
                        value={form.danDomainOriginal?.apiKey || ""}
                        onChange={onChange}
                        type="password"
                        placeholder="OrderService API key from DanDomain admin"
                    />
                </SettingsSection>
            )}

            {/* Meta */}
            <SettingsSection title="Meta" icon={FiFacebook} sectionId={CONFIG_SECTION.meta}>
                <FormField
                    id="facebookAdAccountId"
                    name="facebookAdAccountId"
                    label="Facebook Ad Account ID"
                    value={form.facebookAdAccountId}
                    onChange={onChange}
                    placeholder="e.g. act_123456789"
                />
                <FormField
                    id="facebookPixelId"
                    name="facebookPixelId"
                    label="Facebook Pixel ID (optional)"
                    value={form.facebookPixelId}
                    onChange={onChange}
                    placeholder="Auto-detected from ad account if empty — e.g. 1868342543457309"
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
            <SettingsSection title="Google Ads" icon={FiTrendingUp} sectionId={CONFIG_SECTION.googleAds}>
                <FormField
                    id="googleAdsCustomerId"
                    name="googleAdsCustomerId"
                    label="Google Ads Customer ID"
                    value={form.googleAdsCustomerId}
                    onChange={onChange}
                    placeholder="e.g. 7969227273 or 7969227273, 7969227272"
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
                {shopifyMarketsOn && parseGoogleAdsCustomerIds(form.googleAdsCustomerId).length > 1 ? (
                    <GoogleAdsMarketMappingSection
                        customerId={customerId}
                        googleAdsCustomerId={form.googleAdsCustomerId}
                        mapping={form.googleAdsMarketMapping || []}
                        onMappingChange={onGoogleAdsMarketMappingChange}
                        shopifyMarketsEnabled={shopifyMarketsOn}
                    />
                ) : null}
            </SettingsSection>

            {/* Google Merchant Center */}
            <SettingsSection title="Merchant Center" icon={FiShoppingBag} sectionId={CONFIG_SECTION.merchantCenter}>
                <FormField
                    id="googleMerchantCenterId"
                    name="googleMerchantCenterId"
                    label="Merchant Center account ID"
                    value={form.googleMerchantCenterId}
                    onChange={onChange}
                    placeholder="e.g. 123456789"
                />
                <div className="config-field">
                    <label htmlFor="googleMerchantAccountSlot" className="config-field__label">
                        OAuth account slot
                    </label>
                    <select
                        id="googleMerchantAccountSlot"
                        name="googleMerchantAccountSlot"
                        className="config-field__input"
                        value={form.googleMerchantAccountSlot ?? 1}
                        onChange={onChange}
                    >
                        <option value={0}>Account 0 — Google Ads (GOOGLE_ADS_*)</option>
                        <option value={1}>Account 1 — MC1 (GOOGLE_MERCHANT_*_1)</option>
                        <option value={2}>Account 2 — MC2 (GOOGLE_MERCHANT_*_2)</option>
                    </select>
                    <p className="config-field__hint">
                        Choose which OAuth credentials Price Index uses. Account 0 reuses the shared
                        Google Ads credentials; accounts 1 and 2 use dedicated Merchant Center OAuth
                        apps.
                    </p>
                </div>
            </SettingsSection>

            {/* Pinterest Ads */}
            <SettingsSection title="Pinterest Ads" icon={FiImage} sectionId={CONFIG_SECTION.pinterestAds}>
                <FormField
                    id="pinterestAdAccountId"
                    name="pinterestAdAccountId"
                    label="Pinterest ad account ID"
                    value={form.pinterestAdAccountId}
                    onChange={onChange}
                    placeholder="Numeric id from Pinterest Ads Manager or GET /api/pinterest-ad-accounts"
                />
            </SettingsSection>

            <SettingsSection title="Snapchat Ads" icon={FiZap} sectionId={CONFIG_SECTION.snapchatAds}>
                <FormField
                    id="snapchat-clientId"
                    name="snapchat.clientId"
                    label="OAuth client ID"
                    value={(form.snapchat && form.snapchat.clientId) || ""}
                    onChange={onChange}
                    placeholder="From OAuth app in Snap Business Manager"
                />
                <FormField
                    id="snapchat-organizationId"
                    name="snapchat.organizationId"
                    label="Organization ID"
                    value={(form.snapchat && form.snapchat.organizationId) || ""}
                    onChange={onChange}
                    placeholder="Snap business organization UUID — not the ad account"
                />
                <FormField
                    id="snapchat-adAccountId"
                    name="snapchat.adAccountId"
                    label="Ad account UUID (dashboard)"
                    value={(form.snapchat && form.snapchat.adAccountId) || ""}
                    onChange={onChange}
                    placeholder="Ads account id from Ads Manager — used for stats"
                />
                <FormField
                    id="snapchat-clientSecret"
                    name="snapchat.clientSecret"
                    label="OAuth client secret"
                    type="password"
                    value={(form.snapchat && form.snapchat.clientSecret) || ""}
                    onChange={onChange}
                    placeholder="From Snap OAuth app — required with refresh token"
                />
                <FormField
                    id="snapchat-refreshToken"
                    name="snapchat.refreshToken"
                    label="OAuth refresh token (recommended)"
                    type="password"
                    value={(form.snapchat && form.snapchat.refreshToken) || ""}
                    onChange={onChange}
                    placeholder="From authorization flow — Apex refreshes access tokens automatically"
                />
                <FormField
                    id="snapchat-accessToken"
                    name="snapchat.accessToken"
                    label="Marketing API access token (optional)"
                    type="password"
                    value={(form.snapchat && form.snapchat.accessToken) || ""}
                    onChange={onChange}
                    placeholder="Leave empty when refresh token is set (expires in ~1 hour)"
                />
                <FormField
                    id="snapchat-conversionsApiToken"
                    name="snapchat.conversionsApiToken"
                    label="Conversions API token"
                    type="password"
                    value={(form.snapchat && form.snapchat.conversionsApiToken) || ""}
                    onChange={onChange}
                    placeholder="For CAPI / offline conversions — not used by the Snapchat dashboard charts yet"
                />
            </SettingsSection>

            <SettingsSection title="Reddit Ads" icon={FiMessageCircle} sectionId={CONFIG_SECTION.redditAds}>
                <FormField
                    id="reddit-appId"
                    name="reddit.appId"
                    label="Reddit app (client) ID"
                    value={(form.reddit && form.reddit.appId) || ""}
                    onChange={onChange}
                    placeholder="From reddit.com/prefs/apps"
                />
                <FormField
                    id="reddit-appSecret"
                    name="reddit.appSecret"
                    label="Reddit app secret"
                    type="password"
                    value={(form.reddit && form.reddit.appSecret) || ""}
                    onChange={onChange}
                />
                <FormField
                    id="reddit-accountId"
                    name="reddit.accountId"
                    label="Ads account ID"
                    value={(form.reddit && form.reddit.accountId) || ""}
                    onChange={onChange}
                    placeholder="Often t2_… from Reddit Ads Manager"
                />
                <FormField
                    id="reddit-refreshToken"
                    name="reddit.refreshToken"
                    label="OAuth refresh token (recommended)"
                    type="password"
                    value={(form.reddit && form.reddit.refreshToken) || ""}
                    onChange={onChange}
                    placeholder="From authorization-code flow (scope adsread) — Apex refreshes access tokens automatically"
                />
                <FormField
                    id="reddit-accessToken"
                    name="reddit.accessToken"
                    label="OAuth access token (optional)"
                    type="password"
                    value={(form.reddit && form.reddit.accessToken) || ""}
                    onChange={onChange}
                    placeholder="Leave empty when refresh token is set (access tokens expire in ~1 hour)"
                />
                <FormField
                    id="reddit-username"
                    name="reddit.redditUsername"
                    label="Reddit username for API User-Agent (optional)"
                    value={(form.reddit && form.reddit.redditUsername) || ""}
                    onChange={onChange}
                    placeholder="Your Reddit username (without u/)"
                />
            </SettingsSection>

            {/* Microsoft Advertising (Bing Ads) */}
            <SettingsSection title="Microsoft Advertising (Bing Ads)" icon={FiLayers} sectionId={CONFIG_SECTION.microsoftAds}>
                <FormField
                    id="bingAdsCustomerId"
                    name="bingAdsCustomerId"
                    label="Microsoft Advertising Customer ID"
                    value={form.bingAdsCustomerId}
                    onChange={onChange}
                    placeholder="Digits only — Customer (manager) ID, not Kontonummer"
                />
                <FormField
                    id="bingAdsAccountId"
                    name="bingAdsAccountId"
                    label="Microsoft Advertising Account ID"
                    value={form.bingAdsAccountId}
                    onChange={onChange}
                    placeholder="Digits only — numeric Konto-id, not the alphanumeric Kontonummer (e.g. F118BTG2)"
                />
            </SettingsSection>

            {/* SEO */}
            <SettingsSection title="SEO" icon={FiSearch} sectionId={CONFIG_SECTION.seo}>
                <FormField
                    id="googleSearchConsoleProperty"
                    name="googleSearchConsoleProperty"
                    label="Google Search Console Property"
                    value={form.googleSearchConsoleProperty}
                    onChange={onChange}
                    placeholder="e.g. sc-domain:yourdomain.com"
                />
                <FormField
                    id="bingWebmasterSiteUrl"
                    name="bingWebmasterSiteUrl"
                    label="Bing Webmaster site URL"
                    value={form.bingWebmasterSiteUrl}
                    onChange={onChange}
                    placeholder="https://yourdomain.com/"
                />
                <FormField
                    id="ga4PropertyId"
                    name="ga4PropertyId"
                    label="GA4 Property ID"
                    value={form.ga4PropertyId}
                    onChange={onChange}
                    placeholder="e.g. 123456789"
                />
                <Ga4SetupHint />
            </SettingsSection>

            {/* Email (Klaviyo) */}
            <SettingsSection title="Email (Klaviyo)" icon={FiMail} sectionId={CONFIG_SECTION.email}>
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
