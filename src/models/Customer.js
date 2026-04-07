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
        enum: ["Shopify", "WooCommerce", "Magento", "Other"],
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
        customerRevenueType: {
            type: String,
            enum: ["total_sales", "net_sales", "custom_1"],
            required: false,
            default: "total_sales"
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
        pinterestAdAccountId: {
            type: String,
            default: ""
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
        klaviyoPrivateApiKey: {
            type: String,
            default: ""
        }
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
    }
});

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);