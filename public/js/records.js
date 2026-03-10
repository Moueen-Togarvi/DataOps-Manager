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

      // Populate filter dropdown
      const select = document.getElementById('departmentFilter');
      if (select) {
        const currentValue = select.value;
        select.innerHTML =
          '<option value="">All Departments</option>' +
          departments
            .filter((d) => d.active)
            .map((d) => `<option value="${d._id}">${d.name}</option>`)
            .join('');
        select.value = currentValue;
      }
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
          '<option value="">All Categories</option>' +
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
          <div class="flex flex-col items-center justify-center py-12 text-slate-400">
            <span class="material-symbols-outlined text-4xl mb-2">inventory_2</span>
            <h3 class="text-sm font-semibold">No records found</h3>
            <p class="text-xs">Add a new record or adjust your filters</p>
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

  let html = '';

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

  // Export button
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    API.export.excel(getFilterParams());
  });

  // Import button (Trigger modal in records.html)
  document.getElementById('importBtn')?.addEventListener('click', () => {
    document.getElementById('importModal')?.classList.add('active');
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('importModal')?.classList.remove('active');
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
    const confirmed = await Utils.confirm('This will permanently remove the record from the ledger. Are you sure?', 'Delete Operation');
    if (confirmed) {
      try {
        const response = await API.records.delete(id);
        if (response.success) {
          Utils.showToast('Record deleted successfully', 'success');
          loadRecords();
          loadRecordsStats();
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
  ['searchInput', 'departmentFilter', 'categoryFilter', 'statusFilter', 'dateFromFilter', 'dateToFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  currentPage = 1;
  loadRecords();
}

/**
 * Global API Error handler
 */
function handleApiError(error, defaultMessage) {
  console.error(error);
  const message = error.message || defaultMessage;
  Utils.showToast(message, 'error');
}

/**
 * Loading states
 */
function showLoading() {
  const tbody = document.getElementById('recordsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-8 text-center text-slate-400 text-sm">Loading records...</td></tr>';
  }
}

function hideLoading() {}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initRecords);

// Make functions available globally
window.initRecords = initRecords;
window.loadRecords = loadRecords;