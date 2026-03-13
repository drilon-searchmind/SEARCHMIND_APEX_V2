import React from "react";
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';

export default function CustomerSettingsForm({ form, onChange, saving, customerType }) {
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
            <div className="flex items-center gap-2">
                <input id="fetchCogsFromStore" name="fetchCogsFromStore" type="checkbox" checked={form.fetchCogsFromStore || false} onChange={onChange} className="rounded border-gray-300" />
                <FormLabel htmlFor="fetchCogsFromStore">Fetch COGS From Store</FormLabel>
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
                <FormLabel htmlFor="changeCurrencyShopifyBillingCountryName">Change Currency Shopify Billing Country Name</FormLabel>
                <FormInputText id="changeCurrencyShopifyBillingCountryName" name="changeCurrencyShopifyBillingCountryName" value={form.changeCurrencyShopifyBillingCountryName} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="customerRevenueType">Revenue Type</FormLabel>
                <select id="customerRevenueType" name="customerRevenueType" value={form.customerRevenueType} onChange={onChange} className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20">
                    <option value="total_sales">Total Sales</option>
                    <option value="net_sales">Net Sales</option>
                    <option value="custom_1">Custom 1 (Netto + Refunds + Delivery Fees)</option>
                </select>
            </div>
            {/* Conditional fields based on customer type */}
            {customerType === "Shopify" && (
                <>
                    <div>
                        <FormLabel htmlFor="shopifyUrl">Shopify URL</FormLabel>
                        <FormInputText id="shopifyUrl" name="shopifyUrl" value={form.shopifyUrl} onChange={onChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="shopifyApiPassword">Shopify API Password</FormLabel>
                        <FormInputText id="shopifyApiPassword" name="shopifyApiPassword" value={form.shopifyApiPassword} onChange={onChange} />
                    </div>
                </>
            )}

            {customerType === "WooCommerce" && (
                <>
                    <div>
                        <FormLabel htmlFor="wooCommerceApiKey">WooCommerce API Key</FormLabel>
                        <FormInputText id="wooCommerceApiKey" name="wooCommerceApiKey" value={form.wooCommerceApiKey} onChange={onChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="wooCommerceApiSecret">WooCommerce API Secret</FormLabel>
                        <FormInputText id="wooCommerceApiSecret" name="wooCommerceApiSecret" value={form.wooCommerceApiSecret} onChange={onChange} />
                    </div>
                    <div>
                        <FormLabel htmlFor="wooCommerceApiUrl">WooCommerce API URL</FormLabel>
                        <FormInputText id="wooCommerceApiUrl" name="wooCommerceApiUrl" value={form.wooCommerceApiUrl} onChange={onChange} placeholder="https://yourdomain.com/wp-json/wc/v3/" />
                    </div>
                </>
            )}

            {customerType === "Magento" && (
                <>
                    <div>
                        <FormLabel htmlFor="magentoBaseUrl">Magento Base URL</FormLabel>
                        <FormInputText id="magentoBaseUrl" name="magentoBaseUrl" value={form.magentoBaseUrl} onChange={onChange} placeholder="https://yourdomain.com" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoConsumerKey">Consumer Key</FormLabel>
                        <FormInputText id="magentoConsumerKey" name="magentoConsumerKey" value={form.magentoConsumerKey} onChange={onChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoConsumerSecret">Consumer Secret</FormLabel>
                        <FormInputText id="magentoConsumerSecret" name="magentoConsumerSecret" value={form.magentoConsumerSecret} onChange={onChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoAccessToken">Access Token</FormLabel>
                        <FormInputText id="magentoAccessToken" name="magentoAccessToken" value={form.magentoAccessToken} onChange={onChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoAccessTokenSecret">Access Token Secret</FormLabel>
                        <FormInputText id="magentoAccessTokenSecret" name="magentoAccessTokenSecret" value={form.magentoAccessTokenSecret} onChange={onChange} type="password" placeholder="From System > Integrations" />
                    </div>
                    <div>
                        <FormLabel htmlFor="magentoStoreCode">Currency filter (optional)</FormLabel>
                        <FormInputText id="magentoStoreCode" name="magentoStoreCode" value={form.magentoStoreCode} onChange={onChange} placeholder="e.g. DKK to include only DK store orders" />
                    </div>
                </>
            )}
            <div>
                <FormLabel htmlFor="facebookAdAccountId">Facebook Ad Account ID</FormLabel>
                <FormInputText id="facebookAdAccountId" name="facebookAdAccountId" value={form.facebookAdAccountId} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="googleAdsCustomerId">Google Ads Customer ID</FormLabel>
                <FormInputText id="googleAdsCustomerId" name="googleAdsCustomerId" value={form.googleAdsCustomerId} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="googleSearchConsoleProperty">Google Search Console Property</FormLabel>
                <FormInputText id="googleSearchConsoleProperty" name="googleSearchConsoleProperty" value={form.googleSearchConsoleProperty} onChange={onChange} />
            </div>
            <div>
                <FormLabel htmlFor="ga4PropertyId">GA4 Property ID</FormLabel>
                <FormInputText id="ga4PropertyId" name="ga4PropertyId" value={form.ga4PropertyId} onChange={onChange} />
            </div>
        </form>
    );
}
