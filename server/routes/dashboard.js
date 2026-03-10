/**
 * Dashboard Routes
 * Handles dashboard statistics and analytics
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Record = require('../models/Record');
const Department = require('../models/Department');
const Category = require('../models/Category');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get(
  '/stats',
  auth,
  asyncHandler(async (req, res) => {
    // Get overall record statistics
    const recordStats = await Record.aggregate([
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalReceived: { $sum: '$recordsReceived' },
          totalProcessed: { $sum: '$recordsProcessed' },
          totalPending: { $sum: '$pendingRecords' },
          totalCalculatedValue: { $sum: '$calculatedValue' },
          discrepancyCount: {
            $sum: { $cond: [{ $eq: ['$status', 'discrepancy'] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          processedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = recordStats[0] || {
      totalRecords: 0,
      totalReceived: 0,
      totalProcessed: 0,
      totalPending: 0,
      totalCalculatedValue: 0,
      discrepancyCount: 0,
      pendingCount: 0,
      processedCount: 0,
    };

    // Get counts for departments, categories, users
    const [departmentCount, categoryCount, userCount, activeUserCount] = await Promise.all([
      Department.countDocuments({ active: true }),
      Category.countDocuments({ active: true }),
      User.countDocuments(),
      User.countDocuments({ active: true }),
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        departmentCount,
        categoryCount,
        userCount,
        activeUserCount,
      },
    });
  })
);

/**
 * @route   GET /api/dashboard/charts
 * @desc    Get chart data for dashboard
 * @access  Private
 */
router.get(
  '/charts',
  auth,
  asyncHandler(async (req, res) => {
    const { period = '30' } = req.query;
    const days = parseInt(period, 10) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get category distribution
    const categoryDistribution = await Record.aggregate([
      {
        $match: { date: { $gte: startDate } },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalRecords: { $sum: '$recordsReceived' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: '$categoryInfo' },
      {
        $project: {
          name: '$categoryInfo.name',
          code: '$categoryInfo.code',
          count: 1,
          totalRecords: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get department distribution
    const departmentDistribution = await Record.aggregate([
      {
        $match: { date: { $gte: startDate } },
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          totalRecords: { $sum: '$recordsReceived' },
          totalProcessed: { $sum: '$recordsProcessed' },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'departmentInfo',
        },
      },
      { $unwind: '$departmentInfo' },
      {
        $project: {
          name: '$departmentInfo.name',
          code: '$departmentInfo.code',
          count: 1,
          totalRecords: 1,
          totalProcessed: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get daily trend for the period
    const dailyTrend = await Record.aggregate([
      {
        $match: { date: { $gte: startDate } },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
          totalReceived: { $sum: '$recordsReceived' },
          totalProcessed: { $sum: '$recordsProcessed' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get status distribution
    const statusDistribution = await Record.aggregate([
      {
        $match: { date: { $gte: startDate } },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRecords: { $sum: '$recordsReceived' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get top units
    const topUnits = await Record.aggregate([
      {
        $match: { date: { $gte: startDate } },
      },
      {
        $group: {
          _id: '$unit',
          count: { $sum: 1 },
          totalRecords: { $sum: '$recordsReceived' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        categoryDistribution,
        departmentDistribution,
        dailyTrend,
        statusDistribution,
        topUnits,
      },
    });
  })
);

/**
 * @route   GET /api/dashboard/recent
 * @desc    Get recent records for dashboard widget
 * @access  Private
 */
router.get(
  '/recent',
  auth,
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10), 20);

    const recentRecords = await Record.find()
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .populate('createdBy', 'username');

    res.json({
      success: true,
      data: recentRecords,
    });
  })
);

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get recent activity for dashboard widget
 * @access  Private
 */
router.get(
  '/activity',
  auth,
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10), 20);

    const recentActivity = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(limitNum)
      .populate('userId', 'username email');

    res.json({
      success: true,
      data: recentActivity,
    });
  })
);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get dashboard summary with all data in one call
 * @access  Private
 */
router.get(
  '/summary',
  auth,
  asyncHandler(async (req, res) => {
    // Run all queries in parallel
    const [stats, recentRecords, recentActivity, categoryDistribution] = await Promise.all([
      // Get stats
      Record.aggregate([
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalReceived: { $sum: '$recordsReceived' },
            totalProcessed: { $sum: '$recordsProcessed' },
            totalPending: { $sum: '$pendingRecords' },
            totalCalculatedValue: { $sum: '$calculatedValue' },
            discrepancyCount: {
              $sum: { $cond: [{ $eq: ['$status', 'discrepancy'] }, 1, 0] },
            },
          },
        },
      ]).then(result => result[0] || {
        totalRecords: 0,
        totalReceived: 0,
        totalProcessed: 0,
        totalPending: 0,
        totalCalculatedValue: 0,
        discrepancyCount: 0,
      }),

      // Get recent records
      Record.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('department', 'name code')
        .populate('category', 'name code')
        .populate('createdBy', 'username'),

      // Get recent activity
      ActivityLog.find()
        .sort({ timestamp: -1 })
        .limit(5)
        .populate('userId', 'username'),

      // Get category distribution
      Record.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalRecords: { $sum: '$recordsReceived' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo',
          },
        },
        { $unwind: '$categoryInfo' },
        {
          $project: {
            name: '$categoryInfo.name',
            count: 1,
            totalRecords: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        stats,
        recentRecords,
        recentActivity,
        categoryDistribution,
      },
    });
  })
);

module.exports = router;