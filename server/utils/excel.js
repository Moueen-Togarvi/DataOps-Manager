/**
 * Excel/CSV Import/Export Utility
 * Handles file parsing and generation for data import/export
 */

const XLSX = require('xlsx');
const Papa = require('papaparse');

/**
 * Parse Excel file buffer to JSON
 * @param {Buffer} buffer - Excel file buffer
 * @param {Object} options - Parse options
 * @returns {Array} Parsed data array
 */
const parseExcel = (buffer, options = {}) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = options.sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: '',
    ...options,
  });
};

/**
 * Parse CSV string to JSON
 * @param {string} csvString - CSV content string
 * @param {Object} options - Parse options
 * @returns {Array} Parsed data array
 */
const parseCSV = (csvString, options = {}) => {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    ...options,
  });

  return result.data;
};

/**
 * Generate Excel workbook from data
 * @param {Array} data - Data array
 * @param {Object} options - Generation options
 * @returns {Buffer} Excel file buffer
 */
const generateExcel = (data, options = {}) => {
  const { sheetName = 'Data', columns = null } = options;

  // Filter columns if specified
  let exportData = data;
  if (columns && Array.isArray(columns)) {
    exportData = data.map((row) => {
      const filteredRow = {};
      columns.forEach((col) => {
        if (typeof col === 'string') {
          filteredRow[col] = row[col];
        } else if (col.key && col.label) {
          filteredRow[col.label] = row[col.key];
        }
      });
      return filteredRow;
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Generate CSV string from data
 * @param {Array} data - Data array
 * @param {Object} options - Generation options
 * @returns {string} CSV content string
 */
const generateCSV = (data, options = {}) => {
  const { columns = null } = options;

  // Filter columns if specified
  let exportData = data;
  if (columns && Array.isArray(columns)) {
    exportData = data.map((row) => {
      const filteredRow = {};
      columns.forEach((col) => {
        if (typeof col === 'string') {
          filteredRow[col] = row[col];
        } else if (col.key && col.label) {
          filteredRow[col.label] = row[col.key];
        }
      });
      return filteredRow;
    });
  }

  return Papa.unparse(exportData, {
    header: true,
    ...options,
  });
};

/**
 * Validate import data against schema
 * @param {Array} data - Data array to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result { valid: boolean, errors: Array }
 */
const validateImportData = (data, schema) => {
  const errors = [];

  data.forEach((row, index) => {
    for (const [field, rules] of Object.entries(schema)) {
      const value = row[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ row: index + 2, field, error: `${field} is required` });
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rules.type === 'number' && isNaN(Number(value))) {
          errors.push({ row: index + 2, field, error: `${field} must be a number` });
        }

        if (rules.type === 'date' && isNaN(Date.parse(value))) {
          errors.push({ row: index + 2, field, error: `${field} must be a valid date` });
        }

        if (rules.enum && !rules.enum.includes(value)) {
          errors.push({ row: index + 2, field, error: `${field} must be one of: ${rules.enum.join(', ')}` });
        }

        if (rules.minLength && String(value).length < rules.minLength) {
          errors.push({ row: index + 2, field, error: `${field} must be at least ${rules.minLength} characters` });
        }

        if (rules.maxLength && String(value).length > rules.maxLength) {
          errors.push({ row: index + 2, field, error: `${field} must not exceed ${rules.maxLength} characters` });
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Record import schema
 */
const recordImportSchema = {
  departmentCode: { required: true, minLength: 1, maxLength: 10 },
  categoryCode: { required: true, minLength: 1, maxLength: 10 },
  unit: { required: true, minLength: 1, maxLength: 100 },
  date: { required: true, type: 'date' },
  recordsReceived: { required: true, type: 'number' },
  recordsProcessed: { required: true, type: 'number' },
  calculatedValue: { required: false, type: 'number' },
  status: { required: false, enum: ['pending', 'processed', 'discrepancy'] },
  notes: { required: false, maxLength: 2000 },
};

/**
 * Transform raw import data to record format
 * @param {Array} data - Raw import data
 * @returns {Array} Transformed records
 */
const transformImportData = (data) => {
  return data.map((row) => ({
    departmentCode: String(row.departmentCode || row['Department Code'] || '').trim(),
    categoryCode: String(row.categoryCode || row['Category Code'] || '').trim(),
    unit: String(row.unit || row.Unit || '').trim(),
    date: row.date || row.Date || new Date(),
    recordsReceived: Number(row.recordsReceived || row['Records Received'] || 0),
    recordsProcessed: Number(row.recordsProcessed || row['Records Processed'] || 0),
    calculatedValue: Number(row.calculatedValue || row['Calculated Value'] || 0),
    status: String(row.status || row.Status || 'pending').toLowerCase().trim(),
    notes: String(row.notes || row.Notes || '').trim(),
  }));
};

/**
 * Get Excel file content type
 */
const excelContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Get CSV content type
 */
const csvContentType = 'text/csv';

module.exports = {
  parseExcel,
  parseCSV,
  generateExcel,
  generateCSV,
  validateImportData,
  recordImportSchema,
  transformImportData,
  excelContentType,
  csvContentType,
};