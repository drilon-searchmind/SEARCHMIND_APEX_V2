import mongoose from 'mongoose';

const ParentCustomerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        required: false,
        trim: true,
    },
    // Optionally, keep a list of child customer ObjectIds for fast lookup (not required for Mongoose population)
    customers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
});

// Automatically update updatedAt on save (no next)
ParentCustomerSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

export default mongoose.models.ParentCustomer || mongoose.model('ParentCustomer', ParentCustomerSchema);
