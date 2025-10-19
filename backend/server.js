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

// Serve frontend views and static assets
// Allow EJS to resolve partials located outside the views folder (frontend/partials)
const viewsPath = path.join(__dirname, '..', 'frontend', 'views');
const partialsPath = path.join(__dirname, '..', 'frontend', 'partials');
app.set('views', [viewsPath, partialsPath]);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Development helper - mock user for frontend preview
const mockUser = process.env.MONGODB_URI ? null : {
    name: 'Preview User',
    email: 'preview@example.com'
};

// Basic frontend routes
app.get('/', (req, res) => {
    return res.render('index', { user: req.session?.user || mockUser });
});

app.get('/live', (req, res) => {
    if (!process.env.MONGODB_URI) {
        return res.render('live', { user: mockUser }); // Allow preview without auth
    }
    if (!req.session?.user) {
        return res.redirect('/login');
    }
    return res.render('live', { user: req.session.user });
});

app.get('/archive', (req, res) => {
    if (!process.env.MONGODB_URI) {
        return res.render('archive', { user: mockUser }); // Allow preview without auth
    }
    if (!req.session?.user) {
        return res.redirect('/login');
    }
    return res.render('archive', { user: req.session.user });
});

app.get('/login', (req, res) => {
    if (!process.env.MONGODB_URI) {
        return res.redirect('/?preview=true'); // In preview mode, redirect to home
    }
    return res.render('login', { user: req.session?.user });
});

app.get('/register', (req, res) => {
    if (!process.env.MONGODB_URI) {
        return res.redirect('/?preview=true'); // In preview mode, redirect to home
    }
    return res.render('register', { user: req.session?.user });
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
    res.status(404).json({ error: 'Route not found' });
});


const PORT = process.env.PORT || 1020;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
module.exports = app;