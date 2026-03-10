/**
 * Users Routes
 * Handles user management (admin only)
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const config = require('../config/env');

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/',
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = config.DEFAULT_PAGE_SIZE, role, department, active, search } = req.query;

    const query = {};

    if (role) {
      query.role = role;
    }

    if (department) {
      query.department = department;
    }

    if (active !== undefined) {
      query.active = active === 'true';
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), config.MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('department', 'name code'),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user by ID (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid user ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid user ID', errors.array());
    }

    const user = await User.findById(req.params.id)
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
 * @route   POST /api/users
 * @desc    Create a new user (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/',
  auth,
  adminOnly,
  [
    body('username').trim().notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'data_entry']).withMessage('Valid role is required'),
    body('department').optional().isMongoId().withMessage('Invalid department ID'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { username, email, password, role, department } = req.body;

    // Check for existing username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      throw new ApiError(409, 'Username already exists');
    }

    // Check for existing email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new ApiError(409, 'Email already exists');
    }

    // Verify department if provided
    if (department) {
      const dept = await Department.findById(department);
      if (!dept) {
        throw new ApiError(400, 'Department not found');
      }
    }

    const user = new User({
      username,
      email,
      passwordHash: password,
      role,
      department: department || null,
    });

    await user.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'create',
      entityType: 'User',
      entityId: user._id,
      details: { username, email, role },
      ipAddress: req.ip,
    });

    const populatedUser = await User.findById(user._id)
      .select('-passwordHash')
      .populate('department', 'name code');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: populatedUser,
    });
  })
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user (admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid user ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid user ID', errors.array());
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const { username, email, password, role, department, active } = req.body;

    // Check for duplicate username if changing
    if (username && username !== user.username) {
      const existing = await User.findOne({ username, _id: { $ne: user._id } });
      if (existing) {
        throw new ApiError(409, 'Username already exists');
      }
      user.username = username;
    }

    // Check for duplicate email if changing
    if (email && email !== user.email) {
      const existing = await User.findOne({ email, _id: { $ne: user._id } });
      if (existing) {
        throw new ApiError(409, 'Email already exists');
      }
      user.email = email;
    }

    if (password) {
      user.passwordHash = password;
    }

    if (role) {
      user.role = role;
    }

    if (department !== undefined) {
      if (department) {
        const dept = await Department.findById(department);
        if (!dept) {
          throw new ApiError(400, 'Department not found');
        }
      }
      user.department = department || null;
    }

    if (active !== undefined) {
      user.active = active;
    }

    await user.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'update',
      entityType: 'User',
      entityId: user._id,
      details: { username: user.username, email: user.email, role: user.role },
      ipAddress: req.ip,
    });

    const updatedUser = await User.findById(user._id)
      .select('-passwordHash')
      .populate('department', 'name code');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  })
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user (admin only)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid user ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid user ID', errors.array());
    }

    // Prevent self-deletion
    if (req.params.id === req.user._id.toString()) {
      throw new ApiError(400, 'Cannot delete your own account');
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'delete',
      entityType: 'User',
      entityId: user._id,
      details: { username: user.username, email: user.email },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

/**
 * @route   PUT /api/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:id/reset-password',
  auth,
  adminOnly,
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    user.passwordHash = req.body.password;
    await user.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'password_reset',
      entityType: 'User',
      entityId: user._id,
      details: { username: user.username },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  })
);

module.exports = router;