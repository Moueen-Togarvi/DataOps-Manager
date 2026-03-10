/**
 * Environment configuration module
 * Loads and validates environment variables
 */

require('dotenv').config();

module.exports = {
  // Server configuration
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB configuration
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/dataops-manager',

  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || 'development-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Application settings
  APP_NAME: 'DataOps Manager',
  APP_VERSION: '1.0.0',

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Backup configuration
  BACKUP_DIR: process.env.BACKUP_DIR || './backups',
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30,
};