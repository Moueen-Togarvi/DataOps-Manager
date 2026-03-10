/**
 * DataOps Manager - Express Application Entry Point
 * Main server configuration and route mounting
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const recordsRoutes = require('./routes/records');
const departmentsRoutes = require('./routes/departments');
const categoriesRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const logsRoutes = require('./routes/logs');
const reportsRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');

// Import middleware
const {
  notFound,
  validationErrorHandler,
  duplicateKeyErrorHandler,
  jwtErrorHandler,
  errorHandler,
} = require('./middleware/errorHandler');

// Import utilities
const { parseExcel, parseCSV, generateExcel, generateCSV, recordImportSchema, validateImportData, transformImportData } = require('./utils/excel');
const { generateReportHTML } = require('./utils/pdf');
const { createBackup, listBackups, getBackupInfo, deleteBackup } = require('./utils/backup');

// Import models for initialization
const User = require('./models/User');
const Department = require('./models/Department');
const Category = require('./models/Category');
const ActivityLog = require('./models/ActivityLog');

// Create Express app
const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  },
});

/**
 * Initialize the application
 * Connects to database and creates initial data if needed
 */
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Create initial admin user if none exists
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const admin = new User({
        username: 'admin',
        email: 'admin@dataops.local',
        passwordHash: 'admin123', // Will be hashed by model middleware
        role: 'admin',
      });
      await admin.save();
      console.log('Initial admin user created (username: admin, password: admin123)');
      console.log('IMPORTANT: Change the admin password immediately!');
    }

    // Create initial department if none exists
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      const dept = new Department({
        name: 'Operations',
        code: 'OPS',
        description: 'General Operations Department',
      });
      await dept.save();
      console.log('Initial department created: Operations');
    }

    // Start scheduled backup job
    const { initBackupJob } = require('./jobs/backup');
    initBackupJob();

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.NODE_ENV === 'production' ? false : true,
  credentials: true,
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (config.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// File import endpoint
app.post('/api/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    let data;
    const filename = req.file.originalname.toLowerCase();

    if (filename.endsWith('.csv')) {
      data = parseCSV(req.file.buffer.toString('utf8'));
    } else {
      data = parseExcel(req.file.buffer);
    }

    // Transform and validate
    const transformedData = transformImportData(data);
    const validation = validateImportData(transformedData, recordImportSchema);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    res.json({
      success: true,
      message: `Parsed ${transformedData.length} records from file`,
      data: transformedData,
    });
  } catch (error) {
    next(error);
  }
});

// File export endpoint
app.get('/api/export', async (req, res, next) => {
  try {
    const { format = 'excel' } = req.query;

    // Get data from records route (simplified for demo)
    const Record = require('./models/Record');
    const records = await Record.find()
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ date: -1 })
      .limit(1000);

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

    if (format === 'csv') {
      const csv = generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      return res.send(csv);
    } else {
      const excel = generateExcel(exportData, { sheetName: 'Records' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
      return res.send(excel);
    }
  } catch (error) {
    next(error);
  }
});

// PDF report endpoint
app.get('/api/reports/pdf', async (req, res, next) => {
  try {
    const { type = 'general' } = req.query;

    // Get data based on type
    const Record = require('./models/Record');
    const records = await Record.find()
      .populate('department', 'name code')
      .populate('category', 'name code')
      .sort({ date: -1 })
      .limit(100);

    const html = generateReportHTML(records, {
      title: `DataOps ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      type,
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="report-${type}.html"`);
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// Backup endpoints (admin only)
const { auth, adminOnly } = require('./middleware/auth');

app.get('/api/backup', auth, adminOnly, async (req, res, next) => {
  try {
    const backups = await listBackups();
    res.json({
      success: true,
      data: backups,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/backup', auth, adminOnly, async (req, res, next) => {
  // Set a longer timeout for backup creation (5 minutes)
  req.setTimeout(300000);
  try {
    const result = await createBackup();

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'backup_created',
      entityType: 'Backup',
      details: {
        filename: result.filename,
        size: result.size,
        documentCount: result.stats.totalDocuments,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Backup created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/backup/:filename', auth, adminOnly, async (req, res, next) => {
  try {
    const info = getBackupInfo(req.params.filename);
    if (!info) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
      });
    }
    res.download(info.path, info.filename);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/backup/:filename', auth, adminOnly, async (req, res, next) => {
  try {
    const deleted = deleteBackup(req.params.filename);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
      });
    }

    // Log activity
    await ActivityLog.log({
      userId: req.user._id,
      action: 'backup_deleted',
      entityType: 'Backup',
      details: { filename: req.params.filename },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    version: config.APP_VERSION,
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: config.APP_NAME,
    version: config.APP_VERSION,
    endpoints: {
      auth: '/api/auth',
      records: '/api/records',
      departments: '/api/departments',
      categories: '/api/categories',
      users: '/api/users',
      logs: '/api/logs',
      reports: '/api/reports',
      dashboard: '/api/dashboard',
    },
  });
});

// Error handling middleware
app.use(validationErrorHandler);
app.use(duplicateKeyErrorHandler);
app.use(jwtErrorHandler);
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('\nReceived shutdown signal. Closing connections...');
  await disconnectDB();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  await initializeApp();

  const server = app.listen(config.PORT, () => {
    console.log(`\n${config.APP_NAME} v${config.APP_VERSION}`);
    console.log(`Server running on port ${config.PORT}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`\nAccess the application at: http://localhost:${config.PORT}`);
  });

  return server;
};

// Start if run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, startServer };