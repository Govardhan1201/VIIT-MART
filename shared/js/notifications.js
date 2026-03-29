// NIRVANA MART – Notification Bell Widget
// Usage: include this script, then call NotificationBell.init('#navBellSlot')
// The bell auto-connects to Socket.io and polls the /api/notifications endpoint.

const NotificationBell = (() => {
  let socket = null;

  function getToken() {
    return localStorage.getItem('vm_token');
  }

  function buildBellHTML() {
    return `
      <div id="notif-bell-wrap" style="position:relative;display:inline-flex;align-items:center;">
        <button id="notif-bell-btn" title="Notifications"
          style="background:rgba(255,255,255,0.08);border:none;color:#e2e8f0;width:38px;height:38px;
                 border-radius:10px;cursor:pointer;font-size:1.1rem;position:relative;display:flex;
                 align-items:center;justify-content:center;transition:background 0.2s;">
          <i class="fas fa-bell"></i>
          <span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;
            background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;
            font-size:0.65rem;font-weight:800;align-items:center;justify-content:center;"></span>
        </button>
        <div id="notif-dropdown" style="display:none;position:absolute;top:44px;right:0;
          background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;
          width:300px;max-height:380px;overflow-y:auto;z-index:5000;
          box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <div style="padding:12px 16px;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);
            display:flex;justify-content:space-between;align-items:center;">
            <span>🔔 Notifications</span>
            <button onclick="NotificationBell.markAllRead()" style="background:none;border:none;
              color:#6c63ff;font-size:0.78rem;cursor:pointer;font-family:inherit;">Mark all read</button>
          </div>
          <div id="notif-list" style="padding:8px 0;"></div>
        </div>
      </div>`;
  }

  async function load() {
    const token = getToken();
    if (!token) return;
    try {
      const notifs = await API.get('/notifications');
      const list = document.getElementById('notif-list');
      const badge = document.getElementById('notif-badge');
      if (!list) return;
      const unread = notifs.filter(n => !n.is_read).length;
      if (unread > 0) {
        badge.style.display = 'flex';
        badge.textContent = unread > 9 ? '9+' : unread;
      } else {
        badge.style.display = 'none';
      }
      if (!notifs.length) {
        list.innerHTML = '<p style="padding:20px;text-align:center;color:#94a3b8;font-size:0.88rem;">No notifications yet</p>';
        return;
      }
      const icons = { chat: '💬', order: '📦', info: 'ℹ️', success: '✅' };
      list.innerHTML = notifs.map(n => `
        <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05);
          background:${!n.is_read ? 'rgba(108,99,255,0.07)' : 'transparent'};
          font-size:0.85rem;">
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="font-size:1rem;">${icons[n.type] || 'ℹ️'}</span>
            <div>
              <div style="color:#e2e8f0;">${n.message}</div>
              <div style="color:#64748b;font-size:0.75rem;margin-top:2px;">${new Date(n.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>`).join('');
    } catch {}
  }

  function initSocket(token) {
    if (!token) return;
    // Load socket.io client from the server
    const s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = () => {
      socket = io({ auth: { token } });
      socket.emit('auth', token);
      socket.on('notification:new', () => load());
      socket.on('chat:message', (msg) => {
        // Dispatch a custom event so individual pages can react
        window.dispatchEvent(new CustomEvent('vm:chatMessage', { detail: msg }));
      });
    };
    document.head.appendChild(s);
  }

  function init(slotSelector = '#notifBellSlot') {
    const slot = document.querySelector(slotSelector);
    if (!slot) return;
    slot.innerHTML = buildBellHTML();

    const btn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    btn.addEventListener('click', () => {
      const open = dropdown.style.display === 'block';
      dropdown.style.display = open ? 'none' : 'block';
      if (!open) load();
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('notif-bell-wrap').contains(e.target))
        dropdown.style.display = 'none';
    });

    const token = getToken();
    load();
    initSocket(token);
  }

  async function markAllRead() {
    try {
      await API.patch('/notifications/read', {});
      load();
    } catch {}
  }

  return { init, load, markAllRead };
})();

window.NotificationBell = NotificationBell;
