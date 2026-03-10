/**
 * DataOps Manager - Dashboard Page Logic
 * Handles dashboard data loading and chart rendering
 */

// Chart instances
let categoryChart = null;
let trendChart = null;
let statusChart = null;

/**
 * Initialize dashboard
 */
async function initDashboard() {
  // Set current date
  const currentDateEl = document.getElementById('currentDate');
  if (currentDateEl) {
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // Load dashboard data
  await loadDashboardSummary();

  // Setup auto-refresh (every 5 minutes)
  setInterval(loadDashboardSummary, 5 * 60 * 1000);
}

/**
 * Load dashboard summary data
 */
async function loadDashboardSummary() {
  try {
    const response = await API.dashboard.getSummary();

    if (response.success) {
      const { stats, recentRecords, recentActivity, categoryDistribution } = response.data;

      // Update stats
      updateStats(stats);

      // Update recent records table
      updateRecentRecords(recentRecords);

      // Update activity list
      updateActivityList(recentActivity);

      // Load charts data
      await loadCharts();
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    Utils.showToast('Failed to load dashboard data', 'error');
  }
}

/**
 * Update statistics cards
 */
function updateStats(stats) {
  const elements = {
    totalRecords: stats.totalRecords,
    totalReceived: stats.totalReceived,
    totalProcessed: stats.totalProcessed,
    totalPending: stats.totalPending,
    totalCalculatedValue: stats.totalCalculatedValue,
    discrepancyCount: stats.discrepancyCount,
  };

  Object.entries(elements).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'totalCalculatedValue') {
        el.textContent = Utils.formatCurrency(value);
      } else {
        animateValue(el, value);
      }
    }
  });

  // Update completion rate
  const completionRateEl = document.getElementById('completionRate');
  if (completionRateEl && stats.totalReceived > 0) {
    const rate = Math.round((stats.totalProcessed / stats.totalReceived) * 100);
    completionRateEl.textContent = `${rate}% Completion`;
  }

  // Update department progress
  updateDepartmentProgress();
}

/**
 * Animate value change
 */
function animateValue(element, newValue) {
  const currentValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
  const diff = newValue - currentValue;
  const duration = 500;
  const steps = 20;
  const increment = diff / steps;
  let current = currentValue;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    current += increment;
    element.textContent = Utils.formatNumber(Math.round(current));

    if (step >= steps) {
      clearInterval(timer);
      element.textContent = Utils.formatNumber(newValue);
    }
  }, duration / steps);
}

/**
 * Update recent records table
 */
function updateRecentRecords(records) {
  const tbody = document.getElementById('recentRecordsTable');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-8 text-center text-slate-400 text-sm">No records found</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records
    .map(
      (record) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td class="px-6 py-4"><code class="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">${record.recordId || record._id.slice(-8).toUpperCase()}</code></td>
      <td class="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">${record.unit || '-'}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${Utils.formatNumber(record.recordsReceived)}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${Utils.formatNumber(record.recordsProcessed)}</td>
      <td class="px-6 py-4 text-center">${Utils.getStatusBadge(record.status)}</td>
    </tr>
  `
    )
    .join('');
}

/**
 * Update activity list
 */
function updateActivityList(activities) {
  const list = document.getElementById('activityList');
  if (!list) return;

  if (!activities || activities.length === 0) {
    list.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-slate-400">
        <span class="material-symbols-outlined text-4xl mb-2">history</span>
        <p class="text-sm">No recent activity</p>
      </div>
    `;
    return;
  }

  const actionConfig = {
    login:           { label: 'Logged in',       bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300',   icon: 'login' },
    logout:          { label: 'Logged out',      bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-500 dark:text-slate-400', icon: 'logout' },
    create:          { label: 'Created',         bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: 'add_circle' },
    update:          { label: 'Updated',         bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: 'edit' },
    delete:          { label: 'Deleted',         bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-300',    icon: 'delete' },
    import:          { label: 'Imported data',   bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: 'upload' },
    export:          { label: 'Exported data',   bg: 'bg-teal-100 dark:bg-teal-900/30',  text: 'text-teal-700 dark:text-teal-300',  icon: 'download' },
    backup_created:  { label: 'Backup created',  bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', icon: 'cloud_download' },
    backup_deleted:  { label: 'Backup deleted',  bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-300',    icon: 'cloud_off' },
    password_change: { label: 'Changed password', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: 'lock' },
  };

  list.innerHTML = activities.map((activity) => {
    const cfg = actionConfig[activity.action] || { label: activity.action, bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500', icon: 'info' };
    const user = activity.userId?.username || 'System';
    const initials = user.slice(0, 2).toUpperCase();
    const entity = activity.entityType ? `<span class="text-xs text-slate-400 font-medium">&middot; ${activity.entityType}</span>` : '';
    return `
      <div class="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <div class="flex-shrink-0 size-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <span class="text-primary text-xs font-bold">${initials}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${user}</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}">
              <span class="material-symbols-outlined" style="font-size:12px">${cfg.icon}</span>
              ${cfg.label}
            </span>
            ${entity}
          </div>
          <p class="text-xs text-slate-400 mt-0.5">${Utils.formatDate(activity.timestamp, 'datetime')}</p>
        </div>
        <span class="text-[11px] text-slate-400 flex-shrink-0 mt-0.5 font-medium">${Utils.getRelativeTime(activity.timestamp)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Format activity action text
 */
function formatActivityAction(action) {
  const actions = {
    login: 'Logged in',
    logout: 'Logged out',
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    import: 'Imported data',
    export: 'Exported data',
    backup_created: 'Created backup',
    backup_deleted: 'Deleted backup',
    password_change: 'Changed password',
  };

  return actions[action] || action.replace(/_/g, ' ');
}

/**
 * Load and render charts
 */
async function loadCharts() {
  try {
    const response = await API.dashboard.getCharts(30);

    if (response.success) {
      const { categoryDistribution, dailyTrend, statusDistribution } = response.data;

      renderCategoryChart(categoryDistribution);
      renderTrendChart(dailyTrend);
      renderStatusChart(statusDistribution);
    }
  } catch (error) {
    console.error('Failed to load charts:', error);
  }
}

/**
 * Render category distribution chart
 */
function renderCategoryChart(data) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (categoryChart) {
    categoryChart.destroy();
  }

  if (!data || data.length === 0) {
    canvas.parentElement.innerHTML = '<div class="text-center text-muted">No data available</div>';
    return;
  }

  const colors = [
    '#627d98',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
  ];

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.name || 'Unknown'),
      datasets: [
        {
          data: data.map((d) => d.count),
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
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 12,
            font: { size: 12 },
          },
        },
      },
      cutout: '60%',
    },
  });
}

/**
 * Render trend chart
 */
function renderTrendChart(data) {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    const parent = canvas.parentElement;
    if (parent) {
      parent.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 text-sm italic">No trend data available for this period</div>';
    }
    return;
  }

  try {
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((d) => {
          const date = new Date(d._id);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        datasets: [
          {
            label: 'Received',
            data: data.map((d) => d.totalReceived),
            borderColor: '#627d98',
            backgroundColor: 'rgba(98, 125, 152, 0.1)',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'Processed',
            data: data.map((d) => d.totalProcessed),
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
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 12 },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#e5e7eb' },
          },
        },
      },
    });
  } catch (error) {
    console.error('Trend Chart rendering error:', error);
  }
}

/**
 * Render status distribution chart
 */
function renderStatusChart(data) {
  const canvas = document.getElementById('statusChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (statusChart) {
    statusChart.destroy();
  }

  if (!data || data.length === 0) {
    canvas.parentElement.innerHTML = '<div class="text-center text-muted">No data available</div>';
    return;
  }

  const statusColors = {
    pending: '#f59e0b',
    processed: '#10b981',
    discrepancy: '#ef4444',
    received: '#3b82f6',
  };

  const statusLabels = {
    pending: 'Pending',
    processed: 'Processed',
    discrepancy: 'Discrepancy',
    received: 'Received',
  };

  statusChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map((d) => statusLabels[d._id] || d._id),
      datasets: [
        {
          data: data.map((d) => d.count),
          backgroundColor: data.map((d) => statusColors[d._id] || '#6b7280'),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 8,
            font: { size: 11 },
          },
        },
      },
    },
  });
}

/**
 * Update department progress bars
 */
async function updateDepartmentProgress() {
  const container = document.getElementById('departmentProgress');
  if (!container) return;

  try {
    const response = await API.dashboard.getCharts(30);
    if (response.success && response.data.departmentDistribution) {
      const departments = response.data.departmentDistribution.slice(0, 5);

      if (departments.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No data available</div>';
        return;
      }

      const maxCount = Math.max(...departments.map(d => d.count));

      container.innerHTML = departments.map(dept => {
        const percentage = Math.round((dept.count / maxCount) * 100);
        return `
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-600 dark:text-slate-400">${dept.name || 'Unknown'}</span>
              <span class="text-xs font-bold text-slate-900 dark:text-slate-100">${dept.count}</span>
            </div>
            <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Failed to load department progress:', error);
  }
}

// Make functions available globally
window.initDashboard = initDashboard;
window.loadDashboardSummary = loadDashboardSummary;