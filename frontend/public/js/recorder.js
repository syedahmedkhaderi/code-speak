// public/js/recorder.js - COMPLETE WITH ERROR HANDLING
class AudioRecorder {
    constructor() {
        // Browser compatibility check
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported');
            this.supported = false;
            return;
        }
        
        this.SpeechRecognition = SpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.mediaRecorder = null;
        this.isRecording = false;
        this.lectureId = null;
        this.startTime = null;
        this.supported = true;
        this.interimTranscript = '';
    }
    
    async startRecording(lectureId) {
        if (!this.supported) {
            this.showError('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
            return;
        }
        
        this.lectureId = lectureId;
        this.startTime = Date.now();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onstart = () => {
            this.isRecording = true;
            console.log('✓ Recording started');
        };
        
        this.recognition.onresult = (event) => {
            this.handleTranscription(event);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.showError(`Transcription error: ${event.error}. Please check your microphone.`);
        };
        
        this.recognition.onend = () => {
            this.isRecording = false;
            console.log('✓ Recording stopped');
        };
        
        this.recognition.start();
    }
    
    async handleTranscription(event) {
        this.interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                // Process final result
                const timestamp = (Date.now() - this.startTime) / 1000;
                await this.processFinalTranscript(transcript, timestamp);
            } else {
                // Show interim results
                this.interimTranscript += transcript;
                this.displayInterimTranscript(this.interimTranscript);
            }
        }
    }
    
    async processFinalTranscript(text, timestamp) {
        if (!text.trim()) return;
        
        try {
            const response = await fetch('/api/transcription/process', {
                method: 'POST',
                headers: authManager.getAuthHeader(),
                body: JSON.stringify({
                    lectureId: this.lectureId,
                    text: text,
                    timestamp: timestamp
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to process transcription');
            }
            
            const data = await response.json();
            this.displayTranscription(data, timestamp);
            
        } catch (error) {
            console.error('Error processing transcription:', error);
            this.showError('Failed to process transcription: ' + error.message);
        }
    }
    
    displayInterimTranscript(text) {
        const interim = document.getElementById('interim-transcript');
        if (interim) {
            interim.textContent = text;
            interim.style.opacity = '0.6';
        }
    }
    
    displayTranscription(data, timestamp) {
        const container = document.getElementById('transcription-container');
        if (!container) return;
        
        const entry = document.createElement('div');
        entry.className = data.isCode ? 'transcript-entry code' : 'transcript-entry';
        entry.dataset.timestamp = timestamp;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'timestamp';
        timeSpan.textContent = this.formatTime(timestamp);
        
        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        
        if (data.isCode) {
            textSpan.innerHTML = this.highlightCode(data.correctedText, data.language);
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copy Code';
            copyBtn.onclick = () => this.copyCode(data.correctedText);
            entry.appendChild(copyBtn);
        } else {
            textSpan.textContent = data.correctedText;
        }
        
        entry.appendChild(timeSpan);
        entry.appendChild(textSpan);
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
        
        // Update snippet count
        const snippetCount = document.querySelectorAll('.transcript-entry.code').length;
        const countEl = document.getElementById('snippet-count');
        if (countEl) countEl.textContent = `${snippetCount} code snippets`;
    }
    
    highlightCode(code, language) {
        const keywords = {
            'python': ['def', 'class', 'return', 'if', 'else', 'for', 'while', 'import', 'from'],
            'javascript': ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'async'],
            'java': ['public', 'private', 'static', 'void', 'int', 'return', 'if', 'else', 'class']
        };
        
        let highlighted = this.escapeHtml(code);
        const langKeywords = keywords[language] || [];
        
        langKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
        });
        
        // Highlight strings
        highlighted = highlighted.replace(/"([^"]*)"/g, '<span class="string">"$1"</span>');
        highlighted = highlighted.replace(/'([^']*)'/g, "<span class=\"string\">'$1'</span>");
        
        // Highlight numbers
        highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="number">$1</span>');
        
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
    
    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            this.showNotification('Code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            this.showError('Failed to copy code');
        });
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
            this.isRecording = false;
            console.log('✓ Recording stopped');
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    showNotification(message) {
        const notif = document.getElementById('notification');
        if (notif) {
            notif.textContent = message;
            notif.style.display = 'block';
            setTimeout(() => {
                notif.style.display = 'none';
            }, 3000);
        }
    }
}
// Initialize recorder
const recorder = new AudioRecorder();
// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (!recorder.supported) {
                recorder.showError('Speech recognition not supported in your browser');
                return;
            }
            
            const title = document.getElementById('lecture-title')?.value;
            const subject = document.getElementById('lecture-subject')?.value;
            
            if (!title || !subject) {
                recorder.showError('Please enter lecture title and subject');
                return;
            }
            
            try {
                const response = await fetch('/api/lectures/start', {
                    method: 'POST',
                    headers: authManager.getAuthHeader(),
                    body: JSON.stringify({ title, subject })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to start lecture');
                }
                
                const data = await response.json();
                await recorder.startRecording(data.lectureId);
                
                startBtn.disabled = true;
                stopBtn.disabled = false;
                recorder.showNotification('Lecture recording started');
                
            } catch (error) {
                recorder.showError('Failed to start lecture: ' + error.message);
            }
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
            recorder.stopRecording();
            startBtn.disabled = false;
            stopBtn.disabled = true;
            recorder.showNotification('Lecture recording ended');
        });
    }
});