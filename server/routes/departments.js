/**
 * Departments Routes
 * Handles CRUD operations for departments
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Department = require('../models/Department');
const Category = require('../models/Category');
const Record = require('../models/Record');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @route   GET /api/departments
 * @desc    Get all departments
 * @access  Private
 */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { active, includeStats } = req.query;

    const query = {};
    if (active !== undefined) {
      query.active = active === 'true';
    }

    let departments = await Department.find(query).sort({ name: 1 });

    // Include record counts if requested
    if (includeStats === 'true') {
      const recordCounts = await Record.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]);

      const countMap = new Map(recordCounts.map((r) => [r._id.toString(), r.count]));

      departments = departments.map((dept) => ({
        ...dept.toObject(),
        recordCount: countMap.get(dept._id.toString()) || 0,
      }));
    }

    res.json({
      success: true,
      data: departments,
    });
  })
);

/**
 * @route   GET /api/departments/:id
 * @desc    Get a single department by ID
 * @access  Private
 */
router.get(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Invalid department ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid department ID', errors.array());
    }

    const department = await Department.findById(req.params.id);

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    // Get category count
    const categoryCount = await Category.countDocuments({ department: department._id });

    // Get record count
    const recordCount = await Record.countDocuments({ department: department._id });

    res.json({
      success: true,
      data: {
        ...department.toObject(),
        categoryCount,
        recordCount,
      },
    });
  })
);

/**
 * @route   POST /api/departments
 * @desc    Create a new department (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/',
  auth,
  adminOnly,
  [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    body('code').trim().notEmpty().withMessage('Code is required')
      .isLength({ max: 10 }).withMessage('Code cannot exceed 10 characters'),
    body('description').optional().trim().isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { name, code, description } = req.body;

    // Check for existing code
    const existingCode = await Department.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      throw new ApiError(409, 'Department code already exists');
    }

    // Check for existing name
    const existingName = await Department.findOne({ name });
    if (existingName) {
      throw new ApiError(409, 'Department name already exists');
    }

    const department = new Department({
      name,
      code: code.toUpperCase(),
      description: description || '',
    });

    await department.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'create',
      entityType: 'Department',
      entityId: department._id,
      details: { name, code: department.code },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department,
    });
  })
);

/**
 * @route   PUT /api/departments/:id
 * @desc    Update a department (admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid department ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid department ID', errors.array());
    }

    const department = await Department.findById(req.params.id);
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    const { name, code, description, active } = req.body;

    // Check for duplicate code if changing
    if (code && code.toUpperCase() !== department.code) {
      const existing = await Department.findOne({ code: code.toUpperCase() });
      if (existing) {
        throw new ApiError(409, 'Department code already exists');
      }
      department.code = code.toUpperCase();
    }

    // Check for duplicate name if changing
    if (name && name !== department.name) {
      const existing = await Department.findOne({ name });
      if (existing) {
        throw new ApiError(409, 'Department name already exists');
      }
      department.name = name;
    }

    if (description !== undefined) {
      department.description = description;
    }

    if (active !== undefined) {
      department.active = active;
    }

    await department.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'update',
      entityType: 'Department',
      entityId: department._id,
      details: { name: department.name, code: department.code },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: department,
    });
  })
);

/**
 * @route   DELETE /api/departments/:id
 * @desc    Delete a department (admin only)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid department ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid department ID', errors.array());
    }

    const department = await Department.findById(req.params.id);
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    // Check for related records
    const recordCount = await Record.countDocuments({ department: department._id });
    if (recordCount > 0) {
      throw new ApiError(400, `Cannot delete department with ${recordCount} associated records`);
    }

    // Check for related categories
    const categoryCount = await Category.countDocuments({ department: department._id });
    if (categoryCount > 0) {
      throw new ApiError(400, `Cannot delete department with ${categoryCount} associated categories`);
    }

    await department.deleteOne();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'delete',
      entityType: 'Department',
      entityId: department._id,
      details: { name: department.name, code: department.code },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Department deleted successfully',
    });
  })
);

module.exports = router;