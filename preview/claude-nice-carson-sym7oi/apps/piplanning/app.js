(function () {
  'use strict';

  // ── Escape helper ──────────────────────────────────────────────────────────
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── ID generator ──────────────────────────────────────────────────────────
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  // ── Team accent colors ─────────────────────────────────────────────────────
  var TEAM_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d'];

  // ── Default seed data ─────────────────────────────────────────────────────
  function defaultState() {
    var t1 = uid(), t2 = uid(), t3 = uid();
    var s1 = uid(), s2 = uid(), s3 = uid(), s4 = uid(), s5 = uid(), s6 = uid();
    return {
      pi: { name: 'PI 2026.2' },
      sprints: [
        { id: s1, name: 'Sprint 1' },
        { id: s2, name: 'Sprint 2' },
        { id: s3, name: 'Sprint 3' },
        { id: s4, name: 'Sprint 4' },
        { id: s5, name: 'Sprint 5' },
        { id: s6, name: 'IP Sprint' },
      ],
      teams: [
        { id: t1, name: 'Team Alpha', color: TEAM_COLORS[0] },
        { id: t2, name: 'Team Beta', color: TEAM_COLORS[1] },
        { id: t3, name: 'Team Gamma', color: TEAM_COLORS[2] },
      ],
      cards: [
        { id: uid(), title: 'User Auth Revamp', type: 'Feature', teamId: t1, sprintId: s1, points: 8, notes: '' },
        { id: uid(), title: 'API Rate Limiting', type: 'Enabler', teamId: t2, sprintId: s2, points: 5, notes: '' },
        { id: uid(), title: 'Performance Risk', type: 'Risk', teamId: t3, sprintId: null, points: 0, notes: 'DB queries may be slow' },
        { id: uid(), title: 'Dashboard Stories', type: 'Story', teamId: t1, sprintId: s3, points: 3, notes: '' },
      ],
      objectives: [],
      objCollapsed: {},
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  var STORAGE_KEY = 'piplanning-state';
  var saveTimer = null;

  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) { /* ignore */ }
    }, 200);
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Ensure objCollapsed exists
        if (!parsed.objCollapsed) parsed.objCollapsed = {};
        if (!parsed.objectives) parsed.objectives = [];
        return parsed;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var state = loadState() || defaultState();

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var piNameEl = document.getElementById('pi-name');
  var boardHead = document.getElementById('board-head');
  var boardBody = document.getElementById('board-body');
  var backBtn = document.getElementById('back-btn');

  // Card modal
  var cardModal = document.getElementById('card-modal');
  var modalTitle = document.getElementById('modal-title');
  var cardForm = document.getElementById('card-form');
  var cardIdInput = document.getElementById('card-id');
  var cardTitleInput = document.getElementById('card-title');
  var cardTypeInput = document.getElementById('card-type');
  var cardTeamInput = document.getElementById('card-team');
  var cardSprintInput = document.getElementById('card-sprint');
  var cardPointsInput = document.getElementById('card-points');
  var cardNotesInput = document.getElementById('card-notes');
  var cardDeleteBtn = document.getElementById('card-delete-btn');

  // Objective modal
  var objModal = document.getElementById('obj-modal');
  var objModalTitle = document.getElementById('obj-modal-title');
  var objForm = document.getElementById('obj-form');
  var objIdInput = document.getElementById('obj-id');
  var objTeamIdInput = document.getElementById('obj-team-id');
  var objTitleInput = document.getElementById('obj-title');
  var objBvInput = document.getElementById('obj-bv');
  var objStretchInput = document.getElementById('obj-stretch');
  var objDeleteBtn = document.getElementById('obj-delete-btn');

  // ── Back button ───────────────────────────────────────────────────────────
  backBtn.addEventListener('click', function () {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'close-game' }, '*');
    } else {
      location.href = '../../';
    }
  });

  // ── PI Name ───────────────────────────────────────────────────────────────
  piNameEl.addEventListener('click', function () {
    var current = state.pi.name;
    var newName = prompt('Rename PI:', current);
    if (newName && newName.trim()) {
      state.pi.name = newName.trim();
      piNameEl.textContent = escapeHTML(state.pi.name);
      saveState();
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    piNameEl.textContent = escapeHTML(state.pi.name);
    renderHead();
    renderBody();
  }

  function renderHead() {
    var cols = ['<tr><th class="team-col">Team / Sprint</th>'];
    cols.push('<th class="sprint-cell backlog-col">Backlog</th>');
    state.sprints.forEach(function (s) {
      cols.push('<th class="sprint-cell">' + escapeHTML(s.name) + '</th>');
    });
    cols.push('</tr>');
    boardHead.innerHTML = cols.join('');
  }

  function renderBody() {
    var rows = [];
    state.teams.forEach(function (team) {
      // Main row
      rows.push(renderTeamRow(team));
      // Objectives row
      rows.push(renderObjRow(team));
    });
    boardBody.innerHTML = rows.join('');
    attachCellListeners();
  }

  function renderTeamRow(team) {
    var html = '<tr data-team-id="' + escapeHTML(team.id) + '">';
    html += '<td class="team-col">';
    html += '<div class="team-cell">';
    html += '<div class="team-name">';
    html += '<span class="team-dot" style="background:' + escapeHTML(team.color) + '"></span>';
    html += escapeHTML(team.name);
    html += '</div>';
    html += '<button class="team-toggle-obj" data-team-id="' + escapeHTML(team.id) + '">';
    var collapsed = state.objCollapsed[team.id];
    html += collapsed ? 'Show objectives' : 'Hide objectives';
    html += '</button>';
    html += '</div>';
    html += '</td>';

    // Backlog cell
    html += renderCell(team.id, null, true);

    // Sprint cells
    state.sprints.forEach(function (sprint) {
      html += renderCell(team.id, sprint.id, false);
    });

    html += '</tr>';
    return html;
  }

  function renderCell(teamId, sprintId, isBacklog) {
    var cellClass = 'drop-cell' + (isBacklog ? ' backlog-col' : '');
    var sprintAttr = sprintId ? escapeHTML(sprintId) : 'null';
    var html = '<td class="' + cellClass + '" data-team-id="' + escapeHTML(teamId) + '" data-sprint-id="' + sprintAttr + '">';
    html += '<div class="card-list">';

    var cards = state.cards.filter(function (c) {
      return c.teamId === teamId && (sprintId ? c.sprintId === sprintId : c.sprintId === null || c.sprintId === 'null' || !c.sprintId);
    });

    cards.forEach(function (card) {
      html += renderPlanCard(card);
    });

    html += '</div>';
    html += '<button class="add-card-inline" data-team-id="' + escapeHTML(teamId) + '" data-sprint-id="' + sprintAttr + '">+ card</button>';
    html += '</td>';
    return html;
  }

  function renderPlanCard(card) {
    var html = '<div class="plan-card" draggable="true" data-card-id="' + escapeHTML(card.id) + '" data-type="' + escapeHTML(card.type) + '">';
    html += '<p class="plan-card-title">' + escapeHTML(card.title) + '</p>';
    html += '<div class="plan-card-meta">';
    html += '<span class="plan-card-type">' + escapeHTML(card.type) + '</span>';
    if (card.points) {
      html += '<span class="plan-card-pts">' + escapeHTML(String(card.points)) + ' pts</span>';
    }
    html += '</div>';
    html += '<button class="plan-card-delete" data-card-id="' + escapeHTML(card.id) + '" aria-label="Delete card">&#215;</button>';
    html += '</div>';
    return html;
  }

  function renderObjRow(team) {
    var collapsed = state.objCollapsed[team.id];
    var rowClass = 'obj-row' + (collapsed ? ' hidden-row' : '');
    var html = '<tr class="' + rowClass + '" data-obj-team-id="' + escapeHTML(team.id) + '">';

    // Team objectives cell (left)
    html += '<td class="team-col"><div class="obj-header-cell">Objectives</div></td>';

    // Backlog cell for objectives (empty placeholder)
    html += '<td class="backlog-col"><div class="obj-cell"></div></td>';

    // Single spanning cell for objectives (across sprints) — we use first sprint col but show all
    // Actually render objectives list in first sprint col and leave others empty
    var teamObjs = state.objectives.filter(function (o) { return o.teamId === team.id; });

    var firstCol = true;
    state.sprints.forEach(function (sprint) {
      if (firstCol) {
        firstCol = false;
        html += '<td colspan="' + state.sprints.length + '"><div class="obj-cell">';
        html += '<div class="obj-list">';
        teamObjs.forEach(function (obj) {
          html += renderObjCard(obj);
        });
        html += '</div>';
        html += '<button class="add-obj-btn" data-team-id="' + escapeHTML(team.id) + '">+ objective</button>';
        html += '</div></td>';
      }
    });

    // If no sprints, still add the add button
    if (state.sprints.length === 0) {
      html += '<td><div class="obj-cell">';
      html += '<div class="obj-list"></div>';
      html += '<button class="add-obj-btn" data-team-id="' + escapeHTML(team.id) + '">+ objective</button>';
      html += '</div></td>';
    }

    html += '</tr>';
    return html;
  }

  function renderObjCard(obj) {
    var cls = 'obj-card' + (obj.stretch ? ' stretch' : '');
    var html = '<div class="' + cls + '" data-obj-id="' + escapeHTML(obj.id) + '">';
    html += '<p class="obj-card-title">' + escapeHTML(obj.title) + '</p>';
    html += '<div>';
    html += '<span class="obj-card-bv">BV: ' + escapeHTML(String(obj.businessValue || 5)) + '</span>';
    if (obj.stretch) {
      html += ' <span class="obj-card-stretch-badge">Stretch</span>';
    }
    html += '</div>';
    html += '<button class="obj-card-delete" data-obj-id="' + escapeHTML(obj.id) + '" aria-label="Delete objective">&#215;</button>';
    html += '</div>';
    return html;
  }

  // ── Event delegation after render ─────────────────────────────────────────
  function attachCellListeners() {
    // Drag and drop for plan cards
    boardBody.querySelectorAll('.plan-card[draggable]').forEach(function (el) {
      el.addEventListener('dragstart', onCardDragStart);
      el.addEventListener('dragend', onCardDragEnd);
    });

    boardBody.querySelectorAll('.drop-cell').forEach(function (el) {
      el.addEventListener('dragover', onCellDragOver);
      el.addEventListener('dragleave', onCellDragLeave);
      el.addEventListener('drop', onCellDrop);
    });

    // Double-click to edit cards
    boardBody.querySelectorAll('.plan-card').forEach(function (el) {
      el.addEventListener('dblclick', function (e) {
        var cardId = el.dataset.cardId;
        if (cardId) openCardModal(cardId);
      });
    });

    // Delete buttons on cards
    boardBody.querySelectorAll('.plan-card-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var cardId = btn.dataset.cardId;
        if (cardId && confirm('Delete this card?')) {
          state.cards = state.cards.filter(function (c) { return c.id !== cardId; });
          saveState();
          render();
        }
      });
    });

    // Inline add card
    boardBody.querySelectorAll('.add-card-inline').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openCardModal(null, btn.dataset.teamId, btn.dataset.sprintId);
      });
    });

    // Toggle objectives row
    boardBody.querySelectorAll('.team-toggle-obj').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var teamId = btn.dataset.teamId;
        state.objCollapsed[teamId] = !state.objCollapsed[teamId];
        saveState();
        render();
      });
    });

    // Add objective
    boardBody.querySelectorAll('.add-obj-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openObjModal(null, btn.dataset.teamId);
      });
    });

    // Edit objective
    boardBody.querySelectorAll('.obj-card').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('obj-card-delete')) return;
        openObjModal(el.dataset.objId, null);
      });
    });

    // Delete objective
    boardBody.querySelectorAll('.obj-card-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var objId = btn.dataset.objId;
        if (objId && confirm('Delete this objective?')) {
          state.objectives = state.objectives.filter(function (o) { return o.id !== objId; });
          saveState();
          render();
        }
      });
    });
  }

  // ── Drag and Drop ─────────────────────────────────────────────────────────
  var dragCardId = null;

  function onCardDragStart(e) {
    dragCardId = e.currentTarget.dataset.cardId;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragCardId);
  }

  function onCardDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    dragCardId = null;
    boardBody.querySelectorAll('.drag-over').forEach(function (el) {
      el.classList.remove('drag-over');
    });
  }

  function onCellDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }

  function onCellDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onCellDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    var cardId = e.dataTransfer.getData('text/plain') || dragCardId;
    if (!cardId) return;
    var cell = e.currentTarget;
    var teamId = cell.dataset.teamId;
    var sprintId = cell.dataset.sprintId;
    if (sprintId === 'null') sprintId = null;

    var card = state.cards.find(function (c) { return c.id === cardId; });
    if (card) {
      card.teamId = teamId;
      card.sprintId = sprintId;
      saveState();
      render();
    }
  }

  // ── Card modal ────────────────────────────────────────────────────────────
  function populateCardSelects() {
    var teamOpts = state.teams.map(function (t) {
      return '<option value="' + escapeHTML(t.id) + '">' + escapeHTML(t.name) + '</option>';
    }).join('');
    cardTeamInput.innerHTML = teamOpts;

    var sprintOpts = '<option value="null">Backlog</option>';
    sprintOpts += state.sprints.map(function (s) {
      return '<option value="' + escapeHTML(s.id) + '">' + escapeHTML(s.name) + '</option>';
    }).join('');
    cardSprintInput.innerHTML = sprintOpts;
  }

  function openCardModal(cardId, defaultTeamId, defaultSprintId) {
    populateCardSelects();
    if (cardId) {
      var card = state.cards.find(function (c) { return c.id === cardId; });
      if (!card) return;
      modalTitle.textContent = 'Edit Card';
      cardIdInput.value = card.id;
      cardTitleInput.value = card.title;
      cardTypeInput.value = card.type;
      cardTeamInput.value = card.teamId;
      cardSprintInput.value = card.sprintId || 'null';
      cardPointsInput.value = card.points || '';
      cardNotesInput.value = card.notes || '';
      cardDeleteBtn.style.display = '';
    } else {
      modalTitle.textContent = 'Add Card';
      cardIdInput.value = '';
      cardTitleInput.value = '';
      cardTypeInput.value = 'Feature';
      cardTeamInput.value = defaultTeamId || (state.teams[0] && state.teams[0].id) || '';
      cardSprintInput.value = (defaultSprintId && defaultSprintId !== 'null') ? defaultSprintId : 'null';
      cardPointsInput.value = '';
      cardNotesInput.value = '';
      cardDeleteBtn.style.display = 'none';
    }
    cardModal.classList.remove('hidden');
    cardTitleInput.focus();
  }

  function closeCardModal() {
    cardModal.classList.add('hidden');
  }

  document.getElementById('modal-close').addEventListener('click', closeCardModal);
  cardModal.addEventListener('click', function (e) {
    if (e.target === cardModal) closeCardModal();
  });

  cardDeleteBtn.addEventListener('click', function () {
    var cardId = cardIdInput.value;
    if (cardId && confirm('Delete this card?')) {
      state.cards = state.cards.filter(function (c) { return c.id !== cardId; });
      saveState();
      render();
      closeCardModal();
    }
  });

  cardForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var cardId = cardIdInput.value;
    var sprintVal = cardSprintInput.value;
    var sprintId = (sprintVal === 'null') ? null : sprintVal;

    if (cardId) {
      var card = state.cards.find(function (c) { return c.id === cardId; });
      if (card) {
        card.title = cardTitleInput.value.trim();
        card.type = cardTypeInput.value;
        card.teamId = cardTeamInput.value;
        card.sprintId = sprintId;
        card.points = parseInt(cardPointsInput.value, 10) || 0;
        card.notes = cardNotesInput.value;
      }
    } else {
      state.cards.push({
        id: uid(),
        title: cardTitleInput.value.trim(),
        type: cardTypeInput.value,
        teamId: cardTeamInput.value,
        sprintId: sprintId,
        points: parseInt(cardPointsInput.value, 10) || 0,
        notes: cardNotesInput.value,
      });
    }
    saveState();
    render();
    closeCardModal();
  });

  // ── Objective modal ───────────────────────────────────────────────────────
  function openObjModal(objId, defaultTeamId) {
    if (objId) {
      var obj = state.objectives.find(function (o) { return o.id === objId; });
      if (!obj) return;
      objModalTitle.textContent = 'Edit Objective';
      objIdInput.value = obj.id;
      objTeamIdInput.value = obj.teamId;
      objTitleInput.value = obj.title;
      objBvInput.value = obj.businessValue || 5;
      objStretchInput.checked = !!obj.stretch;
      objDeleteBtn.style.display = '';
    } else {
      objModalTitle.textContent = 'Add Objective';
      objIdInput.value = '';
      objTeamIdInput.value = defaultTeamId || '';
      objTitleInput.value = '';
      objBvInput.value = 5;
      objStretchInput.checked = false;
      objDeleteBtn.style.display = 'none';
    }
    objModal.classList.remove('hidden');
    objTitleInput.focus();
  }

  function closeObjModal() {
    objModal.classList.add('hidden');
  }

  document.getElementById('obj-modal-close').addEventListener('click', closeObjModal);
  objModal.addEventListener('click', function (e) {
    if (e.target === objModal) closeObjModal();
  });

  objDeleteBtn.addEventListener('click', function () {
    var objId = objIdInput.value;
    if (objId && confirm('Delete this objective?')) {
      state.objectives = state.objectives.filter(function (o) { return o.id !== objId; });
      saveState();
      render();
      closeObjModal();
    }
  });

  objForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var objId = objIdInput.value;
    var bv = Math.min(10, Math.max(1, parseInt(objBvInput.value, 10) || 5));

    if (objId) {
      var obj = state.objectives.find(function (o) { return o.id === objId; });
      if (obj) {
        obj.title = objTitleInput.value.trim();
        obj.businessValue = bv;
        obj.stretch = objStretchInput.checked;
      }
    } else {
      state.objectives.push({
        id: uid(),
        teamId: objTeamIdInput.value,
        title: objTitleInput.value.trim(),
        businessValue: bv,
        stretch: objStretchInput.checked,
      });
    }
    saveState();
    render();
    closeObjModal();
  });

  // ── Toolbar actions ───────────────────────────────────────────────────────
  document.getElementById('add-card-btn').addEventListener('click', function () {
    openCardModal(null, null, null);
  });

  document.getElementById('add-team-btn').addEventListener('click', function () {
    var name = prompt('Team name:');
    if (!name || !name.trim()) return;
    var colorIdx = state.teams.length % TEAM_COLORS.length;
    state.teams.push({ id: uid(), name: name.trim(), color: TEAM_COLORS[colorIdx] });
    saveState();
    render();
  });

  document.getElementById('add-sprint-btn').addEventListener('click', function () {
    if (state.sprints.length >= 8) {
      alert('Maximum of 8 sprints reached.');
      return;
    }
    var name = prompt('Sprint name:', 'Sprint ' + (state.sprints.length + 1));
    if (!name || !name.trim()) return;
    state.sprints.push({ id: uid(), name: name.trim() });
    saveState();
    render();
  });

  // ── Loading screen ────────────────────────────────────────────────────────
  var appReady = false;
  var minElapsed = false;
  var loadingEl = document.getElementById('app-loading');

  function tryHideLoading() {
    if (appReady && minElapsed) {
      loadingEl.classList.add('hidden');
      setTimeout(function () {
        if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
      }, 450);
    }
  }

  setTimeout(function () {
    minElapsed = true;
    tryHideLoading();
  }, 3000);

  function init() {
    render();
    appReady = true;
    tryHideLoading();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
