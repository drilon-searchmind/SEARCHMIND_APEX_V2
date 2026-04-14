import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['user', 'ai'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    // Metadata for AI responses
    tokensUsed: {
        type: Number,
        default: 0
    },
    model: {
        type: String,
        default: ''
    }
}, { _id: true });

const AiAnalysisChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        default: 'New Analysis Chat'
    },
    // Analysis period
    dateRange: {
        startDate: {
            type: String,
            required: true
        },
        endDate: {
            type: String,
            required: true
        }
    },
    // Comparison method used during analysis
    comparisonMethod: {
        type: String,
        enum: ['Last Period', 'Last Year'],
        default: 'Last Period'
    },
    // Data snapshot at time of analysis - flexible array structure
    dataSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Messages in the conversation
    messages: {
        type: [MessageSchema],
        default: []
    },
    // Tags for categorization
    tags: {
        type: [String],
        default: []
    },
    // Status of the chat
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
    },
    // Last message preview for chat list
    lastMessage: {
        type: String,
        default: ''
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // Total tokens used in this chat (for cost tracking)
    totalTokensUsed: {
        type: Number,
        default: 0
    },
    // AI model version used
    aiModelVersion: {
        type: String,
        default: 'gpt-4'
    },
    // Dashboard type this chat belongs to (e.g., 'performance-dashboard', 'daily-overview', 'seo-dashboard', etc.)
    dashboardType: {
        type: String,
        enum: ['performance-dashboard', 'daily-overview', 'seo-dashboard', 'ppc-dashboard', 'ps-dashboard', 'pinterest-dashboard', 'pace-report', 'pnl', 'ecommerce', 'analytics', 'parent-property', 'share-of-search', 'other'],
        default: 'other',
        index: true
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
AiAnalysisChatSchema.index({ userId: 1, createdAt: -1 });
AiAnalysisChatSchema.index({ customerId: 1, createdAt: -1 });
AiAnalysisChatSchema.index({ userId: 1, customerId: 1, status: 1 });
AiAnalysisChatSchema.index({ customerId: 1, dashboardType: 1, status: 1 });

// Pre-save middleware to update lastMessage and totalTokensUsed
AiAnalysisChatSchema.pre('save', function() {
    if (this.messages && this.messages.length > 0) {
        const lastMsg = this.messages[this.messages.length - 1];
        this.lastMessage = lastMsg.content.substring(0, 100); // First 100 chars
        
        // Calculate total tokens used
        this.totalTokensUsed = this.messages.reduce((sum, msg) => {
            return sum + (msg.tokensUsed || 0);
        }, 0);
    }
});

// Method to add a message to the chat
AiAnalysisChatSchema.methods.addMessage = function(type, content, metadata = {}) {
    const message = {
        type,
        content,
        timestamp: new Date(),
        tokensUsed: metadata.tokensUsed || 0,
        model: metadata.model || this.aiModelVersion
    };
    this.messages.push(message);
    this.updatedAt = new Date();
    return this.save();
};

// Static method to find chats by user
AiAnalysisChatSchema.statics.findByUser = function(userId, options = {}) {
    const query = { userId, status: options.status || 'active' };
    return this.find(query)
        .sort({ updatedAt: -1 })
        .limit(options.limit || 50);
};

// Static method to find chats by customer
AiAnalysisChatSchema.statics.findByCustomer = function(customerId, options = {}) {
    const query = { customerId, status: options.status || 'active' };
    return this.find(query)
        .sort({ updatedAt: -1 })
        .limit(options.limit || 50);
};

export default mongoose.models.AiAnalysisChat || mongoose.model('AiAnalysisChat', AiAnalysisChatSchema);
