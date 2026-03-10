/**
 * Categories Routes
 * Handles CRUD operations for categories
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Department = require('../models/Department');
const Record = require('../models/Record');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Private
 */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { department, active, includeStats } = req.query;

    const query = {};
    if (department) {
      query.department = department;
    }
    if (active !== undefined) {
      query.active = active === 'true';
    }

    let categories = await Category.find(query)
      .sort({ name: 1 })
      .populate('department', 'name code');

    // Include record counts if requested
    if (includeStats === 'true') {
      const recordCounts = await Record.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);

      const countMap = new Map(recordCounts.map((r) => [r._id.toString(), r.count]));

      categories = categories.map((cat) => ({
        ...cat.toObject(),
        recordCount: countMap.get(cat._id.toString()) || 0,
      }));
    }

    res.json({
      success: true,
      data: categories,
    });
  })
);

/**
 * @route   GET /api/categories/:id
 * @desc    Get a single category by ID
 * @access  Private
 */
router.get(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Invalid category ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid category ID', errors.array());
    }

    const category = await Category.findById(req.params.id)
      .populate('department', 'name code');

    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    // Get record count
    const recordCount = await Record.countDocuments({ category: category._id });

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        recordCount,
      },
    });
  })
);

/**
 * @route   POST /api/categories
 * @desc    Create a new category (admin only)
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
    body('department').isMongoId().withMessage('Valid department ID is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { name, code, department } = req.body;

    // Verify department exists
    const dept = await Department.findById(department);
    if (!dept) {
      throw new ApiError(400, 'Department not found');
    }

    // Check for existing code within department
    const existing = await Category.findOne({
      code: code.toUpperCase(),
      department,
    });
    if (existing) {
      throw new ApiError(409, 'Category code already exists in this department');
    }

    const category = new Category({
      name,
      code: code.toUpperCase(),
      department,
    });

    await category.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'create',
      entityType: 'Category',
      entityId: category._id,
      details: { name, code: category.code, department: dept.name },
      ipAddress: req.ip,
    });

    const populatedCategory = await Category.findById(category._id)
      .populate('department', 'name code');

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: populatedCategory,
    });
  })
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update a category (admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid category ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid category ID', errors.array());
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    const { name, code, department, active } = req.body;

    // Update department if provided
    if (department && department !== category.department.toString()) {
      const dept = await Department.findById(department);
      if (!dept) {
        throw new ApiError(400, 'Department not found');
      }
      category.department = department;
    }

    // Check for duplicate code if changing
    if (code && code.toUpperCase() !== category.code) {
      const existing = await Category.findOne({
        code: code.toUpperCase(),
        department: category.department,
        _id: { $ne: category._id },
      });
      if (existing) {
        throw new ApiError(409, 'Category code already exists in this department');
      }
      category.code = code.toUpperCase();
    }

    if (name) {
      category.name = name;
    }

    if (active !== undefined) {
      category.active = active;
    }

    await category.save();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'update',
      entityType: 'Category',
      entityId: category._id,
      details: { name: category.name, code: category.code },
      ipAddress: req.ip,
    });

    const updatedCategory = await Category.findById(category._id)
      .populate('department', 'name code');

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory,
    });
  })
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category (admin only)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  auth,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid category ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Invalid category ID', errors.array());
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    // Check for related records
    const recordCount = await Record.countDocuments({ category: category._id });
    if (recordCount > 0) {
      throw new ApiError(400, `Cannot delete category with ${recordCount} associated records`);
    }

    await category.deleteOne();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'delete',
      entityType: 'Category',
      entityId: category._id,
      details: { name: category.name, code: category.code },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  })
);

module.exports = router;