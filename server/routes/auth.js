/**
 * Authentication Routes
 * Handles user login, logout, and session management
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { auth, generateToken } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username.toLowerCase() }],
    });

    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }

    if (!user.active) {
      throw new ApiError(401, 'Account is inactive');
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Generate token
    const token = generateToken(user);

    // Log activity
    await ActivityLog.log({
      userId: user._id,
      action: 'login',
      entityType: 'User',
      entityId: user._id,
      details: { method: 'password' },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          department: user.department,
        },
        token,
      },
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post(
  '/logout',
  auth,
  asyncHandler(async (req, res) => {
    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'logout',
      entityType: 'User',
      entityId: req.user._id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select('-passwordHash')
      .populate('department', 'name code');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * @route   PUT /api/auth/password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/password',
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    // Log activity
    await ActivityLog.log({
      userId: user._id,
      action: 'password_change',
      entityType: 'User',
      entityId: user._id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  })
);

module.exports = router;