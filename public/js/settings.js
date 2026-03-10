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
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400 text-sm">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (user) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-id="${user._id}">
      <td class="px-6 py-4">
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${user.username}</span>
          <span class="text-xs text-slate-400">${user.email}</span>
        </div>
      </td>
      <td class="px-6 py-4"><span class="badge ${user.role === 'admin' ? 'badge-info' : 'badge-neutral'}">${user.role}</span></td>
      <td class="px-6 py-4">${Utils.getStatusBadge(user.active ? 'active' : 'inactive')}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${user.department?.name || '-'}</td>
      <td class="px-6 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button class="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors edit-user-btn" data-id="${user._id}" title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors delete-user-btn" data-id="${user._id}" title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    document.getElementById('userFormRole').value = user.role;
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
    role: document.getElementById('userFormRole').value,
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
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400 text-sm">No departments found</td></tr>';
    return;
  }

  tbody.innerHTML = departments
    .map(
      (dept) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-id="${dept._id}">
      <td class="px-6 py-4"><code class="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">${dept.code}</code></td>
      <td class="px-6 py-4 text-sm font-semibold">${dept.name}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${dept.description || '-'}</td>
      <td class="px-6 py-4">${Utils.getStatusBadge(dept.active ? 'active' : 'inactive')}</td>
      <td class="px-6 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button class="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors edit-dept-btn" data-id="${dept._id}" title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors delete-dept-btn" data-id="${dept._id}" title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 text-sm">No categories found</td></tr>';
    return;
  }

  tbody.innerHTML = categories
    .map(
      (cat) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-id="${cat._id}">
      <td class="px-6 py-4"><code class="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">${cat.code}</code></td>
      <td class="px-6 py-4 text-sm font-semibold">${cat.name}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${cat.department?.name || '-'}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${cat.description || '-'}</td>
      <td class="px-6 py-4">${Utils.getStatusBadge(cat.active ? 'active' : 'inactive')}</td>
      <td class="px-6 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button class="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors edit-cat-btn" data-id="${cat._id}" title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors delete-cat-btn" data-id="${cat._id}" title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

async function openCategoryModal(cat = null) {
  // Load departments into dropdown before showing modal
  await loadDepartmentsForDropdown('catDepartment');

  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');

  if (cat) {
    title.textContent = 'Edit Category';
    document.getElementById('categoryId').value = cat._id;
    document.getElementById('catCode').value = cat.code;
    document.getElementById('catName').value = cat.name;
    document.getElementById('catDescription').value = cat.description || '';
    // Set department if populated
    if (cat.department?._id || cat.department) {
      document.getElementById('catDepartment').value = cat.department?._id || cat.department;
    }
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
    } else {
      throw new Error(response.message || 'Backup failed');
    }
  } catch (error) {
    console.error('Backup creation error:', error);
    handleApiError(error, 'Failed to create backup. This might be due to a server-side issue or timeout.');
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
      // The API returns { success: true, data: { logs: [], pagination: {} } }
      const logs = response.data?.logs || response.data || [];
      renderLogs(logs);
    }
  } catch (error) {
    handleApiError(error, 'Failed to load logs');
  }
}

function renderLogs(logs) {
  const list = document.getElementById('logsTableBody');
  if (!list) return;

  // Defensive check: ensure logs is an array
  const logsArray = Array.isArray(logs) ? logs : [];

  if (logsArray.length === 0) {
    list.innerHTML = '<li class="px-6 py-8 text-center text-slate-400 text-sm">No activity logs found</li>';
    return;
  }

  const actionLabels = {
    login: 'Logged in', logout: 'Logged out',
    create: 'Created', update: 'Updated', delete: 'Deleted',
    import: 'Imported data', export: 'Exported data',
    backup_created: 'Backup created', backup_deleted: 'Backup deleted',
    password_change: 'Password changed',
  };

  const actionColors = {
    login: 'bg-blue-100 text-blue-700',
    create: 'bg-green-100 text-green-700',
    update: 'bg-amber-100 text-amber-700',
    delete: 'bg-red-100 text-red-700',
    import: 'bg-purple-100 text-purple-700',
    export: 'bg-teal-100 text-teal-700',
    logout: 'bg-slate-100 text-slate-500',
    backup_created: 'bg-indigo-100 text-indigo-700',
    backup_deleted: 'bg-red-100 text-red-700',
    password_change: 'bg-orange-100 text-orange-700',
  };

  list.innerHTML = logsArray.map((log) => {
    const label = actionLabels[log.action] || log.action?.replace(/_/g, ' ') || 'Action';
    const colorClass = actionColors[log.action] || 'bg-slate-100 text-slate-500';
    const user = log.userId?.username || 'System';
    return `
      <li class="flex items-center gap-4 px-6 py-4">
        <div class="flex-shrink-0 size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <span class="text-slate-500 dark:text-slate-400 text-sm font-bold">${user.charAt(0).toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${user}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClass}">${label}</span>
            ${log.entityType ? `<span class="text-xs text-slate-400">${log.entityType}</span>` : ''}
          </div>
          <div class="flex items-center gap-3 mt-0.5">
            <span class="text-xs text-slate-400">${Utils.formatDate(log.timestamp, 'datetime')}</span>
            ${log.ipAddress ? `<span class="text-xs text-slate-300">·</span><span class="text-xs text-slate-400">${log.ipAddress}</span>` : ''}
          </div>
        </div>
        <span class="text-xs text-slate-400 flex-shrink-0">${Utils.getRelativeTime(log.timestamp)}</span>
      </li>
    `;
  }).join('');
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

// Make functions available globally
window.initSettings = initSettings;