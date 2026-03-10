/**
 * DataOps Manager - Settings Page Logic
 * Handles admin settings: users, departments, categories, backups, logs
 */

// Current state
let currentPage = {};

/**
 * Initialize settings page
 */
async function initSettings() {
  // Require admin role
  if (!Auth.requireAdmin()) {
    return;
  }

  setupTabs();
  setupEventListeners();
  loadUsers();
  loadSettingsStats();
}

/**
 * Load settings statistics
 */
async function loadSettingsStats() {
  try {
    const [usersRes, deptsRes, catsRes] = await Promise.all([
      API.users.getAll(),
      API.departments.getAll(),
      API.categories.getAll()
    ]);

    if (usersRes.success) {
      const users = usersRes.data.users || usersRes.data;
      const activeUsers = users.filter(u => u.active).length;
      document.getElementById('activeUsersCount').textContent = activeUsers;
    }

    if (deptsRes.success) {
      const activeDepts = deptsRes.data.filter(d => d.active).length;
      document.getElementById('departmentsCount').textContent = activeDepts;
    }

    if (catsRes.success) {
      const activeCats = catsRes.data.filter(c => c.active).length;
      document.getElementById('categoriesCount').textContent = activeCats;
    }
  } catch (error) {
    console.error('Failed to load settings stats:', error);
  }
}

/**
 * Setup tab navigation
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update active states - remove active from all tabs and panels
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));

      // Add active to clicked tab and its panel
      tab.classList.add('active');
      const activePanel = document.getElementById(`${tabName}Panel`);
      if (activePanel) {
        activePanel.classList.add('active');
      }

      // Load data for the tab
      switch (tabName) {
        case 'users':
          loadUsers();
          break;
        case 'departments':
          loadDepartments();
          break;
        case 'categories':
          loadCategories();
          break;
        case 'backup':
          loadBackups();
          break;
        case 'logs':
          loadLogs();
          break;
      }
    });
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // User modal
  document.getElementById('addUserBtn')?.addEventListener('click', () => openUserModal());
  document.getElementById('saveUserBtn')?.addEventListener('click', saveUser);

  // Department modal
  document.getElementById('addDepartmentBtn')?.addEventListener('click', () => openDepartmentModal());
  document.getElementById('saveDepartmentBtn')?.addEventListener('click', saveDepartment);

  // Category modal
  document.getElementById('addCategoryBtn')?.addEventListener('click', () => openCategoryModal());
  document.getElementById('saveCategoryBtn')?.addEventListener('click', saveCategory);

  // Backup
  document.getElementById('createBackupBtn')?.addEventListener('click', createBackup);

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('active');
    });
  });

  // Table action handlers
  document.getElementById('usersTableBody')?.addEventListener('click', handleUserAction);
  document.getElementById('departmentsTableBody')?.addEventListener('click', handleDepartmentAction);
  document.getElementById('categoriesTableBody')?.addEventListener('click', handleCategoryAction);
  document.getElementById('backupsTableBody')?.addEventListener('click', handleBackupAction);
}

// ==========================================
// Users Management
// ==========================================

async function loadUsers() {
  try {
    const response = await API.users.getAll();
    if (response.success) {
      const users = response.data.users || response.data;
      renderUsers(users);
    }
  } catch (error) {
    handleApiError(error, 'Failed to load users');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (user) => `
    <tr data-id="${user._id}">
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td><span class="badge badge-${user.role === 'admin' ? 'info' : 'neutral'}">${user.role}</span></td>
      <td>${user.department?.name || '-'}</td>
      <td>${Utils.getStatusBadge(user.active ? 'active' : 'inactive')}</td>
      <td>
        <div class="flex gap-sm">
          <button class="btn btn-sm btn-icon edit-user-btn" data-id="${user._id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon delete-user-btn" data-id="${user._id}" title="Delete">
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

async function openUserModal(user = null) {
  // Load departments for dropdown
  await loadDepartmentsForDropdown('userDepartment');

  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');

  if (user) {
    title.textContent = 'Edit User';
    document.getElementById('userId').value = user._id;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = user.role;
    document.getElementById('userDepartment').value = user.department?._id || '';
    document.getElementById('userActive').value = user.active.toString();
  } else {
    title.textContent = 'Add User';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
  }

  modal?.classList.add('active');
}

async function saveUser() {
  const id = document.getElementById('userId').value;
  const data = {
    username: document.getElementById('userUsername').value,
    email: document.getElementById('userEmail').value,
    role: document.getElementById('userRole').value,
    department: document.getElementById('userDepartment').value || null,
    active: document.getElementById('userActive').value === 'true',
  };

  const password = document.getElementById('userPassword').value;
  if (password) {
    data.password = password;
  }

  try {
    showLoading();

    let response;
    if (id) {
      response = await API.users.update(id, data);
    } else {
      if (!password) {
        Utils.showToast('Password is required for new users', 'error');
        hideLoading();
        return;
      }
      response = await API.users.create(data);
    }

    if (response.success) {
      document.getElementById('userModal')?.classList.remove('active');
      Utils.showToast(id ? 'User updated successfully' : 'User created successfully', 'success');
      loadUsers();
    }
  } catch (error) {
    handleApiError(error, 'Failed to save user');
  } finally {
    hideLoading();
  }
}

async function handleUserAction(e) {
  const editBtn = e.target.closest('.edit-user-btn');
  const deleteBtn = e.target.closest('.delete-user-btn');

  if (editBtn) {
    const id = editBtn.dataset.id;
    try {
      const response = await API.users.getById(id);
      if (response.success) {
        openUserModal(response.data);
      }
    } catch (error) {
      handleApiError(error, 'Failed to load user');
    }
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const confirmed = await Utils.confirm('Are you sure you want to delete this user?', 'Delete User');
    if (confirmed) {
      try {
        await API.users.delete(id);
        Utils.showToast('User deleted successfully', 'success');
        loadUsers();
      } catch (error) {
        handleApiError(error, 'Failed to delete user');
      }
    }
  }
}

// ==========================================
// Departments Management
// ==========================================

async function loadDepartments() {
  try {
    const response = await API.departments.getAll();
    if (response.success) {
      renderDepartments(response.data);
    }
  } catch (error) {
    handleApiError(error, 'Failed to load departments');
  }
}

function renderDepartments(departments) {
  const tbody = document.getElementById('departmentsTableBody');
  if (!tbody) return;

  if (!departments || departments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No departments found</td></tr>';
    return;
  }

  tbody.innerHTML = departments
    .map(
      (dept) => `
    <tr data-id="${dept._id}">
      <td><code>${dept.code}</code></td>
      <td>${dept.name}</td>
      <td>${dept.description || '-'}</td>
      <td>${Utils.getStatusBadge(dept.active ? 'active' : 'inactive')}</td>
      <td>
        <div class="flex gap-sm">
          <button class="btn btn-sm btn-icon edit-dept-btn" data-id="${dept._id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon delete-dept-btn" data-id="${dept._id}" title="Delete">
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

function openDepartmentModal(dept = null) {
  const modal = document.getElementById('departmentModal');
  const title = document.getElementById('departmentModalTitle');

  if (dept) {
    title.textContent = 'Edit Department';
    document.getElementById('departmentId').value = dept._id;
    document.getElementById('deptCode').value = dept.code;
    document.getElementById('deptName').value = dept.name;
    document.getElementById('deptDescription').value = dept.description || '';
  } else {
    title.textContent = 'Add Department';
    document.getElementById('departmentForm').reset();
    document.getElementById('departmentId').value = '';
  }

  modal?.classList.add('active');
}

async function saveDepartment() {
  const id = document.getElementById('departmentId').value;
  const data = {
    code: document.getElementById('deptCode').value.toUpperCase(),
    name: document.getElementById('deptName').value,
    description: document.getElementById('deptDescription').value,
  };

  try {
    showLoading();

    let response;
    if (id) {
      response = await API.departments.update(id, data);
    } else {
      response = await API.departments.create(data);
    }

    if (response.success) {
      document.getElementById('departmentModal')?.classList.remove('active');
      Utils.showToast(id ? 'Department updated successfully' : 'Department created successfully', 'success');
      loadDepartments();
    }
  } catch (error) {
    handleApiError(error, 'Failed to save department');
  } finally {
    hideLoading();
  }
}

async function handleDepartmentAction(e) {
  const editBtn = e.target.closest('.edit-dept-btn');
  const deleteBtn = e.target.closest('.delete-dept-btn');

  if (editBtn) {
    const id = editBtn.dataset.id;
    try {
      const response = await API.departments.getById(id);
      if (response.success) {
        openDepartmentModal(response.data);
      }
    } catch (error) {
      handleApiError(error, 'Failed to load department');
    }
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const confirmed = await Utils.confirm('Are you sure you want to delete this department?', 'Delete Department');
    if (confirmed) {
      try {
        await API.departments.delete(id);
        Utils.showToast('Department deleted successfully', 'success');
        loadDepartments();
      } catch (error) {
        handleApiError(error, 'Failed to delete department');
      }
    }
  }
}

// ==========================================
// Categories Management
// ==========================================

async function loadCategories() {
  try {
    const response = await API.categories.getAll();
    if (response.success) {
      renderCategories(response.data);
    }
  } catch (error) {
    handleApiError(error, 'Failed to load categories');
  }
}

function renderCategories(categories) {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;

  if (!categories || categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No categories found</td></tr>';
    return;
  }

  tbody.innerHTML = categories
    .map(
      (cat) => `
    <tr data-id="${cat._id}">
      <td><code>${cat.code}</code></td>
      <td>${cat.name}</td>
      <td>${cat.description || '-'}</td>
      <td>${Utils.getStatusBadge(cat.active ? 'active' : 'inactive')}</td>
      <td>
        <div class="flex gap-sm">
          <button class="btn btn-sm btn-icon edit-cat-btn" data-id="${cat._id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon delete-cat-btn" data-id="${cat._id}" title="Delete">
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

function openCategoryModal(cat = null) {
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');

  if (cat) {
    title.textContent = 'Edit Category';
    document.getElementById('categoryId').value = cat._id;
    document.getElementById('catCode').value = cat.code;
    document.getElementById('catName').value = cat.name;
    document.getElementById('catDescription').value = cat.description || '';
  } else {
    title.textContent = 'Add Category';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
  }

  modal?.classList.add('active');
}

async function saveCategory() {
  const id = document.getElementById('categoryId').value;
  const data = {
    department: document.getElementById('catDepartment').value,
    code: document.getElementById('catCode').value.toUpperCase(),
    name: document.getElementById('catName').value,
    description: document.getElementById('catDescription').value,
  };

  try {
    showLoading();

    let response;
    if (id) {
      response = await API.categories.update(id, data);
    } else {
      response = await API.categories.create(data);
    }

    if (response.success) {
      document.getElementById('categoryModal')?.classList.remove('active');
      Utils.showToast(id ? 'Category updated successfully' : 'Category created successfully', 'success');
      loadCategories();
    }
  } catch (error) {
    handleApiError(error, 'Failed to save category');
  } finally {
    hideLoading();
  }
}

async function handleCategoryAction(e) {
  const editBtn = e.target.closest('.edit-cat-btn');
  const deleteBtn = e.target.closest('.delete-cat-btn');

  if (editBtn) {
    const id = editBtn.dataset.id;
    try {
      const response = await API.categories.getById(id);
      if (response.success) {
        openCategoryModal(response.data);
      }
    } catch (error) {
      handleApiError(error, 'Failed to load category');
    }
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const confirmed = await Utils.confirm('Are you sure you want to delete this category?', 'Delete Category');
    if (confirmed) {
      try {
        await API.categories.delete(id);
        Utils.showToast('Category deleted successfully', 'success');
        loadCategories();
      } catch (error) {
        handleApiError(error, 'Failed to delete category');
      }
    }
  }
}

// ==========================================
// Backup Management
// ==========================================

async function loadBackups() {
  try {
    const response = await API.backup.getAll();
    if (response.success) {
      renderBackups(response.data);
    }
  } catch (error) {
    handleApiError(error, 'Failed to load backups');
  }
}

function renderBackups(backups) {
  const tbody = document.getElementById('backupsTableBody');
  if (!tbody) return;

  if (!backups || backups.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No backups found</td></tr>';
    return;
  }

  tbody.innerHTML = backups
    .map(
      (backup) => `
    <tr>
      <td>${backup.filename}</td>
      <td>${Utils.formatFileSize(backup.size)}</td>
      <td>${Utils.formatDate(backup.created, 'datetime')}</td>
      <td>
        <div class="flex gap-sm">
          <button class="btn btn-sm btn-secondary download-backup-btn" data-filename="${backup.filename}">
            Download
          </button>
          <button class="btn btn-sm btn-icon delete-backup-btn" data-filename="${backup.filename}" title="Delete">
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

async function createBackup() {
  try {
    showLoading();
    const response = await API.backup.create();
    if (response.success) {
      Utils.showToast('Backup created successfully', 'success');
      loadBackups();
    }
  } catch (error) {
    handleApiError(error, 'Failed to create backup');
  } finally {
    hideLoading();
  }
}

function handleBackupAction(e) {
  const downloadBtn = e.target.closest('.download-backup-btn');
  const deleteBtn = e.target.closest('.delete-backup-btn');

  if (downloadBtn) {
    API.backup.download(downloadBtn.dataset.filename);
  }

  if (deleteBtn) {
    const filename = deleteBtn.dataset.filename;
    Utils.confirm('Are you sure you want to delete this backup?', 'Delete Backup').then(async (confirmed) => {
      if (confirmed) {
        try {
          await API.backup.delete(filename);
          Utils.showToast('Backup deleted successfully', 'success');
          loadBackups();
        } catch (error) {
          handleApiError(error, 'Failed to delete backup');
        }
      }
    });
  }
}

// ==========================================
// Activity Logs
// ==========================================

async function loadLogs(page = 1) {
  try {
    const response = await API.logs.getAll({ page, limit: 20 });
    if (response.success) {
      renderLogs(response.data);
      // Could add pagination here
    }
  } catch (error) {
    handleApiError(error, 'Failed to load logs');
  }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No activity logs found</td></tr>';
    return;
  }

  tbody.innerHTML = logs
    .map(
      (log) => `
    <tr>
      <td>${Utils.formatDate(log.timestamp, 'datetime')}</td>
      <td>${log.userId?.username || 'System'}</td>
      <td>${formatLogAction(log.action)}</td>
      <td>${log.entityType || '-'}</td>
      <td>${log.ipAddress || '-'}</td>
    </tr>
  `
    )
    .join('');
}

function formatLogAction(action) {
  const actions = {
    login: 'Logged in',
    logout: 'Logged out',
    record_created: 'Created record',
    record_updated: 'Updated record',
    record_deleted: 'Deleted record',
    backup_created: 'Created backup',
    backup_deleted: 'Deleted backup',
    password_change: 'Changed password',
  };

  return actions[action] || action.replace(/_/g, ' ');
}

// ==========================================
// Helpers
// ==========================================

async function loadDepartmentsForDropdown(selectId) {
  try {
    const response = await API.departments.getAll();
    if (response.success) {
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML =
          '<option value="">None</option>' +
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

// Add settings tab styles
const settingsStyles = document.createElement('style');
settingsStyles.textContent = `
  .settings-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 12px;
  }

  .settings-tab {
    padding: 8px 16px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--border-radius-sm);
    transition: all var(--transition-fast);
  }

  .settings-tab:hover {
    background: var(--gray-100);
    color: var(--text-primary);
  }

  .settings-tab.active {
    background: var(--primary-600);
    color: var(--text-inverse);
  }

  .settings-panel {
    display: none;
  }

  .settings-panel.active {
    display: block;
  }
`;
document.head.appendChild(settingsStyles);

// Make functions available globally
window.initSettings = initSettings;