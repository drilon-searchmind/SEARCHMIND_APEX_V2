import mongoose from 'mongoose';

const DataWrappedReportSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    period: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}$/,
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

DataWrappedReportSchema.index({ customerId: 1, period: 1 }, { unique: true });

export default mongoose.models.DataWrappedReport || mongoose.model('DataWrappedReport', DataWrappedReportSchema);
