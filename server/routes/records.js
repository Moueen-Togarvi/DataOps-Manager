/**
 * Records Routes
 * Handles CRUD operations for records
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Record = require('../models/Record');
const Department = require('../models/Department');
const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const config = require('../config/env');

/**
 * @route   GET /api/records
 * @desc    Get all records with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = config.DEFAULT_PAGE_SIZE,
      department,
      category,
      status,
      startDate,
      endDate,
      search,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = {};

    if (department) {
      query.department = department;
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { recordId: { $regex: search, $options: 'i' } },
        { unit: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), config.MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * limitNum;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [records, total] = await Promise.all([
      Record.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('department', 'name code')
        .populate('category', 'name code')
        .populate('createdBy', 'username')
        .populate('updatedBy', 'username'),
      Record.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        records,
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
 * @route   GET /api/records/:id
 * @desc    Get a single record by ID
 * @access  Private
 */
router.get(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Invalid record ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid record ID', errors.array());
    }

    const record = await Record.findById(req.params.id)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');

    if (!record) {
      throw new ApiError(404, 'Record not found');
    }

    res.json({
      success: true,
      data: record,
    });
  })
);

/**
 * @route   POST /api/records
 * @desc    Create a new record
 * @access  Private
 */
router.post(
  '/',
  auth,
  [
    body('department').isMongoId().withMessage('Valid department ID is required'),
    body('unit').trim().notEmpty().withMessage('Unit is required'),
    body('category').isMongoId().withMessage('Valid category ID is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('recordsReceived').isInt({ min: 0 }).withMessage('Records received must be non-negative'),
    body('recordsProcessed').isInt({ min: 0 }).withMessage('Records processed must be non-negative'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { department, unit, category, date, status, recordsReceived, recordsProcessed, calculatedValue, notes } = req.body;

    // Verify department exists
    const dept = await Department.findById(department);
    if (!dept) {
      throw new ApiError(400, 'Department not found');
    }

    // Verify category exists and belongs to department
    const cat = await Category.findOne({ _id: category, department });
    if (!cat) {
      throw new ApiError(400, 'Category not found or does not belong to department');
    }

    const record = new Record({
      department,
      unit,
      category,
      date: new Date(date),
      status: status || 'pending',
      recordsReceived,
      recordsProcessed,
      calculatedValue: calculatedValue || 0,
      notes: notes || '',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await record.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'create',
      entityType: 'Record',
      entityId: record._id,
      details: { recordId: record.recordId },
      ipAddress: req.ip,
    });

    const populatedRecord = await Record.findById(record._id)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .populate('createdBy', 'username');

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: populatedRecord,
    });
  })
);

/**
 * @route   PUT /api/records/:id
 * @desc    Update a record
 * @access  Private
 */
router.put(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Invalid record ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid record ID', errors.array());
    }

    const record = await Record.findById(req.params.id);
    if (!record) {
      throw new ApiError(404, 'Record not found');
    }

    const updateFields = ['unit', 'date', 'status', 'recordsReceived', 'recordsProcessed', 'calculatedValue', 'notes'];
    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        record[field] = req.body[field];
      }
    });

    record.updatedBy = req.user._id;
    await record.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'update',
      entityType: 'Record',
      entityId: record._id,
      details: { recordId: record.recordId },
      ipAddress: req.ip,
    });

    const updatedRecord = await Record.findById(record._id)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .populate('updatedBy', 'username');

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: updatedRecord,
    });
  })
);

/**
 * @route   DELETE /api/records/:id
 * @desc    Delete a record (admin only)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid record ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid record ID', errors.array());
    }

    const record = await Record.findByIdAndDelete(req.params.id);
    if (!record) {
      throw new ApiError(404, 'Record not found');
    }

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'delete',
      entityType: 'Record',
      entityId: record._id,
      details: { recordId: record.recordId },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Record deleted successfully',
    });
  })
);

/**
 * @route   POST /api/records/import
 * @desc    Import records from Excel/CSV
 * @access  Private
 */
router.post(
  '/import',
  auth,
  asyncHandler(async (req, res) => {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'No records provided for import');
    }

    const importedRecords = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const rowData = records[i];

        // Find department and category
        const department = await Department.findOne({ code: rowData.departmentCode?.toUpperCase() });
        if (!department) {
          errors.push({ row: i + 1, error: 'Department not found' });
          continue;
        }

        const category = await Category.findOne({
          code: rowData.categoryCode?.toUpperCase(),
          department: department._id,
        });
        if (!category) {
          errors.push({ row: i + 1, error: 'Category not found' });
          continue;
        }

        const record = new Record({
          department: department._id,
          unit: rowData.unit,
          category: category._id,
          date: new Date(rowData.date),
          status: rowData.status || 'pending',
          recordsReceived: parseInt(rowData.recordsReceived, 10) || 0,
          recordsProcessed: parseInt(rowData.recordsProcessed, 10) || 0,
          calculatedValue: parseFloat(rowData.calculatedValue) || 0,
          notes: rowData.notes || '',
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });

        await record.save();
        importedRecords.push(record);
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'import',
      entityType: 'Record',
      details: { count: importedRecords.length, errors: errors.length },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Imported ${importedRecords.length} records`,
      data: {
        imported: importedRecords.length,
        errors: errors.length,
        errorDetails: errors,
      },
    });
  })
);

/**
 * @route   GET /api/records/export
 * @desc    Export records to Excel/CSV format
 * @access  Private
 */
router.get(
  '/export',
  auth,
  asyncHandler(async (req, res) => {
    const { department, category, status, startDate, endDate } = req.query;

    const query = {};

    if (department) query.department = department;
    if (category) query.category = category;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const records = await Record.find(query)
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ date: -1 });

    const exportData = records.map((r) => ({
      recordId: r.recordId,
      department: r.department?.name,
      departmentCode: r.department?.code,
      unit: r.unit,
      category: r.category?.name,
      categoryCode: r.category?.code,
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      recordsReceived: r.recordsReceived,
      recordsProcessed: r.recordsProcessed,
      pendingRecords: r.pendingRecords,
      calculatedValue: r.calculatedValue,
      notes: r.notes,
    }));

    res.json({
      success: true,
      data: exportData,
    });
  })
);

/**
 * @route   GET /api/records/stats
 * @desc    Get record statistics
 * @access  Private
 */
router.get(
  '/stats/summary',
  auth,
  asyncHandler(async (req, res) => {
    const { department, startDate, endDate } = req.query;

    const filters = {};
    if (department) filters.department = mongoose.Types.ObjectId(department);
    if (startDate) filters.date = { ...filters.date, $gte: new Date(startDate) };
    if (endDate) filters.date = { ...filters.date, $lte: new Date(endDate) };

    const stats = await Record.getStats(filters);
    const categoryDistribution = await Record.getCategoryDistribution(filters);

    res.json({
      success: true,
      data: {
        stats,
        categoryDistribution,
      },
    });
  })
);

module.exports = router;