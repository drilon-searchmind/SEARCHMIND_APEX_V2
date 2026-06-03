"use client";

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import ToastProvider, { showToast } from '@/components/ui/ToastProvider';
import { useUser } from '@/contexts/UserContext';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import VerticalTabs from './components/VerticalTabs';
import GeneralSettingsForm from './components/GeneralSettingsForm';
import CustomerSettingsForm from './components/CustomerSettingsForm';
import StaticExpensesForm from './components/StaticExpensesForm';
import PropertyObjectives from './components/PropertyObjectives';
import { defaultSnapchatSettings, normalizeSnapchatSettings } from '@/lib/snapchatCustomerSettings';
import { defaultRedditSettings, normalizeRedditSettings } from '@/lib/redditCustomerSettings';
import { pushGTMEvent, GTM_EVENTS } from '@root/lib/gtmFunctions';
import { prepareCustomerStaticExpensesForSave } from '@/lib/customerStaticExpensesUtils';

export default function ConfigPage() {
    const { customerId } = useParams();
    const user = useUser();
    const defaultFormState = {
        customerName: "",
        parentCustomer: "",
        customerType: "Shopify",
        isArchived: false,
        metricPreference: "ROAS/POAS",
        fetchCogsFromStore: false,
        customerStoreValutaCode: "DKK",
        customerClickupID: "",
        customerMetaID: "",
        customerMetaIDExclude: "",
        changeCurrency: true,
        changeCurrencyShopifyBillingCountryName: "",
        changeCurrencyShopifyBillingCountryExclude: "",
        shopifyMarketsEnabled: false,
        shopifyOnlineStoreOnly: false,
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
        magentoStoreCode: "",
        facebookAdAccountId: "",
        googleAdsCustomerId: "",
        googleAdsCountryFilter: "",
        googleAdsCountryExclude: "",
        pinterestAdAccountId: "",
        snapchat: defaultSnapchatSettings(),
        reddit: defaultRedditSettings(),
        bingAdsCustomerId: "",
        bingAdsAccountId: "",
        googleSearchConsoleProperty: "",
        bingWebmasterSiteUrl: "",
        ga4PropertyId: "",
        klaviyoPrivateApiKey: "",
        CustomerStaticExpenses: {
            cogsPercentage: 0,
            shippingCostPerOrder: 0,
            pickNPackCostPerOrder: 0,
            transactionCostPercentage: 0,
            marketingBureauCost: 0,
            marketingBureauCostLineItems: [],
            marketingToolingCost: 0,
            marketingToolingCostLineItems: [],
            fixedExpenses: 0,
            fixedExpensesLineItems: [],
        },
    };

    const [form, setForm] = useState(defaultFormState);
    const [objectives, setObjectives] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        async function fetchCustomer() {
            setLoading(true);
            try {
                const res = await fetch(`/api/customers/${customerId}`);
                if (!res.ok) throw new Error('Failed to fetch customer');
                const data = await res.json();
                setForm({
                    ...defaultFormState,
                    ...data,
                    ...(data.CustomerSettings || {}),
                    snapchat: normalizeSnapchatSettings(data.CustomerSettings || {}),
                    reddit: normalizeRedditSettings(data.CustomerSettings || {}),
                    CustomerStaticExpenses: {
                        ...defaultFormState.CustomerStaticExpenses,
                        ...(data.CustomerStaticExpenses || {}),
                        // Ensure line items arrays exist
                        marketingBureauCostLineItems: data.CustomerStaticExpenses?.marketingBureauCostLineItems || [],
                        marketingToolingCostLineItems: data.CustomerStaticExpenses?.marketingToolingCostLineItems || [],
                        fixedExpensesLineItems: data.CustomerStaticExpenses?.fixedExpensesLineItems || [],
                    },
                });
                setObjectives(data.CustomerPropertyObjectives || {});
            } catch (err) {
                showToast({ message: 'Failed to load customer', type: 'error', position: 'top-center' });
            } finally {
                setLoading(false);
            }
        }
        fetchCustomer();
    }, [customerId]);

    const handleChange = (e) => {
        const { name, value, type, checked, dataset } = e.target;
        if (dataset && dataset.group === 'CustomerStaticExpenses') {
            setForm((prev) => ({
                ...prev,
                CustomerStaticExpenses: {
                    ...prev.CustomerStaticExpenses,
                    [name]: type === 'number' ? Number(value) : (Array.isArray(value) ? value : value)
                }
            }));
        } else if (typeof name === 'string' && name.startsWith('reddit.')) {
            const field = name.slice('reddit.'.length);
            setForm((prev) => ({
                ...prev,
                reddit: {
                    ...defaultRedditSettings(),
                    ...prev.reddit,
                    [field]: type === 'checkbox' ? checked : value,
                },
            }));
        } else if (typeof name === 'string' && name.startsWith('snapchat.')) {
            const field = name.slice('snapchat.'.length);
            setForm((prev) => ({
                ...prev,
                snapchat: {
                    ...defaultSnapchatSettings(),
                    ...prev.snapchat,
                    [field]: type === 'checkbox' ? checked : value,
                },
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleObjectivesChange = (updated) => {
        setObjectives(updated);
    };

    const handleSave = async (e) => {
        e.preventDefault && e.preventDefault();
        setSaving(true);
        try {
            const {
                customerName,
                parentCustomer,
                customerType,
                isArchived,
                metricPreference,
                fetchCogsFromStore,
                customerStoreValutaCode,
                customerClickupID,
                customerMetaID,
                customerMetaIDExclude,
                googleAdsCountryFilter,
                googleAdsCountryExclude,
                changeCurrency,
                changeCurrencyShopifyBillingCountryName,
                changeCurrencyShopifyBillingCountryExclude,
                shopifyMarketsEnabled,
                shopifyOnlineStoreOnly,
                customerRevenueType,
                shopifyUrl,
                shopifyApiPassword,
                wooCommerceApiKey,
                wooCommerceApiSecret,
                wooCommerceApiUrl,
                magentoBaseUrl,
                magentoAccessToken,
                magentoConsumerKey,
                magentoConsumerSecret,
                magentoAccessTokenSecret,
                magentoStoreCode,
                facebookAdAccountId,
                googleAdsCustomerId,
                pinterestAdAccountId,
                snapchat,
                reddit,
                bingAdsCustomerId,
                bingAdsAccountId,
                googleSearchConsoleProperty,
                bingWebmasterSiteUrl,
                ga4PropertyId,
                klaviyoPrivateApiKey,
                CustomerStaticExpenses,
            } = form;
            
            // Calculate sums from line items and update main fields
            const updatedExpenses = { ...CustomerStaticExpenses };
            
            Object.assign(
                updatedExpenses,
                prepareCustomerStaticExpensesForSave(updatedExpenses)
            );
            const res = await fetch(`/api/customers/${customerId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerName,
                        parentCustomer,
                        customerType,
                        isArchived,
                        CustomerSettings: {
                            metricPreference,
                            fetchCogsFromStore,
                            customerStoreValutaCode,
                            customerClickupID,
                            customerMetaID,
                            customerMetaIDExclude,
                            changeCurrency,
                            changeCurrencyShopifyBillingCountryName,
                            changeCurrencyShopifyBillingCountryExclude,
                            shopifyMarketsEnabled,
                            shopifyOnlineStoreOnly,
                            customerRevenueType,
                            shopifyUrl,
                            shopifyApiPassword,
                            wooCommerceApiKey,
                            wooCommerceApiSecret,
                            wooCommerceApiUrl,
                            magentoBaseUrl,
                            magentoAccessToken,
                            magentoConsumerKey,
                            magentoConsumerSecret,
                            magentoAccessTokenSecret,
                            magentoStoreCode,
                            facebookAdAccountId,
                            googleAdsCustomerId,
                            pinterestAdAccountId,
                            snapchat: {
                                ...defaultSnapchatSettings(),
                                ...snapchat,
                            },
                            reddit: {
                                ...defaultRedditSettings(),
                                ...reddit,
                            },
                            bingAdsCustomerId,
                            bingAdsAccountId,
                            googleAdsCountryFilter,
                            googleAdsCountryExclude,
                            googleSearchConsoleProperty,
                            bingWebmasterSiteUrl,
                            ga4PropertyId,
                            klaviyoPrivateApiKey,
                        },
                        CustomerStaticExpenses: updatedExpenses,
                        CustomerPropertyObjectives: objectives,
                    })
                });
            if (!res.ok) throw new Error('Failed to update customer');
            const saved = await res.json();
            setForm({
                ...defaultFormState,
                ...saved,
                ...(saved.CustomerSettings || {}),
                snapchat: normalizeSnapchatSettings(saved.CustomerSettings || {}),
                reddit: normalizeRedditSettings(saved.CustomerSettings || {}),
                CustomerStaticExpenses: {
                    ...defaultFormState.CustomerStaticExpenses,
                    ...(saved.CustomerStaticExpenses || {}),
                    marketingBureauCostLineItems:
                        saved.CustomerStaticExpenses?.marketingBureauCostLineItems || [],
                    marketingToolingCostLineItems:
                        saved.CustomerStaticExpenses?.marketingToolingCostLineItems || [],
                    fixedExpensesLineItems: saved.CustomerStaticExpenses?.fixedExpensesLineItems || [],
                },
            });
            setObjectives(saved.CustomerPropertyObjectives || {});
            showToast({ message: 'Settings updated successfully!', type: 'success', position: 'top-center' });
            pushGTMEvent(GTM_EVENTS.DASHBOARD_CONFIG_SAVED, {
                eventData: { customerId: String(customerId) },
            });
        } catch (err) {
            showToast({ message: err.message || 'Failed to update customer', type: 'error', position: 'top-center' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="w-full flex justify-center items-center min-h-[300px] text-gray-400">Loading...</div>;
    }

    const allTabs = [
        {
            key: 'general',
            label: 'General Settings',
            content: <GeneralSettingsForm form={form} onChange={handleChange} saving={saving} />,
        },
        {
            key: 'objectives',
            label: 'Property Objectives',
            content: <PropertyObjectives objectives={objectives} onObjectivesChange={handleObjectivesChange} />,
        },
        {
            key: 'customer',
            label: 'Property Settings',
            content: <CustomerSettingsForm form={form} onChange={handleChange} saving={saving} customerType={form.customerType} />,
        },
        {
            key: 'expenses',
            label: 'Expenses',
            content: <StaticExpensesForm form={form} onChange={handleChange} saving={saving} />,
        },
    ];

    const tabs = user?.isExternal
        ? allTabs.filter((t) => t.key !== 'general' && t.key !== 'customer')
        : allTabs;

    const visibleKeys = tabs.map((t) => t.key);
    const effectiveActiveTab = visibleKeys.includes(activeTab) ? activeTab : (visibleKeys[0] ?? 'objectives');

    return (
        <div id='ConfigPage' className="w-full">
            <ToastProvider />
            <DashboardHeading title="Property Configuration" label={form.customerName || ""} />
            <div className="mt-8">
                <div className="bg-white border border-gray-200 rounded-xl p-0">
                    <VerticalTabs tabs={tabs} activeTab={effectiveActiveTab} onTabChange={setActiveTab} />
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        className="bg-[var(--color-primary-searchmind)] text-white px-6 py-2 rounded-lg font-semibold shadow-sm hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save All'}
                    </button>
                </div>
            </div>
        </div>
    );
}