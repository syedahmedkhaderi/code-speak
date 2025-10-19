// This is backend/config/db.js - MongoDB Connection Configuration
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