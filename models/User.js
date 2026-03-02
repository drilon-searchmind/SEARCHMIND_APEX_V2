import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    image: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    isExternal: {
        type: Boolean,
        default: false,
    },
    sharedCustomers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: [],
    }],
    favoritedCustomers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: [],
    }],
    slackId: {
        type: String,
        default: '',
    },
    clickupId: {
        type: String,
        default: '',
    },
    // Per-customer: { [customerId]: ["2026-01", "2026-02"], ... }
    openedWrappedPeriods: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
    },
});

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.models.User || mongoose.model('User', UserSchema);