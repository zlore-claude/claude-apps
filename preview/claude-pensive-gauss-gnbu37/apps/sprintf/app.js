(function () {
  'use strict';

  const loading = document.getElementById('app-loading');
  const startTime = Date.now();

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---- Demo data (mirrors the reference; swapped for real data later) ----
  const sessions = [
    { name: 'vxzcv' },
    { name: 'aaaa' },
    { name: 'TestNewPi' },
    { name: 'aaaa' },
    { name: 'Jira probably failing backlog because of version field' },
  ];

  const connections = [
    { name: 'Custom portfolioitem', tool: 'Rally' },
    { name: 'failing JIra', tool: 'Jira' },
    { name: 'show shqipe', tool: 'Jira', error: true },
    { name: 'new oauth jria', tool: 'Jira' },
    { name: 'Rally SAFe1', tool: 'Rally' },
  ];

  const events = [
    { msg: 'Failed to establish connection: GET https://httpstat.us/408/rest/api/2/myself.', req: 'df566b09-9888-43f7-8a3d-22296e148810', src: 'foobar', time: '22h' },
    { msg: 'Failed to establish connection: GET https://httpstat.us/408/rest/api/2/myself.', req: 'ebea2274-4e76-4cf4-98b4-bc9d3818f836', src: 'foobar', time: '22h' },
    { msg: 'Failed to establish connection: GET http://192.168.162.219/rest/api/2/myself.', src: 'failing JIra', time: '22h' },
    { msg: 'Failed to establish connection: GET http://192.168.162.219/rest/api/2/myself.', src: 'failing JIra', time: '22h' },
    { msg: 'Failed to establish connection: GET https://self-signed.badssl.com/rest/api/2/myself.', src: 'show shqipe', time: '22h' },
    { msg: 'Failed to establish connection: GET https://self-signed.badssl.com/rest/api/2/myself.', src: 'show shqipe', time: '22h' },
    { msg: 'Failed to establish connection: GET https://self-signed.badssl.com/rest/api/2/myself.', src: 'show shqipe', time: '23h' },
    { msg: 'Failed to establish connection: GET https://self-signed.badssl.com/rest/api/2/myself.', src: 'show shqipe', time: '23h' },
  ];

  // ---- Render ----
  function renderSessions() {
    document.getElementById('sessions').innerHTML = sessions.map((s) => `
      <li class="row">
        <span class="row-dot"></span>
        <span class="row-name">${escapeHTML(s.name)}</span>
        <button class="row-menu" type="button" aria-label="Session options" data-noop>⋮</button>
      </li>`).join('');
    document.getElementById('sessions-total').textContent = '97 total';
  }

  function renderConnections() {
    document.getElementById('connections').innerHTML = connections.map((c) => `
      <li class="row">
        <span class="row-dot${c.error ? ' err' : ''}"></span>
        <span class="row-name">${escapeHTML(c.name)}</span>
        ${c.error ? '<span class="row-badge">Error</span>' : ''}
        <span class="row-tag">${escapeHTML(c.tool)}</span>
        <button class="row-menu" type="button" aria-label="Connection options" data-noop>⋮</button>
      </li>`).join('');
    document.getElementById('connections-total').textContent = '24 total';
  }

  function renderEvents() {
    document.getElementById('events').innerHTML = events.map((e) => {
      const req = e.req ? ` <code>[X-Request-ID=${escapeHTML(e.req)}]</code>` : '';
      return `
      <li class="event">
        <span class="event-dot"></span>
        <span class="event-msg">${escapeHTML(e.msg)}${req}</span>
        <span class="event-src">${escapeHTML(e.src)}</span>
        <span class="event-time">${escapeHTML(e.time)}</span>
      </li>`;
    }).join('');
  }

  // ---- Date ----
  function renderDate() {
    const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    document.getElementById('today').textContent = fmt.format(new Date());
  }

  // ---- Wire up ----
  renderSessions();
  renderConnections();
  renderEvents();
  renderDate();

  document.getElementById('refresh-events').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.style.transition = 'transform 0.5s ease';
    btn.style.transform = 'rotate(360deg)';
    setTimeout(() => { btn.style.transition = 'none'; btn.style.transform = 'none'; }, 520);
    renderEvents();
  });

  document.querySelectorAll('[data-noop]').forEach((el) => {
    el.addEventListener('click', (e) => e.preventDefault());
  });

  // Quit — close embedded, or go home when standalone.
  document.getElementById('quit-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'close-game' }, '*');
    } else {
      location.href = '../../';
    }
  });

  // Loading splash — minimum 3s per shell convention.
  requestAnimationFrame(() => {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => loading.classList.add('hidden'), delay);
  });
})();
