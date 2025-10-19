// This is frontend/public/js/transcription.js - Real-time Transcription Display

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