// models/CodeSnippet.js
const mongoose = require('mongoose');
const codeSnippetSchema = new mongoose.Schema({
    lectureId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lecture',
        required: true
    },
    code: {
        type: String,
        required: true,
        maxlength: 10000
    },
    language: {
        type: String,
        enum: ['javascript', 'python', 'java', 'cpp', 'c', 'sql', 'other'],
        default: 'other'
    },
    timestamp: {
        type: Number, // seconds from lecture start
        required: true
    },
    originalTranscript: String, // What was said
    explanation: String, // Context around the code
    isCorrected: {
        type: Boolean,
        default: false
    },
    confidence: {
        type: Number, // 0-1 confidence from ML model
        default: 0,
        min: 0,
        max: 1
    }
}, {
    timestamps: true
});
// Indexes for performance
codeSnippetSchema.index({ lectureId: 1 });
codeSnippetSchema.index({ language: 1 });
codeSnippetSchema.index({ confidence: -1 });
module.exports = mongoose.model('CodeSnippet', codeSnippetSchema);