/**
 * DataOps Manager - Authentication Module
 * Handles user authentication state and login/logout
 */

const Auth = {
  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  },

  /**
   * Get current user data
   */
  getUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  /**
   * Get user role
   */
  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.getRole() === 'admin';
  },

  /**
   * Login user
   */
  async login(username, password) {
    const response = await API.auth.login(username, password);

    if (response.success) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      await API.auth.logout();
    } catch (e) {
      // Ignore logout API errors
    } finally {
      this.clearSession();
    }
  },

  /**
   * Clear session data
   */
  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Verify session with server
   */
  async verifySession() {
    if (!this.isLoggedIn()) {
      return false;
    }

    try {
      const response = await API.auth.me();
      if (response.success) {
        localStorage.setItem('user', JSON.stringify(response.data));
        return true;
      }
    } catch (e) {
      this.clearSession();
      return false;
    }

    return false;
  },

  /**
   * Update user in storage
   */
  updateUser(userData) {
    const currentUser = this.getUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  },

  /**
   * Require authentication - redirect to login if not authenticated
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },

  /**
   * Require admin role - redirect if not admin
   */
  requireAdmin() {
    if (!this.requireAuth()) {
      return false;
    }

    if (!this.isAdmin()) {
      window.location.href = '/dashboard.html';
      return false;
    }
    return true;
  },
};

/**
 * Initialize authentication on page load
 */
function initAuth() {
  // Update user info in sidebar
  const user = Auth.getUser();
  if (user) {
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl) {
      userNameEl.textContent = user.username;
    }

    if (userRoleEl) {
      userRoleEl.textContent = user.role;
    }

    if (userAvatarEl) {
      userAvatarEl.textContent = user.username.charAt(0).toUpperCase();
    }

    // Hide admin-only elements for non-admin users
    if (!Auth.isAdmin()) {
      document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = 'none';
      });
    }
  }

  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await Auth.logout();
      window.location.href = '/index.html';
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Auth;
}