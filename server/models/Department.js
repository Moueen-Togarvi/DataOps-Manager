/**
 * Department Mongoose Model
 * Manages department categories for records
 */

const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters'],
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Department code cannot exceed 10 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
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

// Indexes
departmentSchema.index({ active: 1 });

/**
 * Static method to find active departments
 */
departmentSchema.statics.findActive = function() {
  return this.find({ active: true }).sort({ name: 1 });
};

/**
 * Static method to find by code
 */
departmentSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase() });
};

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;