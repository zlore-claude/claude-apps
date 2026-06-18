'use strict';

// ── Shared state (same localStorage key as the board) ────────────────────────

const STORAGE_KEY = 'potato-builder-state';
const TEAM_COLORS = ['#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#be185d'];

function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState() || { pi: { name: 'Potato PI 1' }, sprints: [], teams: [], cards: [], objectives: [], objExpanded: {} };

// ── DOM ───────────────────────────────────────────────────────────────────────

const headerPiName  = document.getElementById('header-pi-name');
const piNameInput   = document.getElementById('pi-name-input');
const sprintList    = document.getElementById('sprint-list');
const teamList      = document.getElementById('team-list');

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  headerPiName.textContent = state.pi.name;
  piNameInput.value = state.pi.name;
  renderSprints();
  renderTeams();
}

function renderSprints() {
  sprintList.innerHTML = state.sprints.map((sp, i) => `
    <li class="item-row" draggable="true" data-sprint-idx="${i}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <input class="item-name-input" type="text" value="${escapeHTML(sp.name)}" data-sprint-id="${escapeHTML(sp.id)}" aria-label="Sprint name" />
      <button class="btn-icon" data-action="delete-sprint" data-sprint-id="${escapeHTML(sp.id)}" title="Delete sprint">🗑</button>
    </li>`).join('');
  bindSprintDrag();
}

function renderTeams() {
  teamList.innerHTML = state.teams.map((team, i) => {
    const color = team.color || TEAM_COLORS[i % TEAM_COLORS.length];
    return `<li class="item-row" draggable="true" data-team-idx="${i}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <label class="color-swatch" style="background:${escapeHTML(color)}" title="Change color">
        <input type="color" value="${escapeHTML(color)}" data-team-id="${escapeHTML(team.id)}" aria-label="Team color" />
      </label>
      <input class="item-name-input" type="text" value="${escapeHTML(team.name)}" data-team-id="${escapeHTML(team.id)}" aria-label="Team name" />
      <button class="btn-icon" data-action="delete-team" data-team-id="${escapeHTML(team.id)}" title="Delete team">🗑</button>
    </li>`;
  }).join('');
  bindTeamDrag();
}

// ── Inline edit: sprints ──────────────────────────────────────────────────────

sprintList.addEventListener('change', e => {
  const input = e.target.closest('input.item-name-input[data-sprint-id]');
  if (!input) return;
  const sp = state.sprints.find(s => s.id === input.dataset.sprintId);
  if (sp) { sp.name = input.value.trim() || sp.name; saveState(); render(); }
});

sprintList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action="delete-sprint"]');
  if (!btn) return;
  if (!confirm('Delete this sprint? Cards assigned to it will move to the backlog.')) return;
  const id = btn.dataset.sprintId;
  state.sprints = state.sprints.filter(s => s.id !== id);
  state.cards.forEach(c => { if (c.sprintId === id) c.sprintId = null; });
  saveState(); render();
});

// ── Inline edit: teams ────────────────────────────────────────────────────────

teamList.addEventListener('change', e => {
  const nameInput = e.target.closest('input.item-name-input[data-team-id]');
  if (nameInput) {
    const team = state.teams.find(t => t.id === nameInput.dataset.teamId);
    if (team) { team.name = nameInput.value.trim() || team.name; saveState(); render(); }
    return;
  }
  const colorInput = e.target.closest('input[type="color"][data-team-id]');
  if (colorInput) {
    const team = state.teams.find(t => t.id === colorInput.dataset.teamId);
    if (team) { team.color = colorInput.value; saveState(); renderTeams(); }
  }
});

teamList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action="delete-team"]');
  if (!btn) return;
  if (!confirm('Delete this team? All their cards and objectives will be removed.')) return;
  const id = btn.dataset.teamId;
  state.teams = state.teams.filter(t => t.id !== id);
  state.cards = state.cards.filter(c => c.teamId !== id);
  state.objectives = state.objectives.filter(o => o.teamId !== id);
  saveState(); render();
});

// ── Add sprint ────────────────────────────────────────────────────────────────

document.getElementById('btn-add-sprint').addEventListener('click', () => {
  if (state.sprints.length >= 8) { alert('Maximum 8 sprints.'); return; }
  const name = prompt('Sprint name:', `Sprint ${state.sprints.length + 1}`);
  if (!name || !name.trim()) return;
  state.sprints.push({ id: uid(), name: name.trim() });
  saveState(); render();
});

// ── Add team ──────────────────────────────────────────────────────────────────

document.getElementById('btn-add-team').addEventListener('click', () => {
  const name = prompt('Team name:');
  if (!name || !name.trim()) return;
  const idx = state.teams.length;
  state.teams.push({ id: uid(), name: name.trim(), color: TEAM_COLORS[idx % TEAM_COLORS.length] });
  saveState(); render();
});

// ── Save PI name ──────────────────────────────────────────────────────────────

document.getElementById('btn-save-pi').addEventListener('click', () => {
  const val = piNameInput.value.trim();
  if (!val) return;
  state.pi.name = val;
  saveState(); render();
});
piNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-save-pi').click(); });

// ── Reset ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('This will erase ALL board data and restore defaults. Are you sure?')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.href = '../';
});

// ── Drag to reorder (sprints) ─────────────────────────────────────────────────

let dragSrcIdx = null;
let dragType = null;

function bindSprintDrag() {
  sprintList.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrcIdx = Number(row.dataset.sprintIdx);
      dragType = 'sprint';
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', e => {
      if (dragType !== 'sprint') return;
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const destIdx = Number(row.dataset.sprintIdx);
      if (dragSrcIdx === null || dragSrcIdx === destIdx) return;
      const [moved] = state.sprints.splice(dragSrcIdx, 1);
      state.sprints.splice(destIdx, 0, moved);
      saveState(); renderSprints();
    });
  });
}

function bindTeamDrag() {
  teamList.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrcIdx = Number(row.dataset.teamIdx);
      dragType = 'team';
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', e => {
      if (dragType !== 'team') return;
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const destIdx = Number(row.dataset.teamIdx);
      if (dragSrcIdx === null || dragSrcIdx === destIdx) return;
      const [moved] = state.teams.splice(dragSrcIdx, 1);
      state.teams.splice(destIdx, 0, moved);
      saveState(); renderTeams();
    });
  });
}

// ── Back button ───────────────────────────────────────────────────────────────

document.getElementById('back-btn').addEventListener('click', () => {
  location.href = '../';
});

// ── Boot ──────────────────────────────────────────────────────────────────────

const startTime = Date.now();
render();

function removeLoading() {
  const el = document.getElementById('app-loading');
  if (el) el.remove();
}
const elapsed = Date.now() - startTime;
if (elapsed < 3000) setTimeout(removeLoading, 3000 - elapsed);
else removeLoading();
