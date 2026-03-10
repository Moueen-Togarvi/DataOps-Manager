/**
 * ActivityLog Mongoose Model
 * Tracks user activities for audit purposes
 */

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    maxlength: [100, 'Action cannot exceed 100 characters'],
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    enum: ['User', 'Record', 'Department', 'Category', 'System', 'Backup'],
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
    trim: true,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes for efficient queries
activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ entityType: 1 });
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });

/**
 * Static method to log activity
 */
activityLogSchema.statics.log = async function(data) {
  return this.create(data);
};

/**
 * Static method to get recent activity
 */
activityLogSchema.statics.getRecent = async function(limit = 50) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username email');
};

/**
 * Static method to get logs by user
 */
activityLogSchema.statics.getByUser = async function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

/**
 * Static method to get logs by entity
 */
activityLogSchema.statics.getByEntity = async function(entityType, entityId, limit = 100) {
  return this.find({ entityType, entityId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;