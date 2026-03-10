/**
 * Reports Routes
 * Handles report generation and analytics
 */

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Record = require('../models/Record');
const Department = require('../models/Department');
const Category = require('../models/Category');
const { auth } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @route   GET /api/reports/generate
 * @desc    Generate custom report
 * @access  Private
 */
router.get(
  '/generate',
  auth,
  asyncHandler(async (req, res) => {
    const { department, category, startDate, endDate, groupBy } = req.query;

    // Build match filter
    const matchFilter = {};
    if (department) matchFilter.department = mongoose.Types.ObjectId(department);
    if (category) matchFilter.category = mongoose.Types.ObjectId(category);
    if (startDate || endDate) {
      matchFilter.date = {};
      if (startDate) matchFilter.date.$gte = new Date(startDate);
      if (endDate) matchFilter.date.$lte = new Date(endDate);
    }

    // Get records
    const records = await Record.find(matchFilter)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ date: -1 });

    // Calculate summary stats
    const stats = {
      totalRecords: records.length,
      totalReceived: records.reduce((sum, r) => sum + r.recordsReceived, 0),
      totalProcessed: records.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalPending: records.reduce((sum, r) => sum + r.pendingRecords, 0),
      totalCalculatedValue: records.reduce((sum, r) => sum + (r.calculatedValue || 0), 0),
      discrepancyCount: records.filter(r => r.status === 'discrepancy').length,
      pendingCount: records.filter(r => r.status === 'pending').length,
      processedCount: records.filter(r => r.status === 'processed').length,
    };

    // Group data if requested
    let groupedData = null;
    if (groupBy) {
      const groupId = groupBy === 'department' ? '$department'
        : groupBy === 'category' ? '$category'
        : groupBy === 'status' ? '$status'
        : { $dateToString: { format: '%Y-%m-%d', date: '$date' } };

      groupedData = await Record.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: groupId,
            count: { $sum: 1 },
            totalReceived: { $sum: '$recordsReceived' },
            totalProcessed: { $sum: '$recordsProcessed' },
            totalPending: { $sum: '$pendingRecords' },
            totalCalculatedValue: { $sum: '$calculatedValue' },
          },
        },
        { $sort: { count: -1 } },
      ]);

      // Populate department/category names if needed
      if (groupBy === 'department' || groupBy === 'category') {
        const collection = groupBy === 'department' ? Department : Category;
        groupedData = await Promise.all(
          groupedData.map(async (group) => {
            const entity = await collection.findById(group._id);
            return {
              ...group,
              name: entity?.name,
              code: entity?.code,
            };
          })
        );
      }
    }

    res.json({
      success: true,
      data: {
        stats,
        records: groupBy ? undefined : records,
        groupedData,
      },
    });
  })
);

/**
 * @route   GET /api/reports/daily
 * @desc    Generate daily report
 * @access  Private
 */
router.get(
  '/daily',
  auth,
  asyncHandler(async (req, res) => {
    const { date = new Date().toISOString().split('T')[0], department } = req.query;

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const matchFilter = {
      date: { $gte: startOfDay, $lte: endOfDay },
    };

    if (department) {
      matchFilter.department = mongoose.Types.ObjectId(department);
    }

    const records = await Record.find(matchFilter)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ createdAt: -1 });

    const stats = {
      date,
      totalRecords: records.length,
      totalReceived: records.reduce((sum, r) => sum + r.recordsReceived, 0),
      totalProcessed: records.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalPending: records.reduce((sum, r) => sum + r.pendingRecords, 0),
      statusBreakdown: {
        pending: records.filter(r => r.status === 'pending').length,
        processed: records.filter(r => r.status === 'processed').length,
        discrepancy: records.filter(r => r.status === 'discrepancy').length,
      },
    };

    res.json({
      success: true,
      data: {
        stats,
        records,
      },
    });
  })
);

/**
 * @route   GET /api/reports/weekly
 * @desc    Generate weekly report
 * @access  Private
 */
router.get(
  '/weekly',
  auth,
  asyncHandler(async (req, res) => {
    const { startDate, department } = req.query;

    // Calculate week start and end
    let weekStart = startDate ? new Date(startDate) : new Date();
    weekStart.setHours(0, 0, 0, 0);
    // Adjust to Monday if not already
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const matchFilter = {
      date: { $gte: weekStart, $lte: weekEnd },
    };

    if (department) {
      matchFilter.department = mongoose.Types.ObjectId(department);
    }

    const records = await Record.find(matchFilter)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ date: -1 });

    // Group by day
    const dailyData = await Record.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 },
          totalReceived: { $sum: '$recordsReceived' },
          totalProcessed: { $sum: '$recordsProcessed' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const stats = {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalRecords: records.length,
      totalReceived: records.reduce((sum, r) => sum + r.recordsReceived, 0),
      totalProcessed: records.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalPending: records.reduce((sum, r) => sum + r.pendingRecords, 0),
      dailyData,
    };

    res.json({
      success: true,
      data: {
        stats,
        records,
      },
    });
  })
);

/**
 * @route   GET /api/reports/monthly
 * @desc    Generate monthly report
 * @access  Private
 */
router.get(
  '/monthly',
  auth,
  asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1, department } = req.query;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const matchFilter = {
      date: { $gte: monthStart, $lte: monthEnd },
    };

    if (department) {
      matchFilter.department = mongoose.Types.ObjectId(department);
    }

    const records = await Record.find(matchFilter)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ date: -1 });

    // Group by week
    const weeklyData = await Record.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $week: '$date' },
          count: { $sum: 1 },
          totalReceived: { $sum: '$recordsReceived' },
          totalProcessed: { $sum: '$recordsProcessed' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Department breakdown
    const departmentBreakdown = await Record.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          totalReceived: { $sum: '$recordsReceived' },
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
          totalReceived: 1,
          totalProcessed: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    const stats = {
      month: `${year}-${String(month).padStart(2, '0')}`,
      totalRecords: records.length,
      totalReceived: records.reduce((sum, r) => sum + r.recordsReceived, 0),
      totalProcessed: records.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalPending: records.reduce((sum, r) => sum + r.pendingRecords, 0),
      weeklyData,
      departmentBreakdown,
    };

    res.json({
      success: true,
      data: {
        stats,
        records,
      },
    });
  })
);

/**
 * @route   GET /api/reports/trend
 * @desc    Get trend data for charts
 * @access  Private
 */
router.get(
  '/trend',
  auth,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, department, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const matchFilter = {
      date: { $gte: start, $lte: end },
    };

    if (department) {
      matchFilter.department = mongoose.Types.ObjectId(department);
    }

    const trendData = await Record.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupBy === 'month'
            ? { year: { $year: '$date' }, month: { $month: '$date' } }
            : { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' } },
          totalReceived: { $sum: '$recordsReceived' },
          totalProcessed: { $sum: '$recordsProcessed' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Format dates
    const formattedData = trendData.map(item => ({
      date: groupBy === 'month'
        ? `${item._id.year}-${String(item._id.month).padStart(2, '0')}`
        : `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      totalReceived: item.totalReceived,
      totalProcessed: item.totalProcessed,
      count: item.count,
    }));

    res.json({
      success: true,
      data: formattedData,
    });
  })
);

module.exports = router;