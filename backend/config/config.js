// This is backend/config/config.js - Environment Configuration

require('dotenv').config();

const config = {
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:1020',
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
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:1020',
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