// VIIT Mart Auth Helper
const Auth = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('vm_user')); } catch { return null; }
  },
  getToken() { return localStorage.getItem('vm_token'); },
  isLoggedIn() { return !!this.getToken() && !!this.getUser(); },
  setSession(token, user) {
    localStorage.setItem('vm_token', token);
    localStorage.setItem('vm_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('vm_token');
    localStorage.removeItem('vm_user');
  },
  requireAuth(allowedRoles = null) {
    if (!this.isLoggedIn()) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    const user = this.getUser();
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = '/index.html';
      return null;
    }
    return user;
  },
  logout() {
    this.clearSession();
    window.location.href = '/index.html';
  }
};

window.Auth = Auth;

// Apply dark mode theme immediately
(function() {
  const theme = localStorage.getItem('vm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
