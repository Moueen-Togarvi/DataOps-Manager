/**
 * Activity Logs Routes
 * Handles activity log queries (admin only)
 */

const express = require('express');
const router = express.Router();
const { param, query, validationResult } = require('express-validator');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const config = require('../config/env');

/**
 * @route   GET /api/logs
 * @desc    Get activity logs with pagination and filters (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/',
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = config.DEFAULT_PAGE_SIZE,
      userId,
      action,
      entityType,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (action) {
      query.action = action;
    }

    if (entityType) {
      query.entityType = entityType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), config.MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'username email'),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
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
 * @route   GET /api/logs/recent
 * @desc    Get recent activity logs
 * @access  Private (Admin)
 */
router.get(
  '/recent',
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const logs = await ActivityLog.getRecent(limitNum);

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * @route   GET /api/logs/user/:userId
 * @desc    Get activity logs for a specific user
 * @access  Private (Admin)
 */
router.get(
  '/user/:userId',
  auth,
  adminOnly,
  [param('userId').isMongoId().withMessage('Invalid user ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid user ID', errors.array());
    }

    const { limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10), 200);

    const logs = await ActivityLog.getByUser(req.params.userId, limitNum);

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * @route   GET /api/logs/entity/:entityType/:entityId
 * @desc    Get activity logs for a specific entity
 * @access  Private (Admin)
 */
router.get(
  '/entity/:entityType/:entityId',
  auth,
  adminOnly,
  [
    param('entityType').isIn(['User', 'Record', 'Department', 'Category', 'System', 'Backup'])
      .withMessage('Invalid entity type'),
    param('entityId').isMongoId().withMessage('Invalid entity ID'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10), 200);

    const logs = await ActivityLog.getByEntity(
      req.params.entityType,
      req.params.entityId,
      limitNum
    );

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * @route   GET /api/logs/stats
 * @desc    Get activity log statistics
 * @access  Private (Admin)
 */
router.get(
  '/stats',
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    const [actionStats, entityTypeStats, userStats] = await Promise.all([
      ActivityLog.aggregate([
        { $match: matchStage },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ActivityLog.aggregate([
        { $match: matchStage },
        { $group: { _id: '$entityType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ActivityLog.aggregate([
        { $match: matchStage },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        { $unwind: '$userInfo' },
        {
          $project: {
            username: '$userInfo.username',
            email: '$userInfo.email',
            count: 1,
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        actionStats,
        entityTypeStats,
        userStats,
      },
    });
  })
);

module.exports = router;