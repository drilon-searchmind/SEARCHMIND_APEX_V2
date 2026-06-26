import mongoose from 'mongoose';

const SEOPartialKeywordGroupSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    keywords: [{ 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
    }],
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Customer", 
        required: true 
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
        default: false 
    }
});

SEOPartialKeywordGroupSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

SEOPartialKeywordGroupSchema.index({ customer: 1, name: 1 });

export default mongoose.models.SEOPartialKeywordGroup || mongoose.model('SEOPartialKeywordGroup', SEOPartialKeywordGroupSchema);