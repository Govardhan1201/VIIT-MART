// NIRVANA MART API Client
const API_BASE = window.location.protocol === 'file:' 
  ? 'http://localhost:3000/api'
  : '/api';

function getToken() { return localStorage.getItem('vm_token'); }

async function _fetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

const API = {
  get: (path) => _fetch(path, { method: 'GET' }),
  post: (path, body) => _fetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => _fetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => _fetch(path, { method: 'DELETE' }),
};

window.API = API;

// Cloudinary Image Optimizer
window.optimizeImage = function(url, width = 600) {
  if (!url) return '';
  if (url.includes('cloudinary.com') && !url.includes('/upload/w_') && !url.includes('/upload/q_')) {
    return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
  }
  return url;
};
