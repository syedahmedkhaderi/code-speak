// This is backend/middleware/errorHandler.js - Global Error Handler

const errorHandler = (err, req, res, next) => {
    // Log error
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const errors = Object.values(err.errors).map(e => e.message);
        message = `Validation Error: ${errors.join(', ')}`;
    }
    // Mongoose cast error
    if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    }
    // Mongoose duplicate key error
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists`;
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    // Send response
    res.status(statusCode).json({
        error: message,
        statusCode: statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
module.exports = errorHandler;