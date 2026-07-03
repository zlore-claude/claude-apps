(function () {
  const loading = document.getElementById('app-loading');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const thumbs = document.getElementById('thumbs');
  const notes = document.getElementById('notes');
  const docTypes = document.getElementById('doc-types');
  const generateBtn = document.getElementById('generate-btn');
  const inputError = document.getElementById('input-error');
  const statusEl = document.getElementById('status');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const pdfBtn = document.getElementById('pdf-btn');
  const docEl = document.getElementById('doc');
  const emptyState = document.getElementById('empty-state');
  const docScroll = document.getElementById('doc-scroll');
  const keyDialog = document.getElementById('key-dialog');
  const keyInput = document.getElementById('key-input');

  const PROVIDER_STORAGE = 'docsmith-provider';
  const LEGACY_KEY_STORAGE = 'docsmith-api-key'; // pre-multi-provider Anthropic key
  const MAX_IMAGES = 6;
  const MAX_EDGE = 2576; // max useful image resolution across providers

  const PROVIDERS = {
    anthropic: {
      name: 'Claude',
      model: 'claude-opus-4-8',
      host: 'api.anthropic.com',
      hint: 'sk-ant-...',
      note: 'Uses Claude (claude-opus-4-8) — the highest quality option. Create a key at ' +
        '<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. ' +
        'No subscription needed: pay-as-you-go credits, $5 minimum.',
    },
    google: {
      name: 'Gemini',
      model: 'gemini-2.5-flash',
      host: 'generativelanguage.googleapis.com',
      hint: 'AIza...',
      note: 'Uses Gemini (gemini-2.5-flash). Create a <strong>free</strong> key at ' +
        '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a> — ' +
        'the free tier is enough for this app, no billing required.',
    },
    openai: {
      name: 'OpenAI',
      model: 'gpt-4o',
      host: 'api.openai.com',
      hint: 'sk-...',
      note: 'Uses GPT-4o. Create a key at ' +
        '<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com</a> ' +
        '(prepaid credits required).',
    },
  };

  function loadProvider() {
    try {
      const p = localStorage.getItem(PROVIDER_STORAGE);
      return PROVIDERS[p] ? p : 'anthropic';
    } catch (e) { return 'anthropic'; }
  }

  let provider = loadProvider();

  // { dataUrl, mediaType, b64 }
  let images = [];
  let docType = 'user-guide';
  let markdown = '';
  let controller = null;
  let renderQueued = false;

  const DOC_TYPE_BRIEFS = {
    'user-guide':
      'a user guide: task-oriented reference documentation explaining what the ' +
      'feature is, what each visible control does, and how to use it',
    tutorial:
      'a step-by-step tutorial: a single numbered walkthrough that takes the ' +
      'reader from start to finish, one action per step',
    'feature-overview':
      'a feature overview: a concise explanation of what the feature does, why ' +
      'it is useful, and its key capabilities, aimed at someone deciding whether to use it',
    'release-notes':
      "release notes: a short announcement of what's new, written in the " +
      'product voice, with a brief summary and a list of changes',
  };

  const SYSTEM_PROMPT =
    'You are a senior technical writer. You turn product screenshots and rough ' +
    'notes from the author into polished documentation.\n\n' +
    'Rules:\n' +
    '- Only document what is visible in the screenshots or stated in the notes. ' +
    'Never invent menu items, settings, limits, or behavior.\n' +
    "- If something important is ambiguous, document what you can see and note the assumption briefly — don't stall.\n" +
    '- Refer to UI elements the user interacts with in **bold**, matching their on-screen labels exactly.\n' +
    '- Use numbered steps for anything procedural, tables where they aid scanning, and short paragraphs elsewhere.\n' +
    '- Start with a single `#` H1 title, then `##` sections.\n' +
    '- Write in second person ("you"), present tense, plain language.\n' +
    '- Output ONLY the Markdown document. No preamble, no closing remarks, and do not wrap the document in a code fence.';

  /* ---------- Provider & API key ---------- */

  const providersEl = document.getElementById('providers');
  const kdNote = document.getElementById('kd-note');
  const keyBtn = document.getElementById('key-btn');

  function getKey() {
    try {
      return localStorage.getItem('docsmith-key-' + provider) ||
        (provider === 'anthropic' ? localStorage.getItem(LEGACY_KEY_STORAGE) : '') || '';
    } catch (e) { return ''; }
  }

  function setKey(v) {
    try {
      if (v) localStorage.setItem('docsmith-key-' + provider, v);
      else localStorage.removeItem('docsmith-key-' + provider);
      if (provider === 'anthropic' && !v) localStorage.removeItem(LEGACY_KEY_STORAGE);
    } catch (e) { /* private mode — key just won't persist */ }
  }

  function setProvider(p) {
    provider = p;
    try { localStorage.setItem(PROVIDER_STORAGE, p); } catch (e) { /* ignore */ }
    const info = PROVIDERS[p];
    providersEl.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.provider === p);
    });
    // Static app-owned strings only — nothing user-supplied goes through here.
    kdNote.innerHTML = info.note +
      ' Your key is stored only in this browser and sent only to ' + info.host + '.';
    keyInput.placeholder = info.hint;
    keyInput.value = getKey();
    keyBtn.textContent = 'API key · ' + info.name;
  }

  providersEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) setProvider(chip.dataset.provider);
  });

  keyBtn.addEventListener('click', () => {
    setProvider(provider);
    keyDialog.showModal();
  });

  document.getElementById('key-save').addEventListener('click', () => {
    setKey(keyInput.value.trim());
  });

  document.getElementById('key-clear').addEventListener('click', () => {
    keyInput.value = '';
    setKey('');
  });

  setProvider(provider);

  /* ---------- Image intake ---------- */

  function showError(msg) {
    inputError.textContent = msg;
    inputError.hidden = !msg;
  }

  function renderThumbs() {
    thumbs.innerHTML = '';
    images.forEach((img, i) => {
      const li = document.createElement('li');
      const el = document.createElement('img');
      el.src = img.dataUrl;
      el.alt = 'Screenshot ' + (i + 1);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'thumb-x';
      x.textContent = '×';
      x.setAttribute('aria-label', 'Remove screenshot ' + (i + 1));
      x.addEventListener('click', () => {
        images.splice(i, 1);
        renderThumbs();
      });
      li.appendChild(el);
      li.appendChild(x);
      thumbs.appendChild(li);
    });
    thumbs.hidden = images.length === 0;
  }

  function addImageFromDataUrl(dataUrl, mediaType) {
    images.push({
      dataUrl,
      mediaType,
      b64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    });
    renderThumbs();
  }

  function addFile(file) {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return;
    if (images.length >= MAX_IMAGES) {
      showError('Up to ' + MAX_IMAGES + ' screenshots per document.');
      return;
    }
    showError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const long = Math.max(img.width, img.height);
        // Animated gifs lose animation when redrawn; the API reads a frame anyway.
        if (long <= MAX_EDGE && file.size < 4 * 1024 * 1024) {
          addImageFromDataUrl(reader.result, file.type);
          return;
        }
        const scale = Math.min(1, MAX_EDGE / long);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const isPhoto = file.type === 'image/jpeg';
        const outType = isPhoto ? 'image/jpeg' : 'image/png';
        addImageFromDataUrl(
          isPhoto ? canvas.toDataURL(outType, 0.9) : canvas.toDataURL(outType),
          outType
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(addFile);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((t) =>
    dropzone.addEventListener(t, (e) => {
      e.preventDefault();
      dropzone.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((t) =>
    dropzone.addEventListener(t, (e) => {
      e.preventDefault();
      dropzone.classList.remove('over');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    Array.from(e.dataTransfer.files).forEach(addFile);
  });
  document.addEventListener('paste', (e) => {
    if (!e.clipboardData) return;
    Array.from(e.clipboardData.items).forEach((item) => {
      if (item.kind === 'file') addFile(item.getAsFile());
    });
  });

  /* ---------- Doc type chips ---------- */

  docTypes.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    docTypes.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    docType = chip.dataset.type;
  });

  /* ---------- Minimal, escape-first Markdown renderer ---------- */

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function inline(text) {
    let out = escapeHTML(text);
    // Protect inline code spans from bold/italic processing.
    const codes = [];
    out = out.replace(/`([^`\n]+)`/g, (_, code) => {
      codes.push('<code>' + code + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
    return out;
  }

  function renderMarkdown(md) {
    const lines = md.split('\n');
    const html = [];
    let i = 0;
    // list stack entries: { tag: 'ul'|'ol', indent: number }
    const listStack = [];
    let inPara = [];

    function flushPara() {
      if (inPara.length) {
        html.push('<p>' + inline(inPara.join(' ')) + '</p>');
        inPara = [];
      }
    }
    function closeLists(toIndent) {
      while (
        listStack.length &&
        (toIndent === undefined || listStack[listStack.length - 1].indent >= toIndent)
      ) {
        html.push('</li></' + listStack.pop().tag + '>');
      }
    }
    function closeAll() {
      flushPara();
      closeLists(undefined);
    }

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        closeAll();
        const code = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        html.push('<pre><code>' + escapeHTML(code.join('\n')) + '</code></pre>');
        continue;
      }

      // Heading
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        closeAll();
        const level = h[1].length;
        html.push('<h' + level + '>' + inline(h[2].replace(/\s#+\s*$/, '')) + '</h' + level + '>');
        i++;
        continue;
      }

      // Horizontal rule
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        closeAll();
        html.push('<hr>');
        i++;
        continue;
      }

      // Table: header row followed by a separator row
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length &&
          /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        closeAll();
        const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(cells(lines[i]));
          i++;
        }
        let t = '<table><thead><tr>';
        head.forEach((c) => { t += '<th>' + inline(c) + '</th>'; });
        t += '</tr></thead><tbody>';
        rows.forEach((r) => {
          t += '<tr>';
          head.forEach((_, ci) => { t += '<td>' + inline(r[ci] || '') + '</td>'; });
          t += '</tr>';
        });
        t += '</tbody></table>';
        html.push(t);
        continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        closeAll();
        const quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>');
        continue;
      }

      // List item (ordered or unordered), with indentation-based nesting
      const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushPara();
        const indent = li[1].length;
        const tag = /^[-*+]$/.test(li[2]) ? 'ul' : 'ol';
        const top = listStack[listStack.length - 1];
        if (!top || indent > top.indent) {
          listStack.push({ tag, indent });
          html.push('<' + tag + '><li>' + inline(li[3]));
        } else {
          closeLists(indent + 1);
          const cur = listStack[listStack.length - 1];
          if (cur && cur.tag === tag) {
            html.push('</li><li>' + inline(li[3]));
          } else {
            if (cur) html.push('</li></' + listStack.pop().tag + '>');
            listStack.push({ tag, indent });
            html.push('<' + tag + '><li>' + inline(li[3]));
          }
        }
        i++;
        continue;
      }

      // Blank line
      if (/^\s*$/.test(line)) {
        closeAll();
        i++;
        continue;
      }

      // Continuation text inside a list item
      if (listStack.length && /^\s{2,}/.test(line)) {
        html.push(' ' + inline(line.trim()));
        i++;
        continue;
      }

      closeLists(undefined);
      inPara.push(line.trim());
      i++;
    }

    closeAll();
    return html.join('\n');
  }

  /* ---------- Rendering / status ---------- */

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const stick =
        docScroll.scrollTop + docScroll.clientHeight >= docScroll.scrollHeight - 60;
      docEl.innerHTML = renderMarkdown(markdown);
      if (stick) docScroll.scrollTop = docScroll.scrollHeight;
    });
  }

  function setStatus(text, busy) {
    statusEl.textContent = text;
    statusEl.classList.toggle('busy', !!busy);
  }

  function setActionsEnabled(on) {
    copyBtn.disabled = !on;
    downloadBtn.disabled = !on;
    pdfBtn.disabled = !on;
  }

  /* ---------- Generation ---------- */

  function userPrompt() {
    let text = 'Write ' + DOC_TYPE_BRIEFS[docType] + '.';
    if (images.length) {
      text += '\n\nThe ' + (images.length > 1 ? images.length + ' screenshots are' : 'screenshot is') +
        ' attached above, in order.';
    }
    text += '\n\nAuthor notes:\n' + notes.value.trim();
    return text;
  }

  function buildRequest(apiKey) {
    const text = userPrompt();

    if (provider === 'google') {
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/' +
          PROVIDERS.google.model + ':streamGenerateContent?alt=sse',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{
            role: 'user',
            parts: images
              .map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.b64 } }))
              .concat([{ text }]),
          }],
          generationConfig: { maxOutputTokens: 16000 },
        },
      };
    }

    if (provider === 'openai') {
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
        body: {
          model: PROVIDERS.openai.model,
          stream: true,
          max_completion_tokens: 8192,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: images
                .map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } }))
                .concat([{ type: 'text', text }]),
            },
          ],
        },
      };
    }

    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: {
        model: PROVIDERS.anthropic.model,
        max_tokens: 16000,
        stream: true,
        thinking: { type: 'adaptive' },
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: images
            .map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.b64 },
            }))
            .concat([{ type: 'text', text }]),
        }],
      },
    };
  }

  async function streamCompletion(apiKey, signal, onText, onPhase) {
    const req = buildRequest(apiKey);
    const res = await fetch(req.url, {
      method: 'POST',
      signal,
      headers: req.headers,
      body: JSON.stringify(req.body),
    });

    if (!res.ok) {
      let msg = 'Request failed (' + res.status + ')';
      try {
        const err = await res.json();
        if (err && err.error && err.error.message) msg = err.error.message;
      } catch (e) { /* non-JSON error body */ }
      const keyProblem = res.status === 401 || res.status === 403 ||
        (res.status === 400 && /api key/i.test(msg));
      if (keyProblem) {
        msg = 'Invalid ' + PROVIDERS[provider].name +
          ' API key. Check it under "API key" in the top bar.';
      }
      if (res.status === 429) msg = 'Rate limited by the API — wait a moment and try again.';
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let stopReason = null;

    // Normalize each provider's stream events into onPhase/onText/stopReason.
    const handlers = {
      anthropic(ev) {
        if (ev.type === 'content_block_start') {
          if (ev.content_block.type === 'thinking') onPhase('thinking');
          if (ev.content_block.type === 'text') onPhase('writing');
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta.type === 'text_delta') onText(ev.delta.text);
        } else if (ev.type === 'message_delta') {
          if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
        } else if (ev.type === 'error') {
          throw new Error(ev.error && ev.error.message ? ev.error.message : 'Stream error');
        }
      },
      google(ev) {
        if (ev.error) throw new Error(ev.error.message || 'Stream error');
        if (ev.promptFeedback && ev.promptFeedback.blockReason) stopReason = 'refusal';
        const cand = ev.candidates && ev.candidates[0];
        if (!cand) return;
        if (cand.content && cand.content.parts) {
          cand.content.parts.forEach((p) => {
            if (p.text && !p.thought) { onPhase('writing'); onText(p.text); }
          });
        }
        if (cand.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
        else if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') stopReason = 'refusal';
      },
      openai(ev) {
        if (ev.error) throw new Error(ev.error.message || 'Stream error');
        const choice = ev.choices && ev.choices[0];
        if (!choice) return;
        if (choice.delta && choice.delta.content) { onPhase('writing'); onText(choice.delta.content); }
        if (choice.finish_reason === 'length') stopReason = 'max_tokens';
        else if (choice.finish_reason === 'content_filter') stopReason = 'refusal';
      },
    };
    const handle = handlers[provider];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Some providers terminate SSE lines with \r\n; JSON payloads never
      // contain a raw \r, so normalizing the buffer is safe.
      buf = (buf + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        chunk.split('\n').forEach((line) => {
          if (!line.startsWith('data:')) return;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          handle(JSON.parse(data));
        });
      }
    }
    return stopReason;
  }

  async function generate() {
    if (controller) {
      controller.abort();
      return;
    }
    if (!notes.value.trim() && images.length === 0) {
      showError('Add a screenshot or a description first — ideally both.');
      return;
    }
    const apiKey = getKey();
    if (!apiKey) {
      setProvider(provider);
      keyDialog.showModal();
      showError('Pick a provider and save its API key, then hit Generate again. ' +
        'Gemini keys are free.');
      return;
    }

    showError('');
    markdown = '';
    docEl.hidden = false;
    docEl.classList.add('streaming');
    emptyState.hidden = true;
    setActionsEnabled(false);
    generateBtn.textContent = 'Stop';
    generateBtn.classList.add('running');
    setStatus('Sending…', true);
    controller = new AbortController();

    try {
      const stop = await streamCompletion(
        apiKey,
        controller.signal,
        (text) => {
          markdown += text;
          scheduleRender();
        },
        (phase) => setStatus(phase === 'thinking' ? 'Thinking…' : 'Writing…', true)
      );
      const words = markdown.split(/\s+/).filter(Boolean).length;
      if (stop === 'max_tokens') {
        setStatus('Stopped at the length limit — ' + words + ' words');
      } else if (stop === 'refusal') {
        setStatus('The model declined this request.');
      } else {
        setStatus('Done — ' + words + ' words');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus(markdown ? 'Stopped — partial document kept' : 'Stopped');
      } else {
        setStatus(markdown ? 'Interrupted' : 'No document yet');
        showError(String(err.message || err));
      }
    } finally {
      controller = null;
      docEl.classList.remove('streaming');
      generateBtn.textContent = 'Generate documentation';
      generateBtn.classList.remove('running');
      if (markdown) {
        scheduleRender();
        setActionsEnabled(true);
      } else {
        docEl.hidden = true;
        emptyState.hidden = false;
      }
    }
  }

  generateBtn.addEventListener('click', generate);

  /* ---------- Output actions ---------- */

  function docFilename() {
    const m = markdown.match(/^#\s+(.+)$/m);
    const title = m ? m[1] : 'documentation';
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'documentation';
  }

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Markdown'; }, 1400);
    } catch (e) {
      showError('Clipboard access was blocked by the browser.');
    }
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = docFilename() + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  pdfBtn.addEventListener('click', () => window.print());

  /* ---------- Shell integration ---------- */

  document.getElementById('quit-btn').addEventListener('click', () => {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'close-game' }, '*');
    } else {
      location.href = '../../';
    }
  });

  /* ---------- Loading screen ---------- */

  const startTime = Date.now();
  requestAnimationFrame(() => {
    const delay = Math.max(0, 3000 - (Date.now() - startTime));
    setTimeout(() => loading.classList.add('hidden'), delay);
  });
})();
