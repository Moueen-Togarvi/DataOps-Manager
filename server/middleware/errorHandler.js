/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const config = require('../config/env');

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'ApiError';
  }
}

/**
 * Not found handler (404)
 */
const notFound = (req, res, next) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};

/**
 * Validation error handler
 */
const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }
  next(err);
};

/**
 * MongoDB duplicate key error handler
 */
const duplicateKeyErrorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];

    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}: ${value}`,
      errors: [{ field, message: `${field} must be unique` }],
    });
  }
  next(err);
};

/**
 * JWT error handler
 */
const jwtErrorHandler = (err, req, res, next) => {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  next(err);
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Log error in development
  if (config.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      statusCode,
    });
  } else {
    // In production, log minimal info
    console.error(`Error ${statusCode}: ${message}`);
  }

  // Don't expose internal errors in production
  if (config.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
    errors = null;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(config.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async handler wrapper
 * Catches errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  notFound,
  validationErrorHandler,
  duplicateKeyErrorHandler,
  jwtErrorHandler,
  errorHandler,
  asyncHandler,
};