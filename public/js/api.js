/**
 * DataOps Manager - API Wrapper
 * Centralized API communication module
 */

const API = {
  baseURL: '/api',

  /**
   * Get authentication token from storage
   */
  getToken() {
    return localStorage.getItem('token');
  },

  /**
   * Set authentication token
   */
  setToken(token) {
    localStorage.setItem('token', token);
  },

  /**
   * Remove authentication token
   */
  removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    // Handle body for POST/PUT/PATCH
    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          this.removeToken();
          window.location.href = '/index.html';
        }
        throw new APIError(data.message || 'Request failed', response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Network error. Please check your connection.', 0, {});
    }
  },

  // ==========================================
  // Authentication Endpoints
  // ==========================================

  auth: {
    login: async (username, password) => {
      return API.request('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
    },

    logout: async () => {
      return API.request('/auth/logout', { method: 'POST' });
    },

    me: async () => {
      return API.request('/auth/me');
    },

    changePassword: async (currentPassword, newPassword) => {
      return API.request('/auth/password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      });
    },
  },

  // ==========================================
  // Dashboard Endpoints
  // ==========================================

  dashboard: {
    getStats: async () => {
      return API.request('/dashboard/stats');
    },

    getCharts: async (period = 30) => {
      return API.request(`/dashboard/charts?period=${period}`);
    },

    getRecent: async (limit = 10) => {
      return API.request(`/dashboard/recent?limit=${limit}`);
    },

    getActivity: async (limit = 10) => {
      return API.request(`/dashboard/activity?limit=${limit}`);
    },

    getSummary: async () => {
      return API.request('/dashboard/summary');
    },
  },

  // ==========================================
  // Records Endpoints
  // ==========================================

  records: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/records${query ? '?' + query : ''}`);
    },

    getById: async (id) => {
      return API.request(`/records/${id}`);
    },

    create: async (data) => {
      return API.request('/records', {
        method: 'POST',
        body: data,
      });
    },

    update: async (id, data) => {
      return API.request(`/records/${id}`, {
        method: 'PUT',
        body: data,
      });
    },

    delete: async (id) => {
      return API.request(`/records/${id}`, { method: 'DELETE' });
    },

    bulkDelete: async (ids) => {
      return API.request('/records/bulk', {
        method: 'DELETE',
        body: { ids },
      });
    },
  },

  // ==========================================
  // Departments Endpoints
  // ==========================================

  departments: {
    getAll: async () => {
      return API.request('/departments');
    },

    getById: async (id) => {
      return API.request(`/departments/${id}`);
    },

    create: async (data) => {
      return API.request('/departments', {
        method: 'POST',
        body: data,
      });
    },

    update: async (id, data) => {
      return API.request(`/departments/${id}`, {
        method: 'PUT',
        body: data,
      });
    },

    delete: async (id) => {
      return API.request(`/departments/${id}`, { method: 'DELETE' });
    },
  },

  // ==========================================
  // Categories Endpoints
  // ==========================================

  categories: {
    getAll: async () => {
      return API.request('/categories');
    },

    getById: async (id) => {
      return API.request(`/categories/${id}`);
    },

    create: async (data) => {
      return API.request('/categories', {
        method: 'POST',
        body: data,
      });
    },

    update: async (id, data) => {
      return API.request(`/categories/${id}`, {
        method: 'PUT',
        body: data,
      });
    },

    delete: async (id) => {
      return API.request(`/categories/${id}`, { method: 'DELETE' });
    },
  },

  // ==========================================
  // Users Endpoints (Admin)
  // ==========================================

  users: {
    getAll: async () => {
      return API.request('/users');
    },

    getById: async (id) => {
      return API.request(`/users/${id}`);
    },

    create: async (data) => {
      return API.request('/users', {
        method: 'POST',
        body: data,
      });
    },

    update: async (id, data) => {
      return API.request(`/users/${id}`, {
        method: 'PUT',
        body: data,
      });
    },

    delete: async (id) => {
      return API.request(`/users/${id}`, { method: 'DELETE' });
    },
  },

  // ==========================================
  // Activity Logs (Admin)
  // ==========================================

  logs: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/logs${query ? '?' + query : ''}`);
    },
  },

  // ==========================================
  // Reports Endpoints
  // ==========================================

  reports: {
    getSummary: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/reports/summary${query ? '?' + query : ''}`);
    },

    getByDepartment: async (departmentId, params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/reports/department/${departmentId}${query ? '?' + query : ''}`);
    },

    getByCategory: async (categoryId, params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/reports/category/${categoryId}${query ? '?' + query : ''}`);
    },

    getDaily: async (date) => {
      return API.request(`/reports/daily/${date}`);
    },

    getWeekly: async (startDate) => {
      return API.request(`/reports/weekly/${startDate}`);
    },

    getMonthly: async (year, month) => {
      return API.request(`/reports/monthly/${year}/${month}`);
    },
  },

  // ==========================================
  // Import/Export Endpoints
  // ==========================================

  import: {
    upload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = API.getToken();
      const response = await fetch(`${API.baseURL}/import`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(data.message || 'Import failed', response.status, data);
      }
      return data;
    },
  },

  export: {
    excel: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      window.location.href = `/api/export?format=excel${query ? '&' + query : ''}`;
    },

    csv: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      window.location.href = `/api/export?format=csv${query ? '&' + query : ''}`;
    },

    pdf: async (type = 'general') => {
      window.location.href = `/api/reports/pdf?type=${type}`;
    },
  },

  // ==========================================
  // Backup Endpoints (Admin)
  // ==========================================

  backup: {
    getAll: async () => {
      return API.request('/backup');
    },

    create: async () => {
      return API.request('/backup', { method: 'POST' });
    },

    download: (filename) => {
      window.location.href = `/api/backup/${filename}`;
    },

    delete: async (filename) => {
      return API.request(`/backup/${filename}`, { method: 'DELETE' });
    },
  },

  // ==========================================
  // Health Check
  // ==========================================

  health: async () => {
    return API.request('/health');
  },
};

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API, APIError };
}