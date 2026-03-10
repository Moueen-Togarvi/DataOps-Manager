/**
 * DataOps Manager - Records Page Logic
 * Handles records listing, filtering, and CRUD operations
 */

// State
let currentPage = 1;
let pageSize = 20;
let totalPages = 1;
let departments = [];
let categories = [];
let selectedRecords = new Set();

/**
 * Initialize records page
 */
async function initRecords() {
  await Promise.all([loadDepartments(), loadCategories()]);
  await Promise.all([loadRecords(), loadRecordsStats()]);
  setupEventListeners();
}

/**
 * Load records statistics
 */
async function loadRecordsStats() {
  try {
    const response = await API.dashboard.getStats();
    if (response.success) {
      const stats = response.data;
      document.getElementById('totalRecordsCount').textContent = Utils.formatNumber(stats.totalRecords);
      document.getElementById('processedCount').textContent = Utils.formatNumber(stats.processedCount);
      document.getElementById('pendingCount').textContent = Utils.formatNumber(stats.pendingCount);
      document.getElementById('discrepancyCountRecords').textContent = Utils.formatNumber(stats.discrepancyCount);
    }
  } catch (error) {
    console.error('Failed to load records stats:', error);
  }
}

/**
 * Load departments for dropdowns
 */
async function loadDepartments() {
  try {
    const response = await API.departments.getAll();
    if (response.success) {
      departments = response.data;

      // Populate dropdowns
      const selects = ['departmentFilter', 'department'];
      selects.forEach((id) => {
        const select = document.getElementById(id);
        if (select) {
          const currentValue = select.value;
          select.innerHTML =
            '<option value="">Select Department</option>' +
            departments
              .filter((d) => d.active)
              .map((d) => `<option value="${d._id}">${d.name}</option>`)
              .join('');
          select.value = currentValue;
        }
      });
    }
  } catch (error) {
    handleApiError(error, 'Failed to load departments');
  }
}

/**
 * Load categories for dropdowns
 */
async function loadCategories() {
  try {
    const response = await API.categories.getAll();
    if (response.success) {
      categories = response.data;

      // Populate dropdowns
      const selects = ['categoryFilter', 'category'];
      selects.forEach((id) => {
        const select = document.getElementById(id);
        if (select) {
          const currentValue = select.value;
          select.innerHTML =
            '<option value="">Select Category</option>' +
            categories
              .filter((c) => c.active)
              .map((c) => `<option value="${c._id}">${c.name}</option>`)
              .join('');
          select.value = currentValue;
        }
      });
    }
  } catch (error) {
    handleApiError(error, 'Failed to load categories');
  }
}

/**
 * Load records with current filters
 */
async function loadRecords() {
  showLoading();

  try {
    const params = getFilterParams();
    params.page = currentPage;
    params.limit = pageSize;

    const response = await API.records.getAll(params);

    if (response.success) {
      renderRecords(response.data.records);
      renderPagination(response.data.pagination);
    }
  } catch (error) {
    handleApiError(error, 'Failed to load records');
  } finally {
    hideLoading();
  }
}

/**
 * Get filter parameters
 */
function getFilterParams() {
  const params = {};

  const search = document.getElementById('searchInput')?.value?.trim();
  if (search) params.search = search;

  const department = document.getElementById('departmentFilter')?.value;
  if (department) params.department = department;

  const category = document.getElementById('categoryFilter')?.value;
  if (category) params.category = category;

  const status = document.getElementById('statusFilter')?.value;
  if (status) params.status = status;

  const dateFrom = document.getElementById('dateFromFilter')?.value;
  if (dateFrom) params.startDate = dateFrom;

  const dateTo = document.getElementById('dateToFilter')?.value;
  if (dateTo) params.endDate = dateTo;

  return params;
}

/**
 * Render records table
 */
function renderRecords(records) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center">
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <h3>No records found</h3>
            <p>Add a new record or adjust your filters</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records
    .map(
      (record) => `
    <tr data-id="${record._id}">
      <td>
        <input type="checkbox" class="record-select" data-id="${record._id}" ${
        selectedRecords.has(record._id) ? 'checked' : ''
      }>
      </td>
      <td><code>${record.recordId || record._id.slice(-8).toUpperCase()}</code></td>
      <td>${record.department?.name || '-'}</td>
      <td>${record.unit || '-'}</td>
      <td>${record.category?.name || '-'}</td>
      <td>${Utils.formatDate(record.date)}</td>
      <td>${Utils.formatNumber(record.recordsReceived)}</td>
      <td>${Utils.formatNumber(record.recordsProcessed)}</td>
      <td>${Utils.formatNumber(record.pendingRecords)}</td>
      <td>${Utils.getStatusBadge(record.status)}</td>
      <td>
        <div class="flex gap-sm">
          <button class="btn btn-sm btn-icon edit-btn" data-id="${record._id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon delete-btn" data-id="${record._id}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join('');
}

/**
 * Render pagination
 */
function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  if (!container || !pagination) return;

  totalPages = pagination.totalPages;
  currentPage = pagination.currentPage;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Previous button
  html += `<button class="pagination-btn" data-page="${currentPage - 1}" ${
    currentPage === 1 ? 'disabled' : ''
  }>Prev</button>`;

  // Page numbers
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="pagination-btn" disabled>...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="pagination-btn" disabled>...</span>`;
    html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  html += `<button class="pagination-btn" data-page="${currentPage + 1}" ${
    currentPage === totalPages ? 'disabled' : ''
  }>Next</button>`;

  container.innerHTML = html;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add record button
  document.getElementById('addRecordBtn')?.addEventListener('click', () => openRecordModal());

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('recordModal')?.classList.remove('active');
      document.getElementById('importModal')?.classList.remove('active');
    });
  });

  // Save record
  document.getElementById('saveRecordBtn')?.addEventListener('click', saveRecord);

  // Search with debounce
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', Utils.debounce(() => {
      currentPage = 1;
      loadRecords();
    }, 300));
  }

  // Filters
  ['departmentFilter', 'categoryFilter', 'statusFilter', 'dateFromFilter', 'dateToFilter'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      currentPage = 1;
      loadRecords();
    });
  });

  // Clear filters
  document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);

  // Pagination clicks
  document.getElementById('pagination')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.pagination-btn');
    if (btn && !btn.disabled) {
      currentPage = parseInt(btn.dataset.page);
      loadRecords();
    }
  });

  // Table actions
  document.getElementById('recordsTableBody')?.addEventListener('click', handleTableAction);

  // Select all
  document.getElementById('selectAll')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.record-select').forEach((cb) => {
      cb.checked = checked;
      if (checked) {
        selectedRecords.add(cb.dataset.id);
      } else {
        selectedRecords.delete(cb.dataset.id);
      }
    });
  });

  // Import button
  document.getElementById('importBtn')?.addEventListener('click', () => {
    document.getElementById('importModal')?.classList.add('active');
  });

  // Import file change
  document.getElementById('importFile')?.addEventListener('change', handleImportFile);

  // Confirm import
  document.getElementById('confirmImportBtn')?.addEventListener('click', confirmImport);

  // Download template
  document.getElementById('downloadTemplateBtn')?.addEventListener('click', downloadTemplate);

  // Export button
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    API.export.excel(getFilterParams());
  });

  // Calculate pending records
  const receivedInput = document.getElementById('recordsReceived');
  const processedInput = document.getElementById('recordsProcessed');

  [receivedInput, processedInput].forEach((input) => {
    input?.addEventListener('input', () => {
      const received = parseInt(receivedInput?.value) || 0;
      const processed = parseInt(processedInput?.value) || 0;
      // Could show pending in a separate field or update calculated value
    });
  });
}

/**
 * Open record modal
 */
function openRecordModal(record = null) {
  const modal = document.getElementById('recordModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('recordForm');

  if (record) {
    title.textContent = 'Edit Record';
    document.getElementById('recordId').value = record._id;
    document.getElementById('department').value = record.department?._id || '';
    document.getElementById('unit').value = record.unit || '';
    document.getElementById('category').value = record.category?._id || '';
    document.getElementById('recordDate').value = Utils.formatDate(record.date, 'iso');
    document.getElementById('recordsReceived').value = record.recordsReceived || 0;
    document.getElementById('recordsProcessed').value = record.recordsProcessed || 0;
    document.getElementById('recordStatus').value = record.status || 'received';
    document.getElementById('calculatedValue').value = record.calculatedValue || '';
    document.getElementById('notes').value = record.notes || '';
  } else {
    title.textContent = 'Add Record';
    form.reset();
    document.getElementById('recordId').value = '';
    document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
  }

  modal?.classList.add('active');
}

/**
 * Save record
 */
async function saveRecord() {
  const id = document.getElementById('recordId').value;
  const data = {
    department: document.getElementById('department').value,
    unit: document.getElementById('unit').value,
    category: document.getElementById('category').value,
    date: document.getElementById('recordDate').value,
    recordsReceived: parseInt(document.getElementById('recordsReceived').value) || 0,
    recordsProcessed: parseInt(document.getElementById('recordsProcessed').value) || 0,
    status: document.getElementById('recordStatus').value,
    calculatedValue: parseFloat(document.getElementById('calculatedValue').value) || 0,
    notes: document.getElementById('notes').value,
  };

  try {
    showLoading();

    let response;
    if (id) {
      response = await API.records.update(id, data);
    } else {
      response = await API.records.create(data);
    }

    if (response.success) {
      document.getElementById('recordModal')?.classList.remove('active');
      Utils.showToast(id ? 'Record updated successfully' : 'Record created successfully', 'success');
      loadRecords();
    }
  } catch (error) {
    handleApiError(error, 'Failed to save record');
  } finally {
    hideLoading();
  }
}

/**
 * Handle table actions
 */
async function handleTableAction(e) {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');
  const checkbox = e.target.closest('.record-select');

  if (editBtn) {
    const id = editBtn.dataset.id;
    const row = editBtn.closest('tr');
    // Fetch full record and open modal
    try {
      const response = await API.records.getById(id);
      if (response.success) {
        openRecordModal(response.data);
      }
    } catch (error) {
      handleApiError(error, 'Failed to load record');
    }
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const confirmed = await Utils.confirm('Are you sure you want to delete this record?', 'Delete Record');
    if (confirmed) {
      try {
        await API.records.delete(id);
        Utils.showToast('Record deleted successfully', 'success');
        loadRecords();
      } catch (error) {
        handleApiError(error, 'Failed to delete record');
      }
    }
  }

  if (checkbox) {
    if (checkbox.checked) {
      selectedRecords.add(checkbox.dataset.id);
    } else {
      selectedRecords.delete(checkbox.dataset.id);
    }
  }
}

/**
 * Clear all filters
 */
function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('departmentFilter').value = '';
  document.getElementById('categoryFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('dateFromFilter').value = '';
  document.getElementById('dateToFilter').value = '';
  currentPage = 1;
  loadRecords();
}

/**
 * Handle import file selection
 */
async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const response = await API.import.upload(file);

    if (response.success) {
      showImportPreview(response.data);
      document.getElementById('confirmImportBtn').disabled = false;
    }
  } catch (error) {
    handleApiError(error, 'Failed to parse file');
    document.getElementById('confirmImportBtn').disabled = true;
  }
}

/**
 * Show import preview
 */
function showImportPreview(data) {
  const preview = document.getElementById('importPreview');
  const table = document.getElementById('importPreviewTable');

  if (!preview || !table) return;

  if (!data || data.length === 0) {
    preview.classList.add('hidden');
    return;
  }

  // Create header
  const headers = Object.keys(data[0]);
  let html = '<thead><tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr></thead>';

  // Create body (show first 10 rows)
  html += '<tbody>';
  data.slice(0, 10).forEach((row) => {
    html += '<tr>' + headers.map((h) => `<td>${row[h] || ''}</td>`).join('') + '</tr>';
  });
  if (data.length > 10) {
    html += `<tr><td colspan="${headers.length}" class="text-center text-muted">... and ${data.length - 10} more rows</td></tr>`;
  }
  html += '</tbody>';

  table.innerHTML = html;
  preview.classList.remove('hidden');
}

/**
 * Confirm import
 */
async function confirmImport() {
  // This would typically save the imported data
  Utils.showToast('Import functionality requires server-side handling', 'info');
  document.getElementById('importModal')?.classList.remove('active');
}

/**
 * Download import template
 */
function downloadTemplate() {
  const template = [
    {
      departmentCode: 'OPS',
      unit: 'Unit Name',
      categoryCode: 'CAT1',
      date: '2024-01-15',
      recordsReceived: 100,
      recordsProcessed: 95,
      status: 'processed',
      calculatedValue: 0,
      notes: 'Optional notes',
    },
  ];

  const csv = Utils.tableToCSV ? createCSV(template) : '';
  const blob = new Blob([csv], { type: 'text/csv' });
  Utils.downloadBlob(blob, 'import_template.csv');
}

/**
 * Create CSV from data
 */
function createCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => `"${row[h] || ''}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

// Make functions available globally
window.initRecords = initRecords;
window.loadRecords = loadRecords;