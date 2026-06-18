(function () {
  'use strict';

  const loading = document.getElementById('app-loading');
  const form = document.getElementById('cockpit-form');
  const savebar = document.getElementById('savebar');
  const toast = document.getElementById('toast');
  const STORE_KEY = 'potato-rte-cockpit';

  /* ---------- Snapshot / dirty tracking ---------- */
  // Serialize the full form state into a comparable string.
  function snapshot() {
    const state = {};
    form.querySelectorAll('[data-field]').forEach((el) => {
      if (el.matches('.seg')) {
        const on = el.querySelector('.on');
        state[el.dataset.seg] = on ? on.dataset.val : null;
      } else if (el.matches('.radios')) {
        const sel = el.querySelector('input:checked');
        state[el.dataset.radio] = sel ? sel.value : null;
      } else if (el.type === 'checkbox') {
        state[el.id] = el.checked;
      } else {
        state[el.id] = el.value;
      }
    });
    state.__accent = document.documentElement.style.getPropertyValue('--accent') || '#16a34a';
    return state;
  }

  let saved = snapshot(); // baseline = last saved state

  function isDirty() {
    return JSON.stringify(snapshot()) !== JSON.stringify(saved);
  }
  function refreshSaveBar() {
    savebar.classList.toggle('show', isDirty());
  }

  /* ---------- Tabs ---------- */
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = Array.from(document.querySelectorAll('.panel'));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
    });
  });

  /* ---------- Segmented controls ---------- */
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      refreshSaveBar();
    });
  });

  /* ---------- Radio cards ---------- */
  document.querySelectorAll('.radios').forEach((group) => {
    group.addEventListener('change', () => {
      group.querySelectorAll('.radio').forEach((lbl) => {
        lbl.classList.toggle('on', lbl.querySelector('input').checked);
      });
      refreshSaveBar();
    });
  });

  /* ---------- Accent swatches ---------- */
  const swatches = document.getElementById('swatches');
  function applyAccent(hex) {
    const root = document.documentElement.style;
    root.setProperty('--accent', hex);
    // Build a soft (10% alpha) variant from the hex.
    const r = parseInt(hex.slice(1, 3), 16),
          g = parseInt(hex.slice(3, 5), 16),
          b = parseInt(hex.slice(5, 7), 16);
    root.setProperty('--accent-soft', `rgba(${r},${g},${b},0.10)`);
  }
  swatches.addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    swatches.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === btn));
    applyAccent(btn.dataset.accent);
    refreshSaveBar();
  });

  /* ---------- Generic field listeners ---------- */
  form.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', refreshSaveBar);
    el.addEventListener('change', refreshSaveBar);
  });

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  /* ---------- Save / discard ---------- */
  function applyState(state) {
    form.querySelectorAll('[data-field]').forEach((el) => {
      if (el.matches('.seg')) {
        const val = state[el.dataset.seg];
        el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.val === val));
      } else if (el.matches('.radios')) {
        const val = state[el.dataset.radio];
        el.querySelectorAll('input').forEach((inp) => { inp.checked = inp.value === val; });
        el.querySelectorAll('.radio').forEach((lbl) => lbl.classList.toggle('on', lbl.querySelector('input').checked));
      } else if (el.type === 'checkbox') {
        if (el.id in state) el.checked = state[el.id];
      } else if (el.id in state) {
        el.value = state[el.id];
      }
    });
    if (state.__accent) {
      applyAccent(state.__accent);
      swatches.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.accent === state.__accent));
    }
  }

  document.getElementById('btn-save').addEventListener('click', () => {
    saved = snapshot();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (_) {}
    refreshSaveBar();
    showToast('Cockpit defaults saved');
  });

  document.getElementById('btn-discard').addEventListener('click', () => {
    applyState(saved);
    refreshSaveBar();
  });

  /* ---------- Danger zone ---------- */
  document.getElementById('btn-reset').addEventListener('click', () => {
    applyState(FACTORY);
    refreshSaveBar();
    showToast('Reset to factory defaults — Save to keep');
  });
  document.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (window.confirm(btn.dataset.confirm)) {
        showToast('Done — this is a demo, nothing was actually changed');
      }
    });
  });

  /* ---------- No-op nav (visual only) ---------- */
  document.querySelectorAll('[data-noop]').forEach((el) => {
    el.addEventListener('click', (e) => e.preventDefault());
  });
  document.querySelectorAll('.nav-item:not(.active)').forEach((el) => {
    el.addEventListener('click', () => {
      showToast('That lives elsewhere — the cockpit is the Settings page');
    });
  });

  /* ---------- Quit (embedded-aware) ---------- */
  document.getElementById('exit-btn').addEventListener('click', () => {
    if (isDirty() && !window.confirm('Leave with unsaved changes?')) return;
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'close-game' }, '*');
    } else {
      location.href = '../../';
    }
  });

  /* ---------- Factory defaults (captured from initial DOM) ---------- */
  const FACTORY = snapshot();

  /* ---------- Boot: restore saved state, then drop splash ---------- */
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      applyState(stored);
      saved = snapshot();
    }
  } catch (_) {}
  refreshSaveBar();

  const startTime = Date.now();
  requestAnimationFrame(() => {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => loading.classList.add('hidden'), delay);
  });
})();
