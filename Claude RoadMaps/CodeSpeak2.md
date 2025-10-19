**CodeSpeak - Missing Configuration & Utility Files**

````javascript
// ============================================================================
// FILE 1: backend/config/db.js - MongoDB Connection Configuration
// ============================================================================

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codespeak';
        
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('✗ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
    console.warn('⚠ MongoDB Disconnected');
});

mongoose.connection.on('error', (error) => {
    console.error('✗ MongoDB Error:', error);
});

module.exports = connectDB;


// ============================================================================
// FILE 2: backend/config/config.js - Environment Configuration
// ============================================================================

require('dotenv').config();

const config = {
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Database
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/codespeak',

    // Security
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: 10,

    // ML Service
    mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
    mlServiceTimeout: 5000,

    // Rate Limiting
    rateLimitWindowMs: 60000, // 1 minute
    rateLimitMaxRequests: 100,

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

    // File Upload
    maxFileSize: 10 * 1024 * 1024, // 10MB
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.warn(`⚠ Missing environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config;


// ============================================================================
// FILE 3: backend/middleware/errorHandler.js - Global Error Handler
// ============================================================================

const errorHandler = (err, req, res, next) => {
    // Log error
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const errors = Object.values(err.errors).map(e => e.message);
        message = `Validation Error: ${errors.join(', ')}`;
    }

    // Mongoose cast error
    if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists`;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Send response
    res.status(statusCode).json({
        error: message,
        statusCode: statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;


// ============================================================================
// FILE 4: backend/utils/codeDetector.js - ML API Helper
// ============================================================================

const axios = require('axios');
const config = require('../config/config');

class CodeDetectorClient {
    constructor() {
        this.baseURL = config.mlServiceUrl;
        this.timeout = config.mlServiceTimeout;
    }

    async detectCode(text) {
        try {
            if (!text || typeof text !== 'string') {
                return {
                    isCode: false,
                    confidence: 0,
                    language: 'other',
                    correctedText: text,
                    error: 'Invalid text input'
                };
            }

            const response = await axios.post(
                `${this.baseURL}/detect-code`,
                { text: text },
                { timeout: this.timeout }
            );

            return response.data;
        } catch (error) {
            console.warn('ML Service error:', error.message);
            
            // Fallback response
            return {
                isCode: false,
                confidence: 0,
                language: 'other',
                correctedText: text,
                error: 'ML service unavailable',
                fallback: true
            };
        }
    }

    async batchCorrect(snippets) {
        try {
            if (!Array.isArray(snippets)) {
                throw new Error('snippets must be an array');
            }

            if (snippets.length > 100) {
                throw new Error('Maximum 100 snippets per request');
            }

            const response = await axios.post(
                `${this.baseURL}/batch-correct`,
                { snippets: snippets },
                { timeout: this.timeout * 2 }
            );

            return response.data;
        } catch (error) {
            console.warn('Batch correction error:', error.message);
            return {
                results: [],
                count: 0,
                error: error.message
            };
        }
    }

    async getModelStats() {
        try {
            const response = await axios.get(
                `${this.baseURL}/model-stats`,
                { timeout: this.timeout }
            );

            return response.data;
        } catch (error) {
            console.warn('Model stats error:', error.message);
            return null;
        }
    }

    async checkHealth() {
        try {
            const response = await axios.get(
                `${this.baseURL}/health`,
                { timeout: this.timeout }
            );

            return response.data;
        } catch (error) {
            console.warn('ML Service health check failed:', error.message);
            return { status: 'unhealthy' };
        }
    }
}

const codeDetector = new CodeDetectorClient();

module.exports = codeDetector;


// ============================================================================
// FILE 5: backend/utils/textFormatter.js - Text Formatting Utilities
// ============================================================================

class TextFormatter {
    // Format timestamp to HH:MM:SS
    static formatTime(seconds) {
        if (typeof seconds !== 'number' || seconds < 0) {
            return '00:00:00';
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        return [hours, minutes, secs]
            .map(val => String(val).padStart(2, '0'))
            .join(':');
    }

    // Format duration from milliseconds
    static formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        return this.formatTime(totalSeconds);
    }

    // Truncate text with ellipsis
    static truncate(text, maxLength = 100) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    // Sanitize text for display
    static sanitize(text) {
        if (typeof text !== 'string') {
            return '';
        }

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Escape special characters
    static escape(text) {
        return this.sanitize(text);
    }

    // Format code with line numbers
    static formatCodeWithLineNumbers(code) {
        const lines = code.split('\n');
        return lines
            .map((line, index) => `${String(index + 1).padStart(3, ' ')} | ${line}`)
            .join('\n');
    }

    // Extract code language comment
    static extractLanguageHint(text) {
        const languageMatch = text.match(/```(\w+)\n/);
        return languageMatch ? languageMatch[1] : null;
    }

    // Format for JSON serialization
    static toJSON(obj, indent = 2) {
        try {
            return JSON.stringify(obj, null, indent);
        } catch (error) {
            console.error('JSON serialization error:', error);
            return '{}';
        }
    }

    // Parse highlighted code back to plain text
    static stripHighlighting(html) {
        return html
            .replace(/<span[^>]*>/g, '')
            .replace(/<\/span>/g, '');
    }

    // Format for clipboard
    static formatForClipboard(code) {
        return code.trim();
    }

    // Check if text is likely code
    static isLikelyCode(text) {
        const codePatterns = [
            /\{[\s\S]*\}/,           // Braces
            /\([\s\S]*\)/,           // Parentheses
            /\[[\s\S]*\]/,           // Brackets
            /;$/m,                    // Semicolon at end
            /^(def|class|function|if|for|while|return|import)\b/m,  // Keywords
            /=>|:=|==|!=|<=|>=|&&|\|\|/  // Operators
        ];

        return codePatterns.some(pattern => pattern.test(text));
    }

    // Normalize whitespace
    static normalizeWhitespace(text) {
        return text
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Split text into sentences
    static splitIntoSentences(text) {
        return text.match(/[^.!?]+[.!?]+/g) || [text];
    }

    // Convert camelCase to snake_case
    static camelToSnake(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    // Convert snake_case to camelCase
    static snakeToCamel(str) {
        return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    }

    // Format variable name according to convention
    static formatVariableName(name, convention = 'camel') {
        const cleaned = name.replace(/\s+/g, '_').toLowerCase();
        return convention === 'snake' ? cleaned : this.snakeToCamel(cleaned);
    }
}

module.exports = TextFormatter;


// ============================================================================
// FILE 6: frontend/public/js/transcription.js - Real-time Transcription Display
// ============================================================================

class TranscriptionDisplay {
    constructor(containerId = 'transcription-container') {
        this.container = document.getElementById(containerId);
        this.entries = [];
        this.codeSnippets = [];
        this.currentLectureId = null;
    }

    setLectureId(lectureId) {
        this.currentLectureId = lectureId;
    }

    addEntry(data, timestamp) {
        const entry = {
            id: `entry-${Date.now()}`,
            timestamp: timestamp,
            text: data.correctedText,
            isCode: data.isCode,
            language: data.language,
            confidence: data.confidence,
            original: data.originalText,
            created: new Date()
        };

        this.entries.push(entry);

        if (data.isCode && data.confidence > 0.7) {
            this.codeSnippets.push({
                id: entry.id,
                code: data.correctedText,
                language: data.language,
                timestamp: timestamp,
                confidence: data.confidence
            });
        }

        this.renderEntry(entry);
        return entry;
    }

    renderEntry(entry) {
        if (!this.container) return;

        const entryElement = document.createElement('div');
        entryElement.className = `transcript-entry ${entry.isCode ? 'code' : 'text'}`;
        entryElement.id = entry.id;
        entryElement.dataset.timestamp = entry.timestamp;

        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = this.formatTime(entry.timestamp);

        const content = document.createElement('span');
        content.className = 'content';

        if (entry.isCode) {
            const codeElement = document.createElement('code');
            codeElement.className = `language-${entry.language}`;
            codeElement.innerHTML = this.highlightCode(entry.text, entry.language);
            content.appendChild(codeElement);

            // Add copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '📋 Copy';
            copyBtn.onclick = () => this.copyCode(entry.text);
            content.appendChild(copyBtn);

            // Add confidence indicator
            if (entry.confidence) {
                const confidence = document.createElement('span');
                confidence.className = 'confidence-badge';
                confidence.textContent = `${Math.round(entry.confidence * 100)}%`;
                confidence.style.opacity = entry.confidence;
                content.appendChild(confidence);
            }
        } else {
            content.textContent = entry.text;
        }

        entryElement.appendChild(timestamp);
        entryElement.appendChild(content);
        this.container.appendChild(entryElement);

        // Scroll to bottom
        this.container.scrollTop = this.container.scrollHeight;
    }

    highlightCode(code, language = 'javascript') {
        const keywords = {
            python: ['def', 'class', 'if', 'else', 'for', 'while', 'return', 'import', 'from', 'try', 'except'],
            javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'return', 'async', 'await'],
            java: ['public', 'private', 'class', 'void', 'int', 'return', 'if', 'else', 'new'],
            cpp: ['int', 'void', 'class', 'for', 'while', 'if', 'return', 'new', 'delete'],
            sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE']
        };

        let highlighted = this.escapeHtml(code);
        const langKeywords = keywords[language] || [];

        // Highlight keywords
        langKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
        });

        // Highlight strings
        highlighted = highlighted.replace(/"([^"]*)"/g, '<span class="string">"$1"</span>');
        highlighted = highlighted.replace(/'([^']*)'/g, "<span class=\"string\">'$1'</span>");

        // Highlight numbers
        highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="number">$1</span>');

        // Highlight comments
        highlighted = highlighted.replace(/\/\/(.*)$/gm, '<span class="comment">//$1</span>');
        highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, (match) => `<span class="comment">${match}</span>`);

        return highlighted;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            this.showNotification('Code copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            this.showNotification('Failed to copy code', 'error');
        });
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getCodeSnippets() {
        return this.codeSnippets;
    }

    getAllEntries() {
        return this.entries;
    }

    clearAll() {
        this.entries = [];
        this.codeSnippets = [];
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    exportAsJSON() {
        return {
            lectureId: this.currentLectureId,
            entries: this.entries,
            codeSnippets: this.codeSnippets,
            exportedAt: new Date().toISOString()
        };
    }

    searchEntries(query) {
        const q = query.toLowerCase();
        return this.entries.filter(entry =>
            entry.text.toLowerCase().includes(q) ||
            entry.original.toLowerCase().includes(q)
        );
    }

    filterByLanguage(language) {
        return this.entries.filter(entry =>
            entry.isCode && entry.language === language
        );
    }

    getStatistics() {
        return {
            totalEntries: this.entries.length,
            totalCode: this.codeSnippets.length,
            totalText: this.entries.length - this.codeSnippets.length,
            languages: [...new Set(this.codeSnippets.map(s => s.language))],
            avgConfidence: this.codeSnippets.length > 0
                ? this.codeSnippets.reduce((sum, s) => sum + s.confidence, 0) / this.codeSnippets.length
                : 0
        };
    }
}

// Initialize on page load
let transcriptionDisplay;
document.addEventListener('DOMContentLoaded', () => {
    transcriptionDisplay = new TranscriptionDisplay();
});


// ============================================================================
// FILE 7: frontend/public/js/codeHighlight.js - Enhanced Syntax Highlighting
// ============================================================================

class CodeHighlighter {
    static init() {
        // Load Prism.js if available
        if (typeof Prism !== 'undefined') {
            Prism.highlightAll();
        }
    }

    static highlight(code, language = 'javascript') {
        if (typeof Prism !== 'undefined') {
            return Prism.highlight(code, Prism.languages[language], language);
        }
        return this.manualHighlight(code, language);
    }

    static manualHighlight(code, language = 'javascript') {
        const rules = this.getHighlightRules(language);
        let highlighted = this.escapeHtml(code);

        Object.entries(rules).forEach(([className, patterns]) => {
            patterns.forEach(pattern => {
                const regex = typeof pattern === 'string'
                    ? new RegExp(`\\b${pattern}\\b`, 'g')
                    : pattern;
                highlighted = highlighted.replace(regex, 
                    match => `<span class="hljs-${className}">${match}</span>`
                );
            });
        });

        return highlighted;
    }

    static getHighlightRules(language) {
        const rules = {
            keyword: {
                python: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'try', 'except', 'finally', 'with', 'as', 'lambda', 'yield', 'pass', 'break', 'continue', 'raise', 'assert'],
                javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do', 'return', 'new', 'this', 'class', 'extends', 'async', 'await', 'try', 'catch', 'finally', 'throw'],
                java: ['public', 'private', 'protected', 'static', 'final', 'class', 'interface', 'extends', 'implements', 'new', 'this', 'super', 'void', 'int', 'boolean', 'String', 'return', 'if', 'else', 'for', 'while'],
                cpp: ['int', 'void', 'char', 'float', 'double', 'bool', 'class', 'struct', 'if', 'else', 'for', 'while', 'return', 'new', 'delete', 'public', 'private', 'protected'],
                sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'JOIN', 'ON', 'AND', 'OR', 'GROUP', 'ORDER', 'BY', 'LIMIT']
            }
        };

        return rules.keyword[language] ? { keyword: rules.keyword[language] } : {};
    }

    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    static createCodeBlock(code, language = 'javascript') {
        const container = document.createElement('div');
        container.className = 'code-block';

        const pre = document.createElement('pre');
        const code_elem = document.createElement('code');
        code_elem.className = `language-${language}`;
        code_elem.innerHTML = this.highlight(code, language);

        pre.appendChild(code_elem);
        container.appendChild(pre);

        return container;
    }

    static addLineNumbers(code) {
        const lines = code.split('\n');
        const numbered = lines
            .map((line, i) => `<span class="line-number">${i + 1}</span>${line}`)
            .join('\n');
        return numbered;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    CodeHighlighter.init();
});
````

````plaintext
Thought process: Synthesized missing backend utilities and frontend modules comprehensively.

The user asked me to create all the missing sub-files that are referenced in the CodeSpeak.md but not fully provided. I've created a comprehensive artifact containing:

1. backend/config/db.js - MongoDB connection with connection pooling and error handling
2. backend/config/config.js - Environment configuration management with validation
3. backend/middleware/errorHandler.js - Global error handler for Express
4. backend/utils/codeDetector.js - ML API client with fallback error handling
5. backend/utils/textFormatter.js - Text formatting and utility functions
6. frontend/public/js/transcription.js - Real-time transcription display class
7. frontend/public/js/codeHighlight.js - Code syntax highlighting utilities

All with 4-space indentation as requested and consistent with the existing code style shown in the document. Now I need to create the EJS template files for the frontend views in a follow-up response since they're also missing but important.

Let me provide a brief summary and then offer to create the EJS templates.
````

Now let me create the missing **EJS template files** for the frontend:

**CodeSpeak - EJS Frontend Templates** 

````html
<!-- ================================================================
FILE 1: frontend/partials/header.ejs - Header Navigation Partial
================================================================ -->

<header>
    <div class="header-content">
        <div class="logo">
            <h1>📝 CodeSpeak</h1>
            <p class="tagline">Accessible Code Transcription</p>
        </div>
        
        <nav class="nav">
            <% if (typeof user !== 'undefined' && user) { %>
                <a href="/live" class="nav-link">Live Lecture</a>
                <a href="/archive" class="nav-link">Archive</a>
                <span class="user-info">
                    <span class="username"><%= user.name %></span>
                    <form action="/api/auth/logout" method="POST" style="display: inline;">
                        <button type="submit" class="logout-btn">Logout</button>
                    </form>
                </span>
            <% } else { %>
                <a href="/login" class="nav-link">Login</a>
                <a href="/register" class="nav-link">Register</a>
            <% } %>
        </nav>
    </div>
</header>


<!-- ================================================================
FILE 2: frontend/partials/footer.ejs - Footer Partial
================================================================ -->

<footer>
    <div class="footer-content">
        <div class="footer-section">
            <h4>About CodeSpeak</h4>
            <p>Making computer science education accessible to deaf and hard-of-hearing students through intelligent code transcription.</p>
        </div>
        
        <div class="footer-section">
            <h4>Resources</h4>
            <ul>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">GitHub</a></li>
                <li><a href="#">Support</a></li>
            </ul>
        </div>
        
        <div class="footer-section">
            <h4>Contact</h4>
            <p>Email: support@codespeak.app</p>
            <p>Twitter: @CodeSpeakApp</p>
        </div>
        
        <div class="footer-section">
            <h4>Accessibility</h4>
            <p>WCAG 2.1 AA Compliant</p>
            <p>Built with accessibility first</p>
        </div>
    </div>
    
    <div class="footer-bottom">
        <p>&copy; 2024 CodeSpeak. Made with ❤️ for accessibility.</p>
    </div>
</footer>


<!-- ================================================================
FILE 3: frontend/views/index.ejs - Landing Page
================================================================ -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeSpeak - Accessible Code Transcription</title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .hero {
            background: linear-gradient(135deg, #4A90E2 0%, #50E3C2 100%);
            color: white;
            padding: 60px 20px;
            text-align: center;
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .hero h1 {
            font-size: 3.5rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .hero p {
            font-size: 1.3rem;
            margin-bottom: 30px;
            max-width: 600px;
        }

        .cta-buttons {
            display: flex;
            gap: 20px;
            justify-content: center;
            margin-top: 30px;
            flex-wrap: wrap;
        }

        .cta-btn {
            padding: 15px 40px;
            font-size: 1.1rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: bold;
        }

        .cta-btn.primary {
            background: white;
            color: #4A90E2;
        }

        .cta-btn.primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }

        .cta-btn.secondary {
            background: transparent;
            color: white;
            border: 2px solid white;
        }

        .cta-btn.secondary:hover {
            background: white;
            color: #4A90E2;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            padding: 60px 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .feature-card {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s;
        }

        .feature-card:hover {
            transform: translateY(-5px);
        }

        .feature-icon {
            font-size: 3rem;
            margin-bottom: 15px;
        }

        .feature-card h3 {
            color: #4A90E2;
            margin-bottom: 10px;
        }

        .stats {
            background: #F5F5F5;
            padding: 60px 20px;
            text-align: center;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 30px;
            max-width: 1000px;
            margin: 0 auto;
        }

        .stat-item h2 {
            font-size: 2.5rem;
            color: #4A90E2;
            margin-bottom: 10px;
        }

        .stat-item p {
            color: #666;
            font-size: 1.1rem;
        }
    </style>
</head>
<body>
    <%- include('partials/header') %>

    <main>
        <section class="hero">
            <h1>📝 CodeSpeak</h1>
            <p>Real-time code transcription for accessible CS education</p>
            <p>Making computer science education truly accessible to deaf and hard-of-hearing students</p>
            <div class="cta-buttons">
                <a href="/register" class="cta-btn primary">Get Started</a>
                <a href="#features" class="cta-btn secondary">Learn More</a>
            </div>
        </section>

        <section class="stats">
            <h2>Our Impact</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <h2>87%</h2>
                    <p>Code Detection Accuracy</p>
                </div>
                <div class="stat-item">
                    <h2>&lt;200ms</h2>
                    <p>Processing Latency</p>
                </div>
                <div class="stat-item">
                    <h2>5</h2>
                    <p>Languages Supported</p>
                </div>
                <div class="stat-item">
                    <h2>∞</h2>
                    <p>Students Empowered</p>
                </div>
            </div>
        </section>

        <section class="features" id="features">
            <div class="feature-card">
                <div class="feature-icon">🎯</div>
                <h3>Real-Time Detection</h3>
                <p>Intelligent ML model identifies code within natural speech with 87% accuracy</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">✨</div>
                <h3>Smart Correction</h3>
                <p>Automatically fixes transcription errors specific to programming syntax</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🗂️</div>
                <h3>Code Library</h3>
                <p>Organized, searchable archive of all code snippets from lectures</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>Lightning Fast</h3>
                <p>Sub-200ms latency for real-time transcription display</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🎨</div>
                <h3>Syntax Highlighting</h3>
                <p>Beautiful code formatting with language-specific highlighting</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">♿</div>
                <h3>Fully Accessible</h3>
                <p>WCAG 2.1 AA compliant, keyboard navigation, screen reader support</p>
            </div>
        </section>
    </main>

    <%- include('partials/footer') %>
</body>
</html>


<!-- ================================================================
FILE 4: frontend/views/register.ejs - Registration Page
================================================================ -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - CodeSpeak</title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .auth-container {
            max-width: 500px;
            margin: 50px auto;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .auth-container h2 {
            text-align: center;
            color: #4A90E2;
            margin-bottom: 30px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
        }

        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #4A90E2;
            box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
        }

        .error-message {
            color: #E74C3C;
            font-size: 0.9rem;
            margin-top: 5px;
            display: none;
        }

        .submit-btn {
            width: 100%;
            padding: 12px;
            background: #4A90E2;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
            margin-top: 20px;
        }

        .submit-btn:hover {
            background: #3A7BC8;
        }

        .submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .auth-link {
            text-align: center;
            margin-top: 20px;
        }

        .auth-link p {
            margin: 0;
        }

        .auth-link a {
            color: #4A90E2;
            text-decoration: none;
            font-weight: 600;
        }

        .auth-link a:hover {
            text-decoration: underline;
        }

        .password-requirements {
            background: #F5F5F5;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 0.9rem;
        }

        .password-requirements h4 {
            margin: 0 0 10px 0;
            color: #333;
        }

        .password-requirements ul {
            margin: 0;
            padding-left: 20px;
        }

        .password-requirements li {
            margin: 5px 0;
        }

        .requirement {
            color: #999;
        }

        .requirement.met {
            color: #27AE60;
        }
    </style>
</head>
<body>
    <%- include('partials/header') %>

    <main>
        <div class="auth-container">
            <h2>Create Account</h2>

            <% if (typeof error !== 'undefined' && error) { %>
                <div class="alert alert-danger"><%= error %></div>
            <% } %>

            <form id="registerForm" method="POST" action="/api/auth/register">
                <div class="form-group">
                    <label for="name">Full Name</label>
                    <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        required 
                        placeholder="John Doe"
                        autocomplete="name"
                    >
                    <div class="error-message" id="nameError"></div>
                </div>

                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        required 
                        placeholder="john@example.com"
                        autocomplete="email"
                    >
                    <div class="error-message" id="emailError"></div>
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        required 
                        placeholder="At least 8 characters"
                        autocomplete="new-password"
                    >
                    <div class="error-message" id="passwordError"></div>
                    <div class="password-requirements">
                        <h4>Password Requirements:</h4>
                        <ul>
                            <li class="requirement" id="lengthReq">At least 8 characters</li>
                            <li class="requirement" id="uppercaseReq">One uppercase letter</li>
                            <li class="requirement" id="numberReq">One number</li>
                        </ul>
                    </div>
                </div>

                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        name="confirmPassword" 
                        required 
                        placeholder="Confirm your password"
                        autocomplete="new-password"
                    >
                    <div class="error-message" id="confirmError"></div>
                </div>

                <button type="submit" class="submit-btn">Create Account</button>
            </form>

            <div class="auth-link">
                <p>Already have an account? <a href="/login">Login here</a></p>
            </div>
        </div>
    </main>

    <%- include('partials/footer') %>

    <script>
        const registerForm = document.getElementById('registerForm');
        const passwordInput = document.getElementById('password');

        // Password validation
        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            
            document.getElementById('lengthReq').classList.toggle(
                'met', 
                password.length >= 8
            );
            document.getElementById('uppercaseReq').classList.toggle(
                'met', 
                /[A-Z]/.test(password)
            );
            document.getElementById('numberReq').classList.toggle(
                'met', 
                /\d/.test(password)
            );
        });

        // Form submission
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData);

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Registration failed');
                }

                // Save token and redirect
                sessionStorage.setItem('authToken', result.token);
                sessionStorage.setItem('user', JSON.stringify(result.user));
                window.location.href = '/live';

            } catch (error) {
                document.getElementById('nameError').textContent = error.message;
                document.getElementById('nameError').style.display = 'block';
            }
        });
    </script>
</body>
</html>


<!-- ================================================================
FILE 5: frontend/views/login.ejs - Login Page
================================================================ -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - CodeSpeak</title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .auth-container {
            max-width: 400px;
            margin: 100px auto;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .auth-container h2 {
            text-align: center;
            color: #4A90E2;
            margin-bottom: 30px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
        }

        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #4A90E2;
            box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
        }

        .error-message {
            color: #E74C3C;
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            background: #FFEBEE;
            border-radius: 6px;
            display: none;
        }

        .submit-btn {
            width: 100%;
            padding: 12px;
            background: #4A90E2;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
            margin-top: 20px;
        }

        .submit-btn:hover {
            background: #3A7BC8;
        }

        .submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .auth-link {
            text-align: center;
            margin-top: 20px;
        }

        .auth-link a {
            color: #4A90E2;
            text-decoration: none;
            font-weight: 600;
        }

        .auth-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <%- include('partials/header') %>

    <main>
        <div class="auth-container">
            <h2>Login</h2>

            <div class="error-message" id="errorMsg"></div>

            <form id="loginForm" method="POST" action="/api/auth/login">
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        required 
                        placeholder="your@email.com"
                        autocomplete="email"
                    >
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        required 
                        placeholder="Enter your password"
                        autocomplete="current-password"
                    >
                </div>

                <button type="submit" class="submit-btn">Login</button>
            </form>

            <div class="auth-link">
                <p>Don't have an account? <a href="/register">Register here</a></p>
            </div>
        </div>
    </main>

    <%- include('partials/footer') %>

    <script>
        const loginForm = document.getElementById('loginForm');
        const errorMsg = document.getElementById('errorMsg');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData);

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Login failed');
                }

                // Save token and redirect
                sessionStorage.setItem('authToken', result.token);
                sessionStorage.setItem('user', JSON.stringify(result.user));
                window.location.href = '/live';

            } catch (error) {
                errorMsg.textContent = error.message;
                errorMsg.style.display = 'block';
            }
        });
    </script>
</body>
</html>


<!-- ================================================================
FILE 6: frontend/views/live.ejs - Live Transcription Page
================================================================ -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Lecture - CodeSpeak</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="protected">
    <%- include('partials/header') %>

    <main class="container">
        <div class="main-panel">
            <section class="lecture-setup">
                <h2>Start Lecture Recording</h2>
                
                <div id="error-message" class="alert alert-danger"></div>
                <div id="success-message" class="alert alert-success"></div>

                <div class="form-group">
                    <label for="lecture-title">Lecture Title *</label>
                    <input 
                        type="text" 
                        id="lecture-title" 
                        placeholder="e.g., Data Structures - Arrays"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="lecture-subject">Subject *</label>
                    <select id="lecture-subject" required>
                        <option value="">Select a subject</option>
                        <option value="Data Structures">Data Structures</option>
                        <option value="Algorithms">Algorithms</option>
                        <option value="Web Dev">Web Development</option>
                        <option value="Machine Learning">Machine Learning</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div class="controls">
                    <button id="start-btn" class="btn btn-primary">🎙️ Start Recording</button>
                    <button id="stop-btn" class="btn btn-danger" disabled>⏹️ Stop Recording</button>
                </div>
            </section>

            <section class="transcription-panel">
                <div class="panel-header">
                    <h3>Live Transcription</h3>
                    <div class="stats">
                        <span>📝 <span id="text-count">0</span> entries</span>
                        <span>💻 <span id="snippet-count">0</span> code snippets</span>
                    </div>
                </div>

                <div id="interim-transcript" class="interim-transcript"></div>
                <div id="transcription-container" class="transcript-container"></div>
            </section>
        </div>

        <aside class="side-panel">
            <h4>Code Snippets</h4>
            <div id="snippets-list" class="snippets-list"></div>
            <button id="export-btn" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                📥 Export Snippets
            </button>
        </aside>
    </main>

    <%- include('partials/footer') %>

    <script src="/js/auth.js"></script>
    <script src="/js/recorder.js"></script>
    <script src="/js/transcription.js"></script>
    <script src="/js/codeHighlight.js"></script>

    <script>
        let currentLectureId = null;

        document.getElementById('start-btn').addEventListener('click', async () => {
            const title = document.getElementById('lecture-title').value;
            const subject = document.getElementById('lecture-subject').value;

            if (!title || !subject) {
                showError('Please enter lecture title and subject');
                return;
            }

            try {
                const response = await fetch('/api/lectures/start', {
                    method: 'POST',
                    headers: authManager.getAuthHeader(),
                    body: JSON.stringify({ title, subject })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error);
                }

                currentLectureId = data.lectureId;
                transcriptionDisplay.setLectureId(currentLectureId);

                await recorder.startRecording(currentLectureId);
                document.getElementById('start-btn').disabled = true;
                document.getElementById('stop-btn').disabled = false;

                showSuccess('Lecture recording started');
            } catch (error) {
                showError(error.message);
            }
        });

        document.getElementById('stop-btn').addEventListener('click', async () => {
            recorder.stopRecording();
            document.getElementById('start-btn').disabled = false;
            document.getElementById('stop-btn').disabled = true;

            // End lecture on backend
            try {
                const response = await fetch(`/api/lectures/end/${currentLectureId}`, {
                    method: 'POST',
                    headers: authManager.getAuthHeader()
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error);
                }

                showSuccess('Lecture recording ended and saved');
            } catch (error) {
                showError(error.message);
            }
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            const snippets = transcriptionDisplay.getCodeSnippets();
            const data = {
                lectureId: currentLectureId,
                snippets: snippets,
                exportedAt: new Date().toISOString()
            };

            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `codesnippets-${Date.now()}.json`;
            a.click();

            showSuccess('Snippets exported successfully');
        });

        function showError(message) {
            const errorDiv = document.getElementById('error-message');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
        }

        function showSuccess(message) {
            const successDiv = document.getElementById('success-message');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
        }

        // Update stats
        setInterval(() => {
            const stats = transcriptionDisplay.getStatistics();
            document.getElementById('text-count').textContent = stats.totalEntries;
            document.getElementById('snippet-count').textContent = stats.totalCode;
        }, 1000);
    </script>
</body>
</html>


<!-- ================================================================
FILE 7: frontend/views/archive.ejs - Lecture Archive Page
================================================================ -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lecture Archive - CodeSpeak</title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .archive-header {
            background: linear-gradient(135deg, #4A90E2 0%, #50E3C2 100%);
            color: white;
            padding: 40px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .search-bar {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
        }

        .search-bar input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
        }

        .search-bar button {
            padding: 12px 30px;
            background: #4A90E2;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }

        .lecture-list {
            display: grid;
            gap: 15px;
        }

        .lecture-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.3s;
        }

        .lecture-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }

        .lecture-info h3 {
            margin: 0 0 5px 0;
            color: #4A90E2;
        }

        .lecture-meta {
            color: #666;
            font-size: 0.9rem;
            display: flex;
            gap: 15px;
        }

        .lecture-actions {
            display: flex;
            gap: 10px;
        }

        .action-btn {
            padding: 8px 15px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s;
        }

        .action-btn.view {
            background: #4A90E2;
            color: white;
        }

        .action-btn.view:hover {
            background: #3A7BC8;
        }

        .action-btn.delete {
            background: #E74C3C;
            color: white;
        }

        .action-btn.delete:hover {
            background: #C0392B;
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }

        .empty-state h3 {
            color: #4A90E2;
        }

        .pagination {
            display: flex;
            justify-content: center;
            gap: 5px;
            margin-top: 30px;
        }

        .pagination button {
            padding: 8px 12px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.3s;
        }

        .pagination button:hover {
            background: #4A90E2;
            color: white;
        }

        .pagination button.active {
            background: #4A90E2;
            color: white;
        }
    </style>
</head>
<body class="protected">
    <%- include('partials/header') %>

    <main class="container" style="grid-template-columns: 1fr;">
        <div class="archive-header">
            <h2>📚 Lecture Archive</h2>
            <p>View and search all your recorded lectures</p>
        </div>

        <div class="search-bar">
            <input 
                type="text" 
                id="search-input" 
                placeholder="Search lectures by title, subject, or keywords..."
            >
            <button id="search-btn">🔍 Search</button>
        </div>

        <div id="loading" style="text-align: center; display: none;">
            <div class="spinner"></div>
            <p>Loading lectures...</p>
        </div>

        <div id="lecture-list" class="lecture-list"></div>

        <div id="empty-state" class="empty-state" style="display: none;">
            <h3>No lectures yet</h3>
            <p>Start recording a lecture to see it in your archive</p>
            <a href="/live" class="btn btn-primary" style="margin-top: 20px;">Start Recording</a>
        </div>

        <div id="pagination" class="pagination"></div>
    </main>

    <%- include('partials/footer') %>

    <script src="/js/auth.js"></script>
    <script>
        let currentPage = 1;
        const lecturesPerPage = 10;

        async function loadLectures(page = 1, search = '') {
            document.getElementById('loading').style.display = 'block';

            try {
                let url = `/api/lectures/history?page=${page}&limit=${lecturesPerPage}`;
                
                if (search) {
                    url = `/api/lectures/search?q=${encodeURIComponent(search)}`;
                }

                const response = await fetch(url, {
                    headers: authManager.getAuthHeader()
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error);
                }

                renderLectures(data.lectures);
                if (data.pagination) {
                    renderPagination(data.pagination);
                }

                if (data.lectures.length === 0) {
                    document.getElementById('empty-state').style.display = 'block';
                } else {
                    document.getElementById('empty-state').style.display = 'none';
                }

            } catch (error) {
                console.error('Error loading lectures:', error);
                document.getElementById('empty-state').style.display = 'block';
            } finally {
                document.getElementById('loading').style.display = 'none';
            }
        }

        function renderLectures(lectures) {
            const container = document.getElementById('lecture-list');
            container.innerHTML = '';

            lectures.forEach(lecture => {
                const card = document.createElement('div');
                card.className = 'lecture-card';

                const duration = lecture.duration ? formatDuration(lecture.duration) : 'N/A';
                const date = new Date(lecture.startTime).toLocaleDateString();

                card.innerHTML = `
                    <div class="lecture-info">
                        <h3>${lecture.title}</h3>
                        <div class="lecture-meta">
                            <span>📚 ${lecture.subject}</span>
                            <span>⏱️ ${duration}</span>
                            <span>📅 ${date}</span>
                        </div>
                    </div>
                    <div class="lecture-actions">
                        <button class="action-btn view" onclick="viewLecture('${lecture._id}')">View</button>
                        <button class="action-btn delete" onclick="deleteLecture('${lecture._id}')">Delete</button>
                    </div>
                `;

                container.appendChild(card);
            });
        }

        function renderPagination(pagination) {
            const container = document.getElementById('pagination');
            container.innerHTML = '';

            for (let i = 1; i <= pagination.pages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = i === pagination.page ? 'active' : '';
                btn.onclick = () => {
                    currentPage = i;
                    loadLectures(i);
                };
                container.appendChild(btn);
            }
        }

        function formatDuration(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;

            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            }
            return `${minutes}m ${secs}s`;
        }

        async function viewLecture(lectureId) {
            window.location.href = `/lecture/${lectureId}`;
        }

        async function deleteLecture(lectureId) {
            if (!confirm('Are you sure you want to delete this lecture?')) return;

            try {
                const response = await fetch(`/api/lectures/${lectureId}`, {
                    method: 'DELETE',
                    headers: authManager.getAuthHeader()
                });

                if (!response.ok) {
                    throw new Error('Failed to delete lecture');
                }

                loadLectures(currentPage);
            } catch (error) {
                console.error('Error deleting lecture:', error);
                alert('Failed to delete lecture');
            }
        }

        document.getElementById('search-btn').addEventListener('click', () => {
            const query = document.getElementById('search-input').value;
            loadLectures(1, query);
        });

        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('search-btn').click();
            }
        });

        // Load lectures on page load
        loadLectures();
    </script>
</body>
</html>


<!-- ================================================================
FILE 8: frontend/views/snippet.ejs - Code Snippet Viewer Page
================================================================ -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Snippet - CodeSpeak</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css">
    <style>
        .snippet-viewer {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            padding: 30px;
            max-width: 900px;
            margin: 30px auto;
        }

        .snippet-header {
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }

        .snippet-header h2 {
            margin: 0 0 10px 0;
            color: #4A90E2;
        }

        .snippet-meta {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 0.9rem;
            color: #666;
        }

        .snippet-code {
            background: #2D2D2D;
            border-radius: 6px;
            padding: 20px;
            overflow-x: auto;
            margin-bottom: 20px;
        }

        .snippet-code code {
            color: #F8F8F2;
            font-family: 'Fira Code', monospace;
            font-size: 1rem;
            line-height: 1.5;
        }

        .snippet-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        .snippet-actions button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.95rem;
            transition: all 0.3s;
        }

        .btn-copy {
            background: #50E3C2;
            color: white;
        }

        .btn-copy:hover {
            background: #3DD9B5;
        }

        .btn-back {
            background: #4A90E2;
            color: white;
        }

        .btn-back:hover {
            background: #3A7BC8;
        }

        .snippet-explanation {
            background: #F5F5F5;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .snippet-explanation h3 {
            margin-top: 0;
            color: #333;
        }

        .snippet-explanation p {
            margin: 0;
            color: #666;
            line-height: 1.6;
        }

        .confidence-badge {
            display: inline-block;
            background: #50E3C2;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            margin-left: 10px;
        }
    </style>
</head>
<body class="protected">
    <%- include('partials/header') %>

    <main>
        <div class="snippet-viewer">
            <div class="snippet-header">
                <h2>Code Snippet</h2>
                <div class="snippet-meta">
                    <span>💻 Language: <strong id="language">JavaScript</strong></span>
                    <span>📚 Lecture: <strong id="lecture-title">Unknown</strong></span>
                    <span>⏱️ Time: <strong id="timestamp">00:00</strong></span>
                    <span id="confidence-meta"></span>
                </div>
            </div>

            <div class="snippet-actions">
                <button class="snippet-actions button btn-copy" onclick="copySnippet()">📋 Copy Code</button>
                <button class="snippet-actions button btn-back" onclick="goBack()">← Back to Archive</button>
            </div>

            <div class="snippet-code">
                <code id="code-content"></code>
            </div>

            <div class="snippet-explanation" id="explanation-section" style="display: none;">
                <h3>Context</h3>
                <p id="explanation-text"></p>
            </div>

            <div style="background: #F0F0F0; padding: 15px; border-radius: 6px; font-size: 0.9rem; color: #666;">
                <strong>Original Transcription:</strong>
                <p id="original-text" style="margin: 10px 0 0 0; font-family: monospace;"></p>
            </div>
        </div>
    </main>

    <%- include('partials/footer') %>

    <script src="/js/auth.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
    <script>
        async function loadSnippet() {
            const snippetId = new URLSearchParams(window.location.search).get('id');
            
            if (!snippetId) {
                alert('Snippet ID not found');
                window.location.href = '/archive';
                return;
            }

            try {
                const response = await fetch(`/api/snippets/${snippetId}`, {
                    headers: authManager.getAuthHeader()
                });

                if (!response.ok) {
                    throw new Error('Failed to load snippet');
                }

                const snippet = await response.json();

                document.getElementById('language').textContent = snippet.language || 'Unknown';
                document.getElementById('lecture-title').textContent = snippet.lectureTitle || 'Unknown';
                document.getElementById('timestamp').textContent = formatTime(snippet.timestamp);
                document.getElementById('code-content').textContent = snippet.code;
                document.getElementById('original-text').textContent = snippet.originalTranscript;

                if (snippet.explanation) {
                    document.getElementById('explanation-section').style.display = 'block';
                    document.getElementById('explanation-text').textContent = snippet.explanation;
                }

                if (snippet.confidence) {
                    const confidenceMeta = document.getElementById('confidence-meta');
                    confidenceMeta.innerHTML = `<span>✅ Confidence: <strong>${Math.round(snippet.confidence * 100)}%</strong></span>`;
                }

                // Highlight code
                if (typeof hljs !== 'undefined') {
                    hljs.highlightElement(document.getElementById('code-content'));
                }

            } catch (error) {
                console.error('Error loading snippet:', error);
                alert('Failed to load snippet');
            }
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        function copySnippet() {
            const code = document.getElementById('code-content').textContent;
            navigator.clipboard.writeText(code).then(() => {
                alert('Code copied to clipboard!');
            }).catch(err => {
                console.error('Copy failed:', err);
                alert('Failed to copy code');
            });
        }

        function goBack() {
            window.location.href = '/archive';
        }

        // Load snippet on page load
        loadSnippet();
    </script>
</body>
</html>
````
