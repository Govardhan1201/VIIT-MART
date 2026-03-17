// VIIT Mart — Visual Effects Engine
// Handles: Custom cursor, Parallax, Reveal, 3D tilt, Micro-interactions, Dark mode

document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initScrollEffects();
  initReveal();
  initCardTilt();
  initNavbarScroll();
  initDarkModeToggle();
  initPageLoader();
  initRippleButtons();
  initParallax();
});

// ─── Page Loader ─────────────────────────────────────────────
function initPageLoader() {
  const loader = document.querySelector('.page-loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => { loader.classList.add('fade-out'); }, 600);
  });
  setTimeout(() => { loader.classList.add('fade-out'); }, 2000);
}

// ─── Custom Cursor ────────────────────────────────────────────
function initCursor() {
  if (window.innerWidth < 769) return;

  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';
  });

  // Smooth ring follow
  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  // Hover state on interactive elements
  const hoverEls = document.querySelectorAll('a, button, .btn, .card, .cat-chip, .product-card, .role-card, .stat-card, input, select, textarea, .nav-icon-btn, .user-menu-trigger');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('hovered'); ring.classList.add('hovered'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hovered'); ring.classList.remove('hovered'); });
  });

  document.addEventListener('mousedown', () => { dot.style.transform = 'translate(-50%, -50%) scale(0.7)'; });
  document.addEventListener('mouseup', () => { dot.style.transform = 'translate(-50%, -50%) scale(1)'; });
}

// ─── Parallax Hero ───────────────────────────────────────────
function initParallax() {
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  if (parallaxEls.length === 0) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    parallaxEls.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      el.style.transform = `translateY(${scrollY * speed}px)`;
    });
  }, { passive: true });
}

// ─── Scroll Reveal ───────────────────────────────────────────
function initReveal() {
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

  revealEls.forEach(el => observer.observe(el));
}

// ─── 3D Card Tilt ────────────────────────────────────────────
function initCardTilt() {
  const tiltCards = document.querySelectorAll('.card-3d');
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotX = -dy * 8;
      const rotY = dx * 8;
      card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px)`;
      card.style.transition = 'none';
      // Subtle shine
      const shine = card.querySelector('.card-shine');
      if (shine) {
        shine.style.background = `radial-gradient(circle at ${(dx + 1) * 50}% ${(dy + 1) * 50}%, rgba(255,255,255,0.12), transparent 70%)`;
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.5s ease';
    });
  });
}

// ─── Navbar Scroll Effect ────────────────────────────────────
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });
}

// ─── Scroll-based Counter Animation ─────────────────────────
function initScrollEffects() {
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length === 0) return;

  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      let start = 0;
      const duration = 1500;
      const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        el.textContent = Math.floor(progress * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString();
      };
      requestAnimationFrame(step);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(el => countObserver.observe(el));
}

// ─── Dark Mode Toggle ────────────────────────────────────────
function initDarkModeToggle() {
  const toggleBtn = document.getElementById('darkModeToggle');
  if (!toggleBtn) return;

  // Apply saved theme
  const saved = localStorage.getItem('vm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);

  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('vm_theme', next);
  });
}

// ─── Ripple Effect on Buttons ────────────────────────────────
function initRippleButtons() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });
  });
}

// ─── Toast System ────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ'}</div>
    <div style="flex:1; font-size:0.9rem; line-height:1.4;">${message}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.showToast = showToast;

// ─── Modal Helper ───────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('show'); document.body.style.overflow = ''; }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
    document.body.style.overflow = '';
  }
});

window.openModal = openModal;
window.closeModal = closeModal;

// ─── Password Toggle ─────────────────────────────────────────
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  if (btn) btn.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

window.togglePassword = togglePassword;

// ─── Re-run hover cursor detection on dynamic content ────────
function refreshCursorTargets() {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  document.querySelectorAll('a, button, .btn, .card, .cat-chip, .product-card, .role-card, .stat-card, input, select').forEach(el => {
    if (el._cursorBound) return;
    el._cursorBound = true;
    el.addEventListener('mouseenter', () => { dot.classList.add('hovered'); ring.classList.add('hovered'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hovered'); ring.classList.remove('hovered'); });
  });
}

window.refreshCursorTargets = refreshCursorTargets;
