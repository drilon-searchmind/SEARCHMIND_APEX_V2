import mongoose from 'mongoose';

const CustomerTrackingScanScoresSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true,
        },
        totalScore: {
            type: Number,
            default: 0,
        },
        performanceScore: {
            type: Number,
            default: 0,
        },
        trackingScore: {
            type: Number,
            default: 0,
        },
        complianceScore: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

CustomerTrackingScanScoresSchema.index({ customer: 1, createdAt: -1 });

export default mongoose.models.CustomerTrackingScanScores ||
    mongoose.model('CustomerTrackingScanScores', CustomerTrackingScanScoresSchema);
