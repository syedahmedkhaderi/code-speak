// This is backend/server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();

const path = require('path');

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:1020',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple request logger to aid debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// Serve frontend views and static assets
// Allow EJS to resolve partials located outside the views folder (frontend/partials)
const viewsPath = path.join(__dirname, '..', 'frontend', 'views');
const partialsPath = path.join(__dirname, '..', 'frontend', 'partials');
app.set('views', [viewsPath, partialsPath]);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Basic frontend routes
app.get('/', (req, res) => {
    return res.render('index');
});

app.get('/live', (req, res) => {
    return res.render('live');
});

app.get('/archive', (req, res) => {
    return res.render('archive');
});
app.get('/login', (req, res) => {
    return res.render('login');
});

app.get('/register', (req, res) => {
    return res.render('register');
});

// MongoDB Connection (optional for local frontend preview)
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10 // Connection pooling for production
    })
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        // don't exit process to allow frontend preview; keep running for dev
    });
} else {
    console.warn('MONGODB_URI not set — skipping database connection (frontend preview mode).');
}

// Import middleware
const auth = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const lectureRoutes = require('./routes/lectures');
const transcriptionRoutes = require('./routes/transcription');

// Route handlers
app.use('/api/auth', authRoutes);
app.use('/api/lectures', auth, lectureRoutes);
app.use('/api/transcription', auth, transcriptionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'CodeSpeak Backend'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404);
    // If client prefers HTML, render a friendly 404 page
    if (req.accepts('html')) {
        return res.render('404', { url: req.originalUrl });
    }
    // If it's an API request, return JSON
    if (req.originalUrl.startsWith('/api')) {
        return res.json({ error: 'Route not found' });
    }
    // Fallback plain text
    res.type('txt').send('Route not found');
});


const PORT = process.env.PORT || 1020;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
module.exports = app;