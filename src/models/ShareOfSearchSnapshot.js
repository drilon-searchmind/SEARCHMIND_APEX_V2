import mongoose from 'mongoose';

const ShareOfSearchSnapshotSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true,
    },
    /** share | volume — which accordion flow triggered the save */
    view: {
        type: String,
        enum: ['share', 'volume'],
        default: 'share',
    },
    brands: {
        type: [String],
        default: [],
    },
    geoLabel: { type: String, default: '' },
    geoCriterionId: { type: Number, default: null },
    languageCode: { type: String, default: 'en' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    /** Normalized rows: brand, volumeInRange, sharePct, avgMonthlySearches, monthlySearchVolumes, apiKeywordText */
    rows: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },
    /** Small summary for history list */
    summary: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

ShareOfSearchSnapshotSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.models.ShareOfSearchSnapshot ||
    mongoose.model('ShareOfSearchSnapshot', ShareOfSearchSnapshotSchema);
