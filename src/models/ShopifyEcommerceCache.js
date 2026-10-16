import mongoose from 'mongoose';

const SalesFingerprintSchema = new mongoose.Schema(
    {
        startDate: { type: String, default: '' },
        endDate: { type: String, default: '' },
        totalSalesExVat: { type: Number, default: 0 },
        netSales: { type: Number, default: 0 },
        orders: { type: Number, default: 0 },
        netItemsSold: { type: Number, default: 0 },
    },
    { _id: false }
);

const ShopifyEcommerceCacheSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        cacheKey: { type: String, required: true },
        payload: { type: mongoose.Schema.Types.Mixed, required: true },
        salesFingerprint: { type: SalesFingerprintSchema, default: null },
        expiresAt: { type: Date, required: true },
    },
    { collection: 'shopify_ecommerce_cache', timestamps: true }
);

ShopifyEcommerceCacheSchema.index({ customerId: 1, cacheKey: 1 }, { unique: true });
ShopifyEcommerceCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ShopifyEcommerceCache ||
    mongoose.model('ShopifyEcommerceCache', ShopifyEcommerceCacheSchema);
