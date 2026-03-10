/**
 * Record Mongoose Model
 * Core data model for managing operational records
 */

const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  recordId: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 7);
      return `REC-${timestamp}-${random}`.toUpperCase();
    },
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required'],
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
    maxlength: [100, 'Unit cannot exceed 100 characters'],
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['received', 'pending', 'processed', 'discrepancy'],
    default: 'received',
  },
  recordsReceived: {
    type: Number,
    required: [true, 'Records received is required'],
    min: [0, 'Records received cannot be negative'],
    default: 0,
  },
  recordsProcessed: {
    type: Number,
    required: [true, 'Records processed is required'],
    min: [0, 'Records processed cannot be negative'],
    default: 0,
    validate: {
      validator: function(value) {
        return value <= this.recordsReceived;
      },
      message: 'Records processed cannot exceed records received',
    },
  },
  pendingRecords: {
    type: Number,
    default: 0,
  },
  calculatedValue: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes for efficient queries
recordSchema.index({ department: 1 });
recordSchema.index({ category: 1 });
recordSchema.index({ status: 1 });
recordSchema.index({ date: -1 });
recordSchema.index({ createdBy: 1 });
recordSchema.index({ department: 1, date: -1 });
recordSchema.index({ department: 1, status: 1 });

/**
 * Pre-save middleware to calculate pending records
 */
recordSchema.pre('save', function(next) {
  this.pendingRecords = this.recordsReceived - this.recordsProcessed;

  // Auto-update status based on processing
  if (this.pendingRecords === 0 && this.recordsReceived > 0) {
    this.status = 'processed';
  } else if (this.pendingRecords > 0 && this.status === 'processed') {
    this.status = 'pending';
  }

  next();
});

/**
 * Virtual for processing percentage
 */
recordSchema.virtual('processingPercentage').get(function() {
  if (this.recordsReceived === 0) return 0;
  return Math.round((this.recordsProcessed / this.recordsReceived) * 100);
});

/**
 * Static method to get stats summary
 */
recordSchema.statics.getStats = async function(filters = {}) {
  const stats = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        totalReceived: { $sum: '$recordsReceived' },
        totalProcessed: { $sum: '$recordsProcessed' },
        totalPending: { $sum: '$pendingRecords' },
        totalCalculatedValue: { $sum: '$calculatedValue' },
        discrepancyCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'discrepancy'] }, 1, 0],
          },
        },
      },
    },
  ]);

  return stats[0] || {
    totalRecords: 0,
    totalReceived: 0,
    totalProcessed: 0,
    totalPending: 0,
    totalCalculatedValue: 0,
    discrepancyCount: 0,
  };
};

/**
 * Static method to get category distribution
 */
recordSchema.statics.getCategoryDistribution = async function(filters = {}) {
  return this.aggregate([
    { $match: filters },
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
  ]);
};

/**
 * Static method to get trend data
 */
recordSchema.statics.getTrendData = async function(startDate, endDate, groupBy = 'day') {
  const groupId = groupBy === 'month'
    ? { year: { $year: '$date' }, month: { $month: '$date' } }
    : { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' } };

  return this.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: groupId,
        totalReceived: { $sum: '$recordsReceived' },
        totalProcessed: { $sum: '$recordsProcessed' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);
};

const Record = mongoose.model('Record', recordSchema);

module.exports = Record;