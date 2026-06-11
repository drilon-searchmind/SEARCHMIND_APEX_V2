import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
    },
    parentCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ParentCustomer",
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    customerType: {
        type: String,
        enum: ["Shopify", "WooCommerce", "Magento", "Other", "DanDomain"],
        default: "Shopify"
    },
    CustomerSettings: {
        metricPreference: {
            type: String,
            enum: ["ROAS/POAS", "Spendshare"],
            required: true,
            default: "ROAS/POAS"
        },
        fetchCogsFromStore: {
            type: Boolean,
            default: false
        },
        customerStoreValutaCode: {
            type: String,
            required: false,
            default: "DKK"
        },
        customerClickupID: {
            type: String,
            default: ""
        },
        customerMetaID: {
            type: String,
            default: ""
        },
        customerMetaIDExclude: {
            type: String,
            default: ""
        },
        changeCurrency: {
            type: Boolean,
            default: true
        },
        changeCurrencyShopifyBillingCountryName: {
            type: String,
            default: ""
        },
        changeCurrencyShopifyBillingCountryExclude: {
            type: String,
            default: ""
        },
        /** When true: Shopify revenue uses full-store sales (no billing-country filter); dashboards can filter by Shopify Market via region countries → ShopifyQL `billing_country`. */
        shopifyMarketsEnabled: {
            type: Boolean,
            default: false,
        },
        /** When true: ShopifyQL sales and order-based fetches only include the Online Store channel (excludes POS, draft orders, etc.). */
        shopifyOnlineStoreOnly: {
            type: Boolean,
            default: false,
        },
        customerRevenueType: {
            type: String,
            enum: ["total_sales", "net_sales", "custom_1"],
            required: false,
            default: "total_sales"
        },
        /** Dashboard revenue display: excl. VAT, incl. VAT (25%), or incl. VAT from store tax fields. */
        revenueDisplayVat: {
            type: String,
            enum: ["incl", "excl", "incl_shopify"],
            default: "excl",
        },
        shopifyUrl: {
            type: String,
            default: ""
        },
        shopifyApiPassword: {
            type: String,
            default: ""
        },
        facebookAdAccountId: {
            type: String,
            default: ""
        },
        googleAdsCustomerId: {
            type: String,
            default: ""
        },
        googleAdsCountryFilter: {
            type: String,
            default: ""
        },
        googleAdsCountryExclude: {
            type: String,
            default: ""
        },
        /**
         * Map each Google Ads customer ID to Shopify Markets (shopifyql numeric ids).
         * Used when multiple Ads accounts + Shopify Markets + "filter marketing spend by markets".
         */
        googleAdsMarketMapping: {
            type: [
                {
                    googleAdsCustomerId: { type: String, default: "" },
                    shopifyqlMarketIds: { type: [String], default: [] },
                },
            ],
            default: [],
        },
        pinterestAdAccountId: {
            type: String,
            default: ""
        },
        /**
         * Snapchat — Marketing API OAuth + ads account; Conversions API token stored for offline sends.
         * Organization ID is the business organization (different from ad account UUID).
         */
        snapchat: {
            clientId: { type: String, default: "" },
            organizationId: { type: String, default: "" },
            /** UUID for `/v1/adaccounts/{id}/stats`; not the same as organization ID. */
            adAccountId: { type: String, default: "" },
            conversionsApiToken: { type: String, default: "" },
            accessToken: { type: String, default: "" },
            refreshToken: { type: String, default: "" },
            clientSecret: { type: String, default: "" },
        },
        /** Reddit Ads API v3 — developer app + optional user tokens; ads account id often `t2_…`. */
        reddit: {
            appId: { type: String, default: "" },
            appSecret: { type: String, default: "" },
            accessToken: { type: String, default: "" },
            refreshToken: { type: String, default: "" },
            accountId: { type: String, default: "" },
            redditUsername: { type: String, default: "" },
        },
        bingAdsAccountId: {
            type: String,
            default: ""
        },
        /** Microsoft Advertising customer (manager) ID — required with bingAdsAccountId for Reporting API. */
        bingAdsCustomerId: {
            type: String,
            default: ""
        },
        googleSearchConsoleProperty: {
            type: String,
            default: ""
        },
        /** Verified site URL for Bing Webmaster JSON API (e.g. https://example.com/). */
        bingWebmasterSiteUrl: {
            type: String,
            default: ""
        },
        ga4PropertyId: {
            type: String,
            default: ""
        },
        wooCommerceApiKey: {
            type: String,
            default: ""
        },
        wooCommerceApiSecret: {
            type: String,
            default: ""
        },
        wooCommerceApiUrl: {
            type: String,
            default: ""
        },
        magentoBaseUrl: {
            type: String,
            default: ""
        },
        magentoAccessToken: {
            type: String,
            default: ""
        },
        magentoConsumerKey: {
            type: String,
            default: ""
        },
        magentoConsumerSecret: {
            type: String,
            default: ""
        },
        magentoAccessTokenSecret: {
            type: String,
            default: ""
        },
        magentoStoreCode: {
            type: String,
            default: ""
        },
        /** DanDomain HostedShop API — OAuth client credentials + access token. */
        danDomain: {
            shopHost: { type: String, default: "" },
            clientId: { type: String, default: "" },
            clientSecret: { type: String, default: "" },
            accessToken: { type: String, default: "" },
        },
        klaviyoPrivateApiKey: {
            type: String,
            default: ""
        },
        /** Performance dashboard: optional returns % override and related toggles. */
        performanceDashboard: {
            returnsOverrideEnabled: {
                type: Boolean,
                default: false,
            },
            returnsOverridePercent: {
                type: Number,
                default: 45,
                min: 0,
                max: 100,
            },
        },
    },
    CustomerStaticExpenses: {
        cogsPercentage: {
            type: Number,
            default: 0,
        },
        shippingCostPerOrder: {
            type: Number,
            default: 0,
        },
        pickNPackCostPerOrder: {
            type: Number,
            default: 0,
        },
        transactionCostPercentage: {
            type: Number,
            default: 0,
        },
        marketingBureauCost: {
            type: Number,
            default: 0,
        },
        marketingBureauCostLineItems: {
            type: [{
                name: { type: String, required: true },
                amount: { type: Number, required: true }
            }],
            default: []
        },
        marketingToolingCost: {
            type: Number,
            default: 0, 
        },
        marketingToolingCostLineItems: {
            type: [{
                name: { type: String, required: true },
                amount: { type: Number, required: true }
            }],
            default: []
        },
        fixedExpenses: {
            type: Number,
            default: 0,
        },
        fixedExpensesLineItems: {
            type: [{
                name: { type: String, required: true },
                amount: { type: Number, required: true }
            }],
            default: []
        }
    },
    CustomerPropertyObjectives: {
        january: {
            period: { type: String, default: "january" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        february: {
            period: { type: String, default: "february" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        march: {
            period: { type: String, default: "march" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        april: {
            period: { type: String, default: "april" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        may: {
            period: { type: String, default: "may" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        june: {
            period: { type: String, default: "june" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        july: {
            period: { type: String, default: "july" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        august: {
            period: { type: String, default: "august" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        september: {
            period: { type: String, default: "september" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        october: {
            period: { type: String, default: "october" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        november: {
            period: { type: String, default: "november" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        },
        december: {
            period: { type: String, default: "december" },
            revenueTarget: { type: Number, default: 1 },
            marketingBudget: { type: Number, default: 1 }
        }
    },
    /**
     * Per-Shopify-market property objectives (Shopify Markets customers only).
     * Keys: shopifyqlMarketId (string). Values: same 12-month shape as CustomerPropertyObjectives.
     */
    CustomerMarketPropertyObjectives: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    /**
     * Apex Radar per-channel targets (budget, ROAS/CPA, static vs dynamic budget).
     */
    customerApexRadarSettings: {
        facebook: {
            /** Target / planned budget amount (same currency as reporting). */
            targetBudget: { type: Number, default: null },
            /** Whether `targetValue` is interpreted as ROAS or CPA. */
            targetMetricType: {
                type: String,
                enum: ["ROAS", "CPA"],
                default: "ROAS",
            },
            /** Target ROAS (e.g. 5) or target CPA in account currency. */
            targetValue: { type: Number, default: null },
            /** Statisk vs dynamisk — static caps vs dynamic pacing. */
            budgetMode: {
                type: String,
                enum: ["STATIC", "DYNAMIC"],
                default: "DYNAMIC",
            },
        },
        google: {
            targetBudget: { type: Number, default: null },
            targetMetricType: {
                type: String,
                enum: ["ROAS", "CPA"],
                default: "ROAS",
            },
            targetValue: { type: Number, default: null },
            budgetMode: {
                type: String,
                enum: ["STATIC", "DYNAMIC"],
                default: "DYNAMIC",
            },
        },
    },
    /**
     * Cached ClickUp roster + services flags (bulk-sync from CLI/API; Apex Radar reads this to avoid per-customer live calls).
     * Live GET /api/clickup-team-members/[id] unchanged for dashboards.
     */
    customerTeam: {
        members: {
            type: [
                {
                    id: mongoose.Schema.Types.Mixed,
                    username: { type: String, default: "" },
                    email: { type: String, default: null },
                    service: { type: String, default: "" },
                    avatar: { type: String, default: null },
                },
            ],
            default: undefined,
        },
        customerServices: {
            type: [
                {
                    key: { type: String },
                    label: { type: String },
                    optionId: { type: String },
                    active: { type: Boolean },
                },
            ],
            default: undefined,
        },
        syncedAt: { type: Date },
        lastSyncAttemptAt: { type: Date },
        lastSyncError: { type: String, default: null },
    },
});

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);