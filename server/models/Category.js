/**
 * Category Mongoose Model
 * Manages record categories within departments
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters'],
  },
  code: {
    type: String,
    required: [true, 'Category code is required'],
    trim: true,
    uppercase: true,
    maxlength: [10, 'Category code cannot exceed 10 characters'],
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required'],
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// Compound index for unique category within department
categorySchema.index({ department: 1, code: 1 }, { unique: true });
categorySchema.index({ active: 1 });
categorySchema.index({ name: 'text' });

/**
 * Static method to find active categories
 */
categorySchema.statics.findActive = function(departmentId = null) {
  const query = { active: true };
  if (departmentId) {
    query.department = departmentId;
  }
  return this.find(query).sort({ name: 1 }).populate('department', 'name code');
};

/**
 * Static method to find by code within department
 */
categorySchema.statics.findByCode = function(code, departmentId) {
  return this.findOne({ code: code.toUpperCase(), department: departmentId });
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;