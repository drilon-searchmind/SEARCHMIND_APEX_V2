"use client";

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import CobaltLoader from '@/components/ui/CobaltLoader';
import ToastProvider, { showToast } from '@/components/ui/ToastProvider';
import './config.css';
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
import { defaultDanDomainSettings, normalizeDanDomainSettings } from '@/lib/danDomainCustomerSettings';
import { defaultDanDomainOriginalSettings, normalizeDanDomainOriginalSettings } from '@/lib/danDomainOriginalCustomerSettings';
import { pushGTMEvent, GTM_EVENTS } from '@root/lib/gtmFunctions';
import { prepareCustomerStaticExpensesForSave } from '@/lib/customerStaticExpensesUtils';
import { normalizeGoogleAdsMarketMapping } from '@/lib/googleAdsMarketMapping';
import { normalizeRevenueDisplayVat } from '@/lib/revenueVatDisplay';
import { normalizeMarketPropertyObjectives, resolvePropertyObjectivesMode } from '@/lib/propertyObjectivesUtils';

export default function ConfigPage() {
    const { customerId } = useParams();
    const user = useUser();
    const defaultFormState = {
        customerName: "",
        parentCustomer: "",
        customerType: "Shopify",
        businessCategory: "ecommerce",
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
        propertyObjectivesMode: "global",
        shopifyOnlineStoreOnly: false,
        customerRevenueType: "total_sales",
        revenueDisplayVat: "excl",
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
        facebookPixelId: "",
        googleAdsCustomerId: "",
        googleAdsCountryFilter: "",
        googleAdsCountryExclude: "",
        googleAdsMarketMapping: [],
        pinterestAdAccountId: "",
        snapchat: defaultSnapchatSettings(),
        reddit: defaultRedditSettings(),
        danDomain: defaultDanDomainSettings(),
        danDomainOriginal: defaultDanDomainOriginalSettings(),
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
            returnsCostPercentage: 0,
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
    const [marketObjectives, setMarketObjectives] = useState({});
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
                    propertyObjectivesMode: resolvePropertyObjectivesMode(data),
                    snapchat: normalizeSnapchatSettings(data.CustomerSettings || {}),
                    reddit: normalizeRedditSettings(data.CustomerSettings || {}),
                    danDomain: normalizeDanDomainSettings(data.CustomerSettings || {}),
                    danDomainOriginal: normalizeDanDomainOriginalSettings(data.CustomerSettings || {}),
                    googleAdsMarketMapping: normalizeGoogleAdsMarketMapping(
                        data.CustomerSettings?.googleAdsMarketMapping
                    ),
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
                setMarketObjectives(
                    normalizeMarketPropertyObjectives(data.CustomerMarketPropertyObjectives)
                );
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
        } else if (typeof name === 'string' && name.startsWith('danDomain.')) {
            const field = name.slice('danDomain.'.length);
            setForm((prev) => ({
                ...prev,
                danDomain: {
                    ...defaultDanDomainSettings(),
                    ...prev.danDomain,
                    [field]: type === 'checkbox' ? checked : value,
                },
            }));
        } else if (typeof name === 'string' && name.startsWith('danDomainOriginal.')) {
            const field = name.slice('danDomainOriginal.'.length);
            setForm((prev) => ({
                ...prev,
                danDomainOriginal: {
                    ...defaultDanDomainOriginalSettings(),
                    ...prev.danDomainOriginal,
                    [field]: type === 'checkbox' ? checked : value,
                },
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

    const handleMarketObjectivesChange = (updated) => {
        setMarketObjectives(updated);
    };

    const handlePropertyObjectivesModeChange = (mode) => {
        setForm((prev) => ({
            ...prev,
            propertyObjectivesMode: mode,
        }));
    };

    const handleGoogleAdsMarketMappingChange = (mapping) => {
        setForm((prev) => ({
            ...prev,
            googleAdsMarketMapping: mapping,
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault && e.preventDefault();
        setSaving(true);
        try {
            const {
                customerName,
                parentCustomer,
                businessCategory,
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
                propertyObjectivesMode,
                shopifyOnlineStoreOnly,
                customerRevenueType,
                revenueDisplayVat,
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
                facebookPixelId,
                googleAdsCustomerId,
                googleAdsMarketMapping,
                pinterestAdAccountId,
                snapchat,
                reddit,
                danDomain,
                danDomainOriginal,
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
            const payload = {
                        customerName,
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
                            propertyObjectivesMode,
                            shopifyOnlineStoreOnly,
                            customerRevenueType,
                            revenueDisplayVat: normalizeRevenueDisplayVat(revenueDisplayVat),
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
                            facebookPixelId,
                            googleAdsCustomerId,
                            googleAdsMarketMapping: normalizeGoogleAdsMarketMapping(
                                googleAdsMarketMapping
                            ),
                            pinterestAdAccountId,
                            snapchat: {
                                ...defaultSnapchatSettings(),
                                ...snapchat,
                            },
                            reddit: {
                                ...defaultRedditSettings(),
                                ...reddit,
                            },
                            danDomain: {
                                ...defaultDanDomainSettings(),
                                ...danDomain,
                            },
                            danDomainOriginal: {
                                ...defaultDanDomainOriginalSettings(),
                                ...danDomainOriginal,
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
                        CustomerMarketPropertyObjectives: marketObjectives,
                    };

            if (!user?.isExternal) {
                payload.parentCustomer = parentCustomer;
                payload.businessCategory = businessCategory || "ecommerce";
                payload.customerType = customerType;
                payload.isArchived = isArchived;
            }

            const res = await fetch(`/api/customers/${customerId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            if (!res.ok) throw new Error('Failed to update customer');
            const saved = await res.json();
            setForm({
                ...defaultFormState,
                ...saved,
                ...(saved.CustomerSettings || {}),
                propertyObjectivesMode: resolvePropertyObjectivesMode(saved),
                snapchat: normalizeSnapchatSettings(saved.CustomerSettings || {}),
                reddit: normalizeRedditSettings(saved.CustomerSettings || {}),
                danDomain: normalizeDanDomainSettings(saved.CustomerSettings || {}),
                danDomainOriginal: normalizeDanDomainOriginalSettings(saved.CustomerSettings || {}),
                googleAdsMarketMapping: normalizeGoogleAdsMarketMapping(
                    saved.CustomerSettings?.googleAdsMarketMapping
                ),
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
            setMarketObjectives(
                normalizeMarketPropertyObjectives(saved.CustomerMarketPropertyObjectives)
            );
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
        return (
            <div id="ConfigPage" className="apex-perf w-full apex-config-stack">
                <DashboardHeading
                    variant="cobalt"
                    showRunAudit={false}
                    title="Property Configuration"
                    label=""
                    customerId={customerId}
                />
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading property settings" request={`GET /api/customers/${customerId}`} />
                </div>
            </div>
        );
    }

    const allTabs = [
        {
            key: 'general',
            label: 'General Settings',
            content: (
                <GeneralSettingsForm
                    form={form}
                    onChange={handleChange}
                    saving={saving}
                    isExternalUser={user?.isExternal === true}
                />
            ),
        },
        {
            key: 'objectives',
            label: 'Property Objectives',
            content: (
                <PropertyObjectives
                    customerId={customerId}
                    customerType={form.customerType}
                    shopifyMarketsEnabled={form.shopifyMarketsEnabled}
                    propertyObjectivesMode={form.propertyObjectivesMode}
                    onPropertyObjectivesModeChange={handlePropertyObjectivesModeChange}
                    objectives={objectives}
                    marketObjectives={marketObjectives}
                    onObjectivesChange={handleObjectivesChange}
                    onMarketObjectivesChange={handleMarketObjectivesChange}
                />
            ),
        },
        {
            key: 'customer',
            label: 'Property Settings',
            content: (
                <CustomerSettingsForm
                    form={form}
                    onChange={handleChange}
                    saving={saving}
                    customerType={form.customerType}
                    customerId={customerId}
                    onGoogleAdsMarketMappingChange={handleGoogleAdsMarketMappingChange}
                />
            ),
        },
        {
            key: 'expenses',
            label: 'Expenses',
            content: <StaticExpensesForm form={form} onChange={handleChange} saving={saving} />,
        },
    ];

    const tabs = allTabs;

    const visibleKeys = tabs.map((t) => t.key);
    const effectiveActiveTab = visibleKeys.includes(activeTab) ? activeTab : (visibleKeys[0] ?? 'objectives');

    return (
        <div id="ConfigPage" className="apex-perf w-full apex-config-stack">
            <ToastProvider />
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Property Configuration"
                label={form.customerName || ""}
                customerId={customerId}
            />
            <div className="apex-config-panel">
                <VerticalTabs tabs={tabs} activeTab={effectiveActiveTab} onTabChange={setActiveTab} />
            </div>
            <div className="apex-config-actions">
                <button
                    type="button"
                    className="apex-perf-btn apex-perf-btn--primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save All'}
                </button>
            </div>
        </div>
    );
}