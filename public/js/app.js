/**
 * DataOps Manager - Main Application Entry
 * Initializes the application and handles common functionality
 */

/**
 * Initialize the application
 */
async function initApp() {
  // Check authentication
  if (!Auth.requireAuth()) {
    return;
  }

  // Verify session with server
  const isValidSession = await Auth.verifySession();
  if (!isValidSession) {
    window.location.href = '/index.html';
    return;
  }

  // Initialize auth UI
  initAuth();

  // Setup sidebar toggle for mobile
  initSidebar();

  // Setup global error handler
  setupErrorHandler();

  // Initialize page-specific functionality
  initPageSpecific();
}

/**
 * Initialize sidebar functionality
 */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  let backdrop = document.getElementById('sidebar-backdrop');
  
  if (!backdrop && sidebar) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      if (backdrop) backdrop.classList.toggle('active');
    });

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('active');
        backdrop.classList.remove('active');
      });
    }

    // Close sidebar when clicking nav items on mobile
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          sidebar.classList.remove('active');
          if (backdrop) backdrop.classList.remove('active');
        }
      });
    });
  }

  // Highlight current nav item
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach((item) => {
    const href = item.getAttribute('href');
    if (href === currentPage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/**
 * Setup global error handler
 */
function setupErrorHandler() {
  // Handle uncaught errors
  window.onerror = function (message, source, lineno, colno, error) {
    console.error('Uncaught error:', message, source, lineno, colno, error);
    Utils.showToast('An unexpected error occurred', 'error');
    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled rejection:', event.reason);

    // Don't show toast for auth errors (they redirect anyway)
    if (event.reason?.status !== 401) {
      Utils.showToast('An unexpected error occurred', 'error');
    }
  });
}

/**
 * Initialize page-specific functionality
 */
function initPageSpecific() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  switch (currentPage) {
    case 'dashboard.html':
      if (typeof initDashboard === 'function') {
        initDashboard();
      }
      break;
    case 'records.html':
      if (typeof initRecords === 'function') {
        initRecords();
      }
      break;
    case 'reports.html':
      if (typeof initReports === 'function') {
        initReports();
      }
      break;
    case 'settings.html':
      if (typeof initSettings === 'function') {
        initSettings();
      }
      break;
  }
}

/**
 * Show loading overlay
 */
function showLoading() {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Create modal
 */
function createModal(options = {}) {
  const { title, content, footer, onClose } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'dynamicModal';

  const modal = document.createElement('div');
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-header">
      <h3>${title || 'Modal'}</h3>
      <button class="btn btn-icon modal-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="modal-body">${content || ''}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Setup close handlers
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.addEventListener('click', () => closeModal(overlay, onClose));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay, onClose);
    }
  });

  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(overlay, onClose);
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  return overlay;
}

/**
 * Close modal
 */
function closeModal(overlay, onClose) {
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.remove();
    if (typeof onClose === 'function') {
      onClose();
    }
  }, 200);
}

/**
 * Handle API errors
 */
function handleApiError(error, defaultMessage = 'Operation failed') {
  console.error('API Error:', error);

  if (error.status === 401) {
    Auth.clearSession();
    window.location.href = '/index.html';
    return;
  }

  if (error.status === 403) {
    Utils.showToast('You do not have permission to perform this action', 'error');
    return;
  }

  if (error.status === 404) {
    Utils.showToast('Resource not found', 'error');
    return;
  }

  if (error.data?.errors) {
    const messages = error.data.errors.map((e) => e.msg || e.message).join(', ');
    Utils.showToast(messages, 'error');
    return;
  }

  Utils.showToast(error.message || defaultMessage, 'error');
}

// Make functions available globally
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.createModal = createModal;
window.closeModal = closeModal;
window.handleApiError = handleApiError;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);