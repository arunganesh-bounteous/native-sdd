// platform-common.js — shared helpers used by both platform-android.js and platform-ios.js.
// Embedded into wizard-core.js as EMBEDDED_PLATFORM_COMMON by generate-embedded.js and
// injected into the page BEFORE the platform-specific module so all platforms can call these.
//
// Rules for adding functions here:
//   ✅ Genuinely platform-agnostic (no android/ios-specific logic)
//   ✅ Body is identical in both platform files (verified by generate-embedded.js tests)
//   ❌ Never add platform-specific UI strings, SDK names, or tech-stack terms

// ── Navigation ────────────────────────────────────────────────────────────────

function toggleMigScope(id) {
  const checked = document.getElementById('mig-' + id)?.checked;
  const row     = document.getElementById('mig-scope-row-' + id);
  if (row) row.style.display = checked ? 'block' : 'none';
}

// ── Architecture step helpers ─────────────────────────────────────────────────

function getApproachRows(group) {
  const rows = [];
  document.querySelectorAll(`#arch-${group}-detail .approach-card`).forEach(card => {
    const approach = card.dataset.approach || '';
    const note     = (card.querySelector('textarea')?.value || '').trim();
    rows.push({ approach, note });
  });
  return rows;
}

// Apply values parsed from an existing ARCHITECTURE.md back into wizard UI.
// Only overrides fields that are explicitly present in `parsed` — no blanket resets.
function applyArchitectureMD(parsed) {
  if (parsed.arch) selectPill('arch', parsed.arch, 'radio');
  if (parsed.di)   selectPill('di', parsed.di, 'radio');
  if (parsed.ui)   selectPill('ui', parsed.ui, 'radio');
  if (parsed.nav)  selectPill('nav', parsed.nav, 'radio');
  if (parsed.asyncLibs) parsed.asyncLibs.forEach(v => selectPill('async', v, 'check'));
}

// ── Form helpers ───────────────────────────────────────────────────────────────

function setSelectOption(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  for (const opt of el.options) {
    if (opt.value === value || opt.text === value) { el.value = opt.value; return; }
  }
}

// ── Markdown parsers ──────────────────────────────────────────────────────────

// Parse the _index.md keyword→module mapping table back into a map.
function parseIndexKeywords(text) {
  const map = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (!m) continue;
    const keywords = m[1].trim();
    const name     = m[2].trim();
    if (!name || /^-+$/.test(name) || name.toLowerCase() === 'module') continue;
    map[name.toLowerCase()] = keywords;
  }
  return map;
}

// ── Dynamic row builders ──────────────────────────────────────────────────────

function addCustomRuleRow(defaults = {}) {
  const id = ++customRuleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'custom-rule-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('custom-rule-row-${id}').remove(); updatePreview('migrations'); saveDraft()">✕</button>
    <div class="form-row">
      <label>Rule title</label>
      <input type="text" id="custom-rule-title-${id}" value="${esc(defaults.title||'')}" placeholder="e.g. Glide → Coil, Custom Logger" oninput="updatePreview('migrations');saveDraft()" style="font-size:13px">
    </div>
    <div class="form-row">
      <label style="align-self:flex-start;padding-top:4px">Rule body</label>
      <textarea id="custom-rule-body-${id}" rows="4" placeholder="Describe what the agent should do when touching files that use this pattern. Use the same style as the rules above — bullet points work well." oninput="updatePreview('migrations');saveDraft()" style="font-size:12px;font-family:var(--mono);resize:vertical;width:100%">${esc(defaults.body||'')}</textarea>
    </div>`;
  document.getElementById('custom-rules-list').appendChild(row);
  const countEl = document.getElementById('custom-rule-count');
  if (countEl) { countEl.value = customRuleCounter; saveDraft(); }
}

function addDebtRow(defaults = {}) {
  const id = ++debtCounter;
  const num = String(id).padStart(3, '0');
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'debt-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('debt-row-${id}').remove(); updatePreview('debt')">✕</button>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">DEBT-${num}</span>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Title</label>
        <input type="text" class="debt-title" value="${esc(defaults.title||'')}" placeholder="LoginViewModel uses LiveData instead of StateFlow" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Module</label>
        <input type="text" class="debt-module" value="${esc(defaults.module||'')}" placeholder=":feature-auth" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Status</label>
        <select class="debt-status" onchange="updatePreview('debt')">
          <option value="OPEN"${(defaults.status||'OPEN')==='OPEN'?' selected':''}>OPEN</option>
          <option value="SCHEDULED"${defaults.status==='SCHEDULED'?' selected':''}>SCHEDULED</option>
          <option value="RESOLVED"${defaults.status==='RESOLVED'?' selected':''}>RESOLVED</option>
        </select></div>
    </div>
    <div class="form-row"><label>Location (file path)</label>
      <input type="text" class="debt-location" placeholder="feature/auth/ui/LoginViewModel.kt" oninput="updatePreview('debt')"></div>
    <div class="form-row"><label>Impact</label>
      <input type="text" class="debt-impact" placeholder="Cannot use Turbine for testing. Observer lifecycle is manual." oninput="updatePreview('debt')"></div>
    <div class="form-row"><label>Agent Rule (exact instruction)</label>
      <input type="text" class="debt-rule" placeholder="Do not add new LiveData here. New state uses StateFlow." oninput="updatePreview('debt')"></div>
    <div class="form-row"><label>Scheduled Ticket (if any)</label>
      <input type="text" class="debt-ticket" placeholder="TICKET-88 or —" oninput="updatePreview('debt')"></div>
  `;
  document.getElementById('debt-list').appendChild(row);
  updatePreview('debt');
}

// ── CI Drift ──────────────────────────────────────────────────────────────────

// Render the CI drift warning banner on the Conventions step.
// Called from platform-specific scanCIDrift() and from _goTo('conventions').
function renderCIDriftBanner(drifts) {
  const banner = document.getElementById('ci-drift-banner');
  if (!banner) return;
  if (!drifts || drifts.length === 0) { banner.style.display = 'none'; return; }

  const rows = drifts.map(d =>
    `<li style="margin:4px 0"><strong>${d.field}</strong>: ` +
    `CI has <code>${d.ciValue}</code> but CONVENTIONS expects <code>${d.specValue}</code>` +
    (d.file ? ` <span style="color:var(--text-muted);font-size:0.85em">(${d.file})</span>` : '') +
    `</li>`
  ).join('');

  banner.innerHTML =
    `<strong>⚠️ CI Drift detected</strong> — the following settings in your CI config ` +
    `differ from what this wizard will write to CONVENTIONS.md. Align them before committing.<ul style="margin:8px 0 0 0;padding-left:20px">${rows}</ul>`;
  banner.style.display = 'block';
}
