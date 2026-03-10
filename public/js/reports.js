/**
 * DataOps Manager - Reports Page Logic
 */

// Chart instances
let trendChartInstance = null;
let statusChartInstance = null;

// Report data cache
let reportData = null;
let currentPeriod = 'monthly';

document.addEventListener('DOMContentLoaded', initReports);

/**
 * Initialize reports page
 */
async function initReports() {
  await loadDepartments();
  await loadCategories();
  
  // Check for status in URL (drill-down from dashboard)
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  if (status) {
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.value = status;
  }

  setupEventListeners();
  generateReport(); 
}

/**
 * Load departments for filter
 */
async function loadDepartments() {
  try {
    const response = await API.departments.getAll();
    if (response.success) {
      const select = document.getElementById('departmentFilter');
      if (select) {
        select.innerHTML =
          '<option value="">All Departments</option>' +
          response.data
            .filter((d) => d.active)
            .map((d) => `<option value="${d._id}">${d.name}</option>`)
            .join('');
      }
    }
  } catch (error) {
    console.error('Failed to load departments:', error);
  }
}

/**
 * Load categories for filter
 */
async function loadCategories(departmentId = '') {
  try {
    const params = departmentId ? { department: departmentId } : {};
    const response = await API.categories.getAll(params);
    if (response.success) {
      const select = document.getElementById('categoryFilter');
      if (select) {
        select.innerHTML =
          '<option value="">All Categories</option>' +
          response.data
            .filter((c) => c.active)
            .map((c) => `<option value="${c._id}">${c.name}</option>`)
            .join('');
      }
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Period buttons
  document.querySelectorAll('.report-period').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Update UI
      document.querySelectorAll('.report-period').forEach(b => {
        b.classList.remove('bg-white', 'dark:bg-slate-700', 'text-primary', 'shadow-sm');
        b.classList.add('text-slate-500', 'dark:text-slate-400');
      });
      btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-primary', 'shadow-sm');
      btn.classList.remove('text-slate-500', 'dark:text-slate-400');

      currentPeriod = btn.dataset.period;
      
      // Show/hide custom date inputs
      const customInputs = document.getElementById('customDateInputs');
      if (customInputs) {
        if (currentPeriod === 'custom') {
          customInputs.classList.remove('hidden');
        } else {
          customInputs.classList.add('hidden');
        }
      }

      updateDateDisplay();
      generateReport();
    });
  });

  // Generate report button
  document.getElementById('generateReportBtn')?.addEventListener('click', generateReport);

  // Filter change auto-generate
  ['departmentFilter', 'unitFilter', 'categoryFilter', 'statusFilter', 'reportType'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (id === 'departmentFilter') {
        loadCategories(document.getElementById(id).value);
      }
      generateReport();
    });
  });

  // Export & Print
  document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
    API.export.excel(getReportParams());
  });

  document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
    API.export.pdf('general');
  });

  document.getElementById('printReportBtn')?.addEventListener('click', () => {
    window.print();
  });
}

/**
 * Update the human-readable date display
 */
function updateDateDisplay() {
  const display = document.getElementById('dateRangeDisplay');
  if (!display) return;

  const { startDate, endDate } = getDateRange();
  
  if (currentPeriod === 'daily') {
    display.textContent = 'Today (' + Utils.formatDate(startDate) + ')';
  } else if (currentPeriod === 'weekly') {
    display.textContent = 'This Week';
  } else if (currentPeriod === 'monthly') {
    display.textContent = 'This Month';
  } else if (currentPeriod === 'custom') {
    if (startDate && endDate) {
      display.textContent = `${Utils.formatDate(startDate)} - ${Utils.formatDate(endDate)}`;
    } else {
      display.textContent = 'Select Dates';
    }
  }
}

/**
 * Get date range from selection
 */
function getDateRange() {
  const today = new Date();
  let startDate, endDate;

  switch (currentPeriod) {
    case 'daily':
      startDate = endDate = today.toISOString().split('T')[0];
      break;
    case 'weekly':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - today.getDay());
      startDate = weekStart.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'monthly':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'custom':
      startDate = document.getElementById('dateFrom')?.value;
      endDate = document.getElementById('dateTo')?.value;
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
  }

  return { startDate, endDate };
}

/**
 * Get report parameters
 */
function getReportParams() {
  const { startDate, endDate } = getDateRange();
  const params = {};

  if (startDate) params.dateFrom = startDate;
  if (endDate) params.dateTo = endDate;

  const department = document.getElementById('departmentFilter')?.value;
  if (department) params.department = department;

  const unit = document.getElementById('unitFilter')?.value;
  if (unit) params.unit = unit;

  const category = document.getElementById('categoryFilter')?.value;
  if (category) params.category = category;

  const status = document.getElementById('statusFilter')?.value;
  if (status) params.status = status;

  return params;
}

/**
 * Generate report
 */
async function generateReport() {
  showLoading();

  try {
    const params = getReportParams();
    const response = await API.records.getAll({ ...params, limit: 1000 });

    if (response.success) {
      reportData = response.data.records || response.data;
      renderReportStats(reportData);
      renderReportCharts(reportData);
      renderReportTable(reportData);
    }
  } catch (error) {
    handleApiError(error, 'Failed to generate report');
  } finally {
    hideLoading();
  }
}

/**
 * Render report statistics
 */
function renderReportStats(records) {
  const stats = {
    totalRecords: records.length,
    recordsReceived: records.reduce((sum, r) => sum + (r.recordsReceived || 0), 0),
    recordsProcessed: records.reduce((sum, r) => sum + (r.recordsProcessed || 0), 0),
    pendingRecords: records.reduce((sum, r) => sum + (r.pendingRecords || 0), 0),
  };

  document.getElementById('reportTotalRecords').textContent = Utils.formatNumber(stats.totalRecords);
  document.getElementById('reportRecordsReceived').textContent = Utils.formatNumber(stats.recordsReceived);
  document.getElementById('reportRecordsProcessed').textContent = Utils.formatNumber(stats.recordsProcessed);
  document.getElementById('reportPendingRecords').textContent = Utils.formatNumber(stats.pendingRecords);
}

/**
 * Render report charts
 */
function renderReportCharts(records) {
  renderTrendChart(records);
  renderStatusChart(records);
}

/**
 * Render trend chart
 */
function renderTrendChart(records) {
  const canvas = document.getElementById('reportTrendChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  // Group by date
  const byDate = {};
  records.forEach((r) => {
    const date = Utils.formatDate(r.date, 'iso');
    if (!byDate[date]) {
      byDate[date] = { received: 0, processed: 0 };
    }
    byDate[date].received += r.recordsReceived || 0;
    byDate[date].processed += r.recordsProcessed || 0;
  });

  const labels = Object.keys(byDate).sort();
  const receivedData = labels.map((d) => byDate[d].received);
  const processedData = labels.map((d) => byDate[d].processed);

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map((l) => {
        const d = new Date(l);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Received',
          data: receivedData,
          borderColor: '#627d98',
          backgroundColor: 'rgba(98, 125, 152, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Processed',
          data: processedData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    },
  });
}

/**
 * Render status chart
 */
function renderStatusChart(records) {
  const canvas = document.getElementById('reportStatusChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  // Count by status
  const statusCounts = {};
  records.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const statusLabels = {
    pending: 'Pending',
    processed: 'Processed',
    discrepancy: 'Discrepancy',
    received: 'Received',
  };

  const statusColors = {
    pending: '#f59e0b',
    processed: '#10b981',
    discrepancy: '#ef4444',
    received: '#3b82f6',
  };

  const labels = Object.keys(statusCounts);
  const data = labels.map((l) => statusCounts[l]);
  const colors = labels.map((l) => statusColors[l] || '#6b7280');

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map((l) => statusLabels[l] || l),
      datasets: [
        {
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
      },
      cutout: '60%',
    },
  });
}

/**
 * Render report table
 */
function renderReportTable(records) {
  const tbody = document.getElementById('reportTableBody');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No records found for selected criteria</td></tr>';
    return;
  }

  // Sort by date descending
  const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sortedRecords
    .map(
      (r) => `
    <tr>
      <td><code>${r.recordId || r._id.slice(-8).toUpperCase()}</code></td>
      <td>${r.department?.name || '-'}</td>
      <td>${r.unit || '-'}</td>
      <td>${r.category?.name || '-'}</td>
      <td>${Utils.formatDate(r.date)}</td>
      <td>${Utils.formatNumber(r.recordsReceived)}</td>
      <td>${Utils.formatNumber(r.recordsProcessed)}</td>
      <td>${Utils.formatNumber(r.pendingRecords)}</td>
      <td>${Utils.getStatusBadge(r.status)}</td>
    </tr>
  `
    )
    .join('');
}

// Make functions available globally
window.initReports = initReports;
window.generateReport = generateReport;