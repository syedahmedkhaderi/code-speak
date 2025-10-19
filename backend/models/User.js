// We are in models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        required: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    preferences: {
        fontSize: {
            type: Number,
            default: 16,
            min: 12,
            max: 24
        },
    highlightColor: {
        type: String,
        default: '#FFD700'
    },
    autoSaveSnippets: {
        type: Boolean,
        default: true
    },
    preferredLanguages: {
        type: [String],
        default: ['python', 'javascript']
    }
    },
    stats: {
        totalLectures: {
            type: Number,
            default: 0
        },
        totalSnippets: {
            type: Number,
            default: 0
        },
        accuracyFeedback: [{
            snippetId: mongoose.Schema.Types.ObjectId,
            wasAccurate: Boolean,
            date: {
                type: Date,
                default: Date.now
            }
        }]
    },
    role: {
        type: String,
        enum: ['user', 'instructor', 'admin'],
        default: 'user'
    },
        isVerified: {
        type: Boolean,
        default: false
        }
    }, {
        timestamps: true
    });
    
// Indexes for performance
userSchema.index({ email: 1 });
// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('passwordHash')) return next();

    try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
    } catch (error) {
    next(error);
    }
});
// Method to compare passwords
userSchema.methods.comparePassword = async function(password) {
    return bcrypt.compare(password, this.passwordHash);
};
module.exports = mongoose.model('User', userSchema);