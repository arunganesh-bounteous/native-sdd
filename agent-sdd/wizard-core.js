// ══════════════════════════════════════════════════════
//  WIZARD CORE — generic engine, zero platform knowledge
//  Depends on a global PLATFORM object supplied by a
//  platform-*.js file loaded BEFORE this script.
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
//  INFO BUTTON HELPERS
// ══════════════════════════════════════════════════════
function toggleInfo(btn) {
  const box = btn.nextElementSibling;
  if (box && box.classList.contains('info-box')) {
    box.classList.toggle('open');
    btn.style.borderColor = box.classList.contains('open') ? 'var(--accent)' : '';
    btn.style.color       = box.classList.contains('open') ? 'var(--accent)' : '';
  }
}
// Renders an (i) button + hidden info box as a pair.
// Usage: ${infoBtn('Your explanation here')}
function infoBtn(html) {
  return `<button class="info-btn" onclick="toggleInfo(this)" title="More info">i</button><div class="info-box">${html}</div>`;
}

// Renders a tier badge — Core / Recommended / Optional
function tierBadge(tier) {
  const label = { core: 'Core', recommended: 'Recommended', optional: 'Optional' }[tier] || tier;
  return `<span class="tier-badge ${tier}">${label}</span>`;
}

// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
const state = {
  dirHandle: null,           // Project root — readwrite. Wizard reads Gradle from here, writes to agent-sdd/ subdirectory.
  saved: {},
  current: 'welcome',
  detectedInterceptors: [],  // OkHttp Interceptor class names found in source tree
  detectedModuleDetails: [], // [{name, type, diCol, notes}] from settings.gradle + each module's build.gradle
};

const STEPS = [
  { id: 'welcome', icon: '👋', label: 'Welcome', file: null },
  { id: 'done',    icon: '✅', label: 'Done',    file: null },
];

// Maps each wizard step ID → contextual tutorial anchor.
// These are relative paths so they resolve correctly from any local directory.
const STEP_TUTORIALS = {
  projectconfig: 'tutorial.html#setup',
  architecture:  'tutorial-spec-kit.html#architecture',
  conventions:   'tutorial-spec-kit.html#conventions',
  migrations:    'tutorial-spec-kit.html#migrations',
  modules:       'tutorial-spec-kit.html#modulemap',
  debt:          'tutorial-spec-kit.html#techdebt',
  testing:       'tutorial-spec-kit.html#testing',
  datamodel:     'tutorial-spec-kit.html#datamodel',
};

// ══════════════════════════════════════════════════════
//  SIDEBAR
// ══════════════════════════════════════════════════════
function buildSidebar() {
  const container = document.getElementById('sidebarSteps');
  container.innerHTML = STEPS.map(s => `
    <div class="step-item ${s.id === state.current ? 'active' : ''} ${state.saved[s.id] ? 'done' : ''}"
         id="nav-${s.id}" onclick="goTo('${s.id}')">
      <span class="step-icon">${state.saved[s.id] ? '✅' : s.icon}</span>
      <div>
        <div class="step-label">${s.label}</div>
        ${s.file ? `<div class="step-file">${s.file}</div>` : ''}
        ${s.artifact ? `<div class="step-artifact-badge">⚡ AI artifact</div>` : ''}
      </div>
    </div>
  `).join('');
}

function goTo(id) {
  state.current = id;
  document.querySelectorAll('.step-screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  if (screen) screen.classList.add('active');
  // Always return to the top of the form panel when switching pages.
  const fp = document.querySelector('.form-panel');
  if (fp) fp.scrollTop = 0;
  buildSidebar();
  const step = STEPS.find(s => s.id === id);
  document.getElementById('headerTitle').textContent = step.label;
  document.getElementById('headerDesc').textContent = step.file
    ? (step.artifact ? `⚡ AI artifact — ${step.file}` : `📝 Human-authored — ${step.file}`)
    : (id === 'welcome' ? "Set up your project's SDD skeleton" : 'All spec-kit files generated!');

  // Show contextual tutorial link if this step has one
  const tutLink = document.getElementById('headerTutorial');
  if (tutLink) {
    const tutUrl = STEP_TUTORIALS[id];
    if (tutUrl) {
      tutLink.href = tutUrl;
      tutLink.style.display = 'inline-flex';
    } else {
      tutLink.style.display = 'none';
    }
  }
  // Auto-fill conv-package from cfg-package if not already set
  if (id === 'conventions') {
    const src = document.getElementById('cfg-package')?.value.trim();
    const dst = document.getElementById('conv-package');
    if (dst && !dst.value && src) dst.value = src;
  }
  if (step.file) {
    updatePreview(id);
    document.getElementById('previewPanel').classList.remove('collapsed');
  } else {
    document.getElementById('previewPanel').classList.add('collapsed');
  }
}

// ══════════════════════════════════════════════════════
//  DRAFT PERSISTENCE  (localStorage)
//  Saves every form change so a page refresh never loses work.
//  Cleared field-by-field only when the user explicitly saves a step.
// ══════════════════════════════════════════════════════

const DRAFT_KEY = 'sdd-wizard-draft';

// Snapshot all current form values + selected pills → localStorage.
let _draftTimer = null;
function saveDraft() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    const draft = { fields: {}, pills: {} };

    // All text/number inputs and textareas that carry an id
    document.querySelectorAll('input[id]:not([type="checkbox"]):not([type="radio"]), textarea[id]').forEach(el => {
      draft.fields[el.id] = el.value;
    });

    // Selected pills — keyed by group name (from the input's name attribute)
    document.querySelectorAll('[id^="pill-"].selected input').forEach(input => {
      const group = input.name;
      if (!draft.pills[group]) draft.pills[group] = [];
      draft.pills[group].push(input.value);
    });

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, 300); // debounce — don't thrash storage on every keystroke
}

// Read the draft value for a specific field id (used by renderApproachRows
// to pre-fill cards whose textareas don't exist in the DOM yet).
function getDraftField(fieldId) {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    return draft.fields?.[fieldId] ?? '';
  } catch { return ''; }
}

// Restore all saved draft values into the DOM.
// Called once after all screens are built.
function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
  catch { return; }
  if (!draft.fields && !draft.pills) return;

  // ── Restore plain text/number fields ──────────────────────────────────────
  Object.entries(draft.fields || {}).forEach(([id, value]) => {
    // Skip approach-card textareas — handled after pills are restored below.
    if (id.startsWith('approach-')) return;
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  // ── Restore pill selections ────────────────────────────────────────────────
  Object.entries(draft.pills || {}).forEach(([group, values]) => {
    values.forEach(value => {
      const pill = document.getElementById(`pill-${group}_${value}`);
      if (!pill) return;
      const input = pill.querySelector('input');
      if (input?.type === 'radio') {
        // Deselect siblings before selecting this one
        document.querySelectorAll(`[id^="pill-${group}_"]`).forEach(p => p.classList.remove('selected'));
      }
      pill.classList.add('selected');
      if (input) input.checked = true;
    });
  });

  // ── Restore which steps were already saved (sidebar ✅) ───────────────────
  (draft.savedSteps || []).forEach(stepId => { state.saved[stepId] = true; });

  // ── Platform-specific post-restore hooks ──────────────────────────────────
  PLATFORM.onDraftRestored?.();

  updatePreview(state.current);
}

// Mark a step as committed — store the saved step ids in the draft so that
// after a refresh the sidebar can show ✅ for already-saved steps.
function markDraftSaved(stepId) {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    if (!draft.savedSteps) draft.savedSteps = [];
    if (!draft.savedSteps.includes(stepId)) draft.savedSteps.push(stepId);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* ignore */ }
}

// Hook: attach saveDraft to all input/change events on a screen element.
// Called once per screen after it is built.
function attachDraftListeners(screenId) {
  const screen = document.getElementById(screenId);
  if (!screen) return;
  screen.addEventListener('input',  saveDraft);
  screen.addEventListener('change', saveDraft);
}

// ══════════════════════════════════════════════════════
//  FILE SYSTEM ACCESS API
// ══════════════════════════════════════════════════════
async function grantFolder() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    state.dirHandle = handle;
    const badge = document.getElementById('sddBadge');
    badge.textContent = '📂 ' + handle.name;
    badge.className = 'folder-badge granted';
    showToast('Project folder set: ' + handle.name + ' — analysing…', 'success');

    // Auto-set codebase_path to '..' — always correct when agent-sdd/ is inside project root
    const pathEl = document.getElementById('cfg-codebase-path');
    if (pathEl && !pathEl.value) pathEl.value = '..';

    // Try to load existing agent-sdd/project.config.md and pre-fill the form
    const existing = await tryReadFile(handle, 'agent-sdd', 'project.config.md');
    if (existing) loadExistingConfig(existing);

    // Platform hook — e.g. analyzeProject()
    PLATFORM.onFolderGranted?.();
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Could not access folder', 'error');
  }
}

function loadExistingConfig(text) {
  const get = key => text.match(new RegExp(`^${key}:\\s*(.+)`, 'm'))?.[1]?.trim() ?? '';

  // Generic fields
  const codebasePath = get('codebase_path');
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setVal('cfg-codebase-path', codebasePath);

  // Delegate Android-specific field restore to platform
  PLATFORM.onConfigLoaded?.(text);
}

// ══════════════════════════════════════════════════════
//  GENERIC FILE UTILITIES
// ══════════════════════════════════════════════════════
async function tryReadFile(dirHandle, ...parts) {
  try {
    let dir = dirHandle;
    for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    return await (await fh.getFile()).text();
  } catch { return null; }
}

async function countSourceFiles(dirHandle, maxDepth = 4) {
  const counts = { kt: 0, java: 0 };
  async function walk(dh, depth) {
    if (depth <= 0) return;
    try {
      for await (const [name, handle] of dh) {
        if (handle.kind === 'file') {
          if (name.endsWith('.kt')) counts.kt++;
          else if (name.endsWith('.java')) counts.java++;
        } else if (handle.kind === 'directory' && !['build', '.gradle', '.git', 'node_modules'].includes(name)) {
          await walk(handle, depth - 1);
        }
      }
    } catch {}
  }
  await walk(dirHandle, maxDepth);
  return counts;
}

async function saveFile(relativePath, content) {
  if (!state.dirHandle) { showToast('Select a project folder first', 'error'); return false; }
  try {
    // Support both: project root selected (agent-sdd/ created inside) or agent-sdd/ selected directly.
    const sddDir = state.dirHandle.name === 'agent-sdd'
      ? state.dirHandle
      : await state.dirHandle.getDirectoryHandle('agent-sdd', { create: true });

    const parts = relativePath.split('/');
    let dir = sddDir;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function downloadFallback(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.split('/').pop();
  a.click(); URL.revokeObjectURL(url);
}

async function handleSave(stepId, filename, content) {
  const hasFSA = 'showDirectoryPicker' in window;

  // No folder selected yet — prompt the user to pick one before saving
  if (hasFSA && !state.dirHandle) {
    showToast('Select your project root or agent-sdd/ folder to save directly…', 'info');
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      state.dirHandle = handle;
      const badge = document.getElementById('sddBadge');
      if (badge) { badge.textContent = '📂 ' + handle.name; badge.className = 'folder-badge granted'; }
      showToast('Folder set: ' + handle.name + ' — saving…', 'success');
    } catch (e) {
      // User cancelled the picker — fall back to download
      downloadFallback(filename, content);
      showToast('No folder selected — file downloaded to Downloads instead', 'info');
      return;
    }
  }

  if (hasFSA && state.dirHandle) {
    const ok = await saveFile(filename, content);
    if (ok) {
      state.saved[stepId] = true;
      markDraftSaved(stepId);
      buildSidebar();
      showToast('Saved → ' + filename, 'success');
      updateDoneScreen();
    } else {
      showToast('Save failed — downloading instead', 'error');
      downloadFallback(filename, content);
    }
  } else {
    // Browser doesn't support FSA (Safari/Firefox) — download is the only option
    downloadFallback(filename, content);
    state.saved[stepId] = true;
    markDraftSaved(stepId);
    buildSidebar();
    showToast('Downloaded ' + filename.split('/').pop() + ' (use Chrome/Edge to save directly)', 'info');
    updateDoneScreen();
  }
}

// ══════════════════════════════════════════════════════
//  MARKDOWN RENDERER
// ══════════════════════════════════════════════════════
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function inlineMd(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(md) {
  // Protect fenced code blocks
  const blocks = [];
  md = md.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre class="md-code-block">${escHtml(code.trimEnd())}</pre>`);
    return `\x00BLOCK${blocks.length - 1}\x00`;
  });

  const lines = md.split('\n');
  let html = '', inTable = false, tableHead = true, tableHtml = '', inList = false;

  const flushTable = () => { html += tableHtml + '</tbody></table>'; inTable = false; tableHead = true; tableHtml = ''; };
  const flushList  = () => { html += '</ul>'; inList = false; };

  for (const raw of lines) {
    const line = raw;

    // Code block placeholder
    if (/\x00BLOCK\d+\x00/.test(line)) {
      if (inList) flushList();
      if (inTable) flushTable();
      html += blocks[parseInt(line.match(/\d+/)[0])];
      continue;
    }

    // File header comment lines:  # ──── or # HUMAN-AUTHORED
    if (/^# /.test(line) && !/^#{2,}/.test(line)) {
      if (inList) flushList();
      if (inTable) flushTable();
      if (/^# [─═\-]{4,}/.test(line)) { html += '<hr class="md-hr">'; continue; }
      html += `<div class="md-comment">${escHtml(line.slice(2))}</div>`;
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,3}) (.+)/);
    if (hm) {
      if (inList) flushList();
      if (inTable) flushTable();
      const lvl = hm[1].length;
      html += `<div class="md-h${lvl}">${inlineMd(hm[2])}</div>`;
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      if (inList) flushList();
      if (inTable) flushTable();
      html += '<hr class="md-hr">';
      continue;
    }

    // Table row
    if (/^\|.+\|$/.test(line.trim())) {
      if (inList) flushList();
      const cells = line.trim().slice(1,-1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-: ]+$/.test(c))) continue; // separator row
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="md-table"><thead><tr>' + cells.map(c => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>';
        tableHead = false;
      } else {
        tableHtml += '<tr>' + cells.map(c => `<td>${inlineMd(c)}</td>`).join('') + '</tr>';
      }
      continue;
    } else if (inTable) { flushTable(); }

    // List item
    if (/^- /.test(line)) {
      if (!inList) { html += '<ul class="md-list">'; inList = true; }
      html += `<li>${inlineMd(line.slice(2))}</li>`;
      continue;
    } else if (inList) { flushList(); }

    // Empty line
    if (line.trim() === '') { html += '<div class="md-spacer"></div>'; continue; }

    // Paragraph
    html += `<p class="md-p">${inlineMd(line)}</p>`;
  }

  if (inList) flushList();
  if (inTable) flushTable();
  return html;
}

// ══════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}

function togglePreview() {
  document.getElementById('previewPanel').classList.toggle('collapsed');
}

function showPreview(content) {
  document.getElementById('previewContent').innerHTML = renderMarkdown(content);
  document.getElementById('previewPanel').classList.remove('collapsed');
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pill(name, value, group, type = 'check') {
  const id = group + '_' + value;
  return `<label class="${type}-pill" id="pill-${id}" onclick="event.preventDefault(); togglePill(this,'${group}','${value}','${type}')">
    <input type="${type === 'radio' ? 'radio' : 'checkbox'}" name="${group}" value="${value}">
    ${name}
  </label>`;
}

function togglePill(el, group, value, type) {
  if (type === 'radio') {
    document.querySelectorAll(`[id^="pill-${group}_"]`).forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
  } else {
    el.classList.toggle('selected');
    el.querySelector('input').checked = el.classList.contains('selected');
  }
  const step = STEPS.find(s => s.id === state.current);
  if (step && step.file) updatePreview(state.current);
  if (state.current === 'architecture') {
    if (group === 'async' || group === 'state') renderApproachRows(group);
    updateArchProgress();
  }
  saveDraft();
}

function getPills(group) {
  return Array.from(document.querySelectorAll(`[id^="pill-${group}_"]`))
    .filter(p => p.classList.contains('selected'))
    .map(p => p.querySelector('input').value);
}

function getRadio(group) {
  const sel = document.querySelector(`[id^="pill-${group}_"].selected`);
  return sel ? sel.querySelector('input').value : '';
}

function selectPill(group, value, type = 'check') {
  const el = document.getElementById(`pill-${group}_${value}`);
  if (el && !el.classList.contains('selected')) togglePill(el, group, value, type);
}

// ══════════════════════════════════════════════════════
//  DONE SCREEN
// ══════════════════════════════════════════════════════
function updateDoneScreen() {
  const screen = document.getElementById('screen-done');
  if (!screen) return;
  const files = STEPS.filter(s => s.file);
  screen.querySelector('.done-files').innerHTML = files.map(s => `
    <div class="done-file">
      <div class="status-dot ${state.saved[s.id] ? '' : 'pending'}"></div>
      <span style="color:${state.saved[s.id] ? 'var(--success)' : 'var(--text-muted)'}">${s.file}</span>
    </div>
  `).join('');
}

function updatePreview(stepId) {
  const md = PLATFORM.generate[stepId]?.() ?? '';
  if (md) {
    document.getElementById('previewContent').innerHTML = renderMarkdown(md);
  }
}

async function saveStep(stepId) {
  const step = STEPS.find(s => s.id === stepId);
  if (!step || !step.file) return;
  const content = PLATFORM.generate[stepId]?.() ?? '';
  await handleSave(stepId, step.file, content);

  // Platform-specific extra saves (e.g. modules also writes context/_index.md)
  await PLATFORM.extraSave?.[stepId]?.();
}

// ══════════════════════════════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════════════════════════════
function init() {
  // Populate STEPS from platform definition
  STEPS.length = 0;
  PLATFORM.steps.forEach(s => STEPS.push(s));

  const fp = document.getElementById('formPanel');

  // Welcome screen
  fp.innerHTML += `
  <div class="step-screen active" id="screen-welcome">
    <div class="welcome-hero">
      <h2>👋 Welcome to the SDD Setup Wizard</h2>
      <p>Fill in your project details step-by-step. Each step generates a <code>spec-kit/</code> file and saves it directly to your project folder.</p>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;max-width:600px;margin:0 auto 28px;text-align:left">
        <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px">How to run this tool</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[
            ['1','Open in Chrome or Edge','Double-click <code>setup-wizard.html</code>. File System Access API requires Chrome or Edge — other browsers will download files instead of saving directly.'],
            ['2','Select your project folder','Point to your project root (e.g. <code>MyApp/</code>). The wizard auto-detects your Gradle stack and writes all generated files into <code>agent-sdd/</code> inside it.'],
            ['3','Fill in each step','Work through the sidebar steps left to right. Select your stack options, add modules and debt entries. The MD preview on the right updates live.'],
            ['4','Save each file','Click the green <strong>💾 Save</strong> button on each step. Files are written directly to <code>spec-kit/</code> inside the folder you selected. The sidebar shows ✅ for saved steps.'],
            ['5','Review the generated files','Open the saved <code>.md</code> files in your editor. Replace any <code>[fill in]</code> placeholders with your project-specific details.'],
            ['6','Run your first agent task','Copy <code>tasks/TASK_TEMPLATE.md</code>, fill in a real ticket, open a Claude session pointing at the skeleton folder, and let the agent execute it.'],
          ].map(([n, title, desc]) => `
          <div style="display:flex;gap:12px;align-items:flex-start">
            <div style="background:var(--accent-dim);color:var(--accent);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px">${n}</div>
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${title}</div>
              <div style="font-size:11px;color:var(--text-muted);line-height:1.5">${desc}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">What this wizard generates</div>
      <div class="welcome-steps">
        ${STEPS.filter(s=>s.file).map(s=>`
          <div class="welcome-step-card">
            <div class="num">${s.icon} ${s.who || 'Tech lead writes'}</div>
            <h4>${s.label}</h4>
            <div class="card-desc">${s.desc || ''}</div>
            <div class="step-file">${s.file}</div>
            ${s.critical ? `
            <details>
              <summary>What to get right</summary>
              <div class="detail-body">
                <div>
                  <div class="detail-section-title">Critical — agent depends on these</div>
                  <ul class="detail-list">
                    ${s.critical.map(c=>`<li>${c}</li>`).join('')}
                  </ul>
                </div>
                ${s.mistakes ? `
                <div>
                  <div class="detail-section-title warn">Common mistakes</div>
                  <ul class="detail-list mistakes">
                    ${s.mistakes.map(m=>`<li>${m}</li>`).join('')}
                  </ul>
                </div>` : ''}
              </div>
            </details>` : ''}
          </div>`).join('')}
      </div>
      <div class="folder-grant" style="max-width:480px;text-align:left">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Select Your Project Root</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;line-height:1.6">Point to your project root folder (e.g. <code>MyApp/</code>). The wizard reads your project files to auto-detect your stack and writes all generated files into <code>agent-sdd/</code> inside it — creating the folder if it doesn't exist yet.</div>
        <button class="btn btn-primary" onclick="grantFolder()">📂 Select project folder</button>
      </div>
      <br>
      <button class="btn btn-secondary" onclick="goTo('projectconfig')">Start Setup →</button>
    </div>
  </div>`;

  // Done screen
  fp.innerHTML += `
  <div class="step-screen" id="screen-done">
    <div class="done-screen">
      <div class="check-big">🎉</div>
      <h2>Setup Complete!</h2>
      <p>All spec-kit files have been generated. Your SDD skeleton is ready. Fill in the remaining placeholder values in each file, then run your first task.</p>
      <div class="done-files"></div>
      <button class="btn btn-primary" onclick="goTo('welcome')">← Start Over</button>
    </div>
  </div>`;

  // Build platform-specific screens
  const stepIds = STEPS.filter(s => s.id !== 'welcome' && s.id !== 'done').map(s => s.id);
  stepIds.forEach(id => {
    PLATFORM.buildScreens[id]?.(fp);
  });

  // Attach draft save listeners to every non-welcome, non-done screen
  stepIds.forEach(id => {
    attachDraftListeners('screen-' + id);
  });

  // Restore any previously saved draft (survives page refresh)
  restoreDraft();

  buildSidebar();
  updateDoneScreen();
}

// ══════════════════════════════════════════════════════
//  PLATFORM SELECTION
//  Dynamically loads platform-android.js or platform-ios.js
//  after the user picks a platform from the overlay.
// ══════════════════════════════════════════════════════
function choosePlatform(name) {
  const overlay = document.getElementById('platformOverlay');

  // Fade the overlay out immediately so the interaction feels snappy
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
  }

  const script = document.createElement('script');
  script.src = 'platform-' + name + '.js';

  script.onload = () => {
    // Remove overlay from DOM after transition
    setTimeout(() => overlay?.remove(), 320);
    // PLATFORM global is now set — boot the wizard
    init();
  };

  script.onerror = () => {
    // Restore overlay so the user can try again
    if (overlay) { overlay.style.opacity = '1'; overlay.style.pointerEvents = ''; }
    showToast('Could not load platform: ' + name, 'error');
  };

  document.head.appendChild(script);
}

// ══════════════════════════════════════════════════════
//  KEYBOARD NAVIGATION
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('previewPanel').classList.add('collapsed');
  }
});

// DOMContentLoaded — do NOT call init() here.
// The platform overlay is already visible; init() is called by choosePlatform()
// once the user selects a platform and its script has loaded.
window.addEventListener('DOMContentLoaded', () => { /* waiting for platform selection */ });
