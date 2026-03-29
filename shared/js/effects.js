// NIRVANA MART 3.0 — Premium Visual Effects Engine
// Particle Canvas, Custom Cursor, Scroll Reveal, Dark Mode, Modal, Toast

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initCursor();
  initScrollEffects();
  initReveal();
  initCardTilt();
  initNavbarScroll();
  initDarkModeToggle();
  initPageLoader();
  initRippleButtons();
  initParallax();
  initMagneticButtons();
});

// ─── Particle Canvas ──────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const COUNT = window.innerWidth < 768 ? 0 : 70;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

  function Particle() {
    this.reset = function() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.6 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.alpha = Math.random() * 0.5 + 0.15;
    };
    this.reset();
  }

  for (let i = 0; i < COUNT; i++) particles.push(new Particle());

  let mouseX = W / 2, mouseY = H / 2;
  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const baseColor = isDark() ? '200,146,58' : '180,120,40';

    particles.forEach(p => {
      // Gentle mouse attraction
      const dx = mouseX - p.x, dy = mouseY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        p.vx += (dx / dist) * 0.012;
        p.vy += (dy / dist) * 0.012;
      }
      // Speed clamp
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 1.2) { p.vx = (p.vx / speed) * 1.2; p.vy = (p.vy / speed) * 1.2; }

      p.x += p.vx; p.y += p.vy;
      if (p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5) p.reset();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${baseColor},${p.alpha})`;
      ctx.fill();
    });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${baseColor},${0.08 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ─── Page Loader ──────────────────────────────────────────────
function initPageLoader() {
  const loader = document.querySelector('.page-loader');
  if (!loader) return;
  window.addEventListener('load', () => { setTimeout(() => loader.classList.add('fade-out'), 500); });
  setTimeout(() => loader.classList.add('fade-out'), 2200);
}

// ─── Custom Cursor ─────────────────────────────────────────────
function initCursor() {
  if (window.innerWidth < 769) return;
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.left = mx + 'px'; dot.style.top = my + 'px'; });
  
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'IFRAME_MOUSEMOVE') {
      const frame = document.getElementById('cartFrame');
      if (frame) {
        const rect = frame.getBoundingClientRect();
        mx = rect.left + e.data.clientX;
        my = rect.top + e.data.clientY;
        dot.style.left = mx + 'px';
        dot.style.top = my + 'px';
      }
    } else if (e.data && e.data.type === 'IFRAME_MOUSEDOWN') {
      dot.style.transform = 'translate(-50%,-50%) scale(0.65)';
    } else if (e.data && e.data.type === 'IFRAME_MOUSEUP') {
        dot.style.transform = 'translate(-50%,-50%) scale(1)';
    }
  });

  function animateRing() { rx += (mx - rx) * 0.13; ry += (my - ry) * 0.13; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(animateRing); }
  animateRing();

  document.querySelectorAll('a,button,.btn,.card,.cat-chip,.product-card,.role-card,.stat-card,input,select,textarea,.nav-icon-btn').forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('hovered'); ring.classList.add('hovered'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hovered'); ring.classList.remove('hovered'); });
  });
  document.addEventListener('mousedown', () => dot.style.transform = 'translate(-50%,-50%) scale(0.65)');
  document.addEventListener('mouseup',   () => dot.style.transform = 'translate(-50%,-50%) scale(1)');
}

// ─── Magnetic Buttons ─────────────────────────────────────────
function initMagneticButtons() {
  if (window.innerWidth < 769) return;
  document.querySelectorAll('.btn-primary,.btn-gold,.btn-success').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) * 0.22;
      const dy = (e.clientY - rect.top  - rect.height / 2) * 0.22;
      btn.style.transform = `translate(${dx}px, ${dy}px) translateY(-2px)`;
    });
    btn.addEventListener('mouseleave', () => btn.style.transform = '');
  });
}

// ─── Parallax Hero ────────────────────────────────────────────
function initParallax() {
  const els = document.querySelectorAll('[data-parallax]');
  if (!els.length) return;
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    els.forEach(el => { el.style.transform = `translateY(${sy * (parseFloat(el.dataset.parallax) || 0.3)}px)`; });
  }, { passive: true });
}

// ─── Scroll Reveal ────────────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

// ─── 3D Card Tilt ─────────────────────────────────────────────
function initCardTilt() {
  document.querySelectorAll('.card-3d').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
      card.style.transform  = `perspective(800px) rotateX(${-dy * 8}deg) rotateY(${dx * 8}deg) translateY(-6px)`;
      card.style.transition = 'none';
      const shine = card.querySelector('.card-shine');
      if (shine) shine.style.background = `radial-gradient(circle at ${(dx + 1)*50}% ${(dy + 1)*50}%, rgba(255,255,255,0.12), transparent 70%)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.transition = 'transform 0.5s ease'; });
  });
}

// ─── Navbar Scroll ────────────────────────────────────────────
function initNavbarScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 30), { passive: true });
}

// ─── Counter Animation ────────────────────────────────────────
function initScrollEffects() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = parseInt(el.dataset.count);
      let start = 0;
      const step = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 1500, 1);
        el.textContent = Math.floor(p * target).toLocaleString();
        if (p < 1) requestAnimationFrame(step); else el.textContent = target.toLocaleString();
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  els.forEach(el => obs.observe(el));
}

// ─── Dark Mode ────────────────────────────────────────────────
function initDarkModeToggle() {
  const btn = document.getElementById('darkModeToggle');
  if (!btn) return;
  const saved = localStorage.getItem('vm_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('vm_theme', next);
  });
}

// ─── Ripple ───────────────────────────────────────────────────
function initRippleButtons() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const r = this.getBoundingClientRect();
      const rip = document.createElement('span');
      rip.className = 'btn-ripple';
      const size = Math.max(r.width, r.height);
      rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
      this.appendChild(rip);
      setTimeout(() => rip.remove(), 550);
    });
  });
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
  const icons = { success:'✓', error:'✕', info:'ℹ', warning:'⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-icon">${icons[type]||'ℹ'}</div><div style="flex:1;font-size:0.9rem;line-height:1.4;">${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, duration);
}
window.showToast = showToast;

// ─── Modal Helpers ────────────────────────────────────────────
function openModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; } }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('show'); document.body.style.overflow = ''; } }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) { e.target.classList.remove('show'); document.body.style.overflow = ''; } });
window.openModal  = openModal;
window.closeModal = closeModal;

// ─── Password Toggle ──────────────────────────────────────────
function togglePassword(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const hidden = inp.type === 'password';
  inp.type = hidden ? 'text' : 'password';
  if (btn) btn.innerHTML = hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}
window.togglePassword = togglePassword;

// ─── Re-run cursor on dynamic content ────────────────────────
function refreshCursorTargets() {
  const dot = document.querySelector('.cursor-dot'), ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  document.querySelectorAll('a,button,.btn,.card,.cat-chip,.product-card,.role-card,.stat-card,input,select').forEach(el => {
    if (el._cursorBound) return;
    el._cursorBound = true;
    el.addEventListener('mouseenter', () => { dot.classList.add('hovered'); ring.classList.add('hovered'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hovered'); ring.classList.remove('hovered'); });
  });
}
window.refreshCursorTargets = refreshCursorTargets;
