// We are in models/Lecture.js
const mongoose = require('mongoose');
const lectureSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    subject: {
        type: String,
        required: true,
        enum: ['Data Structures', 'Algorithms', 'Web Dev', 'Machine Learning', 'Other']
    },
    instructor: String,
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: Date,
    duration: Number, // in seconds
    transcription: [{
        timestamp: Number,
        text: String,
        isCode: Boolean,
        codeLanguage: String,
        confidence: Number
    }],
    codeSnippets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CodeSnippet'
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tags: [String],
    summary: String,
    isPublic: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
// Indexes for search and performance
lectureSchema.index({ title: 'text', tags: 'text' });
lectureSchema.index({ userId: 1, startTime: -1 });
lectureSchema.index({ userId: 1 });
lectureSchema.index({ createdAt: 1 });
module.exports = mongoose.model('Lecture', lectureSchema);