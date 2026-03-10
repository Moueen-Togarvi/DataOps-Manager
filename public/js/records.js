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

      // Populate filter dropdown
      const select = document.getElementById('categoryFilter');
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
    }
  } catch (error) {
    handleApiError(error, 'Failed to load categories');
  }
}

/**
 * Update modal category dropdown based on department
 */
function updateCategoryDropdown(departmentId, selectedCategoryId = '') {
  const categorySelect = document.getElementById('category');
  if (!categorySelect) return;

  categorySelect.innerHTML = '<option value="">Select Category</option>';
  
  if (!departmentId) {
    categorySelect.disabled = true;
    return;
  }
  
  categorySelect.disabled = false;

  const deptCategories = categories.filter(c => 
    c.active && (c.department === departmentId || c.department?._id === departmentId || !c.department)
  );
  
  categorySelect.innerHTML += deptCategories
    .map(c => `<option value="${c._id}">${c.name}</option>`)
    .join('');

  if (selectedCategoryId) {
    categorySelect.value = selectedCategoryId;
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
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-id="${record._id}">
      <td class="px-6 py-4">
        <input type="checkbox" class="record-select rounded border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-primary" data-id="${record._id}" ${
        selectedRecords.has(record._id) ? 'checked' : ''
      }>
      </td>
      <td class="px-6 py-4"><code class="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">${record.recordId || record._id.slice(-8).toUpperCase()}</code></td>
      <td class="px-6 py-4 text-sm">${record.department?.name || '-'}</td>
      <td class="px-6 py-4 text-sm font-medium">${record.unit || '-'}</td>
      <td class="px-6 py-4 text-sm">${record.category?.name || '-'}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${Utils.formatDate(record.date)}</td>
      <td class="px-6 py-4 text-sm text-center">${Utils.formatNumber(record.recordsReceived)}</td>
      <td class="px-6 py-4 text-sm text-center">${Utils.formatNumber(record.recordsProcessed)}</td>
      <td class="px-6 py-4">${Utils.getStatusBadge(record.status)}</td>
      <td class="px-6 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button class="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors edit-btn" data-id="${record._id}" title="Edit">
            <span class="material-symbols-outlined !text-[18px]">edit</span>
          </button>
          <button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded transition-colors delete-btn" data-id="${record._id}" title="Delete">
            <span class="material-symbols-outlined !text-[18px]">delete</span>
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
  const infoEl = document.getElementById('paginationInfo');
  if (!container || !pagination) return;

  // Backend returns: { page, limit, total, pages }
  totalPages = pagination.pages;
  currentPage = pagination.page;

  if (infoEl) {
    const start = (currentPage - 1) * pagination.limit + 1;
    const end = Math.min(currentPage * pagination.limit, pagination.total);
    infoEl.textContent = `Showing ${pagination.total > 0 ? start : 0}–${end} of ${pagination.total} records`;
  }

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  // Previous button
  html += `<button class="pagination-btn px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;

  // Page numbers
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="pagination-btn px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="px-2 py-1.5 text-xs text-slate-400">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn px-3 py-1.5 text-xs font-medium border rounded ${i === currentPage ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="px-2 py-1.5 text-xs text-slate-400">...</span>`;
    html += `<button class="pagination-btn px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  html += `<button class="pagination-btn px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

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

  // Department change updates categories dropdown
  document.getElementById('department')?.addEventListener('change', (e) => {
    updateCategoryDropdown(e.target.value);
  });

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
 * Handle table actions
 */
async function handleTableAction(e) {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');
  const checkbox = e.target.closest('.record-select');

  if (editBtn) {
    const id = editBtn.dataset.id;
    window.location.href = `data-entry.html?id=${id}`;
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const confirmed = await Utils.confirm('Are you sure you want to delete this record?', 'Delete Record');
    if (confirmed) {
      try {
        const response = await API.records.delete(id);
        if (response.success) {
          Utils.showToast('Record deleted successfully', 'success');
          loadRecords();
        }
      } catch (error) {
        handleApiError(error, 'Failed to delete record');
      }
    }
  }

  if (checkbox) {
    const id = checkbox.dataset.id;
    if (checkbox.checked) {
      selectedRecords.add(id);
    } else {
      selectedRecords.delete(id);
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