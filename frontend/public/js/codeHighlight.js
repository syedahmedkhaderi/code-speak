// This is frontend/public/js/codeHighlight.js - Enhanced Syntax Highlighting

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