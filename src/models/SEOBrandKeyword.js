import mongoose from 'mongoose';

const SEOBrandKeywordSchema = new mongoose.Schema({
    keywords: [{ 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
    }],
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Customer", 
        required: true,
        unique: true // One brand keyword set per customer
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }, 
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
    isActive: {
        type: Boolean,
        default: false,
    },
});

SEOBrandKeywordSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

SEOBrandKeywordSchema.index({ customer: 1 });

export default mongoose.models.SEOBrandKeyword || mongoose.model('SEOBrandKeyword', SEOBrandKeywordSchema);