'use strict';

if (window.self !== window.top) document.documentElement.classList.add('embedded');

// ── State ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'potato-builder-state';

const TEAM_COLORS = ['#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#be185d'];

function defaultState() {
  return {
    pi: { name: 'Potato PI 1' },
    sprints: [
      { id: 's1', name: 'Sprint 1' },
      { id: 's2', name: 'Sprint 2' },
      { id: 's3', name: 'Sprint 3' },
      { id: 's4', name: 'Sprint 4' },
      { id: 's5', name: 'Sprint 5' },
      { id: 'sip', name: 'IP Sprint' },
    ],
    teams: [
      { id: 't1', name: 'Team Alpha' },
      { id: 't2', name: 'Team Beta' },
      { id: 't3', name: 'Team Gamma' },
    ],
    cards: [
      { id: 'c1', title: 'User authentication flow', type: 'feature', teamId: 't1', sprintId: 's1', points: 8, notes: '' },
      { id: 'c2', title: 'Payment gateway integration', type: 'feature', teamId: 't1', sprintId: 's2', points: 13, notes: '' },
      { id: 'c3', title: 'Dashboard redesign', type: 'story', teamId: 't2', sprintId: 's1', points: 5, notes: '' },
      { id: 'c4', title: 'API rate limiting risk', type: 'risk', teamId: 't2', sprintId: null, points: null, notes: 'Third-party API may throttle us.' },
      { id: 'c5', title: 'CI/CD pipeline upgrade', type: 'enabler', teamId: 't3', sprintId: 's3', points: 3, notes: '' },
      { id: 'c6', title: 'Mobile responsive layouts', type: 'feature', teamId: 't3', sprintId: null, points: 8, notes: '' },
    ],
    objectives: [
      { id: 'o1', teamId: 't1', title: 'Ship end-to-end auth', businessValue: 9, stretch: false },
      { id: 'o2', teamId: 't2', title: 'Launch new dashboard', businessValue: 8, stretch: false },
      { id: 'o3', teamId: 't2', title: 'Explore AI recommendations', businessValue: 5, stretch: true },
    ],
    objExpanded: {},
  };
}

let state = loadState();
let saveTimer = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s.objExpanded) s.objExpanded = {};
      return s;
    }
  } catch (_) { /* ignore */ }
  return defaultState();
}

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 200);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function uid() {
  return Math.random().toString(36).slice(2,9) + Date.now().toString(36);
}

function teamColor(teamId) {
  const idx = state.teams.findIndex(t => t.id === teamId);
  return TEAM_COLORS[idx % TEAM_COLORS.length] ?? '#64748b';
}

// ── Board render ──────────────────────────────────────────────────────────────

const board = document.getElementById('board');

function render() {
  const { sprints, teams, cards, objectives, objExpanded } = state;
  const cols = 1 + sprints.length + 1; // team col + sprints + backlog
  board.style.gridTemplateColumns =
    `var(--team-col-w) repeat(${sprints.length}, var(--sprint-col-w)) var(--backlog-col-w)`;

  let html = '';

  // ── Header row ──
  html += `<div class="board-header-cell corner">${escapeHTML(state.pi.name)}</div>`;
  sprints.forEach(sp => {
    html += `<div class="board-header-cell" data-sprint-id="${escapeHTML(sp.id)}">
      <div class="sprint-header-inner">
        <span>${escapeHTML(sp.name)}</span>
        <button class="sprint-rename-btn" data-action="rename-sprint" data-sprint-id="${escapeHTML(sp.id)}" title="Rename">✎</button>
      </div>
    </div>`;
  });
  html += `<div class="board-header-cell backlog">Backlog</div>`;

  // ── Team rows ──
  teams.forEach(team => {
    const color = teamColor(team.id);
    const expanded = objExpanded[team.id] !== false; // default open

    // Team name cell
    html += `<div class="team-cell" data-team-id="${escapeHTML(team.id)}">
      <div class="team-cell-inner">
        <span class="team-dot" style="background:${color}"></span>
        <span class="team-name" data-action="rename-team" data-team-id="${escapeHTML(team.id)}">${escapeHTML(team.name)}</span>
      </div>
      <div class="team-actions">
        <button class="btn-icon" data-action="delete-team" data-team-id="${escapeHTML(team.id)}" title="Delete team">🗑</button>
      </div>
    </div>`;

    // Sprint cells
    sprints.forEach(sp => {
      const cellCards = cards.filter(c => c.teamId === team.id && c.sprintId === sp.id);
      html += `<div class="sprint-cell" data-team-id="${escapeHTML(team.id)}" data-sprint-id="${escapeHTML(sp.id)}">`;
      cellCards.forEach(c => { html += cardHTML(c); });
      html += `<div class="add-card-hint" data-action="quick-add" data-team-id="${escapeHTML(team.id)}" data-sprint-id="${escapeHTML(sp.id)}">+ card</div>`;
      html += `</div>`;
    });

    // Backlog cell
    const backlogCards = cards.filter(c => c.teamId === team.id && c.sprintId === null);
    html += `<div class="sprint-cell backlog-cell" data-team-id="${escapeHTML(team.id)}" data-sprint-id="">`;
    backlogCards.forEach(c => { html += cardHTML(c); });
    html += `<div class="add-card-hint" data-action="quick-add" data-team-id="${escapeHTML(team.id)}" data-sprint-id="">+ card</div>`;
    html += `</div>`;

    // Objectives toggle row
    const toggleClass = expanded ? '' : 'obj-row-collapsed';
    html += `<div class="obj-row-toggle-cell ${toggleClass}" data-action="toggle-obj" data-team-id="${escapeHTML(team.id)}">
      <span class="obj-toggle-icon">▾</span> Objectives
    </div>`;

    // Objectives span cell (spans all sprint cols + backlog)
    const objHiddenClass = expanded ? '' : 'obj-hidden';
    const teamObjs = objectives.filter(o => o.teamId === team.id);
    html += `<div class="obj-span-cell ${objHiddenClass}" style="grid-column: span ${sprints.length + 1}" data-team-id="${escapeHTML(team.id)}">`;
    teamObjs.forEach(o => {
      html += `<div class="obj-chip" data-action="edit-obj" data-obj-id="${escapeHTML(o.id)}">
        <span class="obj-chip-title">${escapeHTML(o.title)}</span>
        <span class="obj-chip-bv">BV ${o.businessValue}</span>
        ${o.stretch ? '<span class="obj-chip-stretch">STRETCH</span>' : ''}
      </div>`;
    });
    html += `<button class="add-obj-btn" data-action="add-obj" data-team-id="${escapeHTML(team.id)}">+ Objective</button>`;
    html += `</div>`;
  });

  board.innerHTML = html;
  bindDrag();
}

function cardHTML(c) {
  const typeLabel = c.type.charAt(0).toUpperCase() + c.type.slice(1);
  const pts = c.points != null && c.points !== '' ? `<span class="card-points">${escapeHTML(String(c.points))}pt</span>` : '';
  return `<div class="card" draggable="true" data-card-id="${escapeHTML(c.id)}" data-type="${escapeHTML(c.type)}">
    <button class="btn-icon card-delete" data-action="delete-card" data-card-id="${escapeHTML(c.id)}" title="Delete">×</button>
    <div class="card-header">
      <div class="card-title">${escapeHTML(c.title)}</div>
    </div>
    <div class="card-footer">
      <span class="card-badge badge-${escapeHTML(c.type)}">${escapeHTML(typeLabel)}</span>
      ${pts}
    </div>
  </div>`;
}

// ── Drag and drop ─────────────────────────────────────────────────────────────

let dragCardId = null;

function bindDrag() {
  board.querySelectorAll('.card').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragCardId = el.dataset.cardId;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      dragCardId = null;
    });
    el.addEventListener('dblclick', () => {
      openCardModal(el.dataset.cardId);
    });
  });

  board.querySelectorAll('.sprint-cell').forEach(cell => {
    cell.addEventListener('dragover', e => {
      if (!dragCardId) return;
      e.preventDefault();
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', e => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      if (!dragCardId) return;
      const teamId = cell.dataset.teamId;
      const sprintId = cell.dataset.sprintId || null;
      const card = state.cards.find(c => c.id === dragCardId);
      if (card) {
        card.teamId = teamId;
        card.sprintId = sprintId;
        saveState();
        render();
      }
    });
  });
}

// ── Event delegation ──────────────────────────────────────────────────────────

board.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'delete-card') {
    e.stopPropagation();
    const id = el.dataset.cardId;
    state.cards = state.cards.filter(c => c.id !== id);
    saveState(); render();
  } else if (action === 'quick-add') {
    openCardModal(null, el.dataset.teamId, el.dataset.sprintId || null);
  } else if (action === 'rename-team') {
    renameTeam(el.dataset.teamId);
  } else if (action === 'delete-team') {
    deleteTeam(el.dataset.teamId);
  } else if (action === 'rename-sprint') {
    e.stopPropagation();
    renameSprint(el.dataset.sprintId);
  } else if (action === 'toggle-obj') {
    const tid = el.dataset.teamId;
    state.objExpanded[tid] = state.objExpanded[tid] === false ? true : false;
    saveState(); render();
  } else if (action === 'edit-obj') {
    openObjModal(el.dataset.objId);
  } else if (action === 'add-obj') {
    openObjModal(null, el.dataset.teamId);
  }
});

// ── PI name ───────────────────────────────────────────────────────────────────

document.getElementById('pi-name').addEventListener('click', function() {
  const el = this;
  const input = document.createElement('input');
  input.className = 'pi-name-input';
  input.value = state.pi.name;
  el.replaceWith(input);
  input.focus(); input.select();
  function commit() {
    const val = input.value.trim() || state.pi.name;
    state.pi.name = val;
    saveState();
    input.replaceWith(el);
    el.textContent = val;
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { input.replaceWith(el); } });
});

function syncPiName() {
  document.getElementById('pi-name').textContent = state.pi.name;
}

// ── Team actions ──────────────────────────────────────────────────────────────

document.getElementById('btn-add-team').addEventListener('click', () => {
  const name = prompt('Team name:');
  if (!name || !name.trim()) return;
  state.teams.push({ id: uid(), name: name.trim() });
  saveState(); render();
});

function renameTeam(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;
  const name = prompt('Rename team:', team.name);
  if (!name || !name.trim()) return;
  team.name = name.trim();
  saveState(); render();
}

function deleteTeam(teamId) {
  if (!confirm('Delete this team and all its cards/objectives?')) return;
  state.teams = state.teams.filter(t => t.id !== teamId);
  state.cards = state.cards.filter(c => c.teamId !== teamId);
  state.objectives = state.objectives.filter(o => o.teamId !== teamId);
  saveState(); render();
}

// ── Sprint actions ────────────────────────────────────────────────────────────

document.getElementById('btn-add-sprint').addEventListener('click', () => {
  if (state.sprints.length >= 8) { alert('Maximum 8 sprints.'); return; }
  const name = prompt('Sprint name:', `Sprint ${state.sprints.length}`);
  if (!name || !name.trim()) return;
  state.sprints.push({ id: uid(), name: name.trim() });
  saveState(); render();
});

function renameSprint(sprintId) {
  const sp = state.sprints.find(s => s.id === sprintId);
  if (!sp) return;
  const name = prompt('Rename sprint:', sp.name);
  if (!name || !name.trim()) return;
  sp.name = name.trim();
  saveState(); render();
}

// ── Card modal ────────────────────────────────────────────────────────────────

const modalOverlay = document.getElementById('modal-overlay');
const fieldTitle   = document.getElementById('field-title');
const fieldType    = document.getElementById('field-type');
const fieldPoints  = document.getElementById('field-points');
const fieldNotes   = document.getElementById('field-notes');
const fieldTeam    = document.getElementById('field-team');
const fieldSprint  = document.getElementById('field-sprint');
const modalTitleEl = document.getElementById('modal-title');

let editingCardId = null;

function openCardModal(cardId, defaultTeamId, defaultSprintId) {
  editingCardId = cardId;
  modalTitleEl.textContent = cardId ? 'Edit Feature' : 'New Feature';

  // Populate team dropdown
  fieldTeam.innerHTML = state.teams.map(t =>
    `<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`
  ).join('');

  // Populate sprint dropdown
  fieldSprint.innerHTML = `<option value="">Backlog</option>` +
    state.sprints.map(s =>
      `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`
    ).join('');

  if (cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    fieldTitle.value  = card.title;
    fieldType.value   = card.type;
    fieldPoints.value = card.points ?? '';
    fieldNotes.value  = card.notes ?? '';
    fieldTeam.value   = card.teamId;
    fieldSprint.value = card.sprintId ?? '';
    document.getElementById('btn-delete-card').style.display = 'inline-flex';
  } else {
    fieldTitle.value  = '';
    fieldType.value   = 'feature';
    fieldPoints.value = '';
    fieldNotes.value  = '';
    fieldTeam.value   = defaultTeamId ?? state.teams[0]?.id ?? '';
    fieldSprint.value = defaultSprintId ?? '';
    document.getElementById('btn-delete-card').style.display = 'none';
  }

  modalOverlay.classList.remove('hidden');
  fieldTitle.focus();
}

function closeCardModal() { modalOverlay.classList.add('hidden'); }

document.getElementById('modal-close').addEventListener('click', closeCardModal);
document.getElementById('btn-cancel-modal').addEventListener('click', closeCardModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeCardModal(); });

document.getElementById('btn-save-card').addEventListener('click', () => {
  const title = fieldTitle.value.trim();
  if (!title) { fieldTitle.focus(); return; }
  const data = {
    title,
    type:     fieldType.value,
    teamId:   fieldTeam.value,
    sprintId: fieldSprint.value || null,
    points:   fieldPoints.value !== '' ? Number(fieldPoints.value) : null,
    notes:    fieldNotes.value.trim(),
  };
  if (editingCardId) {
    const card = state.cards.find(c => c.id === editingCardId);
    if (card) Object.assign(card, data);
  } else {
    state.cards.push({ id: uid(), ...data });
  }
  saveState(); render(); closeCardModal();
});

document.getElementById('btn-delete-card').addEventListener('click', () => {
  if (!editingCardId) return;
  if (!confirm('Delete this card?')) return;
  state.cards = state.cards.filter(c => c.id !== editingCardId);
  saveState(); render(); closeCardModal();
});

document.getElementById('btn-add-card').addEventListener('click', () => {
  openCardModal(null, state.teams[0]?.id, null);
});

document.getElementById('btn-rte-cockpit').addEventListener('click', () => {
  // RTE Cockpit is its own tile. Inside the gallery shell, ask it to
  // switch tiles; standalone, walk over to the sibling app directly.
  if (window.self !== window.top) {
    window.parent.postMessage({ type: 'open-game', slug: 'rte-cockpit' }, '*');
  } else {
    location.href = '../rte-cockpit/';
  }
});

// ── Objective modal ───────────────────────────────────────────────────────────

const objModalOverlay = document.getElementById('obj-modal-overlay');
const objFieldTitle   = document.getElementById('obj-field-title');
const objFieldBv      = document.getElementById('obj-field-bv');
const objFieldStretch = document.getElementById('obj-field-stretch');
const objModalTitle   = document.getElementById('obj-modal-title');

let editingObjId  = null;
let editingObjTeamId = null;

function openObjModal(objId, defaultTeamId) {
  editingObjId = objId;
  editingObjTeamId = defaultTeamId;
  objModalTitle.textContent = objId ? 'Edit Objective' : 'New Objective';

  if (objId) {
    const obj = state.objectives.find(o => o.id === objId);
    if (!obj) return;
    objFieldTitle.value   = obj.title;
    objFieldBv.value      = obj.businessValue;
    objFieldStretch.checked = obj.stretch;
    document.getElementById('obj-btn-delete').style.display = 'inline-flex';
  } else {
    objFieldTitle.value   = '';
    objFieldBv.value      = '5';
    objFieldStretch.checked = false;
    document.getElementById('obj-btn-delete').style.display = 'none';
  }

  objModalOverlay.classList.remove('hidden');
  objFieldTitle.focus();
}

function closeObjModal() { objModalOverlay.classList.add('hidden'); }

document.getElementById('obj-modal-close').addEventListener('click', closeObjModal);
document.getElementById('obj-btn-cancel').addEventListener('click', closeObjModal);
objModalOverlay.addEventListener('click', e => { if (e.target === objModalOverlay) closeObjModal(); });

document.getElementById('obj-btn-save').addEventListener('click', () => {
  const title = objFieldTitle.value.trim();
  if (!title) { objFieldTitle.focus(); return; }
  const bv = Math.min(10, Math.max(1, Number(objFieldBv.value) || 5));
  if (editingObjId) {
    const obj = state.objectives.find(o => o.id === editingObjId);
    if (obj) { obj.title = title; obj.businessValue = bv; obj.stretch = objFieldStretch.checked; }
  } else {
    state.objectives.push({ id: uid(), teamId: editingObjTeamId, title, businessValue: bv, stretch: objFieldStretch.checked });
  }
  saveState(); render(); closeObjModal();
});

document.getElementById('obj-btn-delete').addEventListener('click', () => {
  if (!editingObjId) return;
  if (!confirm('Delete this objective?')) return;
  state.objectives = state.objectives.filter(o => o.id !== editingObjId);
  saveState(); render(); closeObjModal();
});

// ── Back button ───────────────────────────────────────────────────────────────

document.getElementById('back-btn').addEventListener('click', () => {
  if (window.self !== window.top) {
    window.parent.postMessage({ type: 'close-game' }, '*');
  } else {
    location.href = '../../';
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

const startTime = Date.now();

syncPiName();
render();

// Remove loading screen after content ready + 3s minimum
function removeLoading() {
  const el = document.getElementById('app-loading');
  if (el) el.remove();
}
const elapsed = Date.now() - startTime;
if (elapsed < 3000) {
  setTimeout(removeLoading, 3000 - elapsed);
} else {
  removeLoading();
}
