/**
 * Scheduled Backup Job
 * Runs daily database backups using node-cron
 */

const cron = require('node-cron');
const backup = require('../utils/backup');
const ActivityLog = require('../models/ActivityLog');

/**
 * Run backup job
 */
const runBackup = async () => {
  console.log('[Backup Job] Starting scheduled backup...');
  const startTime = Date.now();

  try {
    const result = await backup.createBackup();
    const duration = Date.now() - startTime;

    console.log(`[Backup Job] Backup completed successfully: ${result.filename}`);
    console.log(`[Backup Job] Documents: ${result.stats.totalDocuments}, Duration: ${duration}ms`);

    // Log activity
    await ActivityLog.log({
      userId: null,
      action: 'backup_completed',
      entityType: 'Backup',
      details: {
        filename: result.filename,
        size: result.size,
        documentCount: result.stats.totalDocuments,
        collectionCount: result.stats.collections.length,
        duration,
      },
    });

    // Cleanup old backups
    const deleted = await backup.cleanupOldBackups();
    if (deleted.length > 0) {
      console.log(`[Backup Job] Cleaned up ${deleted.length} old backup(s)`);
    }

    return result;
  } catch (error) {
    console.error('[Backup Job] Backup failed:', error.message);

    // Log error
    await ActivityLog.log({
      userId: null,
      action: 'backup_failed',
      entityType: 'Backup',
      details: {
        error: error.message,
        stack: error.stack,
      },
    });

    throw error;
  }
};

/**
 * Initialize scheduled backup job
 * Runs daily at 2:00 AM
 */
const initBackupJob = () => {
  // Run at 2:00 AM every day
  const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';

  console.log(`[Backup Job] Scheduling daily backup with cron: ${schedule}`);

  const job = cron.schedule(schedule, async () => {
    try {
      await runBackup();
    } catch (error) {
      console.error('[Backup Job] Scheduled backup failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC',
  });

  return job;
};

/**
 * Stop backup job
 */
const stopBackupJob = (job) => {
  if (job) {
    job.stop();
    console.log('[Backup Job] Stopped scheduled backup job');
  }
};

module.exports = {
  initBackupJob,
  stopBackupJob,
  runBackup,
};