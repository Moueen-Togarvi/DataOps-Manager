/**
 * Authentication Middleware
 * Handles JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const config = require('../config/env');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive.',
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Admin role middleware
 * Requires user to have admin role
 */
const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
};

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-passwordHash');

      if (user && user.active) {
        req.user = user;
        req.token = token;
      }
    }
    next();
  } catch (error) {
    // Silently continue without user
    next();
  }
};

/**
 * Activity logging middleware
 */
const logActivity = (action, entityType) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end function
    res.end = async function(chunk, encoding) {
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await ActivityLog.log({
            userId: req.user?._id,
            action,
            entityType,
            entityId: req.params?.id ? req.params.id : req.body?._id,
            details: {
              method: req.method,
              path: req.originalUrl,
              body: req.body ? JSON.parse(JSON.stringify(req.body)) : {},
            },
            ipAddress: req.ip || req.connection.remoteAddress,
          });
        } catch (error) {
          console.error('Activity log error:', error);
        }
      }

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      role: user.role,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
};

module.exports = {
  auth,
  adminOnly,
  optionalAuth,
  logActivity,
  generateToken,
};