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
        enum: ["Shopify", "WooCommerce", "Other"],
        default: "Shopify"
    },
    CustomerSettings: {
        metricPreference: {
            type: String,
            enum: ["ROAS/POAS", "Spendshare"],
            required: true,
            default: "ROAS/POAS"
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
            default: "DK"
        },
        customerMetaIDExclude: {
            type: String,
            default: ""
        },
        changeCurrency: {
            type: Boolean,
            default: true
        },
        customerRevenueType: {
            type: String,
            enum: ["total_sales", "net_sales"],
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
        transactionCostPercentage: {
            type: Number,
            default: 0,
        },
        marketingBureauCost: {
            type: Number,
            default: 0,
        },
        marketingToolingCost: {
            type: Number,
            default: 0, 
        },
        fixedExpenses: {
            type: Number,
            default: 0,
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