// this is backend/utils/codeDetector.js - ML API Helper

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