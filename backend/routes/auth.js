// This is routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Simple in-memory user store used when MongoDB is not configured.
// This is for local frontend/dev only and not persistent.
const inMemoryUsers = new Map();
let nextInMemoryId = 1;
// Register
router.post('/register', async (req, res) => {
    // If MongoDB is not connected, return a clear error
    const useInMemory = mongoose.connection.readyState !== 1;
    if (useInMemory) {
        console.warn('MongoDB not connected — using in-memory user store for registration');
    }
    try {
        const { name, email, password, confirmPassword } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user exists (DB or in-memory)
        if (useInMemory) {
            const key = email.toLowerCase().trim();
            if (inMemoryUsers.has(key)) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            const user = {
                id: `mem-${nextInMemoryId++}`,
                name: name.trim(),
                email: key,
                passwordHash
            };
            inMemoryUsers.set(key, user);

            // Generate token (signed without secret if not provided)
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', {
                expiresIn: '7d'
            });

            return res.status(201).json({
                message: 'User registered (in-memory)',
                token,
                user: { id: user.id, name: user.name, email: user.email }
            });
        }

        // Generate token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const useInMemory = mongoose.connection.readyState !== 1;
    if (useInMemory) {
        console.warn('MongoDB not connected — using in-memory user store for login');
    }
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        if (useInMemory) {
            const key = email.toLowerCase().trim();
            const user = inMemoryUsers.get(key);
            if (!user) return res.status(401).json({ error: 'Invalid email or password' });

            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordValid) return res.status(401).json({ error: 'Invalid email or password' });

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
            return res.json({ message: 'Login successful (in-memory)', token, user: { id: user.id, name: user.name, email: user.email } });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout (client-side, but just for symmetry)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});
module.exports = router;