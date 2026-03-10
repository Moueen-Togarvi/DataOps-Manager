/**
 * Database Backup Utility
 * Handles MongoDB backup and restore operations
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const mongoose = require('mongoose');
const config = require('../config/env');

/**
 * Ensure backup directory exists
 */
const ensureBackupDir = () => {
  const backupDir = config.BACKUP_DIR;
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

/**
 * Get all collections from the database
 * @returns {Promise<Array>} Array of collection names
 */
const getCollections = async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  return collections.map((c) => c.name);
};

/**
 * Export a single collection to JSON
 * @param {string} collectionName - Name of the collection
 * @param {string} outputPath - Path to save the JSON file
 * @returns {Promise<number>} Number of documents exported
 */
const exportCollection = async (collectionName, outputPath) => {
  const collection = mongoose.connection.db.collection(collectionName);
  const documents = await collection.find({}).toArray();

  fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2));

  return documents.length;
};

/**
 * Create a full database backup
 * @returns {Promise<Object>} Backup result with filename and stats
 */
const createBackup = async () => {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${timestamp}`;
  const backupDir = path.join(config.BACKUP_DIR, backupName);

  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });

  const collections = await getCollections();
  const stats = {
    collections: [],
    totalDocuments: 0,
    timestamp: new Date(),
    backupName,
  };

  // Export each collection
  for (const collectionName of collections) {
    // Skip system collections
    if (collectionName.startsWith('system.')) {
      continue;
    }

    const outputPath = path.join(backupDir, `${collectionName}.json`);
    const count = await exportCollection(collectionName, outputPath);

    stats.collections.push({
      name: collectionName,
      documentCount: count,
    });
    stats.totalDocuments += count;
  }

  // Create metadata file
  const metadata = {
    version: config.APP_VERSION,
    timestamp: stats.timestamp,
    collections: stats.collections,
    totalDocuments: stats.totalDocuments,
  };
  fs.writeFileSync(path.join(backupDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Create zip archive
  const zipPath = path.join(config.BACKUP_DIR, `${backupName}.zip`);
  await createZipArchive(backupDir, zipPath);

  // Remove the directory, keep only the zip
  fs.rmSync(backupDir, { recursive: true, force: true });

  return {
    filename: `${backupName}.zip`,
    path: zipPath,
    size: fs.statSync(zipPath).size,
    stats,
  };
};

/**
 * Create a ZIP archive of a directory
 * @param {string} sourceDir - Directory to archive
 * @param {string} outputPath - Path for the ZIP file
 * @returns {Promise<void>}
 */
const createZipArchive = (sourceDir, outputPath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
};

/**
 * List all available backups
 * @returns {Promise<Array>} Array of backup info objects
 */
const listBackups = async () => {
  const backupDir = ensureBackupDir();
  const files = fs.readdirSync(backupDir);

  const backups = files
    .filter((f) => f.endsWith('.zip'))
    .map((filename) => {
      const filePath = path.join(backupDir, filename);
      const stats = fs.statSync(filePath);

      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return backups;
};

/**
 * Delete old backups based on retention policy
 * @returns {Promise<Array>} Array of deleted backup filenames
 */
const cleanupOldBackups = async () => {
  const backupDir = ensureBackupDir();
  const files = fs.readdirSync(backupDir);
  const retentionDays = config.BACKUP_RETENTION_DAYS;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deleted = [];

  for (const filename of files.filter((f) => f.endsWith('.zip'))) {
    const filePath = path.join(backupDir, filename);
    const stats = fs.statSync(filePath);

    if (stats.birthtime < cutoffDate) {
      fs.unlinkSync(filePath);
      deleted.push(filename);
    }
  }

  return deleted;
};

/**
 * Import a collection from JSON
 * @param {string} collectionName - Name of the collection
 * @param {string} jsonPath - Path to the JSON file
 * @returns {Promise<number>} Number of documents imported
 */
const importCollection = async (collectionName, jsonPath) => {
  const collection = mongoose.connection.db.collection(collectionName);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  if (data.length > 0) {
    await collection.insertMany(data);
  }

  return data.length;
};

/**
 * Restore database from backup (WARNING: This will clear existing data)
 * @param {string} backupPath - Path to the backup ZIP file
 * @returns {Promise<Object>} Restore result with stats
 */
const restoreBackup = async (backupPath) => {
  const extractDir = path.join(config.BACKUP_DIR, 'restore-temp');

  // Extract the backup
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(backupPath);
  zip.extractAllTo(extractDir, true);

  const stats = {
    collections: [],
    totalDocuments: 0,
  };

  try {
    // Read metadata
    const metadataPath = path.join(extractDir, 'metadata.json');
    let collections;

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      collections = metadata.collections.map((c) => c.name);
    } else {
      // Fallback: get all JSON files
      collections = fs.readdirSync(extractDir)
        .filter((f) => f.endsWith('.json') && f !== 'metadata.json')
        .map((f) => f.replace('.json', ''));
    }

    // Import each collection
    for (const collectionName of collections) {
      const jsonPath = path.join(extractDir, `${collectionName}.json`);

      if (fs.existsSync(jsonPath)) {
        // Clear existing collection
        await mongoose.connection.db.collection(collectionName).deleteMany({});

        // Import data
        const count = await importCollection(collectionName, jsonPath);

        stats.collections.push({
          name: collectionName,
          documentCount: count,
        });
        stats.totalDocuments += count;
      }
    }
  } finally {
    // Cleanup temp directory
    fs.rmSync(extractDir, { recursive: true, force: true });
  }

  return stats;
};

/**
 * Get backup info by filename
 * @param {string} filename - Backup filename
 * @returns {Object|null} Backup info or null if not found
 */
const getBackupInfo = (filename) => {
  const backupDir = ensureBackupDir();
  const filePath = path.join(backupDir, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);

  return {
    filename,
    path: filePath,
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
};

/**
 * Delete a backup file
 * @param {string} filename - Backup filename to delete
 * @returns {boolean} True if deleted successfully
 */
const deleteBackup = (filename) => {
  const backupDir = ensureBackupDir();
  const filePath = path.join(backupDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }

  return false;
};

module.exports = {
  createBackup,
  listBackups,
  cleanupOldBackups,
  restoreBackup,
  getBackupInfo,
  deleteBackup,
};