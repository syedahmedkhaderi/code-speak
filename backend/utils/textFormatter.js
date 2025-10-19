// This is backend/utils/textFormatter.js - Text Formatting Utilities

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