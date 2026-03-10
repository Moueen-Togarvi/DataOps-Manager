/**
 * DataOps Manager - Utility Functions
 * Common helper functions used across the application
 */

const Utils = {
  /**
   * Format date for display
   */
  formatDate(date, format = 'short') {
    if (!date) return '-';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const options = {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
      datetime: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
      time: { hour: '2-digit', minute: '2-digit' },
      iso: null,
    };

    if (format === 'iso') {
      return d.toISOString().split('T')[0];
    }

    return d.toLocaleDateString('en-US', options[format] || options.short);
  },

  /**
   * Format number with commas
   */
  formatNumber(num, decimals = 0) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    if (amount === null || amount === undefined) return '$0.00';
    return Number(amount).toLocaleString('en-US', {
      style: 'currency',
      currency: currency,
    });
  },

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Get relative time string
   */
  getRelativeTime(date) {
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return this.formatDate(date, 'short');
    } else if (days > 1) {
      return `${days} days ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (hours >= 1) {
      return `${hours}h ago`;
    } else if (minutes >= 1) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  },

  /**
   * Debounce function
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Generate unique ID
   */
  generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Deep clone object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Check if object is empty
   */
  isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  },

  /**
   * Get status badge HTML
   */
  getStatusBadge(status) {
    const statusConfig = {
      pending: { class: 'badge-warning', text: 'Pending' },
      processed: { class: 'badge-success', text: 'Processed' },
      discrepancy: { class: 'badge-danger', text: 'Discrepancy' },
      received: { class: 'badge-info', text: 'Received' },
      active: { class: 'badge-success', text: 'Active' },
      inactive: { class: 'badge-neutral', text: 'Inactive' },
    };

    const config = statusConfig[status] || { class: 'badge-neutral', text: status };
    return `<span class="badge ${config.class}">${config.text}</span>`;
  },

  /**
   * Get activity icon based on action
   */
  getActivityIcon(action) {
    const icons = {
      login: { icon: '↗', class: 'stat-icon-blue' },
      logout: { icon: '↘', class: 'stat-icon-neutral' },
      record_created: { icon: '+', class: 'stat-icon-green' },
      record_updated: { icon: '✎', class: 'stat-icon-amber' },
      record_deleted: { icon: '×', class: 'stat-icon-red' },
      backup_created: { icon: '⬇', class: 'stat-icon-purple' },
      password_change: { icon: '🔒', class: 'stat-icon-amber' },
      import: { icon: '↑', class: 'stat-icon-teal' },
      export: { icon: '↓', class: 'stat-icon-teal' },
    };

    return icons[action] || { icon: '•', class: 'stat-icon-neutral' };
  },

  /**
   * Parse query parameters
   */
  parseQueryParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  },

  /**
   * Update query parameters without reload
   */
  updateQueryParams(params) {
    const url = new URL(window.location);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    window.history.pushState({}, '', url);
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Show confirmation dialog
   */
  async confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3>${title}</h3>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
            <button class="btn btn-danger" id="confirmOk">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('#confirmCancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      overlay.querySelector('#confirmOk').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });
    });
  },

  /**
   * Download file from blob
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Export table to CSV
   */
  tableToCSV(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return '';

    const rows = table.querySelectorAll('tr');
    const csv = [];

    rows.forEach((row) => {
      const cols = row.querySelectorAll('td, th');
      const rowData = [];
      cols.forEach((col) => {
        let data = col.textContent.replace(/"/g, '""');
        rowData.push(`"${data}"`);
      });
      csv.push(rowData.join(','));
    });

    return csv.join('\n');
  },
};

/**
 * Create toast container if not exists
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Add toast styles dynamically
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: #1e293b;
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
    min-width: 280px;
  }

  .toast-success { background: #059669; }
  .toast-error { background: #dc2626; }
  .toast-warning { background: #d97706; }
  .toast-info { background: #2563eb; }

  .toast-fade-out {
    animation: fadeOut 0.3s ease forwards;
  }

  .toast-close {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    opacity: 0.7;
    padding: 0;
    line-height: 1;
  }

  .toast-close:hover {
    opacity: 1;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(toastStyles);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}