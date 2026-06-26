import mongoose from 'mongoose';

const SEOExactKeywordGroupSchema = new mongoose.Schema({
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

SEOExactKeywordGroupSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

SEOExactKeywordGroupSchema.index({ customer: 1, name: 1 });

export default mongoose.models.SEOExactKeywordGroup || mongoose.model('SEOExactKeywordGroup', SEOExactKeywordGroupSchema);