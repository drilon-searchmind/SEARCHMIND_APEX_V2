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
    }
});

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);