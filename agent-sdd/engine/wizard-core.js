// ══════════════════════════════════════════════════════
//  WIZARD CORE — generic engine, zero platform knowledge
//  Depends on a global PLATFORM object supplied by a
//  platform-*.js file loaded BEFORE this script.
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
//  EMBEDDED CLAUDE.MD CONTENT
//  This content is written to agent-artifacts/CLAUDE.md
//  when wizard setup completes. Allows standalone agent-sdd/
//  setup where wizard can't access external folders.
// ══════════════════════════════════════════════════════
// Skeleton version — stamped from agent-sdd/VERSION by generate-embedded.js.
// The wizard writes this into agent-artifacts/.sdd-version and compares it
// against the stored manifest to flag projects with an outdated snapshot.
const SKELETON_VERSION = '1.2';
// What's-new notes per version, parsed from agent-sdd/CHANGELOG.md.
// The wizard shows the relevant entries in the "Update available" banner.
// Platform modules — embedded by generate-embedded.js so choosePlatform() can
// inject them as inline <script> blocks instead of loading via script.src.
// Inline injection is required for file:// origins (Chrome blocks external loads).
const EMBEDDED_PLATFORM_ANDROID = `// ══════════════════════════════════════════════════════
//  platform-android.js
//  Android-specific code for the SDD Setup Wizard.
//  Loaded before wizard-core.js.
//  Requires wizard-core.js globals: state, getPills, getRadio,
//  getDraftField, selectPill, pill, tierBadge, infoBtn, esc,
//  updatePreview, saveFile, showToast, tryReadFile, countSourceFiles
// ══════════════════════════════════════════════════════

// ── Android UI helpers ──────────────────────────────────
function updateArchProgress() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const hasPill = group => document.querySelectorAll(\`[id^="pill-\${group}_"].selected\`).length > 0;

  // Core — pill selections (agent needs these for ADR generation)
  const coreChecks = [
    hasPill('arch'), hasPill('di'), hasPill('async'),
    hasPill('state'), hasPill('ui'), hasPill('nav'),
  ];
  // Returns true if at least one approach card in the group has text entered.
  const hasApproachNote = group =>
    [...document.querySelectorAll(\`#arch-\${group}-detail .approach-card textarea\`)]
      .some(ta => ta.value.trim() !== '');

  // Recommended — text descriptions (improve agent output quality)
  const recChecks = [
    hasApproachNote('async'),
    hasApproachNote('state'),
    val('arch-base-url')     !== '',
    val('arch-auth')         !== '',
    val('arch-target-notes') !== '',
  ];
  // Optional — details that accumulate over time
  const optChecks = [
    hasPill('network'),
    hasPill('storage'),
    val('arch-storage-usage') !== '',
    val('arch-img-usage')     !== '',
    val('arch-violations')    !== '',
  ];

  const coreDone = coreChecks.filter(Boolean).length;
  const recDone  = recChecks.filter(Boolean).length;
  const optDone  = optChecks.filter(Boolean).length;
  const coreTotal = coreChecks.length;
  const recTotal  = recChecks.length;
  const optTotal  = optChecks.length;

  // Track width proportional to section weight: core=50%, rec=33%, opt=17%
  const coreW = Math.round((coreDone / coreTotal) * 50);
  const recW  = Math.round((recDone  / recTotal)  * 33);
  const optW  = Math.round((optDone  / optTotal)  * 17);
  const emptyW = 100 - coreW - recW - optW;

  const track = document.getElementById('arch-progress-track');
  if (!track) return;
  track.innerHTML = \`
    \${coreW > 0 ? \`<div class="arch-seg core"        style="flex:\${coreW}"></div>\` : ''}
    \${recW  > 0 ? \`<div class="arch-seg recommended" style="flex:\${recW}"></div>\`  : ''}
    \${optW  > 0 ? \`<div class="arch-seg optional"    style="flex:\${optW}"></div>\`  : ''}
    \${emptyW > 0 ? \`<div class="arch-seg empty"      style="flex:\${emptyW}"></div>\` : ''}
  \`;
  document.getElementById('arch-progress-core-label').textContent = \`\${coreDone}/\${coreTotal} Core\`;
  document.getElementById('arch-progress-rec-label').textContent  = \`\${recDone}/\${recTotal} Recommended\`;
  document.getElementById('arch-progress-opt-label').textContent  = \`\${optDone}/\${optTotal} Optional\`;

  const hint = document.getElementById('arch-progress-hint');
  if (hint) {
    hint.textContent = coreDone === coreTotal
      ? recDone === recTotal
        ? '★ Fully configured — agent has maximum context.'
        : '✓ Core complete — agent can start. Fill Recommended fields for better output quality.'
      : \`Fill the \${coreTotal - coreDone} remaining Core section\${coreTotal - coreDone > 1 ? 's' : ''} before running tasks.\`;
  }
}

// Inserts a module name at the cursor position of a textarea.
// Auto-prefixes ", " when the cursor follows non-whitespace text on the same line,
// so chips never run directly into adjacent words.
function insertModuleChip(targetId, name) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd   ?? el.value.length;
  const before = el.value.slice(0, start);
  // Find the character immediately before the cursor (ignoring selected text)
  const prevChar = before.length > 0 ? before[before.length - 1] : '';
  const prefix = (prevChar !== '' && prevChar !== '\\n' && prevChar !== ' ' && prevChar !== ',') ? ', ' : '';
  const insert = prefix + name;
  el.value = before + insert + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + insert.length;
  el.focus();
  updatePreview('architecture');
}

// Populates all .module-chips containers on the architecture screen with detected modules.
// Called after analyzeProject() so chips reflect the real project modules.
function refreshModuleChips() {
  const modules = state.detectedModuleDetails;
  if (!modules || modules.length === 0) return;
  // Static chip containers (storage, etc.)
  document.querySelectorAll('.module-chips[data-target]').forEach(container => {
    const targetId = container.dataset.target;
    container.innerHTML =
      \`<div class="module-chips-title">Modules</div>\` +
      modules.map(m =>
        \`<span class="mod-chip" onclick="insertModuleChip('\${targetId}','\${m.name}')">\${m.name}</span>\`
      ).join('');
  });
  // Dynamic per-approach cards (async / state)
  document.querySelectorAll('.approach-card .module-chips[data-target]').forEach(container => {
    populateApproachChips(container);
  });
}

// Fills chips inside a single .approach-card module-chips container.
function populateApproachChips(container) {
  const modules = state.detectedModuleDetails;
  if (!modules || modules.length === 0) return;
  const targetId = container.dataset.target;
  container.innerHTML =
    \`<div class="module-chips-title">Modules</div>\` +
    modules.map(m =>
      \`<span class="mod-chip" onclick="insertModuleChip('\${targetId}','\${m.name}')">\${m.name}</span>\`
    ).join('');
}

// Placeholder hints per approach value, used inside per-approach textarea.
const APPROACH_NOTES = {
  async: {
    'Coroutines': ':appCore, :app — ViewModels and repositories',
    'RxJava2':    ':libs:featureOrder — legacy only, do not add new RxJava',
    'RxJava3':    'describe which modules use RxJava 3',
    'AsyncTask':  'legacy — being replaced with coroutines',
    'Threads':    'describe which modules use raw threads',
  },
  state: {
    'StateFlow':  ':appCore, :libs:featureAuthentication — all new ViewModels',
    'LiveData':   ':app — existing ViewModels only, do not migrate unless task explicitly scopes it',
    'RxSubjects': 'describe which modules use RxSubjects',
    'MVI':        'describe which modules use MVI store',
  },
};

// Rebuilds the per-approach card list whenever async or state pills change.
// Each selected approach gets its own card: label + textarea + module chips.
function renderApproachRows(group) {
  const containerId = \`arch-\${group}-detail\`;
  const container = document.getElementById(containerId);
  if (!container) return;

  const selected = getPills(group);   // e.g. ['StateFlow', 'LiveData']
  if (selected.length === 0) { container.innerHTML = ''; return; }

  const notes = APPROACH_NOTES[group] || {};

  // Preserve existing values so toggling a pill off then on doesn't lose typed text.
  const saved = {};
  container.querySelectorAll('.approach-card').forEach(card => {
    const approach = card.dataset.approach;
    const ta = card.querySelector('textarea');
    if (approach && ta) saved[approach] = ta.value;
  });

  container.innerHTML = selected.map(approach => {
    const taId = \`approach-\${group}-\${approach}\`;
    const ph   = notes[approach] || 'describe which modules use this approach';
    // Prefer current DOM value, then localStorage draft, then empty.
    const val  = saved[approach] ?? getDraftField(taId);
    return \`<div class="approach-card" data-approach="\${approach}">
      <div class="approach-card-label">\${approach}</div>
      <textarea id="\${taId}" rows="2"
        placeholder="\${ph}"
        oninput="updatePreview('architecture'); updateArchProgress()">\${val}</textarea>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="\${taId}"></div>
      </div>
    </div>\`;
  }).join('');

  // Populate chips in the newly rendered cards.
  container.querySelectorAll('.approach-card .module-chips[data-target]').forEach(c => populateApproachChips(c));
}

// Reads all approach-card textareas for a group → array of {approach, note} pairs.
function getApproachRows(group) {
  const rows = [];
  document.querySelectorAll(\`#arch-\${group}-detail .approach-card\`).forEach(card => {
    const approach = card.dataset.approach || '';
    const note = (card.querySelector('textarea')?.value || '').trim();
    rows.push({ approach, note });
  });
  return rows;
}

// ── Parse existing DATA_MODEL.md → entity + endpoint row objects ──
function parseDataModelMD(text) {
  const entities  = [];
  const endpoints = [];

  // ── Entities from ## Domain Entities section ──────────
  const domainSection = text.match(/^## Domain Entities([\\s\\S]*?)(?=^## )/m)?.[1] ?? '';
  for (const block of domainSection.split(/^### /m).slice(1)) {
    const name = block.split('\\n')[0].trim();
    if (!name || name.includes('[')) continue;
    const dataClassMatch = block.match(/data class \\w+\\s*\\(([\\s\\S]*?)\\)/);
    if (dataClassMatch) {
      const fields = dataClassMatch[1]
        .split('\\n')
        .map(l => l.trim().replace(/^va[lr]\\s+/, '').replace(/,$/, '').trim())
        .filter(l => l && l.includes(':'))
        .join(', ');
      entities.push({ name, fields });
    } else {
      // sealed interface, typealias, enum — store name only
      entities.push({ name, fields: '' });
    }
  }

  // ── Endpoints — find all #### METHOD /path blocks ─────
  for (const block of text.split(/^#### /m).slice(1)) {
    const firstLine  = block.split('\\n')[0].trim();
    const spaceIdx   = firstLine.indexOf(' ');
    if (spaceIdx === -1) continue;
    const method = firstLine.slice(0, spaceIdx).toUpperCase();
    const path   = firstLine.slice(spaceIdx + 1).trim();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;

    const reqBody  = block.match(/Request:\\s*\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/)?.[1]?.trim()  ?? '';
    const respBody = block.match(/Response 200:\\s*\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/)?.[1]?.trim() ?? '';
    const errRows  = [...block.matchAll(/\\|\\s*\`([^\`\\n]+)\`\\s*\\|\\s*([^|\\n]+)\\|/g)];
    const errors   = errRows
      .map(m => \`\${m[1].trim()} — \${m[2].trim()}\`)
      .filter(e => !e.toLowerCase().startsWith('error code'))
      .join(', ');

    endpoints.push({ method, path, reqBody, respBody, errors });
  }

  return { entities, endpoints };
}

// ── Parse context/_index.md routing table → { moduleName(lowercased): keywords } ──
// Keywords are the single source of truth in _index.md (not MODULE_MAP). When
// reloading a project we backfill them onto the module rows so re-saving the
// wizard regenerates _index.md correctly instead of wiping the routing table.
function parseIndexKeywords(text) {
  const map = {};
  for (const line of text.split('\\n')) {
    const m = line.match(/^\\|\\s*(.+?)\\s*\\|\\s*(.+?)\\s*\\|\\s*(.+?)\\s*\\|/);
    if (!m) continue;
    const keywords = m[1].trim();
    const name     = m[2].trim();
    if (!name || /^-+$/.test(name) || name.toLowerCase() === 'module') continue; // header/separator
    map[name.toLowerCase()] = keywords;
  }
  return map;
}

// ── Parse existing MODULE_MAP.md → module row objects ────
function parseModuleMapMD(text) {
  const modules = [];
  const patternMap = {
    'single activity': 'Single Activity',
    'mvvm': 'MVVM', 'mvp': 'MVP', 'clean': 'Clean',
    'repository': 'Repository', 'infrastructure': 'Infrastructure',
  };
  const normalisePattern = raw => {
    const l = raw.toLowerCase();
    if (l.includes('single activity')) return 'Single Activity';
    for (const [k, v] of Object.entries(patternMap)) if (l.includes(k)) return v;
    return 'MVVM';
  };
  const normaliseDI = raw => {
    const l = raw.toLowerCase();
    if (l.includes('hilt'))   return 'Hilt';
    if (l.includes('dagger')) return 'Dagger';
    if (l.includes('manual')) return 'Manual';
    return 'None';
  };
  const getField = (block, field) => {
    const re = new RegExp(\`\\\\|\\\\s*\${field}\\\\s*\\\\|\\\\s*([^|\\\\n]+?)\\\\s*\\\\|\`, 'i');
    return (block.match(re)?.[1] ?? '').replace(/\`/g, '').trim();
  };

  const sections = text.split(/^### /m).slice(1);
  for (const section of sections) {
    const name = section.split('\\n')[0].trim();
    if (!name || name.startsWith('#') || name.startsWith('<!--')) continue;
    const path      = getField(section, 'Path');
    const purpose   = getField(section, 'Purpose');
    const keywords  = getField(section, 'Keywords');
    const keyClasses = getField(section, 'Key classes');
    const depends   = getField(section, 'Depends on');
    const rawPat    = getField(section, 'Pattern');
    const rawDI     = getField(section, 'DI');
    // Skip stub entries that were never filled in
    if (purpose === '[describe purpose]' && keyClasses === '[fill in]') continue;
    modules.push({
      name, path, purpose, keywords, keyClasses, depends,
      pattern: normalisePattern(rawPat),
      di: normaliseDI(rawDI),
    });
  }
  return modules;
}

// ── Project analysis ────────────────────────────────────
async function scanForInterceptors(dirHandle, maxDepth = 6) {
  const names = [];
  const skip = new Set(['build', '.gradle', '.git', 'node_modules', 'test', 'androidTest']);
  async function walk(dh, depth) {
    if (depth <= 0) return;
    try {
      for await (const [name, handle] of dh) {
        if (handle.kind === 'file' && (name.endsWith('.kt') || name.endsWith('.java')) && name.includes('Interceptor'))
          names.push(name.replace(/\\.(kt|java)$/, ''));
        else if (handle.kind === 'directory' && !skip.has(name))
          await walk(handle, depth - 1);
      }
    } catch {}
  }
  await walk(dirHandle, maxDepth);
  return [...new Set(names)];
}

async function analyzeProject() {
  if (!state.dirHandle) return;
  showToast('Analyzing project…', 'info');

  // Read Gradle files from the project root
  const [rootGradle, settings] = await Promise.all([
    tryReadFile(state.dirHandle, 'build.gradle').then(t => t ?? tryReadFile(state.dirHandle, 'build.gradle.kts')),
    tryReadFile(state.dirHandle, 'settings.gradle').then(t => t ?? tryReadFile(state.dirHandle, 'settings.gradle.kts')),
  ]);

  if (!rootGradle && !settings) {
    showToast('No Gradle files found — fill in manually', 'info');
    return;
  }

  // Resolve the app module directory: try 'app/' first, then any module listed in settings.gradle
  // that contains 'com.android.application' in its build.gradle.
  let appGradle = await tryReadFile(state.dirHandle, 'app', 'build.gradle')
               ?? await tryReadFile(state.dirHandle, 'app', 'build.gradle.kts');
  if (!appGradle && settings) {
    const moduleNames = [...settings.matchAll(/include\\s*['"]:?([\\w\\-]+)['"]/g)].map(m => m[1]);
    for (const mod of moduleNames) {
      if (mod === 'app') continue; // already tried
      const candidate = await tryReadFile(state.dirHandle, mod, 'build.gradle')
                     ?? await tryReadFile(state.dirHandle, mod, 'build.gradle.kts');
      if (candidate && /com\\.android\\.application/.test(candidate)) { appGradle = candidate; break; }
    }
  }

  const gradle = ((rootGradle || '') + '\\n' + (appGradle || '')).toLowerCase();
  const has = (...terms) => terms.some(t => gradle.includes(t.toLowerCase()));

  // Language: count source files
  const fileCounts = await countSourceFiles(state.dirHandle);
  const lang = (fileCounts.kt > 0 && fileCounts.java > 0) ? 'Kotlin+Java'
             : fileCounts.java > fileCounts.kt ? 'Java' : 'Kotlin';

  // Stack signals
  const di = has('hilt-android', 'dagger.hilt') ? 'Hilt'
           : has('"dagger', 'com.google.dagger') && !has('hilt') ? 'Dagger'
           : has('insert-koin', 'koin-android', 'koin-core') ? 'Koin' : '';

  const uiMode = has('androidx.compose', 'compose-bom', 'compose-ui', 'ui:compose')
    ? (has('appcompat', 'constraintlayout', 'recyclerview') ? 'Mixed' : 'Compose')
    : 'XML';

  const navMode = has('navigation-compose') ? 'ComposeNav'
                : has('navigation-fragment', 'navigation-ui') ? 'JetpackNav' : '';

  const imageLib = has('io.coil-kt', 'coil-kt', '"coil"') ? 'Coil'
                 : has('squareup.picasso') ? 'Picasso'
                 : has('bumptech.glide', '"glide"') ? 'Glide' : '';

  // Extract module names from settings.gradle
  const moduleNames = [...((settings || '').matchAll(/include\\s*[\\(]?\\s*["':]([\\w\\-:]+)["']/g))]
    .map(m => (m[1].startsWith(':') ? m[1] : ':' + m[1]));

  // ── Extract Project Config fields (preserve case — do not use lowercased gradle) ──
  const appIdMatch    = (appGradle || '').match(/\\bapplicationId\\b\\s*=?\\s*["']([^"']+)["']/);
  const baseAppId     = appIdMatch ? appIdMatch[1] : '';
  const minSdkMatch   = (appGradle || '').match(/\\bminSdk(?:Version)?\\b\\s*=?\\s*(\\d+)/);
  const targetSdkMatch= (appGradle || '').match(/\\btargetSdk(?:Version)?\\b\\s*=?\\s*(\\d+)/);

  // productFlavors — Groovy: flavorName { ... }  /  KTS: create("flavorName") { ... }
  // Use brace-counting to extract the full block (lazy regex stops at the first inner \`}\`)
  const detectedVariants = [];
  const flavorsStart = (appGradle || '').search(/productFlavors\\s*\\{/);
  if (flavorsStart !== -1) {
    const openAt = appGradle.indexOf('{', flavorsStart);
    let depth = 0, i = openAt, flavorsInner = '';
    for (; i < appGradle.length; i++) {
      if (appGradle[i] === '{') depth++;
      else if (appGradle[i] === '}') { depth--; if (depth === 0) { flavorsInner = appGradle.slice(openAt + 1, i); break; } }
    }
    // Extract each inner flavor block the same way
    const flavorRe = /\\b(\\w+)\\s*\\{|create\\s*\\(\\s*["'](\\w+)["']\\s*\\)\\s*\\{/g;
    let fm;
    const _skipNames = new Set(['dimension','flavorDimensions','signingConfig','buildTypes','sourceSets','testOptions','compileOptions','kotlinOptions','lint','buildFeatures','android','defaultConfig']);
    while ((fm = flavorRe.exec(flavorsInner)) !== null) {
      const name = fm[1] || fm[2];
      if (_skipNames.has(name)) continue;
      const bStart = flavorsInner.indexOf('{', fm.index);
      let d = 0, j = bStart, body = '';
      for (; j < flavorsInner.length; j++) {
        if (flavorsInner[j] === '{') d++;
        else if (flavorsInner[j] === '}') { d--; if (d === 0) { body = flavorsInner.slice(bStart + 1, j); break; } }
      }
      const suffixMatch = body.match(/applicationIdSuffix\\s*=?\\s*["']([^"']+)["']/);
      const idMatch     = body.match(/\\bapplicationId\\b\\s*=?\\s*["']([^"']+)["']/);
      const appId = idMatch ? idMatch[1] : (baseAppId + (suffixMatch ? suffixMatch[1] : ''));
      detectedVariants.push({ name, applicationId: appId });
      flavorRe.lastIndex = j + 1;
    }
  }

  // Apply to Project Config form
  if (baseAppId) { const el = document.getElementById('cfg-package'); if (el && !el.value) el.value = baseAppId; }
  if (minSdkMatch)    { const el = document.getElementById('cfg-min-sdk');    if (el) el.value = minSdkMatch[1]; }
  if (targetSdkMatch) { const el = document.getElementById('cfg-target-sdk'); if (el) el.value = targetSdkMatch[1]; }
  selectPill('cfg-platform', 'Android', 'radio');
  if (lang === 'Kotlin') selectPill('cfg-lang', 'Kotlin', 'radio');
  else if (lang === 'Java') selectPill('cfg-lang', 'Java', 'radio');
  else selectPill('cfg-lang', 'Kotlin+Java', 'radio');
  if (detectedVariants.length > 0) {
    const list = document.getElementById('cfg-variants-list');
    if (list) { list.innerHTML = ''; variantCounter = 0; detectedVariants.forEach(v => addVariantRow(v)); }
  }
  updatePreview('projectconfig');

  // ── Apply to Architecture pills ──────────────────────
  if (lang === 'Kotlin') selectPill('lang', 'Kotlin');
  else if (lang === 'Java') selectPill('lang', 'Java');
  else selectPill('lang', 'Kotlin+Java');

  if (di || has('viewmodel', 'lifecycle-viewmodel')) selectPill('arch', 'MVVM', 'radio');

  if (di) selectPill('di', di, 'radio');

  if (has('kotlinx-coroutines')) { selectPill('async', 'Coroutines'); selectPill('state', 'StateFlow'); }
  if (has('rxjava:2', 'rxandroid:2', '"rxjava2"', 'rxjava2')) selectPill('async', 'RxJava2');
  if (has('rxjava3', 'rxandroid:3')) selectPill('async', 'RxJava3');
  if (has('lifecycle-livedata', 'livedata-ktx')) selectPill('state', 'LiveData');

  selectPill('ui', uiMode, 'radio');
  if (navMode) selectPill('nav', navMode, 'radio');

  if (has('retrofit')) selectPill('network', 'Retrofit');
  if (has('okhttp')) selectPill('network', 'OkHttp');
  if (has('io.ktor')) selectPill('network', 'Ktor');
  if (has('volley')) selectPill('network', 'Volley');

  if (has('room-runtime', 'room-ktx', 'androidx.room')) selectPill('storage', 'Room');
  if (has('datastore')) selectPill('storage', 'DataStore');
  if (has('realm')) selectPill('storage', 'Realm');

  if (imageLib) selectPill('img', imageLib, 'radio');

  // ── Apply to Testing dropdowns ───────────────────────
  if (has('junit.jupiter', 'junit5', 'junit-platform')) setSelectOption('test-test-runner', 'JUnit 5');
  setSelectOption('test-mocking', has('mockk') ? 'MockK' : has('mockito') ? 'Mockito' : 'MockK');
  setSelectOption('test-flow-test', has('turbine') ? 'Turbine' : 'None');
  setSelectOption('test-assertions', has('truth') ? 'Truth' : has('assertj') ? 'AssertJ' : 'Truth');
  setSelectOption('test-ui-test', has('espresso') ? 'Espresso' : has('ui-test-junit4', 'compose.ui.test') ? 'Compose UI Test' : 'None');

  // ── Apply to Migration toggles ───────────────────────
  const setToggle = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  if (lang === 'Kotlin+Java' || lang === 'Java') setToggle('mig-java', true);
  if (has('lifecycle-livedata', 'livedata-ktx')) setToggle('mig-livedata', true);
  if (has('rxjava2', 'rxjava3', 'rxandroid')) setToggle('mig-rxjava', true);

  // ── Apply to Modules list ────────────────────────────
  // Prefer existing MODULE_MAP.md (richer data) over Gradle-detected names
  const existingModuleMap = await tryReadFile(state.dirHandle, 'agent-artifacts', 'spec-kit', 'MODULE_MAP.md');
  const parsedModules = existingModuleMap ? parseModuleMapMD(existingModuleMap) : [];

  // Keywords live only in _index.md — backfill them onto the parsed modules so
  // re-saving regenerates the routing table instead of emptying it.
  if (parsedModules.length > 0) {
    const idxText = await tryReadFile(state.dirHandle, 'agent-artifacts', 'context', '_index.md');
    if (idxText) {
      const kw = parseIndexKeywords(idxText);
      parsedModules.forEach(m => { const hit = kw[m.name.trim().toLowerCase()]; if (hit) m.keywords = hit; });
    }
  }

  if (parsedModules.length > 0) {
    const list = document.getElementById('modules-list');
    if (list) { list.innerHTML = ''; moduleCounter = 0; }
    parsedModules.forEach(m => addModuleRow(m));
    state.detectedModuleDetails = parsedModules.map(m => ({
      name: m.name, type: m.pattern, diCol: m.di, notes: m.purpose,
    }));
  } else if (moduleNames.length > 0) {
    const list = document.getElementById('modules-list');
    if (list) { list.innerHTML = ''; moduleCounter = 0; }
    moduleNames.forEach(name => addModuleRow({
      name,
      path: name.replace(/^:/, '').replace(/:/g, '/') + '/',
      keywords: guessModuleKeywords(name),
    }));
  }

  // ── Load existing DATA_MODEL.md ──────────────────────
  const existingDataModel = await tryReadFile(state.dirHandle, 'agent-artifacts', 'spec-kit', 'DATA_MODEL.md');
  if (existingDataModel) {
    const { entities } = parseDataModelMD(existingDataModel);
    const entList = document.getElementById('entities-list');
    if (entList && entities.length > 0) { entList.innerHTML = ''; entityCounter = 0; entities.forEach(e => addEntityRow(e)); }
  }

  // ── Scan for OkHttp Interceptors ─────────────────────
  state.detectedInterceptors = await scanForInterceptors(state.dirHandle);

  // ── Detect per-module details (type, DI, notes) ──────
  state.detectedModuleDetails = await Promise.all(moduleNames.map(async (modName) => {
    const modPath = modName.replace(/^:/, '').replace(/:/g, '/');
    const parts   = modPath.split('/');
    const modGradle = await tryReadFile(state.dirHandle, ...parts, 'build.gradle')
                   ?? await tryReadFile(state.dirHandle, ...parts, 'build.gradle.kts');
    let type = '—', diCol = '—', notes = '';
    if (modGradle) {
      const g = modGradle.toLowerCase();
      diCol = g.includes('hilt') ? 'Hilt' : '—';
      if (g.includes('com.android.application')) {
        type = 'Single Activity'; notes = 'App entry point, NavHost, deep links';
      } else if (g.includes('com.android.library')) {
        const n = modName.toLowerCase();
        if (n.includes('feature'))                              { type = 'MVVM';       notes = 'Feature module'; }
        else if (n.includes('core') || n.includes('common'))   { type = 'Repository'; notes = 'Shared domain layer'; }
        else if (n.includes('sdk'))                            { type = '—';          notes = 'SDK / external integration'; }
        else if (n.includes('toolkit') || n.includes('util'))  { type = '—';          notes = 'Shared utilities'; }
        else                                                    { type = '—';          notes = 'Library module'; }
      }
    }
    return { name: modName, type, diCol, notes };
  }));

  // Refresh previews, module chips, per-approach cards, and progress bar
  updatePreview('architecture');
  updatePreview('modules');
  refreshModuleChips();
  renderApproachRows('async');
  renderApproachRows('state');
  updateArchProgress();

  const moduleSource = parsedModules.length > 0
    ? \`\${parsedModules.length} modules loaded from MODULE_MAP.md\`
    : \`\${moduleNames.length} modules detected from Gradle\`;
  showToast(\`Auto-filled · \${moduleSource}, \${state.detectedInterceptors.length} interceptors · review & adjust\`, 'success');
}

function setSelectOption(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  for (const opt of el.options) {
    if (opt.value === value || opt.text === value) { el.value = opt.value; return; }
  }
}

function guessModuleKeywords(moduleName) {
  const name = moduleName.replace(/^:/, '').replace(/[-:]/g, ' ').toLowerCase();
  const map = [
    ['auth',      'login, logout, auth, session, token, signup'],
    ['home',      'home, dashboard, landing, feed'],
    ['order',     'order, basket, cart, checkout'],
    ['profile',   'profile, account, user, settings'],
    ['network',   'network, api, http, retrofit, endpoint'],
    ['data',      'data, database, room, cache, repository'],
    ['ui',        'ui, theme, components, design, composables'],
    ['analytics', 'analytics, tracking, events, logging'],
    ['search',    'search, filter, query'],
    ['payment',   'payment, billing, purchase'],
    ['app',       'app, main, startup, navhost'],
    ['core',      'core, shared, common, util'],
  ];
  for (const [key, kw] of map) if (name.includes(key)) return kw;
  return name.trim();
}

// ── Screen builders and MD generators ──────────────────
let variantCounter = 0;

function addVariantRow(defaults = {}) {
  const id = ++variantCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'variant-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('variant-row-\${id}').remove(); updatePreview('projectconfig')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:10px">
      <div class="form-row"><label>Variant name</label>
        <input type="text" class="var-name" value="\${esc(defaults.name||'')}" placeholder="dev" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>applicationId</label>
        <input type="text" class="var-app-id" value="\${esc(defaults.applicationId||'')}" placeholder="com.example.app.dev" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>Note (optional)</label>
        <input type="text" class="var-note" value="\${esc(defaults.note||'')}" placeholder="Dev build — internal testing only" oninput="updatePreview('projectconfig')"></div>
    </div>
  \`;
  document.getElementById('cfg-variants-list').appendChild(row);
  updatePreview('projectconfig');
}

function generateProjectConfigMD() {
  const codebasePath  = document.getElementById('cfg-codebase-path')?.value.trim() || '/absolute/path/to/your/project';
  const platform      = getRadio('cfg-platform') || 'Android';
  const lang          = getRadio('cfg-lang') || 'Kotlin';
  const pkg           = document.getElementById('cfg-package')?.value.trim() || 'com.example.myapp';
  const minSdk        = document.getElementById('cfg-min-sdk')?.value.trim() || '26';
  const targetSdk     = document.getElementById('cfg-target-sdk')?.value.trim() || '35';
  const defaultTests  = getRadio('cfg-tests') || 'N';
  const branch        = document.getElementById('cfg-branch')?.value.trim() || 'feature/TICKET-ID';

  const variantRows = Array.from(document.querySelectorAll('[id^="variant-row-"]'));
  const variants = variantRows.map(row => ({
    name:          row.querySelector('.var-name')?.value.trim()   || '',
    applicationId: row.querySelector('.var-app-id')?.value.trim() || '',
    note:          row.querySelector('.var-note')?.value.trim()   || '',
  })).filter(v => v.name);

  let pkgComment = '# Matches source directory structure — used by the agent for file path and import generation.';
  if (variants.length > 0) {
    const maxNameLen = Math.max(...variants.map(v => v.name.length));
    const variantLines = variants
      .map(v => \`#   \${v.name}:\${' '.repeat(Math.max(1, maxNameLen - v.name.length + 2))}\${v.applicationId || '[fill in]'}\${v.note ? \`  # \${v.note}\` : ''}\`)
      .join('\\n');
    pkgComment = \`# Base source package — matches source directory structure.\\n# applicationId varies by build variant:\\n\${variantLines}\\n# Use the base package_name above for all file path and import generation.\`;
  }

  const androidSection = platform === 'Android' ? \`
## Android-specific (remove section if not Android)

package_name: \${pkg}
\${pkgComment}
min_sdk: \${minSdk}
target_sdk: \${targetSdk}
\` : '';

  const langOut = lang === 'Kotlin+Java' ? 'Kotlin' : lang;

  return \`# Project Configuration
# ─────────────────────────────────────────────────────────────────────────────
# Edit this file once when adopting this skeleton for a new project.
# Every Claude session reads this file first (Step 0 of CLAUDE.md protocol).
# ─────────────────────────────────────────────────────────────────────────────

## Codebase

codebase_path: \${codebasePath}
# All file paths in context/*.md are resolved relative to this path.

## Platform

platform: \${platform}
# Options: Android | iOS | Web | Backend | Flutter | React Native

primary_language: \${langOut}
# Options: Kotlin | Java | Swift | TypeScript | JavaScript | Dart | Python | etc.
\${androidSection}
## Team Preferences

default_tests: \${defaultTests}
# Y = Claude always writes tests unless the task MD explicitly says N.
# N = Claude asks each time.

branch_convention: \${branch}
# Naming hint shown in task completion reports.
# Example: feature/[PROJ]-1234 | bugfix/[PROJ]-1234 | chore/[PROJ]-1234
\`;
}

function buildProjectConfigScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-projectconfig">

    <div id="cfg-existing-banner" style="display:none;align-items:flex-start;gap:12px;background:rgba(62,207,142,0.08);border:1px solid var(--success);border-radius:var(--radius);padding:14px 16px;margin-bottom:20px">
      <span style="font-size:18px;line-height:1">ℹ️</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--success);margin-bottom:3px">Existing project.config.md detected</div>
        <div style="font-size:11px;color:var(--text-muted);line-height:1.5">Current values have been loaded below for review. Edit any field and click <strong>Save</strong> to update, or click <strong>Next →</strong> to continue without making changes.</div>
      </div>
      <button onclick="document.getElementById('cfg-existing-banner').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;line-height:1;padding:0">✕</button>
    </div>

    <div class="form-section">
      <h3>Codebase Path</h3>
      <div class="form-row">
        <input type="text" id="cfg-codebase-path" placeholder="/absolute/path/to/your/project"
               oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Absolute path to your project root. The agent resolves every file reference from here.</div>
      </div>
    </div>

    <div class="form-section">
      <h3>Platform</h3>
      <div class="radio-group">
        \${pill('Android','Android','cfg-platform','radio')}
        \${pill('iOS','iOS','cfg-platform','radio')}
        \${pill('Web','Web','cfg-platform','radio')}
        \${pill('Backend','Backend','cfg-platform','radio')}
        \${pill('Flutter','Flutter','cfg-platform','radio')}
        \${pill('React Native','React Native','cfg-platform','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Primary Language</h3>
      <div class="radio-group">
        \${pill('Kotlin','Kotlin','cfg-lang','radio')}
        \${pill('Java','Java','cfg-lang','radio')}
        \${pill('Kotlin + Java','Kotlin+Java','cfg-lang','radio')}
        \${pill('Swift','Swift','cfg-lang','radio')}
        \${pill('TypeScript','TypeScript','cfg-lang','radio')}
        \${pill('Dart','Dart','cfg-lang','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Base Package Name</h3>
      <div class="form-row">
        <input type="text" id="cfg-package" placeholder="com.example.myapp"
               oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Must match your source directory structure — not a variant applicationId. Auto-filled from app/build.gradle if detected.</div>
      </div>
    </div>

    <div class="form-section">
      <h3>Android SDK <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(Android only)</span></h3>
      <div style="display:flex;gap:24px">
        <div class="form-row">
          <label>minSdk</label>
          <input type="number" id="cfg-min-sdk" placeholder="26" min="1" max="99"
                 oninput="updatePreview('projectconfig')" style="width:80px">
        </div>
        <div class="form-row">
          <label>targetSdk</label>
          <input type="number" id="cfg-target-sdk" placeholder="35" min="1" max="99"
                 oninput="updatePreview('projectconfig')" style="width:80px">
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Build Variants</h3>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Each variant's applicationId — the agent uses this to avoid confusing install-time identifiers with the base source package. Auto-detected from <code>productFlavors</code> if found in build.gradle.</div>
      <div class="dynamic-list" id="cfg-variants-list"></div>
      <button class="add-btn" onclick="addVariantRow()" style="margin-top:10px">+ Add Variant</button>
    </div>

    <div class="form-section">
      <h3>Default Tests</h3>
      <div class="radio-group">
        \${pill('Y — always write tests','Y','cfg-tests','radio')}
        \${pill('N — ask each time','N','cfg-tests','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Branch Convention</h3>
      <div class="form-row">
        <input type="text" id="cfg-branch" placeholder="feature/TICKET-ID" oninput="updatePreview('projectconfig')">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Shown in task completion reports. e.g. feature/[PROJ]-1234 | bugfix/[PROJ]-1234 | chore/[PROJ]-1234</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-success" onclick="saveStep('projectconfig')">💾 Save project.config.md</button>
      <button class="btn btn-secondary" onclick="goTo('architecture')">Next: Architecture →</button>
    </div>

  </div>\`;

  // Seed with three blank variant rows so the table is always visible
  addVariantRow({ name: 'dev',     applicationId: '', note: 'Development build' });
  addVariantRow({ name: 'staging', applicationId: '', note: 'Staging build' });
  addVariantRow({ name: 'prod',    applicationId: '', note: 'Production build' });
}

// ══════════════════════════════════════════════════════
//  ARCHITECTURE STEP
// ══════════════════════════════════════════════════════
function buildArchitectureScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-architecture">

    <div class="form-section">
      <h3>Language</h3>
      <div class="form-sub">Primary language(s) in the codebase — affects which conventions and migration rules apply.</div>
      <div class="check-group" id="lang-group">
        \${pill('Kotlin','Kotlin','lang')}
        \${pill('Java','Java','lang')}
        \${pill('Kotlin + Java','Kotlin+Java','lang')}
      </div>
    </div>

    <div class="form-section">
      <h3>Architecture Pattern \${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>Select the architecture your app currently uses</strong> — this tells the agent how to read existing code.
        If you're migrating to a different pattern, use the <em>Target Architecture Notes</em> field below to describe where you're heading.
        The agent will write new code to the target, and use Migration Rules to guard against expanding the legacy pattern.<br><br>
        <strong>MVVM</strong> — ViewModel + StateFlow + Repository. Most common modern Android pattern.<br>
        <strong>MVP</strong> — Presenter + View interface. Legacy pattern; use Migration Rules to guard new code.<br>
        <strong>MVC</strong> — Controller in Activity/Fragment. Legacy; same guard approach as MVP.<br>
        <strong>Clean Architecture</strong> — adds Domain layer (UseCases) between ViewModel and Repository.<br>
        <strong>Clean + MVI</strong> — Clean Architecture with strict unidirectional intent → state → render cycle.
      </div>
      <div class="radio-group" id="arch-group">
        \${pill('MVVM','MVVM','arch','radio')}
        \${pill('MVP','MVP','arch','radio')}
        \${pill('MVC','MVC','arch','radio')}
        \${pill('Clean Architecture','Clean','arch','radio')}
        \${pill('Clean + MVI','Clean+MVI','arch','radio')}
        \${otherPill('arch','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Dependency Injection \${tierBadge('core')}</h3>
      <div class="radio-group" id="di-group">
        \${pill('Hilt','Hilt','di','radio')}
        \${pill('Dagger','Dagger','di','radio')}
        \${pill('Koin','Koin','di','radio')}
        \${pill('Manual','Manual','di','radio')}
        \${pill('None','None','di','radio')}
        \${otherPill('di','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Async / Threading \${tierBadge('core')} \${infoBtn('Select every async approach currently in the codebase. Then describe <strong>where each one is used</strong> in the text area below — the agent uses this to decide which async primitive to reach for in each module.')}</h3>
      <div class="check-group" id="async-group">
        \${pill('Coroutines + Flow','Coroutines','async')}
        \${pill('RxJava 2','RxJava2','async')}
        \${pill('RxJava 3','RxJava3','async')}
        \${pill('AsyncTask (legacy)','AsyncTask','async')}
        \${pill('Threads','Threads','async')}
        \${otherPill('async')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> above to get a separate card. One card = one approach. Use module chips to specify which modules use it.</p>
      <div class="approach-detail" id="arch-async-detail"></div>
    </div>

    <div class="form-section">
      <h3>State Management \${tierBadge('core')} \${infoBtn('Select <strong>all</strong> state approaches in the codebase — including legacy ones.<br><br><strong>Each selected approach gets its own card.</strong> In each card, describe which modules use that approach and any migration rules.<br><br>Example — LiveData card:<br><code>:app, :libs:featureOrder — existing ViewModels only, do not migrate unless task explicitly scopes it</code><br><br>This tells the agent exactly where LiveData lives and to leave it alone.')}</h3>
      <div class="check-group" id="state-group">
        \${pill('StateFlow','StateFlow','state')}
        \${pill('LiveData','LiveData','state')}
        \${pill('RxSubjects','RxSubjects','state')}
        \${pill('MVI Store','MVI','state')}
        \${otherPill('state')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> above to get a separate card. One card = one approach. Use module chips to specify which modules use it.</p>
      <div class="approach-detail" id="arch-state-detail"></div>
    </div>

    <div class="form-section">
      <h3>UI Layer \${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>Jetpack Compose</strong> — declarative UI, all new screens use Composables + Material 3.<br>
        <strong>XML Layouts</strong> — View system only; agent writes XML + ViewBinding, no Compose.<br>
        <strong>Mixed</strong> — both exist; agent uses Compose for new screens and leaves XML screens untouched.
      </div>
      <div class="radio-group" id="ui-group">
        \${pill('Jetpack Compose','Compose','ui','radio')}
        \${pill('XML Layouts','XML','ui','radio')}
        \${pill('Mixed (Compose + XML)','Mixed','ui','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Navigation \${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>Jetpack Navigation</strong> — NavController + nav graph XML; single Activity model.<br>
        <strong>Compose Navigation</strong> — NavHost + composable routes; used with full Compose apps.<br>
        <strong>Manual Fragments</strong> — FragmentManager.beginTransaction(); legacy multi-Activity or no nav graph.<br>
        <strong>Mixed</strong> — Jetpack Nav for some flows, manual transactions for others.
      </div>
      <div class="radio-group" id="nav-group">
        \${pill('Jetpack Navigation','JetpackNav','nav','radio')}
        \${pill('Manual Fragments','ManualFragments','nav','radio')}
        \${pill('Mixed','MixedNav','nav','radio')}
        \${pill('Compose Navigation','ComposeNav','nav','radio')}
        \${otherPill('nav','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Networking \${tierBadge('recommended')} \${infoBtn('<strong>Base URL strategy</strong> — describe HOW the URL is managed, not the actual value. Examples:<br><code>per-environment via BuildConfig.BASE_URL</code><br><code>injected via NomNom SDK config</code><br><br><strong>Auth mechanism</strong> — describe the approach:<br><code>Bearer token injected by AuthInterceptor</code><br><code>API key in request header</code><br><br>No actual URLs, tokens, or secrets here.')}</h3>
      <div class="check-group" id="network-group">
        \${pill('Retrofit','Retrofit','network')}
        \${pill('OkHttp','OkHttp','network')}
        \${pill('Ktor','Ktor','network')}
        \${pill('Volley','Volley','network')}
        \${otherPill('network')}
      </div>
      <div class="form-row" style="margin-top:8px;display:flex;gap:12px">
        <input type="text" id="arch-base-url" placeholder="Strategy only, not the URL — e.g. per-environment via BuildConfig.BASE_URL" oninput="updatePreview('architecture')" style="flex:1">
        <input type="text" id="arch-auth" placeholder="Auth — e.g. Bearer token via AuthInterceptor" oninput="updatePreview('architecture')" style="flex:1">
      </div>
    </div>

    <div class="form-section">
      <h3>Local Storage \${tierBadge('optional')} \${infoBtn('Select every storage approach in use. Then describe what each one stores — one line per approach:<br><code>DataStore — user preferences, session tokens</code><br><code>Realm — order history, product cache</code><br><code>SharedPreferences — legacy feature flags (read-only, do not add new keys)</code>')}</h3>
      <div class="check-group" id="storage-group">
        \${pill('Room','Room','storage')}
        \${pill('DataStore','DataStore','storage')}
        \${pill('SharedPreferences','SharedPrefs','storage')}
        \${pill('SQLite','SQLite','storage')}
        \${pill('Realm','Realm','storage')}
        \${otherPill('storage')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-storage-usage" rows="2" placeholder="One line per approach e.g.&#10;DataStore — user preferences, session tokens&#10;Realm — order history cache" oninput="updatePreview('architecture')"></textarea>
      </div>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="arch-storage-usage"></div>
      </div>
    </div>

    <div class="form-section">
      <h3>Image Loading \${tierBadge('optional')} \${infoBtn('Select the primary image loading library. In the text area, briefly describe where images are loaded — helps the agent pick the right approach when building new UI:<br><code>product images, restaurant logos, user avatars</code>')}</h3>
      <div class="radio-group" id="img-group">
        \${pill('Coil','Coil','img','radio')}
        \${pill('Glide','Glide','img','radio')}
        \${pill('Picasso','Picasso','img','radio')}
        \${pill('None','NoneImg','img','radio')}
        \${otherPill('img','radio')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-img-usage" rows="2" placeholder="Where used — e.g. product images, restaurant logos, user avatars" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Known Architecture Violations \${tierBadge('optional')} \${infoBtn('<strong>New to the codebase? Leave this empty — "None documented yet" is the correct default.</strong><br><br>The agent flags violations it discovers during task execution under <em>Follow-up recommended</em> in the completion report. Once you confirm a violation is real, add it here so the agent avoids spreading the same pattern.<br><br>Format — <code>File.kt — what the violation is and why it exists</code><br>Examples:<br><code>HomeFragment.kt — business logic in onViewCreated, pre-dates MVVM adoption</code><br><code>OrdersManager.kt — network calls outside a Repository, legacy service class</code>')}</h3>
      <div class="form-row">
        <textarea id="arch-violations" rows="3" placeholder="e.g. HomeFragment.kt: business logic in onViewCreated — pre-dates MVVM adoption" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Target Architecture Notes \${tierBadge('recommended')}</h3>
      <div class="form-row">
        <textarea id="arch-target-notes" rows="2" placeholder="e.g. All new screens use Compose + MVI. RxJava being removed incrementally." oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="arch-progress-wrap">
      <div class="arch-progress-title">Setup Quality</div>
      <div class="arch-progress-track" id="arch-progress-track">
        <div class="arch-seg empty" style="flex:100"></div>
      </div>
      <div class="arch-progress-labels">
        <div class="arch-progress-label">
          <div class="dot" style="background:#f87171"></div>
          <span id="arch-progress-core-label">0/6 Core</span>
        </div>
        <div class="arch-progress-label">
          <div class="dot" style="background:#fbbf24"></div>
          <span id="arch-progress-rec-label">0/5 Recommended</span>
        </div>
        <div class="arch-progress-label">
          <div class="dot" style="background:var(--text-muted)"></div>
          <span id="arch-progress-opt-label">0/5 Optional</span>
        </div>
      </div>
      <div class="arch-progress-hint" id="arch-progress-hint">Fill the Core sections before running tasks.</div>
    </div>

    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateArchitectureMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('architecture')">⚡ Generate &amp; Save ARCHITECTURE.md</button>
      <button class="btn btn-secondary" onclick="goTo('conventions')">Next →</button>
    </div>
  </div>\`;

  document.getElementById('screen-architecture').querySelectorAll('textarea, input').forEach(el => {
    el.addEventListener('input', () => { updatePreview('architecture'); updateArchProgress(); });
  });
  // Initial render — build approach cards for any pills already selected (e.g. after analyzeProject)
  renderApproachRows('async');
  renderApproachRows('state');
  updateArchProgress();
}

function generateArchitectureMD() {
  const langs    = getPills('lang');
  const arch     = getRadio('arch');
  const di       = getRadio('di');
  const asyncLib = getPills('async');
  const stateLib = getPills('state');
  const ui       = getRadio('ui');
  const nav      = getRadio('nav');
  const network  = getPills('network');
  const storage  = getPills('storage');
  const img      = getRadio('img');
  const violations   = (document.getElementById('arch-violations')?.value    || '').trim();
  const targetNotes  = (document.getElementById('arch-target-notes')?.value  || '').trim();
  const baseUrl      = (document.getElementById('arch-base-url')?.value      || '').trim();
  const authMech     = (document.getElementById('arch-auth')?.value          || '').trim();
  const storageUsage = (document.getElementById('arch-storage-usage')?.value || '').trim();
  const imgUsage     = (document.getElementById('arch-img-usage')?.value     || '').trim();

  const today = new Date().toISOString().split('T')[0];
  const primaryLang = langs[0] || 'Kotlin';
  // Real package name from Project Config step — falls back to placeholder if not set
  const pkgName = document.getElementById('cfg-package')?.value?.trim() || 'com.example.app';

  // Per-approach rows: one table row per approach card, preserving module-level granularity.
  // e.g. | StateFlow | :appCore, :libs:featureAuth — all new ViewModels |
  //      | LiveData  | :app — existing ViewModels only, do not migrate  |
  function approachRowsToMD(group, pills, placeholder) {
    const rows = getApproachRows(group);
    if (rows.length > 0) {
      return rows.map(({ approach, note }) =>
        \`| \${approach} | \${note || placeholder} |\`
      ).join('\\n');
    }
    // Fallback: pills selected but no cards rendered yet (shouldn't happen normally)
    return pills.map(p => \`| \${p} | \${placeholder} |\`).join('\\n');
  }

  // Multiline textarea → table rows (used for storage, not async/state).
  function textareaToRows(lines, pills, placeholder) {
    const filled = lines.split('\\n').map(l => l.trim()).filter(Boolean);
    if (filled.length > 0) return filled.map(l => {
      const sep = l.indexOf('—') !== -1 ? l.indexOf('—') : l.indexOf('-');
      if (sep > 0) return \`| \${l.slice(0, sep).trim()} | \${l.slice(sep + 1).trim()} |\`;
      return \`| \${l} | |\`;
    }).join('\\n');
    return pills.map(p => \`| \${p} | \${placeholder} |\`).join('\\n');
  }

  const asyncRows   = approachRowsToMD('async', asyncLib, '[describe which modules]');
  const stateRows   = approachRowsToMD('state', stateLib, '[describe which ViewModels]');
  const storageRows = textareaToRows(storageUsage, storage, '[describe usage]');
  const violationsBlock = violations
    ? violations.split('\\n').map(v => \`- \${v.trim()}\`).join('\\n')
    : '- None documented yet.';

  // ── ADR helpers ──────────────────────────────────────────────────────────

  // ADR-001: Layer Structure
  const layerPackageTree = arch === 'Clean+MVI' || arch === 'Clean'
    ? \`\\\`\\\`\\\`
\${pkgName}/
├── feature/
│   └── <name>/
│       ├── ui/          ← Composables / Fragments (UI layer)
│       ├── viewmodel/   ← ViewModel (presentation layer)
│       ├── usecase/     ← Business logic (domain layer)
│       └── data/        ← Repository impl, DTOs (data layer)
├── core/
│   ├── network/
│   ├── database/
│   └── ui/
└── di/                  ← \${di || 'Hilt'} modules
\\\`\\\`\\\`\`
    : arch === 'MVVM'
    ? \`\\\`\\\`\\\`
\${pkgName}/
├── ui/         ← Composables / Fragments
├── viewmodel/  ← ViewModels
├── repository/ ← Repository interfaces + impls
├── model/      ← Data / domain models
└── di/         ← \${di || 'Hilt'} modules
\\\`\\\`\\\`\`
    : \`\\\`\\\`\\\`
\${pkgName}/
├── ui/
├── viewmodel/
├── repository/
└── di/
\\\`\\\`\\\`\`;

  const dependencyRule = arch === 'Clean+MVI' || arch === 'Clean'
    ? \`**Dependency Rule**: dependencies point inward only.\\n\\\`ui → viewmodel → usecase → repository → datasource\\\`\\nNo layer may import from a layer above it.\`
    : \`**Dependency Rule**: \\\`ui → viewmodel → repository\\\`\\nViewModels must not import from the \\\`ui\\\` package.\`;

  const violationExamples = arch === 'Clean+MVI' || arch === 'Clean'
    ? \`**Violations the agent must refuse to introduce:**\\n- Calling a \\\`UseCase\\\` directly from a \\\`@Composable\\\` or \\\`Fragment\\\`\\n- Importing an Android \\\`Context\\\` inside a \\\`UseCase\\\`\\n- Returning a \\\`Response<T>\\\` (Retrofit type) from a \\\`Repository\\\` interface\`
    : \`**Violations the agent must refuse to introduce:**\\n- Business logic inside a \\\`@Composable\\\` or \\\`Fragment\\\`\\n- Network calls made outside a \\\`Repository\\\`\\n- ViewModel depending on \\\`View\\\` or \\\`Activity\\\` references\`;

  const adr001 = \`### ADR-001 — Layer Structure and Dependency Rule
- **Date**: \${today}
- **Decision**: Adopt \${arch || 'MVVM'} with strict unidirectional dependency flow.
- **Reason**: Enforces separation of concerns, testability, and prevents coupling between layers.
- **Consequence**: Every new file must be placed in the correct layer package. PRs that violate the dependency rule are rejected.

#### Package Tree

\${layerPackageTree}

#### Dependency Rule

\${dependencyRule}

#### Violation Examples

\${violationExamples}\`;

  // ADR-002: Architecture Pattern (MVI or MVVM code template)
  let adr002 = '';
  if (arch === 'Clean+MVI' || arch === 'MVI') {
    adr002 = \`### ADR-002 — MVI Pattern: UiState + Intent + ViewModel + Screen
- **Date**: \${today}
- **Decision**: All feature screens follow the MVI contract below. No exceptions.
- **Reason**: Unidirectional data flow makes state mutations predictable and testable.
- **Consequence**: Every screen ships with a \\\`UiState\\\`, a sealed \\\`Intent\\\`, a \\\`ViewModel\\\`, and a stateless \\\`Screen\\\` composable.

\\\`\\\`\\\`kotlin
// UiState — immutable snapshot of everything the screen needs to render
data class ExampleUiState(
    val isLoading: Boolean = false,
    val items: List<Item> = emptyList(),
    val error: String? = null
)

// Intent — every user action the screen can produce
sealed interface ExampleIntent {
    data object LoadItems : ExampleIntent
    data class DeleteItem(val id: String) : ExampleIntent
}

// ViewModel
@HiltViewModel
class ExampleViewModel @Inject constructor(
    private val getItemsUseCase: GetItemsUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(ExampleUiState())
    val state: StateFlow<ExampleUiState> = _state.asStateFlow()

    fun onIntent(intent: ExampleIntent) {
        when (intent) {
            is ExampleIntent.LoadItems  -> loadItems()
            is ExampleIntent.DeleteItem -> deleteItem(intent.id)
        }
    }

    private fun loadItems() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getItemsUseCase()
                .onSuccess { items -> _state.update { it.copy(isLoading = false, items = items) } }
                .onFailure { e  -> _state.update { it.copy(isLoading = false, error = e.message) } }
        }
    }
}

// Screen — stateless; receives state and emits intents
@Composable
fun ExampleScreen(
    state: ExampleUiState,
    onIntent: (ExampleIntent) -> Unit
) {
    LaunchedEffect(Unit) { onIntent(ExampleIntent.LoadItems) }
    // … render state …
}
\\\`\\\`\\\`\`;
  } else if (arch === 'MVVM') {
    adr002 = \`### ADR-002 — MVVM Pattern: UiState + ViewModel + Screen
- **Date**: \${today}
- **Decision**: All feature screens follow the MVVM contract below. No exceptions.
- **Reason**: Clear separation between UI and business logic; ViewModel survives configuration changes.
- **Consequence**: Every screen ships with a \\\`UiState\\\`, a \\\`ViewModel\\\`, and a stateless \\\`Screen\\\` composable.

\\\`\\\`\\\`kotlin
// UiState
data class ExampleUiState(
    val isLoading: Boolean = false,
    val items: List<Item> = emptyList(),
    val error: String? = null
)

// ViewModel
@HiltViewModel
class ExampleViewModel @Inject constructor(
    private val repository: ExampleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ExampleUiState())
    val uiState: StateFlow<ExampleUiState> = _uiState.asStateFlow()

    fun loadItems() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            repository.getItems()
                .onSuccess { items -> _uiState.update { it.copy(isLoading = false, items = items) } }
                .onFailure { e    -> _uiState.update { it.copy(isLoading = false, error = e.message) } }
        }
    }
}

// Screen — stateless
@Composable
fun ExampleScreen(
    uiState: ExampleUiState,
    onLoadItems: () -> Unit
) {
    LaunchedEffect(Unit) { onLoadItems() }
    // … render uiState …
}
\\\`\\\`\\\`\`;
  }

  // ADR-003: DI
  const diName = di || 'Hilt';
  let adr003 = '';
  if (diName === 'Hilt') {
    adr003 = \`### ADR-003 — Dependency Injection with Hilt
- **Date**: \${today}
- **Decision**: Hilt is the sole DI framework. No manual \\\`object\\\` singletons or service locators.
- **Reason**: Hilt provides compile-time validation, scoped components, and first-class ViewModel injection.
- **Consequence**: Every dependency must be provided through a \\\`@Module\\\`. Direct instantiation of injected types is forbidden.

\\\`\\\`\\\`kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())
            .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
}

@Module
@InstallIn(ViewModelComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindExampleRepository(impl: ExampleRepositoryImpl): ExampleRepository
}
\\\`\\\`\\\`\`;
  } else if (diName === 'Koin') {
    adr003 = \`### ADR-003 — Dependency Injection with Koin
- **Date**: \${today}
- **Decision**: Koin is the sole DI framework. No manual singletons or service locators.
- **Reason**: Koin provides lightweight runtime DI with a Kotlin-first DSL.
- **Consequence**: All modules declared in the \\\`di/\\\` package and loaded at \\\`Application.onCreate\\\`.

\\\`\\\`\\\`kotlin
val networkModule = module {
    single {
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())
            .build()
    }
    single {
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(get())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}

val repositoryModule = module {
    single<ExampleRepository> { ExampleRepositoryImpl(get()) }
}

val viewModelModule = module {
    viewModel { ExampleViewModel(get()) }
}
\\\`\\\`\\\`\`;
  } else {
    adr003 = \`### ADR-003 — Dependency Injection with \${diName}
- **Date**: \${today}
- **Decision**: \${diName} is the sole DI framework.
- **Reason**: Chosen for consistency and to avoid mixing DI approaches.
- **Consequence**: All dependencies wired through \${diName}. Manual instantiation of injectable types is forbidden.\`;
  }

  // ADR-004: Navigation
  let adr004 = '';
  if (nav === 'ComposeNav') {
    adr004 = \`### ADR-004 — Navigation with Compose Navigation
- **Date**: \${today}
- **Decision**: All navigation is handled by Jetpack Compose Navigation. A single \\\`NavHost\\\` lives in \\\`MainActivity\\\`.
- **Reason**: Type-safe, lifecycle-aware navigation native to Compose.
- **Consequence**: No \\\`startActivity\\\` calls for in-app navigation. All routes declared in \\\`NavRoutes\\\`.

\\\`\\\`\\\`kotlin
sealed class NavRoutes(val route: String) {
    data object Home    : NavRoutes("home")
    data object Detail  : NavRoutes("detail/{itemId}") {
        fun createRoute(itemId: String) = "detail/$itemId"
    }
    data object Settings : NavRoutes("settings")
}

// In MainActivity / top-level NavHost:
NavHost(navController = navController, startDestination = NavRoutes.Home.route) {
    composable(NavRoutes.Home.route)    { HomeScreen(navController) }
    composable(
        route = NavRoutes.Detail.route,
        arguments = listOf(navArgument("itemId") { type = NavType.StringType })
    ) { backStackEntry ->
        DetailScreen(itemId = backStackEntry.arguments?.getString("itemId") ?: "")
    }
    composable(NavRoutes.Settings.route) { SettingsScreen() }
}
\\\`\\\`\\\`\`;
  } else if (nav === 'JetpackNav') {
    adr004 = \`### ADR-004 — Navigation with Jetpack Navigation Component
- **Date**: \${today}
- **Decision**: Single-Activity architecture with Jetpack Navigation Component. NavGraph defined in XML.
- **Reason**: Standardised back-stack management, deep-link support, and Safe Args for type safety.
- **Consequence**: No manual \\\`FragmentTransaction\\\` calls for in-app navigation. All destinations in \\\`nav_graph.xml\\\`.

\\\`\\\`\\\`kotlin
// Safe Args — generated NavDirections
val action = HomeFragmentDirections.actionHomeToDetail(itemId = item.id)
findNavController().navigate(action)

// Deep link declared in nav_graph.xml:
// <deepLink app:uri="myapp://detail/{itemId}" />
\\\`\\\`\\\`\`;
  } else if (nav === 'ManualFragments') {
    adr004 = \`### ADR-004 — Navigation via FragmentManager
- **Date**: \${today}
- **Decision**: Navigation is handled via manual \\\`FragmentTransaction\\\` through a shared \\\`NavigationManager\\\`.
- **Reason**: Legacy codebase; migration to Jetpack Navigation is tracked separately.
- **Consequence**: All fragment transactions must go through \\\`NavigationManager\\\`. No direct \\\`supportFragmentManager\\\` calls outside that class.\`;
  }

  // ADR-005: Async / State
  const hasRx = asyncLib.includes('RxJava2') || asyncLib.includes('RxJava3');
  const hasLiveData = stateLib.includes('LiveData');
  const hasCoroutines = asyncLib.includes('Coroutines') || asyncLib.length === 0;
  const hasStateFlow = stateLib.includes('StateFlow') || stateLib.length === 0;

  const adr005 = \`### ADR-005 — Async and State Management
- **Date**: \${today}
- **Decision**: \${hasCoroutines ? 'Kotlin Coroutines + Flow' : asyncLib.join(' + ')} for async operations; \${hasStateFlow ? 'StateFlow' : stateLib.join(' + ')} for UI state.\${hasRx ? ' RxJava is legacy and being removed incrementally.' : ''}\${hasLiveData ? ' LiveData is legacy and being replaced with StateFlow.' : ''}
- **Reason**: Coroutines + StateFlow are the Android-recommended, lifecycle-aware primitives with structured concurrency.
- **Consequence**: All new async work uses \\\`viewModelScope.launch\\\` or \\\`flow { }\\\`. All new UI state uses \\\`StateFlow\\\`. No new RxJava or LiveData usage.

| Legacy | Modern replacement | Migration status |
|--------|-------------------|-----------------|
\${[
  hasRx       ? \`| \${asyncLib.filter(a => a.startsWith('RxJava')).join('/')} | Kotlin Coroutines + Flow | Incremental — remove on touch |\` : '',
  hasLiveData ? '| LiveData | StateFlow + collectAsStateWithLifecycle() | Incremental — replace on touch |' : '',
  '| AsyncTask *(if any)* | \`viewModelScope.launch\` | Must be replaced immediately |',
  '| Threads / Executors *(if any)* | \`withContext(Dispatchers.IO)\` | Must be replaced immediately |',
].filter(Boolean).join('\\n')}\`;

  // ADR-006: Mixed UI (only if Mixed selected)
  const adr006 = ui === 'Mixed'
    ? \`### ADR-006 — Mixed UI: Compose for new screens; XML stays until migration ticket
- **Date**: \${today}
- **Decision**: Do not rewrite existing XML screens to Compose unless a ticket explicitly scopes it.
- **Reason**: Rewriting UI without adding user value introduces risk and churn with no product benefit.
- **Consequence**: The codebase contains both XML layouts and Composables. The agent must not assume all UI is Compose. When touching an existing XML screen, keep it in XML unless the ticket says otherwise.\`
    : '';

  // ── Migration Contrast Map ───────────────────────────────────────────────
  const migrationRows = [];
  if (hasLiveData) {
    migrationRows.push('| \`LiveData<T>\` in ViewModel | \`StateFlow<T>\` (MutableStateFlow + asStateFlow()) |');
    migrationRows.push('| \`observe(viewLifecycleOwner)\` in Fragment/Activity | \`collectAsStateWithLifecycle()\` in Composable |');
  }
  if (hasRx) {
    migrationRows.push('| \`Observable\` / \`Single\` (RxJava) | \`Flow\` / \`suspend fun\` |');
    migrationRows.push('| \`.subscribeOn(Schedulers.io())\` | \`withContext(Dispatchers.IO)\` |');
    migrationRows.push('| \`.observeOn(AndroidSchedulers.mainThread())\` | \`flowOn(Dispatchers.Main)\` or emit on main in ViewModel |');
  }
  if (ui === 'Mixed' || ui === 'XML') {
    migrationRows.push('| XML layout (\`activity_*.xml\` / \`fragment_*.xml\`) | \`@Composable\` Screen function |');
    migrationRows.push('| \`ViewBinding\` / \`DataBinding\` | Compose state hoisting (\`state: UiState, onIntent: (Intent) -> Unit\`) |');
  }
  if (nav === 'ManualFragments') {
    migrationRows.push('| \`supportFragmentManager.beginTransaction()\` | \`NavController.navigate(NavRoutes.*)\` |');
  }
  if (di === 'Koin' || (!di && false)) {
    migrationRows.push('| Koin \`inject()\` / \`get()\` | \`@Inject constructor(...)\` with Hilt |');
  }
  migrationRows.push('| \`AsyncTask\` | \`viewModelScope.launch { withContext(Dispatchers.IO) { … } }\` |');
  migrationRows.push('| \`GlobalScope.launch\` | \`viewModelScope.launch\` |');

  const migrationSection = migrationRows.length > 0
    ? \`---

## Migration Contrast Map

> Patterns the agent must recognise as legacy and replace with the modern equivalent on every touch.

| Legacy Pattern | Modern Equivalent |
|---------------|------------------|
\${migrationRows.join('\\n')}\`
    : '';

  // ── ADR block assembly ───────────────────────────────────────────────────
  const adrBlocks = [adr001, adr002, adr003, adr004, adr005, adr006]
    .filter(a => a.trim() !== '')
    .join('\\n\\n');

  // ── Module Structure rows ────────────────────────────────────────────────
  const langDisplay = langs.join(' + ') || 'Kotlin';
  const diDisplay   = di || 'Hilt';
  let moduleTableRows;
  if (state.detectedModuleDetails && state.detectedModuleDetails.length > 0) {
    moduleTableRows = state.detectedModuleDetails.map(m => {
      // Promote generic pattern based on arch selection when module is MVVM-flagged
      const pattern = m.type === 'MVVM' ? (arch || 'MVVM') : m.type;
      return \`| \${m.name} | \${langDisplay} | \${pattern} | \${m.diCol} | \${m.notes} |\`;
    }).join('\\n');
  } else {
    moduleTableRows =
\`| :app | \${langDisplay} | Single Activity | \${diDisplay} | App entry point, NavHost, deep links |
| :feature-[name] | \${primaryLang} | \${arch || 'MVVM'} | \${diDisplay} | [describe feature] |
| :core-network | \${primaryLang} | — | \${diDisplay} | Retrofit, OkHttp, interceptors |
| :core-data | \${primaryLang} | Repository | \${diDisplay} | Room, DataStore |
| :core-ui | \${primaryLang} | — | — | Shared composables, theme |\`;
  }

  // ── Interceptors ─────────────────────────────────────────────────────────
  const interceptorList = state.detectedInterceptors && state.detectedInterceptors.length > 0
    ? state.detectedInterceptors.join(', ')
    : '[list each]';

  return \`# Architecture
# ─────────────────────────────────────────────────────────────────────────────
# AI-GENERATED ARTIFACT. Re-run setup wizard to update — do not edit manually.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read this entire file before writing any code. Every decision here is final. Do not deviate.

---

## Current State

### Module Structure

| Gradle Module / Package | Language | Pattern | DI | Notes |
|------------------------|----------|---------|-----|-------|
\${moduleTableRows}

### Navigation

\${nav === 'JetpackNav' ? 'Single-activity with Jetpack Navigation Component. NavGraph in app/src/main/res/navigation/nav_graph.xml.' :
  nav === 'ComposeNav' ? 'Compose Navigation — NavHost in MainActivity.kt.' :
  nav === 'ManualFragments' ? 'Manual fragment transactions via FragmentManager.' :
  '[Describe navigation approach]'}

### Threading Model

| Approach | Where used |
|----------|-----------|
\${asyncRows || '| Kotlin Coroutines + Flow | All new code |'}

### State Management

| Approach | Where used |
|----------|-----------|
\${stateRows || '| StateFlow | All new ViewModels |'}

### Networking

| Property | Value |
|----------|-------|
| Library | \${network.join(' + ') || 'Retrofit + OkHttp'} |
| Base URL strategy | \${baseUrl || '[single base URL / per-environment via BuildConfig / remote config]'} |
| Auth mechanism | \${authMech || '[Bearer token injected by AuthInterceptor / API key / none]'} |
| Custom interceptors | \${interceptorList} |

### Local Storage

| Approach | Where used |
|----------|-----------|
\${storageRows || '| Room | [describe usage] |'}

### Image Loading
\${img && img !== 'NoneImg' ? \`\${img} — \${imgUsage.split('\\n').map(l=>l.trim()).filter(Boolean).join(', ') || '[describe usage]'}\` : 'No image loading library.'}

### Known Architecture Violations

\${violationsBlock}

---

## Target State

### Architecture Pattern
\${arch === 'Clean+MVI' ? 'Clean Architecture + MVI\\nUI → ViewModel (MVI: intent → state) → UseCase → Repository → DataSource' :
  arch === 'Clean' ? 'Clean Architecture\\nUI → ViewModel → UseCase → Repository → DataSource' :
  arch ? arch + '\\n[describe target state]' :
  'Clean Architecture + MVI\\nUI → ViewModel → UseCase → Repository → DataSource'}

### DI
\${di || 'Hilt'} everywhere. No manual wiring.

### Async
Kotlin Coroutines + Flow everywhere.\${hasRx ? ' RxJava being removed incrementally.' : ''}

### UI
\${ui === 'Compose' ? '- All screens: Jetpack Compose + Material 3' :
  ui === 'Mixed' ? '- New screens: Jetpack Compose + Material 3\\n- Existing XML screens: kept until explicit migration ticket\\n- No new XML screens' :
  ui === 'XML' ? '- Current: XML layouts\\n- Target: Migrate to Jetpack Compose incrementally' :
  '- [Describe UI target state]'}

### Navigation
\${nav === 'JetpackNav' || nav === 'ComposeNav' ? 'Jetpack Navigation Component. Single-Activity. Type-safe destinations.' : '[Describe navigation target]'}
\${targetNotes ? '\\n### Additional Notes\\n' + targetNotes : ''}

---

## Architecture Decision Records

\${adrBlocks}

\${migrationSection}

<!-- ─────────────────────────────────────────────────────────────────────────
     END OF ARCHITECTURE.md — Every decision above is final.
     The agent must not modify this file or deviate from its constraints.
     ───────────────────────────────────────────────────────────────────── -->
\`;
}

// ══════════════════════════════════════════════════════
//  CONVENTIONS STEP
// ══════════════════════════════════════════════════════
function buildConventionsScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-conventions">

    <div class="form-section">
      <h3>Package Name Prefix \${infoBtn('Used to fill in the package structure example in the generated CONVENTIONS.md.<br><br>e.g. if your app root package is <code>com.example.app</code>, enter that here. It replaces the placeholder in the feature module path: <code>com.example.app.feature.[name]/ui/...</code>')}</h3>
      <div class="form-sub">Root package name for your app — used in the generated package structure example.</div>
      <div class="form-row">
        <input type="text" id="conv-package" placeholder="e.g. com.example.myapp" oninput="updatePreview('conventions')">
      </div>
    </div>

    <div class="form-section">
      <h3>Null Safety Rules</h3>
      <div class="dynamic-list" id="conv-null-rules">
        <div class="toggle-row">
          <div><div class="toggle-label">Ban !! null assertions</div><div class="toggle-sub">Use ?.let{}, ?: return, or requireNotNull()</div></div>
          <label class="toggle"><input type="checkbox" id="conv-ban-bang" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Ban lateinit var (except Hilt injected)</div><div class="toggle-sub">Prefer constructor injection</div></div>
          <label class="toggle"><input type="checkbox" id="conv-ban-lateinit" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Prefer val over var</div><div class="toggle-sub">Immutability by default — use var only when mutation is strictly needed</div></div>
          <label class="toggle"><input type="checkbox" id="conv-prefer-val" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">data class for all model/state/event types</div><div class="toggle-sub">Gives equals, hashCode, copy for free — no mutable var fields inside</div></div>
          <label class="toggle"><input type="checkbox" id="conv-data-class" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Exhaustive when on sealed classes (no else)</div><div class="toggle-sub">Compiler catches missing branches when new cases are added later</div></div>
          <label class="toggle"><input type="checkbox" id="conv-exhaustive-when" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>ViewModel Rules</h3>
      <div class="dynamic-list">
        <div class="toggle-row">
          <div><div class="toggle-label">StateFlow for state (never LiveData)</div><div class="toggle-sub">Lifecycle-safe, testable, and composable-friendly — new ViewModels must not use LiveData</div></div>
          <label class="toggle"><input type="checkbox" id="conv-stateflow" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">SharedFlow for one-shot events (navigation, toasts)</div><div class="toggle-sub">Events that should not replay on re-subscription — separate from UiState</div></div>
          <label class="toggle"><input type="checkbox" id="conv-channel" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No Android framework imports in ViewModel</div><div class="toggle-sub">Context, View, FragmentManager are banned — keeps ViewModel unit-testable</div></div>
          <label class="toggle"><input type="checkbox" id="conv-no-android-vm" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">All coroutines in viewModelScope</div><div class="toggle-sub">Automatically cancelled when ViewModel is cleared — no manual cleanup needed</div></div>
          <label class="toggle"><input type="checkbox" id="conv-vmscope" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No GlobalScope</div><div class="toggle-sub">GlobalScope leaks beyond ViewModel lifecycle — always scope to viewModelScope or lifecycleScope</div></div>
          <label class="toggle"><input type="checkbox" id="conv-no-global" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Compose Rules (if applicable)</h3>
      <div class="dynamic-list">
        <div class="toggle-row">
          <div><div class="toggle-label">Stateless composables (receive state, emit events)</div><div class="toggle-sub">Composables take UiState as param and return events via lambda — no internal ViewModel access</div></div>
          <label class="toggle"><input type="checkbox" id="conv-stateless" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No business logic inside @Composable</div><div class="toggle-sub">Composables only render and forward events — all decisions live in the ViewModel</div></div>
          <label class="toggle"><input type="checkbox" id="conv-no-logic-compose" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Use collectAsStateWithLifecycle() not collectAsState()</div><div class="toggle-sub">Stops collecting when the composable is in the background — prevents unnecessary work</div></div>
          <label class="toggle"><input type="checkbox" id="conv-lifecycle-collect" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Material 3 only (no Material 2 in new screens)</div><div class="toggle-sub">Mixing M2 and M3 breaks theming — new screens import only androidx.compose.material3</div></div>
          <label class="toggle"><input type="checkbox" id="conv-m3" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Resource Rules</h3>
      <div class="dynamic-list">
        <div class="toggle-row">
          <div><div class="toggle-label">All strings in strings.xml (no hardcoded strings)</div><div class="toggle-sub">Enables localisation and keeps user-visible text out of code reviews</div></div>
          <label class="toggle"><input type="checkbox" id="conv-strings" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No hardcoded hex colors</div><div class="toggle-sub">Use ?attr/colorPrimary in XML or MaterialTheme.colorScheme.* in Compose — supports dark mode</div></div>
          <label class="toggle"><input type="checkbox" id="conv-no-hex" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No magic number dimensions</div><div class="toggle-sub">Define spacing and sizes in dimens.xml or a design token system — avoids scattered hardcoded dp values</div></div>
          <label class="toggle"><input type="checkbox" id="conv-no-magic" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Vector drawables only (no rasters)</div><div class="toggle-sub">SVG-based VectorDrawable scales to any density — PNG/JPG only for brand assets that can't be vectorised</div></div>
          <label class="toggle"><input type="checkbox" id="conv-vectors" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Quality Gate \${infoBtn('The agent runs this checklist on <strong>every task</strong> during Step 6b self-verification.<br><br>Each enabled check becomes a row in the Quality Gate table. If the agent finds a violation, it must fix it before writing the completion report.<br><br>Enable every check that applies to your project — the more specific, the better the agent\\'s output quality.')}</h3>
      <div class="dynamic-list">
        <div class="toggle-row">
          <div><div class="toggle-label">No !! operators</div><div class="toggle-sub">Use ?.let {}, ?: return, or requireNotNull</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-bang" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No new LiveData</div><div class="toggle-sub">New state uses StateFlow only</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-livedata" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No GlobalScope</div><div class="toggle-sub">All coroutines in viewModelScope or lifecycleScope</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-globalscope" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No hardcoded strings</div><div class="toggle-sub">All user-visible text in strings.xml</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-strings" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No hardcoded colors or dimensions</div><div class="toggle-sub">Use theme attributes or dimens.xml</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-hardcoded-res" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Sealed types exhaustive</div><div class="toggle-sub">No else branch on when over sealed class/interface</div></div>
          <label class="toggle"><input type="checkbox" id="qg-sealed-exhaustive" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">No business logic in UI layer</div><div class="toggle-sub">Composables, Fragments, Activities call ViewModel only</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-logic-ui" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">ViewModel has no Android imports</div><div class="toggle-sub">No Context, View, FragmentManager in ViewModel</div></div>
          <label class="toggle"><input type="checkbox" id="qg-vm-no-android" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">DTOs not exposed to UI</div><div class="toggle-sub">Repository returns domain models only</div></div>
          <label class="toggle"><input type="checkbox" id="qg-no-dto-ui" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-label">Test naming convention</div><div class="toggle-sub">functionName_scenario_expectedResult</div></div>
          <label class="toggle"><input type="checkbox" id="qg-test-naming" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>
      </div>
      <div class="form-row" style="margin-top:10px">
        <textarea id="conv-qg-extra" rows="2" placeholder="Extra checks — one per line e.g.&#10;No Realm calls outside Repository&#10;No direct SharedPreferences access outside DataSource" oninput="updatePreview('conventions')"></textarea>
      </div>
    </div>

    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateConventionsMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('conventions')">💾 Save CONVENTIONS.md</button>
      <button class="btn btn-secondary" onclick="goTo('migrations')">Next →</button>
    </div>
  </div>\`;
}

function generateConventionsMD() {
  const pkg       = document.getElementById('conv-package')?.value.trim() || 'com.example.myapp';
  const banBang   = document.getElementById('conv-ban-bang')?.checked;
  const banLate   = document.getElementById('conv-ban-lateinit')?.checked;
  const prefVal   = document.getElementById('conv-prefer-val')?.checked;
  const dataCls   = document.getElementById('conv-data-class')?.checked;
  const exhaust   = document.getElementById('conv-exhaustive-when')?.checked;
  const stateflow = document.getElementById('conv-stateflow')?.checked;
  const noAndVM   = document.getElementById('conv-no-android-vm')?.checked;
  const vmscope   = document.getElementById('conv-vmscope')?.checked;
  const noGlobal  = document.getElementById('conv-no-global')?.checked;
  const stateless = document.getElementById('conv-stateless')?.checked;
  const noLogic   = document.getElementById('conv-no-logic-compose')?.checked;
  const lifecycle = document.getElementById('conv-lifecycle-collect')?.checked;
  const m3        = document.getElementById('conv-m3')?.checked;
  const strings   = document.getElementById('conv-strings')?.checked;
  const noHex     = document.getElementById('conv-no-hex')?.checked;
  const noMagic   = document.getElementById('conv-no-magic')?.checked;
  const vectors   = document.getElementById('conv-vectors')?.checked;

  // Quality Gate toggles
  const qgNoBang      = document.getElementById('qg-no-bang')?.checked;
  const qgNoLivedata  = document.getElementById('qg-no-livedata')?.checked;
  const qgNoGlobal    = document.getElementById('qg-no-globalscope')?.checked;
  const qgNoStrings   = document.getElementById('qg-no-strings')?.checked;
  const qgNoHardRes   = document.getElementById('qg-no-hardcoded-res')?.checked;
  const qgSealed      = document.getElementById('qg-sealed-exhaustive')?.checked;
  const qgNoLogicUI   = document.getElementById('qg-no-logic-ui')?.checked;
  const qgVmNoAndroid = document.getElementById('qg-vm-no-android')?.checked;
  const qgNoDtoUI     = document.getElementById('qg-no-dto-ui')?.checked;
  const qgTestNaming  = document.getElementById('qg-test-naming')?.checked;
  const qgExtra       = (document.getElementById('conv-qg-extra')?.value || '').trim();

  const rule = (active, text) => active ? \`- \${text}\` : null;
  const coreRules = [
    rule(banBang,  'No \`!!\` null assertions. Use \`?.let {}\`, \`?: return\`, or \`requireNotNull(x) { "msg" }\`.'),
    rule(banLate,  'No \`lateinit var\` except Hilt-injected fields (\`@Inject lateinit var\`). Prefer constructor injection.'),
    rule(prefVal,  'Prefer \`val\` over \`var\`.'),
    rule(dataCls,  'Use \`data class\` for all model/state/event types. No mutable \`var\` fields in data classes.'),
    rule(exhaust,  'Every \`when\` on a sealed class or sealed interface must be exhaustive. Never use \`else\` on sealed types.'),
    '- Use \`object\` for singletons.',
    '- Prefer named arguments when calling functions with 3+ parameters of the same type.',
    '- Extension functions go in a dedicated \`[Subject]Extensions.kt\` file in the same package.',
  ].filter(Boolean).join('\\n');

  const coreAntiPatterns = (banBang || dataCls || exhaust) ? \`
### Anti-patterns (agent must never write these)

\\\`\\\`\\\`kotlin
\${banBang ? \`// \\u274c Null assertion
val name = user!!.name

// \\u2705 Safe unwrap
val name = user?.name ?: return
\` : ''}\${exhaust ? \`
// \\u274c else on sealed type — misses future cases
when (state) {
    is Loading -> showSpinner()
    else -> hideSpinner()
}

// \\u2705 Exhaustive — compiler catches missing cases
when (state) {
    is Loading -> showSpinner()
    is Success -> showContent(state.data)
    is Error   -> showError(state.message)
}
\` : ''}\${dataCls ? \`
// \\u274c var in data class
data class User(var name: String, var email: String)

// \\u2705 Immutable data class
data class User(val name: String, val email: String)
\` : ''}\\\`\\\`\\\`\` : '';

  const vmRules = [
    rule(stateflow, 'Expose state as \`StateFlow<[Name]UiState>\` — never \`LiveData\`.'),
    stateflow ? '- Expose one-shot navigation/events as \`SharedFlow<NavigationEvent>\` — separate from UiState.' : null,
    rule(noAndVM,   'No Android framework imports in ViewModel (\`Context\`, \`View\`, \`FragmentManager\` are banned).'),
    '- No direct DataSource calls — always through UseCase or Repository.',
    rule(vmscope,   'All coroutines launched with \`viewModelScope.launch { }\`. Never \`GlobalScope\`.'),
    '- Process user actions via a single \`processIntent(intent: [Name]Intent)\` function.',
  ].filter(Boolean).join('\\n');

  const vmCodeBlock = stateflow ? \`
\\\`\\\`\\\`kotlin
// \\u2705 Correct ViewModel structure
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<NavigationEvent>()
    val navigationEvent: SharedFlow<NavigationEvent> = _navigationEvent.asSharedFlow()

    fun processIntent(intent: LoginIntent) {
        when (intent) {
            is LoginIntent.EmailChanged    -> _uiState.update { it.copy(email = intent.value) }
            is LoginIntent.PasswordChanged -> _uiState.update { it.copy(password = intent.value) }
            is LoginIntent.SubmitLogin     -> submitLogin()
            is LoginIntent.NavigateToRegister -> {
                viewModelScope.launch { _navigationEvent.emit(NavigationEvent.ToRegister) }
            }
        }
    }

    private fun submitLogin() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, generalError = null) }
            loginUseCase(email = _uiState.value.email, password = _uiState.value.password)
                .onSuccess { _navigationEvent.emit(NavigationEvent.ToHome) }
                .onFailure { _uiState.update { s -> s.copy(isLoading = false, generalError = it.message) } }
        }
    }
}
\\\`\\\`\\\`

\\\`\\\`\\\`kotlin
// \\u2705 Correct UiState — data class, all fields have defaults
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val emailError: String? = null,
    val passwordError: String? = null,
    val generalError: String? = null
    // \\u274c Never add navigation flags here: navigateToHome: Boolean = false
)
\\\`\\\`\\\`

\\\`\\\`\\\`kotlin
// \\u2705 Correct Intent — sealed class, one subclass per user action
sealed class LoginIntent {
    data class EmailChanged(val value: String) : LoginIntent()
    data class PasswordChanged(val value: String) : LoginIntent()
    object SubmitLogin : LoginIntent()
    object NavigateToRegister : LoginIntent()
}
\\\`\\\`\\\`\` : '';

  const vmAntiPatterns = \`
### Anti-patterns (agent must never write these)

\\\`\\\`\\\`kotlin
// \\u274c Multiple LiveData fields instead of unified state
private val _isLoading = MutableLiveData<Boolean>()
private val _errorMessage = MutableLiveData<String>()
private val _email = MutableLiveData<String>()

// \\u274c Navigation flag inside UiState
data class LoginUiState(val navigateToHome: Boolean = false)

// \\u274c Android import in ViewModel
class LoginViewModel : ViewModel() {
    fun showToast(context: Context) { ... }  // banned
}

// \\u274c Direct DataSource call from ViewModel
class LoginViewModel @Inject constructor(
    private val authRemoteDataSource: AuthRemoteDataSource  // banned — use UseCase
)
\\\`\\\`\\\`\`;

  const coroutinesSection = \`
## Coroutines and Flow

- \\\`Dispatchers.IO\\\` for all database and network operations.
- \\\`Dispatchers.Main\\\` is the default in \\\`viewModelScope\\\` — no need to specify for UI updates.
\${noGlobal ? '- Never use \`GlobalScope\` — always scope to \`viewModelScope\` or a DI-provided \`CoroutineScope\`.' : ''}
- Never use \\\`Thread.sleep()\\\` — use \\\`delay()\\\`.
- Cold-to-warm flows: \\\`stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initialValue)\\\`.
- Repository functions return \\\`Result<T>\\\` — never throw across layer boundaries.

\\\`\\\`\\\`kotlin
// \\u2705 Correct repository suspend function
suspend fun login(email: String, password: String): Result<User> = runCatching {
    val response = apiService.login(LoginRequest(email, password))
    response.toDomain()
}

// \\u274c Callback-based (legacy — do not add new ones)
fun login(email: String, onSuccess: (User) -> Unit, onError: (Throwable) -> Unit)
\\\`\\\`\\\`\`;

  const composeRules = [
    rule(stateless, 'Composables are **stateless** — receive state as parameters, emit events via lambda callbacks.'),
    rule(noLogic,   'No business logic inside \`@Composable\` functions.'),
    '- No ViewModel access inside composables — hoist to screen-level composable only.',
    rule(lifecycle, 'Use \`collectAsStateWithLifecycle()\` — not \`collectAsState()\`.'),
    rule(m3,        'Material 3 components only. No Material 2 imports in new screens.'),
    '- Previews use \`@PreviewLightDark\` or \`@Preview(showBackground = true)\`.',
  ].filter(Boolean).join('\\n');

  const composeCodeBlock = \`
\\\`\\\`\\\`kotlin
// \\u2705 Correct Screen composable — stateless, ViewModel at top level only
@Composable
fun LoginScreen(
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.navigationEvent.collect { event ->
            when (event) {
                NavigationEvent.ToHome -> navController.navigate(NavRoutes.HOME)
            }
        }
    }

    LoginContent(uiState = uiState, onIntent = viewModel::processIntent)
}

// \\u2705 Pure content composable — no ViewModel, fully testable
@Composable
fun LoginContent(
    uiState: LoginUiState,
    onIntent: (LoginIntent) -> Unit
) { ... }

// \\u274c ViewModel inside a non-screen composable
@Composable
fun LoginButton() {
    val viewModel: LoginViewModel = hiltViewModel()  // banned — hoist to screen level
}
\\\`\\\`\\\`\`;

  const resourceRules = [
    rule(strings,  'All user-visible text in \`strings.xml\`. No hardcoded strings in code or layouts.'),
    rule(noHex,    'Colors: \`?attr/colorPrimary\` in XML, \`MaterialTheme.colorScheme.*\` in Compose. Never hardcode hex values.'),
    rule(noMagic,  'Dimensions: use \`dimens.xml\` or design token system. No magic number \`dp\` values inline.'),
    rule(vectors,  'Drawables: vector XML only (\`VectorDrawable\`). No raster PNG/JPG unless strictly required by brand asset.'),
  ].filter(Boolean).join('\\n');

  return \`# Conventions
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads this and follows it exactly. Never modifies it.
# These rules override the defaults in CLAUDE.md where they conflict.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: follow every convention in this file exactly. These are non-negotiable.
> When in doubt between two approaches, the one described here wins.

---

## Kotlin Core Rules

\${coreRules}
\${coreAntiPatterns}

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes, Objects, Interfaces | PascalCase | \\\`LoginViewModel\\\`, \\\`AuthRepository\\\` |
| Functions, Properties | camelCase, verb-first for functions | \\\`loadUser()\\\`, \\\`onLoginClicked()\\\` |
| Constants | \\\`SCREAMING_SNAKE_CASE\\\` in \\\`companion object\\\` | \\\`MAX_RETRY_COUNT\\\` |
| Resource IDs — Views | \\\`type_description\\\` | \\\`tv_title\\\`, \\\`btn_submit\\\`, \\\`iv_avatar\\\` |
| Resource IDs — Layouts | \\\`fragment_name\\\` / \\\`item_name\\\` | \\\`fragment_login\\\`, \\\`item_order\\\` |
| Drawables | \\\`ic_name\\\` (icons), \\\`bg_name\\\` (backgrounds) | \\\`ic_back\\\`, \\\`bg_card\\\` |
| String resources | \\\`module_element_description\\\` | \\\`login_error_invalid_email\\\` |
| Test files | \\\`[SourceClass]Test\\\` | \\\`LoginViewModelTest\\\` |
| Test functions | \\\`functionName_scenario_expectedResult\\\` | \\\`onLoginClicked_invalidEmail_showsError\\\` |

---

## Package Structure (per feature module)

\\\`\\\`\\\`
\${pkg}.feature.[name]/
├── ui/
│   ├── [Name]Fragment.kt          (XML screens — legacy only)
│   ├── [Name]Screen.kt            (Compose screens — new screens)
│   ├── [Name]ViewModel.kt
│   ├── [Name]UiState.kt           (data class with default values)
│   └── [Name]Intent.kt            (sealed class — one per user action)
├── domain/
│   ├── model/                     (pure Kotlin entities — no Android imports)
│   └── usecase/                   (one class per use case)
└── data/
    ├── [Name]Repository.kt        (interface in domain, impl here)
    ├── remote/
    │   ├── [Name]RemoteDataSource.kt
    │   └── [Name]ApiService.kt    (Retrofit interface)
    └── local/
        └── [Name]LocalDataSource.kt
\\\`\\\`\\\`

---

## ViewModel Conventions

\${vmRules}
\${vmCodeBlock}
\${vmAntiPatterns}

---
\${coroutinesSection}

---

## Jetpack Compose (new screens only)

\${composeRules}
\${composeCodeBlock}

---

## Resources

\${resourceRules}

---

## Dependency Injection (Hilt)

- All ViewModels: \\\`@HiltViewModel\\\` + \\\`@Inject constructor\\\`. No manual instantiation.
- All repositories and data sources: \\\`@Inject constructor\\\`. No \\\`companion object\\\` factories.
- DI module files live in \\\`di/\\\` package inside each feature or core module.
- Repositories scoped \\\`@Singleton\\\`. ViewModels are automatically scoped by Hilt.
- No \\\`@ActivityScoped\\\` or \\\`@FragmentScoped\\\` for business logic — only for UI-bound resources.

\\\`\\\`\\\`kotlin
// \\u2705 Correct Hilt module
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAuthRepository(impl: AuthRepositoryImpl): AuthRepository = impl

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): AuthApiService =
        retrofit.create(AuthApiService::class.java)
}
\\\`\\\`\\\`

---

## Quality Gate

> Agent: run this checklist on every file you create or modify (Step 6b).
> For each failure: fix it before writing the completion report.

| Check | Rule |
|-------|------|
\${[
  qgNoBang      ? '| No \`!!\` operators | Use \`?.let {}\`, \`?: return\`, or \`requireNotNull(x) { "message" }\` |' : null,
  qgNoLivedata  ? '| No new \`LiveData\` | New state uses \`StateFlow\` only |' : null,
  qgNoGlobal    ? '| No \`GlobalScope\` | All coroutines in \`viewModelScope\` (or \`lifecycleScope\` for one-shot UI ops) |' : null,
  qgNoStrings   ? '| No hardcoded strings | All user-visible text in \`strings.xml\` |' : null,
  qgNoHardRes   ? '| No hardcoded colors or dimensions | Use theme attributes or \`dimens.xml\` |' : null,
  qgSealed      ? '| Sealed types are exhaustive | No \\\`else\\\` on \\\`when\\\` over sealed class/interface |' : null,
  qgNoLogicUI   ? '| No business logic in UI layer | Composables, Fragments, Activities call ViewModel only |' : null,
  qgVmNoAndroid ? '| ViewModel has no Android imports | No \\\`Context\\\`, \\\`View\\\`, \\\`FragmentManager\\\` in ViewModel |' : null,
  qgNoDtoUI     ? '| DTOs/Entities not exposed to UI | Repository returns domain models only |' : null,
  qgTestNaming  ? '| Tests follow naming convention | \\\`functionName_scenario_expectedResult\\\` |' : null,
  ...(qgExtra ? qgExtra.split('\\n').map(l => l.trim()).filter(Boolean).map(l => '| ' + l + ' | — |') : []),
].filter(Boolean).join('\\n')}
\`;
}

// ══════════════════════════════════════════════════════
//  MIGRATIONS STEP
// ══════════════════════════════════════════════════════
function buildMigrationsScreen(fp) {
  const legacyPatterns = [
    { id: 'java',      label: 'Java files exist in codebase',       sub: 'Mixed Java/Kotlin project' },
    { id: 'livedata',  label: 'LiveData used in ViewModels',         sub: 'Legacy state management' },
    { id: 'rxjava',    label: 'RxJava chains exist',                sub: 'Legacy async' },
    { id: 'mvp',       label: 'MVP / MVC Presenters exist',         sub: 'Legacy architecture' },
    { id: 'nvm',       label: 'Fragments with no ViewModel',        sub: 'Business logic in Fragment' },
    { id: 'retrofit',  label: 'Direct Retrofit calls (no DataSource)', sub: 'No repository layer' },
    { id: 'sharedpref',label: 'SharedPreferences in use',           sub: 'Legacy preferences' },
    { id: 'asynctask', label: 'AsyncTask exists',                   sub: 'Deprecated threading' },
  ];

  fp.innerHTML += \`
  <div class="step-screen" id="screen-migrations">
    <div class="callout callout-info" style="margin-bottom:20px">
      <strong>Despite the name, this file does not tell the agent to migrate anything.</strong><br>
      It tells the agent what to do when a task lands it inside a file that still uses legacy patterns —
      keep the old code untouched, use the modern pattern only for new lines it adds, and log any
      violations it notices but didn't touch in the completion report.
    </div>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">
      Toggle each legacy pattern that exists in your codebase. The agent will apply these guard rules automatically when touching files with those patterns.
    </p>
    <div class="form-section">
      <h3>Legacy Patterns Present</h3>
      <div class="dynamic-list">
        \${legacyPatterns.map(p => \`
        <div class="dynamic-item" style="padding:10px 12px">
          <div class="toggle-row" style="margin-bottom:0">
            <div>
              <div class="toggle-label">\${p.label}</div>
              <div class="toggle-sub">\${p.sub}</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="mig-\${p.id}" onchange="toggleMigScope('\${p.id}'); updatePreview('migrations')">
              <div class="toggle-track"></div><div class="toggle-thumb"></div>
            </label>
          </div>
          <div id="mig-scope-row-\${p.id}" style="display:none;margin-top:8px">
            <input type="text" id="mig-scope-\${p.id}" placeholder="Affected modules — e.g. :app, :feature-order" oninput="updatePreview('migrations')" style="width:100%;font-size:12px">
          </div>
        </div>\`).join('')}
      </div>
    </div>
    <div class="form-section" style="margin-top:24px">
      <h3>Custom Rules <span style="font-size:12px;font-weight:400;color:var(--text-muted)">— project-specific patterns not covered above</span></h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">
        Add any rule the agent should follow when touching files with your own legacy or project-specific patterns — e.g. a custom image loader, an internal networking layer, or a design system component.
      </p>
      <div class="dynamic-list" id="custom-rules-list"></div>
      <button class="btn btn-secondary" style="margin-top:8px" onclick="addCustomRuleRow()">+ Add Custom Rule</button>
      <input type="hidden" id="custom-rule-count" value="0">
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateMigrationsMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('migrations')">💾 Save MIGRATION_RULES.md</button>
      <button class="btn btn-secondary" onclick="goTo('modules')">Next →</button>
    </div>
  </div>\`;
}

let customRuleCounter = 0;
function addCustomRuleRow(defaults = {}) {
  const id = ++customRuleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'custom-rule-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('custom-rule-row-\${id}').remove(); updatePreview('migrations'); saveDraft()">✕</button>
    <div class="form-row">
      <label>Rule title</label>
      <input type="text" id="custom-rule-title-\${id}" value="\${esc(defaults.title||'')}" placeholder="e.g. Glide → Coil, Custom Logger" oninput="updatePreview('migrations');saveDraft()" style="font-size:13px">
    </div>
    <div class="form-row">
      <label style="align-self:flex-start;padding-top:4px">Rule body</label>
      <textarea id="custom-rule-body-\${id}" rows="4" placeholder="Describe what the agent should do when touching files that use this pattern. Use the same style as the rules above — bullet points work well." oninput="updatePreview('migrations');saveDraft()" style="font-size:12px;font-family:var(--mono);resize:vertical;width:100%">\${esc(defaults.body||'')}</textarea>
    </div>\`;
  document.getElementById('custom-rules-list').appendChild(row);
  const countEl = document.getElementById('custom-rule-count');
  if (countEl) { countEl.value = customRuleCounter; saveDraft(); }
}

function toggleMigScope(id) {
  const checked = document.getElementById('mig-' + id)?.checked;
  const row = document.getElementById('mig-scope-row-' + id);
  if (row) row.style.display = checked ? 'block' : 'none';
}

function generateNewScreensTable() {
  const ui      = getRadio('ui')   || 'Jetpack Compose';
  const di      = getRadio('di')   || 'Hilt';
  const arch    = getRadio('arch') || 'MVVM';
  const asyncLibs = getPills('async');
  const stateLibs = getPills('state');

  const uiRule = ui === 'XML'    ? 'XML Layouts (View system)'
               : ui === 'Mixed'  ? 'Jetpack Compose for new screens — no new XML layouts'
               :                   'Jetpack Compose + Material 3';

  const stateRule = stateLibs.includes('StateFlow')
    ? '\`StateFlow\` for state, \`SharedFlow\` for one-shot events'
    : stateLibs[0] ? stateLibs[0] : '\`StateFlow\` for state, \`SharedFlow\` for one-shot events';
  const vmRule = (arch === 'Clean+MVI' || arch === 'Clean Architecture')
    ? \`MVI — \${stateRule}\`
    : \`MVVM — \${stateRule}\`;

  const asyncRule = asyncLibs.includes('Coroutines') || asyncLibs.includes('Coroutines+Flow')
    ? 'Coroutines + Flow only'
    : asyncLibs[0] ? asyncLibs[0] : 'Coroutines + Flow only';

  const diRule = di === 'Hilt'   ? \`Hilt — \\\`@HiltViewModel\\\`, \\\`@Singleton\\\` for repositories\`
               : di === 'Koin'   ? \`Koin — \\\`viewModel { }\\\`, single-scoped repositories\`
               : di === 'Dagger' ? \`Dagger — component-scoped ViewModel and repository bindings\`
               :                   di;

  const hasDomain = arch === 'Clean Architecture' || arch === 'Clean+MVI';
  const domainRow = hasDomain ? \`| Domain | UseCase(s) per operation |\\n\` : '';

  return \`| Layer | Rule |
|-------|------|
| UI | \${uiRule} |
| ViewModel | \${vmRule} |
\${domainRow}| Data | Repository + RemoteDataSource / LocalDataSource |
| DI | \${diRule} |
| Async | \${asyncRule} |\`;
}

function generateMigrationsMD() {
  const has   = id => document.getElementById('mig-' + id)?.checked;
  const scope = id => { const v = document.getElementById('mig-scope-' + id)?.value.trim(); return v ? \`\\n> **Affected modules:** \${v}\\n\` : ''; };

  const javaBlock = has('java') ? \`
## Java Files
\${scope('java')}
- Do not convert Java to Kotlin unless the task explicitly instructs it.
- When touching a Java file: write new logic in a separate Kotlin file that the Java calls.
- Do not add Kotlin-specific patterns inside \\\`.java\\\` files.
- Fix null-safety issues that the agent's own changes introduce. Not pre-existing ones.

Comment format when adding a TODO near Java code:
\\\`\\\`\\\`java
// TODO [DEBT-XXX]: migrate to Kotlin — [brief reason]
\\\`\\\`\\\`
\` : '';

  const liveDataBlock = has('livedata') ? \`
## LiveData → StateFlow
\${scope('livedata')}
- Do not migrate existing \\\`LiveData\\\` to \\\`StateFlow\\\` unless the task scopes it.
- When touching a ViewModel that uses \\\`LiveData\\\`:
  - Do not change existing \\\`MutableLiveData\\\` declarations.
  - Use \\\`MutableStateFlow\\\` for any new state added by this task.
  - Do not mix \\\`observe()\\\` and \\\`collectAsStateWithLifecycle()\\\` for the same state property.

\\\`\\\`\\\`kotlin
// ❌ Adding new state as LiveData in a task
private val _isLoading = MutableLiveData<Boolean>()  // banned — new state uses StateFlow

// ✅ New state uses StateFlow alongside existing LiveData
private val _legacyUser = MutableLiveData<User>()        // existing — do not touch
private val _isLoading = MutableStateFlow(false)          // new state — StateFlow only
// TODO [DEBT-XXX]: migrate existing LiveData state to StateFlow
\\\`\\\`\\\`
\` : '';

  const rxBlock = has('rxjava') ? \`
## RxJava → Coroutines
\${scope('rxjava')}
- Do not add new RxJava chains. Do not remove existing ones.
- When touching a file with RxJava:
  - Write all new async logic using Coroutines + Flow.
  - If new logic must interact with existing Rx: use \\\`asFlow()\\\` or \\\`awaitFirst()\\\` bridges.

\\\`\\\`\\\`kotlin
// ❌ Adding a new RxJava chain
compositeDisposable.add(
    apiService.getUser(id)
        .subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe({ user -> ... }, { error -> ... })
)

// ✅ New async work uses coroutines; bridge to existing Rx only when required
viewModelScope.launch {
    val user = repository.getUser(id)  // suspend fun — new code
    _uiState.update { it.copy(user = user) }
}
// TODO [DEBT-XXX]: replace existing Rx chain in this file with coroutine
\\\`\\\`\\\`
\` : '';

  const mvpBlock = has('mvp') ? \`
## MVP / MVC → MVVM
\${scope('mvp')}
- Do not rewrite existing Presenters or Controllers.
- When a task adds functionality to an MVP/MVC screen:
  - Create a new ViewModel for the new logic only.
  - Wire the ViewModel alongside the existing Presenter.
  - Do not move existing Presenter logic into the ViewModel.
  - Add comment: \\\`// TODO [DEBT-XXX]: consolidate into ViewModel once Presenter is removed\\\`
\` : '';

  const nvmBlock = has('nvm') ? \`
## Fragment with No ViewModel
\${scope('nvm')}
- Do not add business logic directly to a Fragment.
- When adding state or business logic to a Fragment that has no ViewModel:
  - Create \\\`[FeatureName]ViewModel.kt\\\` in the same package.
  - Put the new logic in the ViewModel.
  - Do not refactor existing Fragment code.
\` : '';

  const retrofitBlock = has('retrofit') ? \`
## Direct Retrofit / API Calls (no Repository or DataSource)
\${scope('retrofit')}
- Do not add more direct API calls in Repositories or ViewModels.
- When touching a file that makes direct Retrofit calls:
  - Do not add more direct calls.
  - If the task requires a new network call: create \\\`[Feature]RemoteDataSource.kt\\\`, call it from the Repository.
  - Do not refactor existing direct calls.
\` : '';

  const sharedPrefBlock = has('sharedpref') ? \`
## SharedPreferences → DataStore
\${scope('sharedpref')}
- Do not add new SharedPreferences usage. Do not remove existing usage.
- When a task requires reading or writing preferences:
  - Use DataStore Preferences for all new preference keys.
  - Do not migrate existing SharedPreferences keys in the same task.
  - Add comment: \\\`// TODO [DEBT-XXX]: migrate key to DataStore\\\`
\` : '';

  const asyncBlock = has('asynctask') ? \`
## AsyncTask
\${scope('asynctask')}
- AsyncTask is deprecated. Never add or extend it.
- When touching a class that contains AsyncTask:
  - Do not add new work to the AsyncTask.
  - Implement new async work as a \\\`suspend fun\\\` called from ViewModel.
  - Add comment: \\\`// TODO [DEBT-XXX]: replace AsyncTask with coroutine\\\`
\` : '';

  const hasAny = ['java','livedata','rxjava','mvp','nvm','retrofit','sharedpref','asynctask'].some(has);

  // Collect custom rules
  const customBlocks = [];
  document.querySelectorAll('[id^="custom-rule-row-"]').forEach(row => {
    const idNum = row.id.replace('custom-rule-row-', '');
    const title = document.getElementById(\`custom-rule-title-\${idNum}\`)?.value.trim();
    const body  = document.getElementById(\`custom-rule-body-\${idNum}\`)?.value.trim();
    if (title || body) customBlocks.push(\`\\n## \${title || 'Custom Rule'}\\n\\n\${body || ''}\\n\`);
  });

  return \`# Migration Rules
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads and applies automatically. Never modifies.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read every rule in this file before touching any file that matches
> the patterns described. Apply rules only to lines you add or the immediate
> surrounding context. Do not refactor untouched code — log it instead.

## The Principle

When a task modifies an existing file, the agent must:
1. Do what the task asks (primary obligation — always)
2. Apply the relevant rules below to lines it adds or the immediate surrounding context
3. NOT refactor the entire file unless the task explicitly scopes it

Agent never "improves" code outside task scope. Diffs stay reviewable. Risk stays controlled.

If the agent notices a violation in code it did not touch, it logs it in the completion
report under "Follow-up recommended" with file and line number — then moves on.

---
\${hasAny ? [javaBlock, liveDataBlock, rxBlock, mvpBlock, nvmBlock, retrofitBlock, sharedPrefBlock, asyncBlock].join('') : '\\n_No legacy patterns selected. Add rules here if legacy code is discovered._\\n'}

## New Screens and Features

All new screens and features use the target architecture. No exceptions.

When a task creates a new screen or feature:

\${generateNewScreensTable()}

No new MVP, MVC, Activities as feature containers\${getRadio('ui') !== 'Compose' ? ', or XML layouts for new screens' : ''}.\${getRadio('arch') === 'MVP' || getRadio('arch') === 'MVC' ? '' : '\\nNo new MVP or MVC patterns.'}

---

## Scope Guard

The agent does not apply migration rules to code it did not add or modify.
If the agent notices a violation in untouched code, it logs it in the completion
report under "Follow-up recommended" with the file path and line number.
It does not touch it.
\${customBlocks.length > 0 ? '\\n---\\n' + customBlocks.join('\\n---\\n') : ''}
\`;
}

// ══════════════════════════════════════════════════════
//  MODULES STEP
// ══════════════════════════════════════════════════════
function buildModulesScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-modules">
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">
      Add one entry per Gradle module or feature package. The agent uses this table to route task keywords to context files.
    </p>
    <div class="dynamic-list" id="modules-list"></div>
    <button class="add-btn" onclick="addModuleRow()" style="margin-top:10px">+ Add Module</button>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateModulesMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('modules')">⚡ Generate &amp; Save MODULE_MAP.md</button>
      <button class="btn btn-secondary" onclick="goTo('debt')">Next →</button>
    </div>
  </div>\`;

  addModuleRow({ name: ':app', path: 'app/src/main/java/', pattern: 'Single Activity', keywords: 'app, main, navhost, startup' });
  addModuleRow({ name: ':feature-auth', path: 'feature/auth/', pattern: 'MVVM', keywords: 'login, logout, auth, session, token' });
}

let moduleCounter = 0;
function addModuleRow(defaults = {}) {
  const id = ++moduleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'module-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('module-row-\${id}').remove(); updatePreview('modules')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Module / Gradle name</label>
        <input type="text" class="mod-name" value="\${esc(defaults.name||'')}" placeholder=":feature-home" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="mod-path" value="\${esc(defaults.path||'')}" placeholder="feature/home/" oninput="updatePreview('modules')"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Language</label>
        <select class="mod-lang" onchange="updatePreview('modules')">
          <option>Kotlin</option><option>Java</option><option>Kotlin + Java</option>
        </select></div>
      <div class="form-row"><label>Pattern</label>
        <select class="mod-pattern" onchange="updatePreview('modules')">
          \${['MVVM','MVP','Clean','Repository','Infrastructure','Single Activity'].map(p =>
            \`<option\${(defaults.pattern||'MVVM')===p?' selected':''}>\${p}</option>\`).join('')}
        </select></div>
      <div class="form-row"><label>DI</label>
        <select class="mod-di" onchange="updatePreview('modules')">
          <option>Hilt</option><option>Dagger</option><option>Manual</option><option>None</option>
        </select></div>
    </div>
    <div class="form-row"><label>Keywords (comma-separated — used to route tasks)</label>
      <input type="text" class="mod-keywords" value="\${esc(defaults.keywords||'')}" placeholder="home, dashboard, feed, landing" oninput="updatePreview('modules')"></div>
    <div class="form-row"><label>Purpose (one sentence)</label>
      <input type="text" class="mod-purpose" value="\${esc(defaults.purpose||'')}" placeholder="Main dashboard shown after login" oninput="updatePreview('modules')"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Key classes (comma-separated)</label>
        <input type="text" class="mod-keyclasses" value="\${esc(defaults.keyClasses||'')}" placeholder="HomeViewModel, HomeRepository" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Depends on</label>
        <input type="text" class="mod-depends" value="\${esc(defaults.depends||'')}" placeholder=":core, :libs:network" oninput="updatePreview('modules')"></div>
    </div>
  \`;
  document.getElementById('modules-list').appendChild(row);
  updatePreview('modules');
}

function generateModulesMD() {
  const rows = Array.from(document.querySelectorAll('[id^="module-row-"]'));
  const moduleBlocks = rows.map(row => {
    const name       = row.querySelector('.mod-name')?.value.trim() || '[module]';
    const path       = row.querySelector('.mod-path')?.value.trim() || '[path]';
    const lang       = row.querySelector('.mod-lang')?.value || 'Kotlin';
    const pattern    = row.querySelector('.mod-pattern')?.value || 'MVVM';
    const di         = row.querySelector('.mod-di')?.value || 'Hilt';
    const purpose    = row.querySelector('.mod-purpose')?.value.trim() || '[describe purpose]';
    const keyClasses = row.querySelector('.mod-keyclasses')?.value.trim() || '[fill in]';
    const depends    = row.querySelector('.mod-depends')?.value.trim() || '[fill in]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';

    return \`### \${name}

| Field | Value |
|-------|-------|
| Path | \\\`\${path}\\\` |
| Language | \${lang} |
| Pattern | \${pattern} |
| DI | \${di} |
| Purpose | \${purpose} |
| Key classes | \${keyClasses} |
| Depends on | \${depends} |
| Context file | \\\`\${contextFile}\\\` |
| Known debt | see \\\`TECH_DEBT.md#\${name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}\\\` |

---\`;
  }).join('\\n\\n');

  return \`# Module Map
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED after initial wizard generation. Edit directly to update modules.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: route via \\\`context/_index.md\\\` (the keyword → context-file table) to decide
> which modules a task touches. Then come here for each module's \\\`Path\\\`, \\\`Key classes\\\`,
> and \\\`Known debt\\\` anchor, and read only the source files the context file references.
> Never skip the routing step.

## How the Agent Uses This File

1. After routing via \\\`context/_index.md\\\`, come here for module paths, key classes, and debt anchors.
2. If a context file is missing: use \\\`Key classes\\\` to identify the 5–8 source files to read.
3. After completing a task on a new module: generate \\\`context/<module>.md\\\` via \\\`context/TEMPLATE.md\\\`,
   then add a routing row to \\\`context/_index.md\\\`.

**Routing lives in \\\`context/_index.md\\\`, not here.**
Keywords are intentionally NOT duplicated in this file — they live only in
\\\`context/_index.md\\\` to avoid drift. This file is the registry (paths, key classes,
debt anchors); \\\`_index.md\\\` is the router (keyword → context file).

---

## Module Index

\${moduleBlocks || '_No modules added yet._'}

<!-- Add one entry per module using the format above.
     Keywords live only in context/_index.md — add a routing row there for the
     agent. Do not add a Keywords field here (single source of truth = _index.md). -->
\`;
}

function generateIndexMD() {
  const rows = Array.from(document.querySelectorAll('[id^="module-row-"]'));
  const tableRows = rows.map(row => {
    const name     = row.querySelector('.mod-name')?.value.trim() || '[module]';
    const keywords = row.querySelector('.mod-keywords')?.value.trim() || '[add keywords]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';
    return \`| \${keywords} | \${name} | \\\`\${contextFile}\\\` |\`;
  }).join('\\n');

  return \`# Context Index
# ─────────────────────────────────────────────────────────────────────────────
# THIS IS THE AUTHORITATIVE ROUTING TABLE.
# Agent uses this table to decide which context/<module>.md files to load.
# spec-kit/MODULE_MAP.md is the module registry (metadata); this file routes.
# ─────────────────────────────────────────────────────────────────────────────

## How to Use (Agent)

1. Read the task MD: description, acceptance criteria, affected areas.
2. Match task keywords against the Keywords column in this file.
3. Load every context file that matches before reading any source files.
4. If no match: check \\\`spec-kit/MODULE_MAP.md\\\` by package/module name for richer metadata.
5. If still no match: read 5–8 key source files, then generate a context file afterward.

For tasks touching >1 module: load ALL matching context files, then proceed.

---

## Keyword Routing Table

| Keywords | Module | Context File |
|----------|--------|--------------|
\${tableRows || '| [keywords] | [module] | \`context/[module].md\` |'}

<!-- Add a row here whenever you add a new context/<module>.md file.
     Do NOT put routing logic in MODULE_MAP.md — this file is the single routing source of truth. -->

---

## Notes for Humans

- This file and \\\`spec-kit/MODULE_MAP.md\\\` serve different roles:
  - \\\`_index.md\\\` (this file) — agent routing table: keyword → context file
  - \\\`MODULE_MAP.md\\\` — module registry: path, pattern, DI, key classes, debt anchor
- Keep both in sync when adding a new module.
\`;
}

// ══════════════════════════════════════════════════════
//  TECH DEBT STEP
// ══════════════════════════════════════════════════════
function buildDebtScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-debt">
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">
      Document known legacy patterns, workarounds, and code smells. The agent loads these rules and avoids replicating the debt.
    </p>
    <div class="dynamic-list" id="debt-list"></div>
    <button class="add-btn" onclick="addDebtRow()" style="margin-top:10px">+ Add Debt Entry</button>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateDebtMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('debt')">💾 Save TECH_DEBT.md</button>
      <button class="btn btn-secondary" onclick="goTo('testing')">Next →</button>
    </div>
  </div>\`;
  addDebtRow({ title: 'Example — replace with real debt', module: ':app', status: 'OPEN' });
}

let debtCounter = 0;
function addDebtRow(defaults = {}) {
  const id = ++debtCounter;
  const num = String(id).padStart(3, '0');
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'debt-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('debt-row-\${id}').remove(); updatePreview('debt')">✕</button>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">DEBT-\${num}</span>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Title</label>
        <input type="text" class="debt-title" value="\${esc(defaults.title||'')}" placeholder="LoginViewModel uses LiveData instead of StateFlow" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Module</label>
        <input type="text" class="debt-module" value="\${esc(defaults.module||'')}" placeholder=":feature-auth" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Status</label>
        <select class="debt-status" onchange="updatePreview('debt')">
          <option value="OPEN"\${(defaults.status||'OPEN')==='OPEN'?' selected':''}>OPEN</option>
          <option value="SCHEDULED"\${defaults.status==='SCHEDULED'?' selected':''}>SCHEDULED</option>
          <option value="RESOLVED"\${defaults.status==='RESOLVED'?' selected':''}>RESOLVED</option>
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
  \`;
  document.getElementById('debt-list').appendChild(row);
  updatePreview('debt');
}

function generateDebtMD() {
  const rows = Array.from(document.querySelectorAll('[id^="debt-row-"]'));
  const byModule = {};
  rows.forEach((row, i) => {
    const module   = row.querySelector('.debt-module')?.value.trim() || ':app';
    const title    = row.querySelector('.debt-title')?.value.trim() || '[describe debt]';
    const status   = row.querySelector('.debt-status')?.value || 'OPEN';
    const location = row.querySelector('.debt-location')?.value.trim() || '[file path]';
    const impact   = row.querySelector('.debt-impact')?.value.trim() || '[impact]';
    const rule     = row.querySelector('.debt-rule')?.value.trim() || '[agent rule]';
    const ticket   = row.querySelector('.debt-ticket')?.value.trim() || '—';
    const num      = String(i + 1).padStart(3, '0');
    // sync badge label to current position
    const badge = row.querySelector('span[style*="color:var(--accent)"]');
    if (badge) badge.textContent = 'DEBT-' + num;
    if (!byModule[module]) byModule[module] = [];
    byModule[module].push({ num, title, status, location, impact, rule, ticket });
  });

  const moduleBlocks = Object.entries(byModule).map(([mod, entries]) => {
    const anchor = mod.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return \`## \${mod} {#\${anchor}}\\n\\n\` + entries.map(e => \`### DEBT-\${e.num} — \${e.title}

| Field | Value |
|-------|-------|
| Status | \${e.status} |
| Location | \\\`\${e.location}\\\` |
| Impact | \${e.impact} |
| Agent rule | \${e.rule} |
| Scheduled ticket | \${e.ticket} |\`).join('\\n\\n');
  }).join('\\n\\n---\\n\\n');

  return \`# Tech Debt Register
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads only the sections for modules a task touches.
# Never modifies this file. Debt surfaced during tasks is reported in the
# completion report — a human decides whether to add it here.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: load only the module sections relevant to the current task.
> For every OPEN or SCHEDULED entry in scope: do not replicate the pattern,
> do not remove the workaround unless the task explicitly scopes it.
> When you discover new debt, report it in the completion report — do not
> add it to this file.

## Status Legend

| Status | Meaning |
|--------|---------|
| OPEN | Exists in codebase. Not yet scheduled. |
| SCHEDULED | Assigned to a ticket. See "Scheduled ticket" field. |
| RESOLVED | Fixed. Entry kept for history. |

## How the Agent Uses This File

- Load only sections for modules touched by the current task.
- For each OPEN or SCHEDULED entry in scope: do not replicate the pattern, do not
  remove the workaround unless the task explicitly scopes it.
- Log new debt discovered during task execution in the completion report.
  Do not add entries to this file — a human reviews and decides.

---

\${moduleBlocks || '_No debt entries added. Add entries as discovered._'}

---

## Resolved {#resolved}

<!-- Move entries here when fixed. Keep for historical reference. -->
\`;
}

// ══════════════════════════════════════════════════════
//  TESTING STEP
// ══════════════════════════════════════════════════════
function buildTestingScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-testing">

    <div class="form-section">
      <h3>Test Frameworks</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        \${[
          ['test-runner',   'Test Runner',    'JUnit 4', ['JUnit 4','JUnit 5','TestNG']],
          ['mocking',       'Mocking',        'MockK',   ['MockK','Mockito','None']],
          ['flow-test',     'Flow/StateFlow', 'Turbine', ['Turbine','None']],
          ['assertions',    'Assertions',     'Truth',   ['Truth','AssertJ','JUnit Assert','None']],
          ['coroutines-test','Coroutines Test','kotlinx-coroutines-test',['kotlinx-coroutines-test','None']],
          ['ui-test',       'UI Tests',       'Espresso',['Espresso','Compose UI Test','None']],
        ].map(([id, label, def, opts]) => \`
        <div class="form-row">
          <label>\${label}</label>
          <select id="test-\${id}" onchange="updatePreview('testing')">
            \${opts.map(o => \`<option\${o===def?' selected':''}>\${o}</option>\`).join('')}
          </select>
        </div>\`).join('')}
      </div>
    </div>

    <div class="form-section">
      <h3>Coverage Targets</h3>
      \${[
        ['vm',      'ViewModel',        '80'],
        ['usecase', 'UseCase',          '90'],
        ['repo',    'Repository',       '70'],
        ['util',    'Utility functions','80'],
      ].map(([id, label, def]) => \`
      <div class="slider-row">
        <label>\${label}</label>
        <input type="range" id="cov-\${id}" min="0" max="100" value="\${def}" oninput="document.getElementById('cov-val-\${id}').textContent=this.value+'%'; updatePreview('testing')">
        <span class="slider-val" id="cov-val-\${id}">\${def}%</span>
      </div>\`).join('')}
    </div>

    <div class="form-section">
      <h3>Testing Rules</h3>
      <div class="dynamic-list">
        \${[
          ['test-rule-one-class', 'One class per test file', 'LoginViewModelTest tests only LoginViewModel', true],
          ['test-rule-no-sleep',  'No Thread.sleep() in tests', 'Use advanceUntilIdle() instead', true],
          ['test-rule-no-blocking','No runBlocking in tests', 'Use runTest from kotlinx-coroutines-test', true],
          ['test-rule-no-mock-data','Never mock data classes', 'Mock interfaces and abstract classes only', true],
          ['test-rule-verify-sparingly','Use verify() sparingly', 'Only when testing side effects, not by default', true],
        ].map(([id, label, sub, checked]) => \`
        <div class="toggle-row">
          <div><div class="toggle-label">\${label}</div><div class="toggle-sub">\${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="\${id}" \${checked?'checked':''} onchange="updatePreview('testing')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>\`).join('')}
      </div>
    </div>

    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateTestingMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('testing')">💾 Save TESTING.md</button>
      <button class="btn btn-secondary" onclick="goTo('datamodel')">Next →</button>
    </div>
  </div>\`;
}

function generateTestingMD() {
  const fw = id => document.getElementById('test-' + id)?.value || '';
  const cov = id => document.getElementById('cov-' + id)?.value || '80';
  const rule = id => document.getElementById(id)?.checked;

  const fwTable = [
    ['Unit test runner', fw('test-runner')],
    ['Mocking', fw('mocking')],
    ['Flow / StateFlow testing', fw('flow-test')],
    ['Assertions', fw('assertions')],
    ['Coroutines test', fw('coroutines-test')],
    ['UI tests', fw('ui-test')],
  ].map(([p, l]) => \`| \${p} | \${l} | [version] |\`).join('\\n');

  const rules = [
    rule('test-rule-one-class')       && '**One class per test file.** \`LoginViewModelTest\` tests only \`LoginViewModel\`.',
    rule('test-rule-no-sleep')        && 'Never use \`Thread.sleep()\` — use \`advanceUntilIdle()\` to drain coroutines.',
    rule('test-rule-no-blocking')     && 'Use \`runTest\` from \`kotlinx-coroutines-test\` — never \`runBlocking\`.',
    rule('test-rule-no-mock-data')    && 'Mock interfaces and abstract classes. Never mock data classes or concrete implementations.',
    rule('test-rule-verify-sparingly')&& "Use \`verify\` to assert interaction counts only when testing side effects. Don't add \`verify\` to every test.",
  ].filter(Boolean).map(r => \`- \${r}\`).join('\\n');

  return \`# Testing Standards
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads this whenever a task requires writing tests.
# Never modifies. Overrides defaults in CLAUDE.md.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read this file in full before writing any test. Follow every rule
> exactly. Do not write tests for code you did not add or modify in this task.
> One test class per source class — no exceptions.

## Framework Stack

| Purpose | Library | Version |
|---------|---------|---------|
\${fwTable}

<!-- Update versions to match your project's build.gradle -->

---

## Unit Test Rules

**What to test:**
- Every ViewModel (state transitions, event emissions, error paths)
- Every UseCase (business logic, validation, mapping)
- Every Repository (caching strategy, error handling)
- Every non-trivial utility function

**What NOT to test:**
- Android framework classes directly (Activity, Fragment, Service)
- Data classes with no logic
- Trivial wrappers with no branching logic
- Code you did not write or modify in this task

**One class per test file.** \\\`LoginViewModelTest\\\` tests only \\\`LoginViewModel\\\`.

\${rules}

### Test Function Naming — \\\`functionName_scenario_expectedResult\\\`

\\\`\\\`\\\`kotlin
// ✅ Correct
fun onLoginClicked_withInvalidEmail_showsEmailError()
fun onLoginClicked_withValidCredentials_emitsNavigateToHome()
fun loadUser_whenNetworkFails_showsErrorState()

// ❌ Wrong — no scenario, no expected result
fun testLogin()
fun shouldWorkCorrectly()
fun loginTest()
\\\`\\\`\\\`

---

## Flow / StateFlow Testing

- Always use \${fw('flow-test') !== 'None' ? fw('flow-test') : 'a Flow testing library'} for testing Flows and Channels.
- Use \\\`runTest\\\` from \\\`kotlinx-coroutines-test\\\` — never \\\`runBlocking\\\`.
- Use \\\`advanceUntilIdle()\\\` to drain pending coroutines before asserting state.
- Never use \\\`Thread.sleep()\\\` or \\\`delay()\\\` in tests.

\\\`\\\`\\\`kotlin
// ✅ Turbine for SharedFlow events
viewModel.navigationEvent.test {
    viewModel.processIntent(LoginIntent.SubmitLogin)
    assertThat(awaitItem()).isEqualTo(NavigationEvent.ToHome)
    cancelAndIgnoreRemainingEvents()
}

// ✅ StateFlow assertion after coroutine drains
viewModel.processIntent(LoginIntent.SubmitLogin)
advanceUntilIdle()
assertThat(viewModel.uiState.value.isLoading).isFalse()

// ❌ Never block the thread
Thread.sleep(500)
assertThat(viewModel.uiState.value.isLoading).isFalse()
\\\`\\\`\\\`

---

## Mocking Rules

- **\${fw('mocking')} only.**\${fw('mocking') === 'MockK' ? ' Do not use Mockito.' : ''}
- Mock interfaces and abstract classes. Never mock data classes or concrete implementations.
- Use \\\`coEvery\\\` for suspend functions, \\\`every\\\` for regular functions.
- Use \\\`verify\\\` to assert interaction counts only when testing side effects. Don't add it to every test.

\\\`\\\`\\\`kotlin
// ✅ Mock the interface, not the implementation
private val repository: AuthRepository = mockk()  // interface ✅

// ❌ Never mock a data class or concrete class
private val user: User = mockk()                    // data class — banned

// ✅ coEvery for suspend functions
coEvery { repository.login(any(), any()) } returns Result.success(fakeUser())

// ✅ verify only for side-effect tests
verify(exactly = 1) { analyticsTracker.trackLogin() }
\\\`\\\`\\\`

---

## Test File Location

| Source file | Test file |
|-------------|-----------|
| \\\`app/src/main/.../LoginViewModel.kt\\\` | \\\`app/src/test/.../LoginViewModelTest.kt\\\` |
| \\\`feature/auth/.../AuthRepository.kt\\\` | \\\`feature/auth/src/test/.../AuthRepositoryTest.kt\\\` |

---

## Coverage Expectations

| Layer | Minimum |
|-------|---------|
| ViewModel | \${cov('vm')}% |
| UseCase | \${cov('usecase')}% |
| Repository | \${cov('repo')}% |
| Utility functions | \${cov('util')}% |

These are targets for new code written in tasks. Pre-existing untouched code
is not subject to these targets per task.
\`;
}

// ══════════════════════════════════════════════════════
//  DATA MODEL STEP
// ══════════════════════════════════════════════════════
function buildDataModelScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-datamodel">

    <div class="form-section">
      <h3>Domain Entities</h3>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
        Core business objects. API contracts belong in each module's <code>context/</code> file — not here.
      </div>
      <div class="dynamic-list" id="entities-list"></div>
      <button class="add-btn" onclick="addEntityRow()" style="margin-top:8px">+ Add Entity</button>
    </div>

    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateDataModelMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('datamodel')">⚡ Generate &amp; Save DATA_MODEL.md</button>
      <button class="btn btn-secondary" onclick="goTo('done')">Finish ✨</button>
    </div>
  </div>\`;

  addEntityRow({ name: 'User', fields: 'id: String, email: String, displayName: String, createdAt: Long' });
}

let entityCounter = 0;
function addEntityRow(defaults = {}) {
  const id = ++entityCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'entity-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('entity-row-\${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">
      <div class="form-row"><label>Entity Name</label>
        <input type="text" class="entity-name" value="\${esc(defaults.name||'')}" placeholder="User" oninput="updatePreview('datamodel')"></div>
      <div class="form-row"><label>Fields (comma-separated: name: Type)</label>
        <input type="text" class="entity-fields" value="\${esc(defaults.fields||'')}" placeholder="id: String, email: String, createdAt: Long" oninput="updatePreview('datamodel')"></div>
    </div>\`;
  document.getElementById('entities-list').appendChild(row);
  updatePreview('datamodel');
}

let endpointCounter = 0;
function addEndpointRow(defaults = {}) {
  const id = ++endpointCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'endpoint-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('endpoint-row-\${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:120px 1fr;gap:10px">
      <div class="form-row"><label>Method</label>
        <select class="ep-method" onchange="updatePreview('datamodel')">
          <option\${defaults.method==='POST'?' selected':''}>POST</option>
          <option\${defaults.method==='GET'?' selected':''}>GET</option>
          <option\${defaults.method==='PUT'?' selected':''}>PUT</option>
          <option\${defaults.method==='PATCH'?' selected':''}>PATCH</option>
          <option\${defaults.method==='DELETE'?' selected':''}>DELETE</option>
        </select></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="ep-path" value="\${esc(defaults.path||'')}" placeholder="/users/me" oninput="updatePreview('datamodel')"></div>
    </div>
    <div class="form-row"><label>Request body (JSON)</label>
      <textarea class="ep-req" rows="2" placeholder='{"key":"value"}' oninput="updatePreview('datamodel')">\${esc(defaults.reqBody||'')}</textarea></div>
    <div class="form-row"><label>Response 200 (JSON)</label>
      <textarea class="ep-resp" rows="2" placeholder='{"key":"value"}' oninput="updatePreview('datamodel')">\${esc(defaults.respBody||'')}</textarea></div>
    <div class="form-row"><label>Error codes</label>
      <input type="text" class="ep-errors" value="\${esc(defaults.errors||'')}" placeholder="401 unauthorized, 404 not found" oninput="updatePreview('datamodel')"></div>
  \`;
  document.getElementById('endpoints-list').appendChild(row);
  updatePreview('datamodel');
}

function generateDataModelMD() {
  const entities = Array.from(document.querySelectorAll('[id^="entity-row-"]')).map(row => {
    const name   = row.querySelector('.entity-name')?.value.trim() || 'Entity';
    const fields = row.querySelector('.entity-fields')?.value.trim() || 'id: String';
    const parsedFields = fields.split(',').map(f => {
      const parts = f.trim().split(':');
      const fname = (parts[0] || 'field').trim();
      const ftype = (parts[1] || 'String').trim();
      return { fname, ftype };
    });
    const fieldLines = parsedFields.map(({ fname, ftype }) => \`    val \${fname}: \${ftype},\`).join('\\n');
    const fieldTable = parsedFields.map(({ fname, ftype }) => \`| \\\`\${fname}\\\` | \\\`\${ftype}\\\` | [add rule] |\`).join('\\n');
    return \`### \${name}

\\\`\\\`\\\`kotlin
data class \${name}(
\${fieldLines}
)
\\\`\\\`\\\`

| Field | Type | Validation |
|-------|------|-----------|
\${fieldTable}
\`;
  }).join('\\n');

  return \`# Data Model
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED after initial wizard generation. Edit directly to add domain entities.
# API contracts belong in each module's context/ file, not here.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: load this file for tasks involving domain models, Room schema, or layer mapping rules.
> API contracts (request/response shapes) live in context/<module>.md — not here.
> The mapping rules below are non-negotiable — never expose DTOs or Room entities to the UI layer.

---

## Mapping Conventions

Every data type lives in exactly one layer. Mapping always flows inward — never outward.

\\\`\\\`\\\`
Network DTO  ──→  Domain model  ──→  UI model
DB Entity    ──→  Domain model  ──→  UI model
\\\`\\\`\\\`

| Mapping | Where it happens | Class name |
|---------|-----------------|------------|
| Network DTO → Domain model | \\\`*RemoteDataSource.kt\\\` or \\\`*Mapper.kt\\\` | \\\`AuthMapper.kt\\\` |
| DB Entity → Domain model | \\\`*LocalDataSource.kt\\\` or \\\`*Mapper.kt\\\` | \\\`UserMapper.kt\\\` |
| Domain model → UI model | ViewModel or \\\`*UiMapper.kt\\\` | \\\`UserUiMapper.kt\\\` |

### Anti-patterns (agent must never do these)

\\\`\\\`\\\`kotlin
// ❌ Exposing a Room entity directly to the UI layer
class UserRepository {
    fun getUser(): Flow<UserEntity>  // banned — map to domain first
}

// ❌ Exposing a Retrofit DTO to the ViewModel
class AuthRepository {
    suspend fun login(): AuthResponse  // banned — map to domain model
}

// ❌ Domain model with Room annotations
@Entity(tableName = "users")  // banned — domain is pure Kotlin, no Android imports
data class User(val id: String, val email: String)

// ✅ Correct — domain model is pure Kotlin
data class User(val id: String, val email: String)

// ✅ Correct — repository returns domain model
class AuthRepositoryImpl : AuthRepository {
    override suspend fun login(email: String, password: String): Result<User> {
        val response = apiService.login(LoginRequest(email, password))
        return Result.success(response.toDomain())  // map at the boundary
    }
}
\\\`\\\`\\\`

### Mapper pattern

\\\`\\\`\\\`kotlin
// ✅ Extension function mapper — DTO → Domain
fun AuthResponse.toDomain() = User(
    id    = id,
    email = email,
    name  = displayName ?: ""
)

// ✅ Extension function mapper — Room Entity → Domain
fun UserEntity.toDomain() = User(
    id    = id,
    email = email,
    name  = name
)

// ✅ Extension function mapper — Domain → Room Entity
fun User.toEntity() = UserEntity(
    id    = id,
    email = email,
    name  = name
)
\\\`\\\`\\\`

---

## Domain Entities

<!-- Add one section per core entity. Include Kotlin definition and validation rules. -->

\${entities || '_No entities added yet._'}

---

## Database Schema

### AppDatabase

> Note: Never use domain models as Room entities. Always have a separate \\\`*Entity\\\` class.

<!-- Add one table per Room table: column name, type, notes. -->

---

## API Contracts

> API contracts (request/response shapes, error codes, base URLs) live in each module's
> \\\`context/<module>.md\\\` under "What the Agent Should Know".
> Add them there so the agent loads only the contracts relevant to the task at hand.
\`;
}

// ══════════════════════════════════════════════════════
//  PLATFORM config — consumed by wizard-core.js init()
// ══════════════════════════════════════════════════════
const PLATFORM = {
  id:   'android',
  name: 'Android (Kotlin)',

  steps: [
    { id: 'welcome', icon: '👋', label: 'Welcome', file: null },
    {
      id: 'projectconfig', icon: '⚙️', label: 'Project Config', file: 'project.config.md',
      who: 'Tech lead fills once',
      desc: 'Codebase path, platform, package name, build variants, and team preferences. Read by the agent at the start of every session.',
      critical: [
        '<strong>codebase_path must be an absolute path</strong> — the agent resolves every file reference from here. A wrong path means the agent cannot find any source files.',
        'package_name must match the source directory structure, not a variant applicationId. Auto-filled from app/build.gradle.',
        'Build variants are for agent awareness — they prevent the agent from confusing variant applicationIds with the base source package.',
      ],
      mistakes: [
        'Using a variant applicationId (e.g. com.example.app.dev) as package_name instead of the base source package',
        'Leaving codebase_path as a placeholder — the agent cannot find any files without it',
      ],
    },
    {
      id: 'architecture', icon: '🏛️', label: 'Architecture', file: 'spec-kit/ARCHITECTURE.md',
      artifact: true,
      who: 'Wizard generates from form input',
      desc: 'Module structure, navigation, ADRs, patterns, and known violations.',
      critical: [
        'ADRs are the most important part — document <strong>why</strong> each major decision was made, not just what it is. An ADR without a reason is useless.',
        'List known violations (screens that break the pattern). Without this, the agent "fixes" intentional exceptions.',
        'Keep base URLs and auth here — not in DATA_MODEL.md.',
      ],
      mistakes: [
        'Leaving the ADR section empty — the agent will make architectural decisions without context',
        "Documenting only the \\"what\\" (we use MVVM) without the \\"why\\" (because of testability, not because it's default)",
      ],
    },
    {
      id: 'conventions', icon: '📐', label: 'Conventions', file: 'spec-kit/CONVENTIONS.md',
      who: 'Tech lead writes',
      desc: 'Non-negotiable coding standards with ❌/✅ code examples. Every rule the agent must follow exactly.',
      critical: [
        'The <strong>Quality Gate section at the bottom</strong> is read by the agent in Step 6b for every task. Platform teams must replace the Android/Kotlin table with their own checks.',
        'Rules here override CLAUDE.md defaults — use this to make platform-specific exceptions.',
        'Include ❌ anti-patterns alongside ✅ correct patterns. Without the anti-pattern, the agent may not recognise what to avoid.',
      ],
      mistakes: [
        'Forgetting to update the Quality Gate table for non-Android projects',
        'Writing rules without code examples — abstract rules are ignored or misapplied',
      ],
    },
    {
      id: 'migrations', icon: '🔄', label: 'Migration Rules', file: 'spec-kit/MIGRATION_RULES.md',
      who: 'Tech lead writes',
      desc: 'How to handle legacy patterns (LiveData, RxJava, MVP, AsyncTask). Never forces a full migration.',
      critical: [
        '<strong>Scope Guard</strong>: rules apply only to lines the agent adds or the immediate surrounding context — not the whole file. Without this, the agent rewrites everything it touches.',
        "List every legacy pattern that exists in your codebase. If it's not here, the agent may replicate it.",
        'Include the "do not migrate" examples as clearly as the "do migrate" examples.',
      ],
      mistakes: [
        'Omitting a legacy pattern that exists in the codebase — the agent will see it and try to "fix" it',
        'Not specifying scope — "replace LiveData with StateFlow" without the Scope Guard causes whole-file rewrites',
      ],
    },
    {
      id: 'modules', icon: '📦', label: 'Modules', file: 'spec-kit/MODULE_MAP.md',
      artifact: true,
      who: 'Wizard generates from Gradle scan + form input',
      desc: 'Module registry — one entry per Gradle module. Paths, key classes, debt anchors. Agent uses this when no context file exists yet.',
      critical: [
        '<strong>Keywords here are for human reference only.</strong> Actual agent routing uses <code>context/_index.md</code>. Saving this step also auto-generates <code>context/_index.md</code>.',
        'The <code>Key classes</code> field is the fallback when no context file exists — list the 3–6 most important files the agent should read first.',
        'Every module entry must have a matching section in TECH_DEBT.md (same anchor ID) or the cross-reference link will break.',
      ],
      mistakes: [
        'Thinking this file routes the agent — routing is in context/_index.md',
        "Leaving Key classes blank — when context files don't exist yet, the agent has nothing to fall back on",
        'Module name in MODULE_MAP not matching the anchor ID in TECH_DEBT.md',
      ],
    },
    {
      id: 'debt', icon: '🔧', label: 'Tech Debt', file: 'spec-kit/TECH_DEBT.md',
      who: 'Team writes',
      desc: 'Known debt by module with status (OPEN/SCHEDULED/RESOLVED) and precise agent rules per entry.',
      critical: [
        '<strong>The Agent rule field is the most important.</strong> It must be an exact instruction: "do not add more X here, new code uses Y". Vague descriptions ("this is messy") are ignored.',
        'Section anchors (e.g. <code>{#profile}</code>) must exactly match the <code>Known debt</code> links in MODULE_MAP.md. A mismatch means the agent\\'t find the rules.',
        'Agent loads only the sections for modules touched by the current task — keep sections clearly separated.',
      ],
      mistakes: [
        'Writing impact descriptions instead of agent rules — "this causes slowness" vs "do not call X from UI thread, use Y instead"',
        'Anchor ID mismatch with MODULE_MAP — the agent follows the link; if the section is missing, it skips the rules',
      ],
    },
    {
      id: 'testing', icon: '🧪', label: 'Testing', file: 'spec-kit/TESTING.md',
      who: 'Tech lead writes',
      desc: 'Framework stack, ViewModel test pattern with MockK + Turbine, mocking rules, coverage targets per layer.',
      critical: [
        'Test naming convention (<code>functionName_scenario_expectedResult</code>) is enforced by the Quality Gate in every task. Deviating here means the gate will flag all agent-written tests.',
        'Specify which mocking library to use and when — MockK for interfaces, real objects for data classes. Without this, the agent mixes approaches.',
        'Flow testing: explicitly state whether to use Turbine or <code>turbineScope</code>. The agent defaults to whichever it sees first in the codebase.',
      ],
      mistakes: [
        "Leaving coverage targets blank — the agent won't know which layers require tests",
        'Not specifying dispatcher injection pattern — untestable ViewModels result from hardcoded Dispatchers',
      ],
    },
    {
      id: 'datamodel', icon: '🗄️', label: 'Data Model', file: 'spec-kit/DATA_MODEL.md',
      artifact: true,
      who: 'Wizard generates from form input',
      desc: 'Domain entities, API contracts, and field-level notes. Agent loads this for every task touching network, DB, or data models.',
      critical: [
        '<strong>Mapping direction is non-negotiable</strong>: Network DTO → Domain model → UI model. Never expose DTOs to the UI layer. The anti-pattern examples must be here.',
        'Use <strong>Agent note</strong> blocks for fields that must be added, wrong sources to avoid, or nullable gotchas. These notes are read during implementation.',
        'Document "already exists" vs "must be added" for every field in a request body. Ambiguity here causes the agent to either duplicate or skip fields.',
      ],
      mistakes: [
        'Putting base URLs here instead of ARCHITECTURE.md',
        'Documenting only the response, not the request body — the agent needs both for write endpoints',
        'No Agent note for the authoritative source — the agent picks whichever field it sees first',
      ],
    },
    { id: 'done', icon: '✅', label: 'Done', file: null },
  ],

  buildScreens: {
    projectconfig: fp => buildProjectConfigScreen(fp),
    architecture:  fp => buildArchitectureScreen(fp),
    conventions:   fp => buildConventionsScreen(fp),
    migrations:    fp => buildMigrationsScreen(fp),
    modules:       fp => buildModulesScreen(fp),
    debt:          fp => buildDebtScreen(fp),
    testing:       fp => buildTestingScreen(fp),
    datamodel:     fp => buildDataModelScreen(fp),
  },

  generate: {
    projectconfig: () => generateProjectConfigMD(),
    architecture:  () => generateArchitectureMD(),
    conventions:   () => generateConventionsMD(),
    migrations:    () => generateMigrationsMD(),
    modules:       () => generateModulesMD(),
    debt:          () => generateDebtMD(),
    testing:       () => generateTestingMD(),
    datamodel:     () => generateDataModelMD(),
  },

  extraSave: {
    modules: async () => {
      const idx = generateIndexMD();
      await saveFile('context/_index.md', idx);
    },
  },

  onFolderGranted: () => analyzeProject(),

  onDraftRestored: () => {
    renderApproachRows('async');
    renderApproachRows('state');
    refreshModuleChips();
    updateArchProgress();
    // Recreate custom rule rows so restoreDraft can fill their inputs/textareas
    const count = parseInt(document.getElementById('custom-rule-count')?.value || '0', 10);
    for (let i = 0; i < count; i++) addCustomRuleRow();
  },

  onConfigLoaded: (text) => {
    const get    = key => text.match(new RegExp(\`^\${key}:\\\\s*(.+)\`, 'm'))?.[1]?.trim() ?? '';
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

    setVal('cfg-codebase-path', get('codebase_path'));
    setVal('cfg-package',       get('package_name'));
    setVal('cfg-min-sdk',       get('min_sdk'));
    setVal('cfg-target-sdk',    get('target_sdk'));
    setVal('cfg-branch',        get('branch_convention'));

    const platform = get('platform');
    const lang     = get('primary_language');
    const defTests = get('default_tests');
    if (platform) selectPill('cfg-platform', platform, 'radio');
    if (lang)     selectPill('cfg-lang', lang, 'radio');
    if (defTests) selectPill('cfg-tests', defTests, 'radio');

    const variantMatches = [...text.matchAll(/^#\\s{2,4}(\\w+):\\s+(\\S+)(?:\\s+#\\s*(.+))?$/gm)];
    const variants = variantMatches
      .filter(([, name]) => !['Relative','Resolved','All','Use','applicationId'].includes(name))
      .map(([, name, applicationId, note = '']) => ({ name, applicationId, note: note.trim() }));
    if (variants.length > 0) {
      const list = document.getElementById('cfg-variants-list');
      if (list) { list.innerHTML = ''; variantCounter = 0; variants.forEach(v => addVariantRow(v)); }
    }

    const banner = document.getElementById('cfg-existing-banner');
    if (banner) banner.style.display = 'flex';
    updatePreview('projectconfig');
    showToast('Existing project.config.md loaded — review and save or skip', 'success');
  },

  taskDefaults: {
    qualityGate: [
      { id: 'no-bang-bang',    label: 'No \`!!\` operators introduced' },
      { id: 'no-livedata',     label: 'No new \`LiveData\` — new state uses \`StateFlow\`' },
      { id: 'no-globalscope',  label: 'No \`GlobalScope\` — use \`viewModelScope\` or \`lifecycleScope\`' },
      { id: 'no-hardcoded',    label: 'No hardcoded strings, colors, or dimensions' },
      { id: 'exhaustive-when', label: 'All \`when\` on sealed types are exhaustive — no \`else\`' },
      { id: 'no-biz-ui',       label: 'No business logic in UI layer' },
      { id: 'test-naming',     label: 'Tests follow \`functionName_scenario_expectedResult\` naming' },
    ],
  },
};
`;
const EMBEDDED_PLATFORM_IOS = `// ══════════════════════════════════════════════════════
//  platform-ios.js
//  iOS-specific code for the SDD Setup Wizard.
//  Loaded before wizard-core.js.
//  Requires wizard-core.js globals: state, getPills, getRadio,
//  getDraftField, selectPill, pill, tierBadge, infoBtn, esc,
//  updatePreview, saveFile, showToast, tryReadFile, countSourceFiles
// ══════════════════════════════════════════════════════

// ── iOS UI helpers ───────────────────────────────────

function updateArchProgress() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const hasPill = group => document.querySelectorAll(\`[id^="pill-\${group}_"].selected\`).length > 0;

  const coreChecks = [
    hasPill('arch'), hasPill('di'), hasPill('async'),
    hasPill('state'), hasPill('ui'), hasPill('nav'),
  ];
  const hasApproachNote = group =>
    [...document.querySelectorAll(\`#arch-\${group}-detail .approach-card textarea\`)]
      .some(ta => ta.value.trim() !== '');

  const recChecks = [
    hasApproachNote('async'),
    hasApproachNote('state'),
    val('arch-base-url')     !== '',
    val('arch-auth')         !== '',
    val('arch-target-notes') !== '',
  ];
  const optChecks = [
    hasPill('network'),
    hasPill('storage'),
    val('arch-storage-usage') !== '',
    val('arch-img-usage')     !== '',
    val('arch-violations')    !== '',
  ];

  const coreDone  = coreChecks.filter(Boolean).length;
  const recDone   = recChecks.filter(Boolean).length;
  const optDone   = optChecks.filter(Boolean).length;
  const coreTotal = coreChecks.length;
  const recTotal  = recChecks.length;
  const optTotal  = optChecks.length;

  const coreW  = Math.round((coreDone / coreTotal) * 50);
  const recW   = Math.round((recDone  / recTotal)  * 33);
  const optW   = Math.round((optDone  / optTotal)  * 17);
  const emptyW = 100 - coreW - recW - optW;

  const track = document.getElementById('arch-progress-track');
  if (!track) return;
  track.innerHTML = \`
    \${coreW  > 0 ? \`<div class="arch-seg core"        style="flex:\${coreW}"></div>\`  : ''}
    \${recW   > 0 ? \`<div class="arch-seg recommended" style="flex:\${recW}"></div>\`   : ''}
    \${optW   > 0 ? \`<div class="arch-seg optional"    style="flex:\${optW}"></div>\`   : ''}
    \${emptyW > 0 ? \`<div class="arch-seg empty"       style="flex:\${emptyW}"></div>\` : ''}
  \`;
  document.getElementById('arch-progress-core-label').textContent = \`\${coreDone}/\${coreTotal} Core\`;
  document.getElementById('arch-progress-rec-label').textContent  = \`\${recDone}/\${recTotal} Recommended\`;
  document.getElementById('arch-progress-opt-label').textContent  = \`\${optDone}/\${optTotal} Optional\`;

  const hint = document.getElementById('arch-progress-hint');
  if (hint) {
    hint.textContent = coreDone === coreTotal
      ? recDone === recTotal
        ? '★ Fully configured — agent has maximum context.'
        : '✓ Core complete — agent can start. Fill Recommended fields for better output quality.'
      : \`Fill the \${coreTotal - coreDone} remaining Core section\${coreTotal - coreDone > 1 ? 's' : ''} before running tasks.\`;
  }
}

function insertModuleChip(targetId, name) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const start   = el.selectionStart ?? el.value.length;
  const end     = el.selectionEnd   ?? el.value.length;
  const before  = el.value.slice(0, start);
  const prevChar = before.length > 0 ? before[before.length - 1] : '';
  const prefix  = (prevChar !== '' && prevChar !== '\\n' && prevChar !== ' ' && prevChar !== ',') ? ', ' : '';
  const insert  = prefix + name;
  el.value = before + insert + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + insert.length;
  el.focus();
  updatePreview('architecture');
}

function refreshModuleChips() {
  const modules = state.detectedModuleDetails;
  if (!modules || modules.length === 0) return;
  document.querySelectorAll('.module-chips[data-target]').forEach(container => {
    const targetId = container.dataset.target;
    container.innerHTML =
      \`<div class="module-chips-title">Modules</div>\` +
      modules.map(m =>
        \`<span class="mod-chip" onclick="insertModuleChip('\${targetId}','\${m.name}')">\${m.name}</span>\`
      ).join('');
  });
  document.querySelectorAll('.approach-card .module-chips[data-target]').forEach(container => {
    populateApproachChips(container);
  });
}

function populateApproachChips(container) {
  const modules = state.detectedModuleDetails;
  if (!modules || modules.length === 0) return;
  const targetId = container.dataset.target;
  container.innerHTML =
    \`<div class="module-chips-title">Modules</div>\` +
    modules.map(m =>
      \`<span class="mod-chip" onclick="insertModuleChip('\${targetId}','\${m.name}')">\${m.name}</span>\`
    ).join('');
}

const APPROACH_NOTES = {
  async: {
    'async/await':  'All new network calls and business logic — preferred for all new code',
    'Combine':      'Describe which modules use Combine publishers and subscribers',
    'RxSwift':      'Legacy only — do not add new RxSwift chains',
    'GCD':          'Background work in legacy code only — new code uses async/await',
    'OperationQueue': 'Legacy dependency-based task queues — describe which modules',
  },
  state: {
    '@Observable':         'Swift 5.9+ — all new ViewModels on iOS 17+',
    'ObservableObject':    'Describe which modules use @Published + ObservableObject',
    'CurrentValueSubject': 'Combine-based state — describe which modules',
    'RxRelay':             'Legacy RxSwift state — do not add new usage',
  },
};

function renderApproachRows(group) {
  const containerId = \`arch-\${group}-detail\`;
  const container   = document.getElementById(containerId);
  if (!container) return;

  const selected = getPills(group);
  if (selected.length === 0) { container.innerHTML = ''; return; }

  const notes = APPROACH_NOTES[group] || {};
  const saved = {};
  container.querySelectorAll('.approach-card').forEach(card => {
    const approach = card.dataset.approach;
    const ta = card.querySelector('textarea');
    if (approach && ta) saved[approach] = ta.value;
  });

  container.innerHTML = selected.map(approach => {
    const taId = \`approach-\${group}-\${approach}\`;
    const ph   = notes[approach] || 'describe which modules use this approach';
    const val  = saved[approach] ?? getDraftField(taId);
    return \`<div class="approach-card" data-approach="\${approach}">
      <div class="approach-card-label">\${approach}</div>
      <textarea id="\${taId}" rows="2"
        placeholder="\${ph}"
        oninput="updatePreview('architecture'); updateArchProgress()">\${val}</textarea>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="\${taId}"></div>
      </div>
    </div>\`;
  }).join('');

  container.querySelectorAll('.approach-card .module-chips[data-target]').forEach(c => populateApproachChips(c));
}

function getApproachRows(group) {
  const rows = [];
  document.querySelectorAll(\`#arch-\${group}-detail .approach-card\`).forEach(card => {
    const approach = card.dataset.approach || '';
    const note     = (card.querySelector('textarea')?.value || '').trim();
    rows.push({ approach, note });
  });
  return rows;
}

// ── Parse existing DATA_MODEL.md → entity + endpoint row objects ──
function parseDataModelMD(text) {
  const entities  = [];
  const endpoints = [];

  const domainSection = text.match(/^## Domain Entities([\\s\\S]*?)(?=^## )/m)?.[1] ?? '';
  for (const block of domainSection.split(/^### /m).slice(1)) {
    const name = block.split('\\n')[0].trim();
    if (!name || name.includes('[')) continue;
    const dataClassMatch = block.match(/(?:data class|struct) \\w+[\\s\\S]*?\\{?([\\s\\S]*?)\\}?\\)/);
    const simpleMatch    = block.match(/data class \\w+\\s*\\(([\\s\\S]*?)\\)/);
    if (simpleMatch) {
      const fields = simpleMatch[1]
        .split('\\n')
        .map(l => l.trim().replace(/^va[lr]\\s+|^let\\s+|^var\\s+/, '').replace(/,$/, '').trim())
        .filter(l => l && l.includes(':'))
        .join(', ');
      entities.push({ name, fields });
    } else {
      entities.push({ name, fields: '' });
    }
  }

  for (const block of text.split(/^#### /m).slice(1)) {
    const firstLine = block.split('\\n')[0].trim();
    const spaceIdx  = firstLine.indexOf(' ');
    if (spaceIdx === -1) continue;
    const method = firstLine.slice(0, spaceIdx).toUpperCase();
    const path   = firstLine.slice(spaceIdx + 1).trim();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;

    const reqBody  = block.match(/Request:\\s*\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/)?.[1]?.trim()      ?? '';
    const respBody = block.match(/Response 200:\\s*\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/)?.[1]?.trim() ?? '';
    const errRows  = [...block.matchAll(/\\|\\s*\`([^\`\\n]+)\`\\s*\\|\\s*([^|\\n]+)\\|/g)];
    const errors   = errRows
      .map(m => \`\${m[1].trim()} — \${m[2].trim()}\`)
      .filter(e => !e.toLowerCase().startsWith('error code'))
      .join(', ');

    endpoints.push({ method, path, reqBody, respBody, errors });
  }

  return { entities, endpoints };
}

// ── Parse context/_index.md routing table → { moduleName(lowercased): keywords } ──
// Keywords are the single source of truth in _index.md (not MODULE_MAP). When
// reloading a project we backfill them onto the module rows so re-saving the
// wizard regenerates _index.md correctly instead of wiping the routing table.
function parseIndexKeywords(text) {
  const map = {};
  for (const line of text.split('\\n')) {
    const m = line.match(/^\\|\\s*(.+?)\\s*\\|\\s*(.+?)\\s*\\|\\s*(.+?)\\s*\\|/);
    if (!m) continue;
    const keywords = m[1].trim();
    const name     = m[2].trim();
    if (!name || /^-+$/.test(name) || name.toLowerCase() === 'module') continue; // header/separator
    map[name.toLowerCase()] = keywords;
  }
  return map;
}

// ── Parse existing MODULE_MAP.md → module row objects ────
function parseModuleMapMD(text) {
  const modules = [];
  const normalisePattern = raw => {
    const l = raw.toLowerCase();
    if (l.includes('single activity')) return 'Single Activity';
    if (l.includes('mvvm'))            return 'MVVM';
    if (l.includes('mvp'))             return 'MVP';
    if (l.includes('clean'))           return 'Clean';
    if (l.includes('repository'))      return 'Repository';
    if (l.includes('infrastructure'))  return 'Infrastructure';
    return 'MVVM';
  };
  const normaliseDI = raw => {
    const l = raw.toLowerCase();
    if (l.includes('manual')) return 'Manual';
    if (l.includes('none'))   return 'None';
    return raw.trim() || 'Manual';
  };
  const getField = (block, field) => {
    const re = new RegExp(\`\\\\|\\\\s*\${field}\\\\s*\\\\|\\\\s*([^|\\\\n]+?)\\\\s*\\\\|\`, 'i');
    return (block.match(re)?.[1] ?? '').replace(/\`/g, '').trim();
  };
  const sections = text.split(/^### /m).slice(1);
  for (const section of sections) {
    const name = section.split('\\n')[0].trim();
    if (!name || name.startsWith('#') || name.startsWith('<!--')) continue;
    const path       = getField(section, 'Path');
    const purpose    = getField(section, 'Purpose');
    const keywords   = getField(section, 'Keywords');
    const keyClasses = getField(section, 'Key classes');
    const depends    = getField(section, 'Depends on');
    const rawPat     = getField(section, 'Pattern');
    const rawDI      = getField(section, 'DI');
    if (purpose === '[describe purpose]' && keyClasses === '[fill in]') continue;
    modules.push({
      name, path, purpose, keywords, keyClasses, depends,
      pattern: normalisePattern(rawPat),
      di: normaliseDI(rawDI),
    });
  }
  return modules;
}

// ── Project analysis ────────────────────────────────────

async function scanForURLProtocols(dirHandle, maxDepth = 6) {
  const names = [];
  const skip  = new Set(['.build', '.git', 'node_modules', 'DerivedData', 'Pods']);
  async function walk(dh, depth) {
    if (depth <= 0) return;
    try {
      for await (const [name, handle] of dh) {
        if (handle.kind === 'file' && name.endsWith('.swift') &&
            (name.includes('URLProtocol') || name.includes('Interceptor') || name.includes('Middleware')))
          names.push(name.replace(/\\.swift$/, ''));
        else if (handle.kind === 'directory' && !skip.has(name))
          await walk(handle, depth - 1);
      }
    } catch {}
  }
  await walk(dirHandle, maxDepth);
  return [...new Set(names)];
}

async function analyzeProject() {
  if (!state.dirHandle) return;
  showToast('Analyzing project…', 'info');

  // ── Step 1: Find .xcodeproj directory ────────────────────
  let xcodeTarget = '', xcodeprojDirName = '';
  try {
    for await (const [name, handle] of state.dirHandle) {
      if (handle.kind === 'directory' && name.endsWith('.xcodeproj')) {
        xcodeTarget = name.replace('.xcodeproj', '');
        xcodeprojDirName = name;
        break;
      }
    }
  } catch {}

  // ── Step 2: Read key project files in parallel ───────────
  const [packageSwift, podfile, pbxproj] = await Promise.all([
    tryReadFile(state.dirHandle, 'Package.swift'),
    tryReadFile(state.dirHandle, 'Podfile'),
    xcodeprojDirName
      ? tryReadFile(state.dirHandle, xcodeprojDirName, 'project.pbxproj')
      : Promise.resolve(null),
  ]);

  // ── Step 3: Scan Swift source files for imports + patterns ─
  const swiftImports = new Set();
  const swiftPatterns = [];
  let swiftCount = 0, objcCount = 0;
  const _skipScan = new Set(['.build', '.git', 'node_modules', 'DerivedData', 'Pods', 'build', '.swiftpm']);
  async function _walkForImports(dh, depth) {
    if (depth <= 0) return;
    try {
      for await (const [fname, fh] of dh) {
        if (fh.kind === 'file') {
          if (fname.endsWith('.swift') && swiftCount < 40) {
            swiftCount++;
            try {
              const text = await (await fh.getFile()).text();
              [...text.matchAll(/^import\\s+(\\w+)/gm)].forEach(m => swiftImports.add(m[1]));
              if (text.includes('@StateObject') || text.includes('@ObservedObject')) swiftPatterns.push('stateobject');
              if (text.includes('@Observable'))                                       swiftPatterns.push('observable');
              if (text.includes('ObservableObject'))                                  swiftPatterns.push('observableobject');
              if (text.includes('UIViewController') || text.includes(': UIView'))     swiftPatterns.push('uikit');
              if (text.includes(': View') || text.includes('some View'))              swiftPatterns.push('swiftui');
              if (text.includes('async ') || text.includes('await '))                 swiftPatterns.push('asyncawait');
              if (text.includes('AnyPublisher') || text.includes('@Published'))       swiftPatterns.push('combine');
              if (text.includes('NavigationStack'))                                    swiftPatterns.push('navstack');
              if (text.includes('Coordinator'))                                        swiftPatterns.push('coordinator');
            } catch {}
          } else if (fname.endsWith('.m') || fname.endsWith('.mm')) {
            objcCount++;
          }
        } else if (fh.kind === 'directory' && !_skipScan.has(fname) && !fname.startsWith('.')) {
          await _walkForImports(fh, depth - 1);
        }
      }
    } catch {}
  }
  await _walkForImports(state.dirHandle, 5);

  const lang   = swiftCount > 0 ? (objcCount > 0 ? 'Swift+ObjC' : 'Swift') : 'Objective-C';
  const hasImp = lib  => swiftImports.has(lib);
  const hasPat = pat  => swiftPatterns.includes(pat);
  const src    = ((packageSwift || '') + '\\n' + (podfile || '')).toLowerCase();
  const hasSrc = (...terms) => terms.some(t => src.includes(t.toLowerCase()));

  // ── Step 4: Parse project.pbxproj for literal bundle IDs ──
  let mainBundleId = '';
  let buildConfigs = [];
  const configBundleMap = {}; // configName → bundle ID (from pbxproj or xcconfig)
  if (pbxproj) {
    // Split on XCBuildConfiguration markers. The buildSettings block closes with };
    // before name = ...; so we split at the first }; to find each part separately.
    for (const chunk of pbxproj.split('isa = XCBuildConfiguration;').slice(1)) {
      const splitAt  = chunk.indexOf('};');
      if (splitAt === -1) continue;
      const settings = chunk.slice(0, splitAt);
      const after    = chunk.slice(splitAt);
      const nameM    = after.match(/\\bname\\s*=\\s*"?([^";\\n]+)"?\\s*;/);
      const idM      = settings.match(/PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*([^\\s$(\\n;]+)\\s*;/);
      if (nameM && idM) {
        const cfgName  = nameM[1].trim();
        const bundleId = idM[1].trim();
        // Skip variable references ($BUNDLE_ID, $(VAR)) — xcconfig scan handles these
        if (bundleId.includes('.') && !bundleId.startsWith('$') &&
            !/(test|widget|extension|watch|notification|clip)/i.test(bundleId))
          configBundleMap[cfgName] = bundleId;
      }
    }
  }

  // ── Step 4b: Scan xcconfig files for BUNDLE_ID / PRODUCT_BUNDLE_IDENTIFIER ─
  // Many iOS projects use $BUNDLE_ID in pbxproj and store real values in xcconfig files.
  const _skipXcc = new Set(['Pods', 'node_modules', 'DerivedData', 'build', '.build', '.git']);
  async function _scanXcconfigs(dh, depth) {
    if (depth <= 0) return;
    try {
      for await (const [name, handle] of dh) {
        if (handle.kind === 'file' && name.endsWith('.xcconfig')) {
          try {
            const text = await (await handle.getFile()).text();
            const idM  = text.match(/^(?:BUNDLE_ID|PRODUCT_BUNDLE_IDENTIFIER)\\s*=\\s*([^\\s$(\\n][^\\n]*)/m);
            if (idM) {
              const bundleId = idM[1].trim();
              if (bundleId.includes('.') && !bundleId.includes('$') &&
                  !/(test|widget|extension|watch|notification|clip)/i.test(bundleId))
                configBundleMap[name.replace('.xcconfig', '')] = bundleId;
            }
          } catch {}
        } else if (handle.kind === 'directory' && !_skipXcc.has(name) && !name.startsWith('.')) {
          await _scanXcconfigs(handle, depth - 1);
        }
      }
    } catch {}
  }
  await _scanXcconfigs(state.dirHandle, 6);

  // mainBundleId: prefer AppStore (production), then Release, then first non-dev ID
  mainBundleId = configBundleMap['AppStore']
    || configBundleMap['AppStore-Release']
    || configBundleMap['Release']
    || Object.values(configBundleMap).find(id => !/(develop|debug|stag|preprod|uat)/i.test(id))
    || Object.values(configBundleMap)[0]
    || '';

  // Unique base config names for scheme fallback (strip -Debug/-Release variants)
  buildConfigs = [...new Set(
    Object.keys(configBundleMap).map(n => n.replace(/-(Debug|Release)$/, ''))
  )].filter(n => n.length < 30);

  // ── Step 5: Read xcscheme names ──────────────────────────
  let schemeNames = [];
  if (xcodeprojDirName) {
    try {
      const xcodeprojH = await state.dirHandle.getDirectoryHandle(xcodeprojDirName);
      const sharedH    = await xcodeprojH.getDirectoryHandle('xcshareddata');
      const schemesH   = await sharedH.getDirectoryHandle('xcschemes');
      for await (const [name] of schemesH)
        if (name.endsWith('.xcscheme')) schemeNames.push(name.replace('.xcscheme', ''));
    } catch {}
  }

  // ── Step 6: Detect dependencies ─────────────────────────
  const di = hasImp('Resolver')         ? 'Resolver'
           : hasImp('Swinject')         ? 'Swinject'
           : hasImp('NeedleFoundation') ? 'Needle'
           : hasImp('Factory')          ? 'Factory'
           : hasSrc('resolver')         ? 'Resolver'
           : hasSrc('swinject')         ? 'Swinject'
           : hasSrc('needle')           ? 'Needle'
           : hasSrc('factory')          ? 'Factory'
           :                             'Manual';

  const hasAsyncAwait = hasPat('asyncawait') || hasSrc('async/await');
  const hasCombine    = hasPat('combine')    || hasImp('Combine')    || hasSrc('combine', 'currentvaluesubject');
  const hasRxSwift    = hasImp('RxSwift')    || hasSrc('rxswift', 'rxcocoa');
  const hasObservable = hasPat('observable') && !hasPat('observableobject');
  const hasObsObj     = hasPat('observableobject') || hasPat('stateobject');

  const hasSwiftUI = hasPat('swiftui') || hasImp('SwiftUI');
  const hasUIKit   = hasPat('uikit')   || hasImp('UIKit') || hasSrc('uiviewcontroller');
  const uiMode     = hasSwiftUI && hasUIKit ? 'Mixed' : hasUIKit ? 'UIKit' : hasSwiftUI ? 'SwiftUI' : 'SwiftUI';

  const navMode = hasPat('navstack') || hasSrc('navigationstack')         ? 'NavigationStack'
                : hasPat('coordinator') || hasSrc('coordinator')          ? 'Coordinator'
                : hasSrc('uinavigationcontroller', 'pushviewcontroller')  ? 'UINavigationController'
                :                                                            '';

  const netLib = hasImp('Alamofire') || hasSrc('alamofire') ? 'Alamofire'
               : hasImp('Moya')      || hasSrc('moya')      ? 'Moya'
               :                                               'URLSession';

  const hasSwiftData = hasImp('SwiftData')  || hasSrc('swiftdata', '@model');
  const hasCoreData  = hasImp('CoreData')   || hasSrc('coredata', 'nsmanagedobject');
  const hasRealm     = hasImp('RealmSwift') || hasSrc('realmswift', 'realm');
  const hasDefaults  = hasSrc('userdefaults');

  const imgLib = hasImp('Kingfisher') || hasSrc('kingfisher') ? 'Kingfisher'
               : hasImp('SDWebImage') || hasSrc('sdwebimage') ? 'SDWebImage'
               : hasImp('Nuke')       || hasSrc('nuke')       ? 'Nuke'
               :                                                 '';

  // ── Step 7: Build module list ─────────────────────────────
  const spmModules = packageSwift
    ? [...packageSwift.matchAll(/\\.target\\s*\\(\\s*name:\\s*["']([^"']+)["']/g)].map(m => m[1])
    : [];
  const podTargets = podfile
    ? [...podfile.matchAll(/target\\s+['"]([^'"]+)['"]\\s+do/g)].map(m => m[1]).filter(t => !/[Tt]est/.test(t))
    : [];

  // Scan root directory for feature folders containing Swift source
  const sourceModules = [];
  const _skipModDirs = new Set(['.build', '.git', 'node_modules', 'DerivedData', 'Pods',
    'build', '.swiftpm', 'fastlane', 'scripts', 'docs', 'Resources',
    xcodeprojDirName, xcodeTarget + '.xcworkspace']);
  try {
    for await (const [name, handle] of state.dirHandle) {
      if (handle.kind !== 'directory' || _skipModDirs.has(name) || name.startsWith('.')) continue;
      let hasSrcFiles = false;
      try {
        for await (const [fname, fh] of handle) {
          if (fname.endsWith('.swift') || fname === 'Sources' || fname === 'Source') {
            hasSrcFiles = true; break;
          }
        }
      } catch {}
      if (hasSrcFiles && name !== xcodeTarget) sourceModules.push(name);
    }
  } catch {}

  const allModules = [...new Set([...spmModules, ...podTargets, xcodeTarget, ...sourceModules].filter(Boolean))];

  // ── Step 8: Apply to Project Config ──────────────────────
  const bundleEl = document.getElementById('cfg-bundle-id');
  if (bundleEl) bundleEl.value = mainBundleId || (xcodeTarget ? \`com.example.\${xcodeTarget.toLowerCase()}\` : '');
  selectPill('cfg-platform', 'iOS', 'radio');
  if (lang === 'Swift')            selectPill('cfg-lang', 'Swift', 'radio');
  else if (lang === 'Objective-C') selectPill('cfg-lang', 'Objective-C', 'radio');
  else                             selectPill('cfg-lang', 'Swift+ObjC', 'radio');
  updatePreview('projectconfig');

  // ── Step 9: Populate scheme rows ─────────────────────────
  const schemeList = document.getElementById('cfg-schemes-list');
  if (schemeList) { schemeList.innerHTML = ''; schemeCounter = 0; }

  // Look up actual bundle ID for a scheme name from pbxproj config map.
  // Tries: exact → SchemeName-Release → SchemeName-Debug → naive suffix fallback.
  function resolveSchemeBundle(name) {
    if (configBundleMap[name])               return configBundleMap[name];
    if (configBundleMap[name + '-Release'])  return configBundleMap[name + '-Release'];
    if (configBundleMap[name + '-Debug'])    return configBundleMap[name + '-Debug'];
    // Case-insensitive prefix match
    const nl = name.toLowerCase();
    for (const [cfg, id] of Object.entries(configBundleMap))
      if (cfg.toLowerCase().startsWith(nl)) return id;
    // Last resort: naive suffix on mainBundleId
    if (!mainBundleId) return '';
    if (nl.includes('debug'))                return mainBundleId + '.debug';
    if (nl.includes('stag') || nl.includes('uat')) return mainBundleId + '.staging';
    return mainBundleId;
  }

  const schemeSrc = schemeNames.length > 0 ? schemeNames : buildConfigs;
  if (schemeSrc.length > 0) {
    schemeSrc.forEach(name => {
      const nl = name.toLowerCase();
      addSchemeRow({
        name,
        bundleId: resolveSchemeBundle(name),
        note: nl.includes('debug') ? 'Development build'
            : nl.includes('stag') || nl.includes('uat') ? 'Staging build'
            : nl.includes('release') || nl.includes('prod') ? 'Production build'
            : '',
      });
    });
  } else {
    addSchemeRow({ name: 'Debug',   bundleId: mainBundleId ? mainBundleId + '.debug'   : '', note: 'Development build' });
    addSchemeRow({ name: 'Staging', bundleId: mainBundleId ? mainBundleId + '.staging' : '', note: 'Staging build' });
  }

  // ── Step 10: Apply Architecture pills ────────────────────
  if (lang === 'Swift')        selectPill('lang', 'Swift');
  else if (lang === 'Swift+ObjC') selectPill('lang', 'Swift+ObjC');

  selectPill('arch', 'MVVM', 'radio');
  selectPill('di', di, 'radio');

  if (hasAsyncAwait) selectPill('async', 'async/await');
  if (hasCombine)    selectPill('async', 'Combine');
  if (hasRxSwift)    selectPill('async', 'RxSwift');

  if (hasObservable)      selectPill('state', '@Observable');
  else if (hasObsObj)     selectPill('state', 'ObservableObject');
  if (hasRxSwift)         selectPill('state', 'RxRelay');

  selectPill('ui', uiMode, 'radio');
  if (navMode) selectPill('nav', navMode, 'radio');

  selectPill('network', netLib);
  if (hasSwiftData) selectPill('storage', 'SwiftData');
  if (hasCoreData)  selectPill('storage', 'Core Data');
  if (hasRealm)     selectPill('storage', 'Realm');
  if (hasDefaults)  selectPill('storage', 'UserDefaults');
  if (imgLib)       selectPill('img', imgLib, 'radio');

  // ── Step 11: Testing dropdowns ───────────────────────────
  setSelectOption('test-test-runner', 'XCTest');
  setSelectOption('test-mocking',     hasImp('Mockingbird') || hasSrc('mockingbird') ? 'Mockingbird' : 'Manual Mocks');
  setSelectOption('test-flow-test',   hasCombine ? 'XCTestExpectation' : 'None');
  setSelectOption('test-assertions',  hasImp('Nimble') || hasSrc('quick', 'nimble') ? 'Nimble' : 'XCTAssert');
  setSelectOption('test-ui-test',     hasSrc('xcuiapplication', 'xcuitest') ? 'XCUITest' : 'None');

  // ── Step 12: Migration toggles ────────────────────────────
  const setToggle = (id, val) => { const el = document.getElementById('mig-' + id); if (el) el.checked = val; };
  if (lang === 'Swift+ObjC' || lang === 'Objective-C') setToggle('objc', true);
  if (hasCombine)              setToggle('combine', true);
  if (hasRxSwift)              setToggle('rxswift', true);
  if (hasUIKit && hasSwiftUI)  setToggle('uikit', true);

  // ── Step 13: Modules list — prefer existing MODULE_MAP.md ──
  const existingModuleMap = await tryReadFile(state.dirHandle, 'agent-artifacts', 'spec-kit', 'MODULE_MAP.md');
  const parsedModules = existingModuleMap ? parseModuleMapMD(existingModuleMap) : [];

  // Keywords live only in _index.md — backfill them onto the parsed modules so
  // re-saving regenerates the routing table instead of emptying it.
  if (parsedModules.length > 0) {
    const idxText = await tryReadFile(state.dirHandle, 'agent-artifacts', 'context', '_index.md');
    if (idxText) {
      const kw = parseIndexKeywords(idxText);
      parsedModules.forEach(m => { const hit = kw[m.name.trim().toLowerCase()]; if (hit) m.keywords = hit; });
    }
  }

  if (parsedModules.length > 0) {
    const list = document.getElementById('modules-list');
    if (list) { list.innerHTML = ''; moduleCounter = 0; }
    parsedModules.forEach(m => addModuleRow(m));
    state.detectedModuleDetails = parsedModules.map(m => ({
      name: m.name, type: m.pattern, diCol: m.di, notes: m.purpose,
    }));
  } else if (allModules.length > 0) {
    const list = document.getElementById('modules-list');
    if (list) { list.innerHTML = ''; moduleCounter = 0; }
    allModules.forEach(name => addModuleRow({ name, path: name + '/', keywords: guessModuleKeywords(name) }));
    state.detectedModuleDetails = allModules.map(name => {
      const n = name.toLowerCase();
      let type = '—', notes = '';
      if      (n.match(/feature|view|screen/))     { type = 'MVVM';       notes = 'Feature module'; }
      else if (n.match(/core|common|shared/))      { type = 'Repository'; notes = 'Shared domain layer'; }
      else if (n.match(/network|api|service/))     { type = '—';          notes = 'Network layer'; }
      else if (n.match(/kit|util|helper|support/)) { type = '—';          notes = 'Shared utilities'; }
      return { name, type, diCol: di !== 'Manual' ? di : '—', notes };
    });
  }

  // ── Load existing DATA_MODEL.md ──────────────────────
  const existingDataModel = await tryReadFile(state.dirHandle, 'agent-artifacts', 'spec-kit', 'DATA_MODEL.md');
  if (existingDataModel) {
    const { entities } = parseDataModelMD(existingDataModel);
    const entList = document.getElementById('entities-list');
    if (entList && entities.length > 0) { entList.innerHTML = ''; entityCounter = 0; entities.forEach(e => addEntityRow(e)); }
  }

  state.detectedInterceptors = await scanForURLProtocols(state.dirHandle);

  updatePreview('architecture');
  updatePreview('modules');
  refreshModuleChips();
  renderApproachRows('async');
  renderApproachRows('state');
  updateArchProgress();

  const moduleSource = parsedModules.length > 0
    ? \`\${parsedModules.length} modules from MODULE_MAP.md\`
    : allModules.length ? \`\${allModules.length} modules detected\` : null;
  const summary = [
    mainBundleId    ? \`bundle ID\`    : null,
    moduleSource,
    schemeNames.length  ? \`\${schemeNames.length} schemes\`  :
    buildConfigs.length ? \`\${buildConfigs.length} configs\` : null,
    state.detectedInterceptors.length ? \`\${state.detectedInterceptors.length} interceptors\` : null,
  ].filter(Boolean).join(', ');
  showToast(\`Auto-filled · \${summary || 'basic settings'} · review & adjust\`, 'success');
}

function setSelectOption(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  for (const opt of el.options) {
    if (opt.value === value || opt.text === value) { el.value = opt.value; return; }
  }
}

function guessModuleKeywords(moduleName) {
  const name = moduleName.replace(/[-_]/g, ' ').toLowerCase();
  const map = [
    ['auth',      'login, logout, auth, session, token, signup'],
    ['home',      'home, dashboard, landing, feed'],
    ['order',     'order, basket, cart, checkout'],
    ['profile',   'profile, account, user, settings'],
    ['network',   'network, api, http, endpoint, urlsession'],
    ['data',      'data, database, coredata, swiftdata, cache, repository'],
    ['ui',        'ui, theme, components, design, swiftui'],
    ['analytics', 'analytics, tracking, events, logging'],
    ['search',    'search, filter, query'],
    ['payment',   'payment, billing, purchase'],
    ['app',       'app, main, startup, rootview'],
    ['core',      'core, shared, common, util'],
  ];
  for (const [key, kw] of map) if (name.includes(key)) return kw;
  return name.trim();
}

// ── Screen builders and MD generators ──────────────────

let schemeCounter = 0;

function addSchemeRow(defaults = {}) {
  const id  = ++schemeCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'scheme-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('scheme-row-\${id}').remove(); updatePreview('projectconfig')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:10px">
      <div class="form-row"><label>Scheme name</label>
        <input type="text" class="scheme-name" value="\${esc(defaults.name||'')}" placeholder="Debug" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>Bundle ID</label>
        <input type="text" class="scheme-bundle" value="\${esc(defaults.bundleId||'')}" placeholder="com.example.app.debug" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>Note (optional)</label>
        <input type="text" class="scheme-note" value="\${esc(defaults.note||'')}" placeholder="Dev build — internal testing only" oninput="updatePreview('projectconfig')"></div>
    </div>
  \`;
  document.getElementById('cfg-schemes-list').appendChild(row);
  updatePreview('projectconfig');
}

function generateProjectConfigMD() {
  const codebasePath   = document.getElementById('cfg-codebase-path')?.value.trim() || '/absolute/path/to/your/project';
  const platform       = getRadio('cfg-platform') || 'iOS';
  const lang           = getRadio('cfg-lang') || 'Swift';
  const bundleId       = document.getElementById('cfg-bundle-id')?.value.trim() || 'com.example.myapp';
  const deployTarget   = document.getElementById('cfg-deploy-target')?.value.trim() || '16.0';
  const xcodeVer       = document.getElementById('cfg-xcode-ver')?.value.trim() || '16.0';
  const defaultTests   = getRadio('cfg-tests') || 'N';
  const branch         = document.getElementById('cfg-branch')?.value.trim() || 'feature/TICKET-ID';

  const schemeRows = Array.from(document.querySelectorAll('[id^="scheme-row-"]'));
  const schemes    = schemeRows.map(row => ({
    name:     row.querySelector('.scheme-name')?.value.trim()   || '',
    bundleId: row.querySelector('.scheme-bundle')?.value.trim() || '',
    note:     row.querySelector('.scheme-note')?.value.trim()   || '',
  })).filter(s => s.name);

  let bundleComment = '# Matches source directory structure — used by the agent for import generation.';
  if (schemes.length > 0) {
    const maxLen      = Math.max(...schemes.map(s => s.name.length));
    const schemeLines = schemes
      .map(s => \`#   \${s.name}:\${' '.repeat(Math.max(1, maxLen - s.name.length + 2))}\${s.bundleId || '[fill in]'}\${s.note ? \`  # \${s.note}\` : ''}\`)
      .join('\\n');
    bundleComment = \`# Base bundle ID — production bundle identifier.\\n# Bundle ID varies by scheme:\\n\${schemeLines}\\n# Use the base bundle_id above for all import and namespace generation.\`;
  }

  const iosSection = platform === 'iOS' ? \`
## iOS-specific (remove section if not iOS)

bundle_id: \${bundleId}
\${bundleComment}
deployment_target: \${deployTarget}
xcode_version: \${xcodeVer}
\` : '';

  const langOut = lang === 'Swift+ObjC' ? 'Swift' : lang;

  return \`# Project Configuration
# ─────────────────────────────────────────────────────────────────────────────
# Edit this file once when adopting this skeleton for a new project.
# Every Claude session reads this file first (Step 0 of CLAUDE.md protocol).
# ─────────────────────────────────────────────────────────────────────────────

## Codebase

codebase_path: \${codebasePath}
# All file paths in context/*.md are resolved relative to this path.

## Platform

platform: \${platform}
# Options: Android | iOS | Web | Backend | Flutter | React Native

primary_language: \${langOut}
# Options: Swift | Objective-C | Kotlin | TypeScript | etc.
\${iosSection}
## Team Preferences

default_tests: \${defaultTests}
# Y = Claude always writes tests unless the task MD explicitly says N.
# N = Claude asks each time.

branch_convention: \${branch}
# Naming hint shown in task completion reports.
# Example: feature/APP-1234 | bugfix/APP-1234 | chore/APP-1234
\`;
}

function buildProjectConfigScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-projectconfig">

    <div id="cfg-existing-banner" style="display:none;align-items:flex-start;gap:12px;background:rgba(62,207,142,0.08);border:1px solid var(--success);border-radius:var(--radius);padding:14px 16px;margin-bottom:20px">
      <span style="font-size:18px;line-height:1">ℹ️</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--success);margin-bottom:3px">Existing project.config.md detected</div>
        <div style="font-size:11px;color:var(--text-muted);line-height:1.5">Current values have been loaded below. Edit any field and click <strong>Save</strong> to update, or click <strong>Next →</strong> to continue without changes.</div>
      </div>
      <button onclick="document.getElementById('cfg-existing-banner').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;line-height:1;padding:0">✕</button>
    </div>

    <div class="form-section">
      <h3>Codebase Path</h3>
      <div class="form-row">
        <input type="text" id="cfg-codebase-path" placeholder="/absolute/path/to/your/project"
               oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Absolute path to your project root. The agent resolves every file reference from here.</div>
      </div>
    </div>

    <div class="form-section">
      <h3>Platform</h3>
      <div class="radio-group">
        \${pill('iOS','iOS','cfg-platform','radio')}
        \${pill('Android','Android','cfg-platform','radio')}
        \${pill('Web','Web','cfg-platform','radio')}
        \${pill('Backend','Backend','cfg-platform','radio')}
        \${pill('Flutter','Flutter','cfg-platform','radio')}
        \${pill('React Native','React Native','cfg-platform','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Primary Language</h3>
      <div class="radio-group">
        \${pill('Swift','Swift','cfg-lang','radio')}
        \${pill('Objective-C','Objective-C','cfg-lang','radio')}
        \${pill('Swift + Obj-C','Swift+ObjC','cfg-lang','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Base Bundle ID</h3>
      <div class="form-row">
        <input type="text" id="cfg-bundle-id" placeholder="com.example.myapp"
               oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Production bundle identifier — not a scheme-specific override. Auto-filled from project if detected.</div>
      </div>
    </div>

    <div class="form-section">
      <h3>iOS Version <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(iOS only)</span></h3>
      <div style="display:flex;gap:24px">
        <div class="form-row">
          <label>Deployment Target</label>
          <input type="text" id="cfg-deploy-target" placeholder="16.0"
                 oninput="updatePreview('projectconfig')" style="width:80px">
        </div>
        <div class="form-row">
          <label>Xcode Version</label>
          <input type="text" id="cfg-xcode-ver" placeholder="16.0"
                 oninput="updatePreview('projectconfig')" style="width:80px">
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Build Schemes</h3>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Each scheme's bundle ID — helps the agent avoid confusing Debug/Staging identifiers with the production bundle ID. Auto-detected from project if possible.</div>
      <div class="dynamic-list" id="cfg-schemes-list"></div>
      <button class="add-btn" onclick="addSchemeRow()" style="margin-top:10px">+ Add Scheme</button>
    </div>

    <div class="form-section">
      <h3>Default Tests</h3>
      <div class="radio-group">
        \${pill('Y — always write tests','Y','cfg-tests','radio')}
        \${pill('N — ask each time','N','cfg-tests','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Branch Convention</h3>
      <div class="form-row">
        <input type="text" id="cfg-branch" placeholder="feature/TICKET-ID" oninput="updatePreview('projectconfig')">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Shown in task completion reports. e.g. feature/APP-1234 | bugfix/APP-1234</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-success" onclick="saveStep('projectconfig')">💾 Save project.config.md</button>
      <button class="btn btn-secondary" onclick="goTo('architecture')">Next: Architecture →</button>
    </div>

  </div>\`;

  addSchemeRow({ name: 'Debug',   bundleId: '', note: 'Development build' });
  addSchemeRow({ name: 'Staging', bundleId: '', note: 'Staging build' });
  addSchemeRow({ name: 'Release', bundleId: '', note: 'Production build' });
}

// ══════════════════════════════════════════════════════
//  ARCHITECTURE STEP
// ══════════════════════════════════════════════════════
function buildArchitectureScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-architecture">

    <div class="form-section">
      <h3>Language</h3>
      <div class="check-group" id="lang-group">
        \${pill('Swift','Swift','lang')}
        \${pill('Objective-C','ObjC','lang')}
        \${pill('Swift + Obj-C','Swift+ObjC','lang')}
      </div>
    </div>

    <div class="form-section">
      <h3>Architecture Pattern \${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>Select the architecture your app currently uses</strong> — this tells the agent how to read existing code.
        If you're migrating to a different pattern, use the <em>Target Architecture Notes</em> field below to describe where you're heading.
        The agent will write new code to the target, and use Migration Rules to guard against expanding the legacy pattern.<br><br>
        <strong>MVVM</strong> — ViewModel + StateFlow/@Published + Repository. Recommended for SwiftUI.<br>
        <strong>MVC</strong> — ViewController as controller. Default UIKit pattern; use Migration Rules to guard new code.<br>
        <strong>VIPER</strong> — View, Interactor, Presenter, Entity, Router. Complex but fully testable.<br>
        <strong>TCA</strong> — The Composable Architecture. Unidirectional, testable, composable state.<br>
        <strong>Clean Architecture</strong> — Domain layer (UseCases) between ViewModel and Repository.
      </div>
      <div class="radio-group" id="arch-group">
        \${pill('MVVM','MVVM','arch','radio')}
        \${pill('MVC','MVC','arch','radio')}
        \${pill('VIPER','VIPER','arch','radio')}
        \${pill('TCA','TCA','arch','radio')}
        \${pill('Clean Architecture','Clean','arch','radio')}
        \${otherPill('arch','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Dependency Injection \${tierBadge('core')}</h3>
      <div class="radio-group" id="di-group">
        \${pill('Manual','Manual','di','radio')}
        \${pill('Resolver','Resolver','di','radio')}
        \${pill('Swinject','Swinject','di','radio')}
        \${pill('Needle','Needle','di','radio')}
        \${pill('Factory','Factory','di','radio')}
        \${otherPill('di','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Async / Threading \${tierBadge('core')} \${infoBtn('Select every async approach in the codebase. Then describe <strong>where each is used</strong> — the agent uses this to decide which async primitive to reach for.')}</h3>
      <div class="check-group" id="async-group">
        \${pill('async/await','async/await','async')}
        \${pill('Combine','Combine','async')}
        \${pill('RxSwift','RxSwift','async')}
        \${otherPill('async')}
        \${pill('GCD','GCD','async')}
        \${pill('OperationQueue','OperationQueue','async')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> to get a separate card. Use module chips to specify which modules use it.</p>
      <div class="approach-detail" id="arch-async-detail"></div>
    </div>

    <div class="form-section">
      <h3>State Management \${tierBadge('core')} \${infoBtn('Select <strong>all</strong> state approaches — including legacy ones. Each gets its own card.')}</h3>
      <div class="check-group" id="state-group">
        \${pill('@Observable','@Observable','state')}
        \${pill('ObservableObject','ObservableObject','state')}
        \${pill('CurrentValueSubject','CurrentValueSubject','state')}
        \${pill('RxRelay','RxRelay','state')}
        \${otherPill('state')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> to get a separate card.</p>
      <div class="approach-detail" id="arch-state-detail"></div>
    </div>

    <div class="form-section">
      <h3>UI Layer \${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>SwiftUI</strong> — declarative UI, all new screens use Views + @Observable / ObservableObject.<br>
        <strong>UIKit</strong> — imperative UI only; agent writes ViewControllers + Storyboard/XIB or programmatic layout.<br>
        <strong>Mixed</strong> — both exist; agent uses SwiftUI for new screens, leaves UIKit screens untouched.
      </div>
      <div class="radio-group" id="ui-group">
        \${pill('SwiftUI','SwiftUI','ui','radio')}
        \${pill('UIKit','UIKit','ui','radio')}
        \${pill('Mixed (SwiftUI + UIKit)','Mixed','ui','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Navigation \${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>NavigationStack</strong> — SwiftUI NavigationStack with typed paths. iOS 16+.<br>
        <strong>Coordinator</strong> — Coordinator pattern managing UINavigationController. Common UIKit pattern.<br>
        <strong>UINavigationController</strong> — Direct push/pop; legacy single-Activity equivalent.<br>
        <strong>Mixed</strong> — NavigationStack for SwiftUI flows, Coordinator for UIKit flows.
      </div>
      <div class="radio-group" id="nav-group">
        \${pill('NavigationStack','NavigationStack','nav','radio')}
        \${pill('Coordinator','Coordinator','nav','radio')}
        \${pill('UINavigationController','UINavController','nav','radio')}
        \${pill('Mixed','MixedNav','nav','radio')}
        \${otherPill('nav','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Networking \${tierBadge('recommended')} \${infoBtn('<strong>Base URL strategy</strong> — describe HOW the URL is managed. Examples:<br><code>per-environment via InfoPlist BASE_URL</code><br><code>injected via AppConfig singleton</code><br><br><strong>Auth mechanism</strong>:<br><code>Bearer token injected by AuthURLProtocol</code><br><code>API key in request header via URLRequestInterceptor</code>')}</h3>
      <div class="check-group" id="network-group">
        \${pill('URLSession','URLSession','network')}
        \${pill('Alamofire','Alamofire','network')}
        \${pill('Moya','Moya','network')}
        \${otherPill('network')}
      </div>
      <div class="form-row" style="margin-top:8px;display:flex;gap:12px">
        <input type="text" id="arch-base-url" placeholder="Strategy only — e.g. per-environment via InfoPlist BASE_URL" oninput="updatePreview('architecture')" style="flex:1">
        <input type="text" id="arch-auth" placeholder="Auth — e.g. Bearer token via AuthURLProtocol" oninput="updatePreview('architecture')" style="flex:1">
      </div>
    </div>

    <div class="form-section">
      <h3>Local Storage \${tierBadge('optional')}</h3>
      <div class="check-group" id="storage-group">
        \${pill('SwiftData','SwiftData','storage')}
        \${pill('Core Data','CoreData','storage')}
        \${pill('Realm','Realm','storage')}
        \${pill('UserDefaults','UserDefaults','storage')}
        \${pill('Keychain','Keychain','storage')}
        \${otherPill('storage')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-storage-usage" rows="2" placeholder="One line per approach e.g.&#10;SwiftData — user preferences, order history&#10;Keychain — auth tokens, secure credentials" oninput="updatePreview('architecture')"></textarea>
      </div>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="arch-storage-usage"></div>
      </div>
    </div>

    <div class="form-section">
      <h3>Image Loading \${tierBadge('optional')}</h3>
      <div class="radio-group" id="img-group">
        \${pill('Kingfisher','Kingfisher','img','radio')}
        \${pill('SDWebImage','SDWebImage','img','radio')}
        \${pill('Nuke','Nuke','img','radio')}
        \${pill('None','NoneImg','img','radio')}
        \${otherPill('img','radio')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-img-usage" rows="2" placeholder="Where used — e.g. product images, restaurant logos, user avatars" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Known Architecture Violations \${tierBadge('optional')}</h3>
      <div class="form-row">
        <textarea id="arch-violations" rows="3" placeholder="e.g. HomeViewController.swift — business logic in viewDidLoad, pre-dates MVVM adoption" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Target Architecture Notes \${tierBadge('recommended')}</h3>
      <div class="form-row">
        <textarea id="arch-target-notes" rows="2" placeholder="e.g. All new screens use SwiftUI + @Observable. UIKit being removed incrementally." oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="arch-progress-wrap">
      <div class="arch-progress-title">Setup Quality</div>
      <div class="arch-progress-track" id="arch-progress-track">
        <div class="arch-seg empty" style="flex:100"></div>
      </div>
      <div class="arch-progress-labels">
        <div class="arch-progress-label"><div class="dot" style="background:#f87171"></div><span id="arch-progress-core-label">0/6 Core</span></div>
        <div class="arch-progress-label"><div class="dot" style="background:#fbbf24"></div><span id="arch-progress-rec-label">0/5 Recommended</span></div>
        <div class="arch-progress-label"><div class="dot" style="background:var(--text-muted)"></div><span id="arch-progress-opt-label">0/5 Optional</span></div>
      </div>
      <div class="arch-progress-hint" id="arch-progress-hint">Fill the Core sections before running tasks.</div>
    </div>

    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateArchitectureMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('architecture')">⚡ Generate &amp; Save ARCHITECTURE.md</button>
      <button class="btn btn-secondary" onclick="goTo('conventions')">Next →</button>
    </div>
  </div>\`;

  document.getElementById('screen-architecture').querySelectorAll('textarea, input').forEach(el => {
    el.addEventListener('input', () => { updatePreview('architecture'); updateArchProgress(); });
  });
  renderApproachRows('async');
  renderApproachRows('state');
  updateArchProgress();
}

function generateArchitectureMD() {
  const langs        = getPills('lang');
  const arch         = getRadio('arch');
  const di           = getRadio('di');
  const asyncLib     = getPills('async');
  const stateLib     = getPills('state');
  const ui           = getRadio('ui');
  const nav          = getRadio('nav');
  const network      = getPills('network');
  const storage      = getPills('storage');
  const img          = getRadio('img');
  const violations   = (document.getElementById('arch-violations')?.value    || '').trim();
  const targetNotes  = (document.getElementById('arch-target-notes')?.value  || '').trim();
  const baseUrl      = (document.getElementById('arch-base-url')?.value      || '').trim();
  const authMech     = (document.getElementById('arch-auth')?.value          || '').trim();
  const storageUsage = (document.getElementById('arch-storage-usage')?.value || '').trim();
  const imgUsage     = (document.getElementById('arch-img-usage')?.value     || '').trim();

  const today       = new Date().toISOString().split('T')[0];
  const primaryLang = langs[0] || 'Swift';
  const bundleId    = document.getElementById('cfg-bundle-id')?.value?.trim() || 'com.example.app';
  const appName     = bundleId.split('.').pop() || 'App';

  function approachRowsToMD(group, pills, placeholder) {
    const rows = getApproachRows(group);
    if (rows.length > 0) return rows.map(({ approach, note }) => \`| \${approach} | \${note || placeholder} |\`).join('\\n');
    return pills.map(p => \`| \${p} | \${placeholder} |\`).join('\\n');
  }
  function textareaToRows(lines, pills, placeholder) {
    const filled = lines.split('\\n').map(l => l.trim()).filter(Boolean);
    if (filled.length > 0) return filled.map(l => {
      const sep = l.indexOf('—') !== -1 ? l.indexOf('—') : l.indexOf('-');
      if (sep > 0) return \`| \${l.slice(0, sep).trim()} | \${l.slice(sep + 1).trim()} |\`;
      return \`| \${l} | |\`;
    }).join('\\n');
    return pills.map(p => \`| \${p} | \${placeholder} |\`).join('\\n');
  }

  const asyncRows   = approachRowsToMD('async', asyncLib, '[describe which modules]');
  const stateRows   = approachRowsToMD('state', stateLib, '[describe which ViewModels]');
  const storageRows = textareaToRows(storageUsage, storage, '[describe usage]');
  const violationsBlock = violations
    ? violations.split('\\n').map(v => \`- \${v.trim()}\`).join('\\n')
    : '- None documented yet.';

  // ── ADR-001: Layer Structure ──────────────────────────
  const isTCA   = arch === 'TCA';
  const isClean = arch === 'Clean';
  const isVIPER = arch === 'VIPER';

  const layerPackageTree = isTCA
    ? \`\\\`\\\`\\\`\\n\${appName}/\\n├── Features/\\n│   └── <Name>/\\n│       ├── <Name>Feature.swift    ← TCA Reducer\\n│       ├── <Name>View.swift       ← SwiftUI View\\n│       └── <Name>Client.swift     ← Effect dependencies\\n├── Core/\\n│   ├── Network/\\n│   └── Storage/\\n└── App/\\n    └── AppFeature.swift           ← Root reducer\\n\\\`\\\`\\\`\`
    : isVIPER
    ? \`\\\`\\\`\\\`\\n\${appName}/\\n├── Modules/\\n│   └── <Name>/\\n│       ├── View/          ← UIViewController / SwiftUI View\\n│       ├── Presenter/     ← Presentation logic\\n│       ├── Interactor/    ← Business logic\\n│       ├── Router/        ← Navigation\\n│       └── Entity/        ← Data models\\n├── Services/\\n└── Common/\\n\\\`\\\`\\\`\`
    : isClean
    ? \`\\\`\\\`\\\`\\n\${appName}/\\n├── Features/\\n│   └── <name>/\\n│       ├── Presentation/  ← View + ViewModel\\n│       ├── Domain/        ← UseCase + Repository protocol\\n│       └── Data/          ← RepositoryImpl + DTOs\\n├── Core/\\n│   ├── Network/\\n│   └── Storage/\\n└── App/\\n\\\`\\\`\\\`\`
    : \`\\\`\\\`\\\`\\n\${appName}/\\n├── Features/\\n│   └── <name>/\\n│       ├── View/          ← SwiftUI View / UIViewController\\n│       ├── ViewModel/     ← ObservableObject / @Observable\\n│       └── Repository/    ← Data access\\n├── Core/\\n│   ├── Network/\\n│   └── Storage/\\n└── App/\\n\\\`\\\`\\\`\`;

  const dependencyRule = isTCA
    ? \`**Dependency Rule**: \\\`View → Reducer (Store) → Effect (Client)\\\`\\nAll side effects go through \\\`Effect\\\`. No direct API calls from the Reducer.\`
    : isClean
    ? \`**Dependency Rule**: \\\`View → ViewModel → UseCase → Repository → DataSource\\\`\\nNo layer may import from a layer above it.\`
    : \`**Dependency Rule**: \\\`View → ViewModel → Repository\\\`\\nViewModels must not import the View layer.\`;

  const adr001 = \`### ADR-001 — Layer Structure and Dependency Rule
- **Date**: \${today}
- **Decision**: Adopt \${arch || 'MVVM'} with strict unidirectional dependency flow.
- **Reason**: Enforces separation of concerns, testability, and prevents coupling between layers.
- **Consequence**: Every new file must be placed in the correct layer. PRs that violate the dependency rule are rejected.

#### Package Tree

\${layerPackageTree}

#### \${dependencyRule}

**Violations the agent must refuse to introduce:**
- Business logic or network calls directly inside a \\\`View\\\` or \\\`UIViewController\\\`
- Importing a DTO or network response type into the ViewModel or View layer
- Accessing \\\`UserDefaults\\\` / Keychain directly from a ViewModel\`;

  // ── ADR-002: Pattern example ──────────────────────────
  const hasObservable = stateLib.includes('@Observable');
  const stateAnnotation = hasObservable ? '@Observable\\nclass' : '@MainActor\\nclass';
  const stateConformance = hasObservable ? '' : ': ObservableObject';
  const stateProp = hasObservable ? 'var isLoading = false\\n    var items: [Item] = []\\n    var error: String?'
                                   : '@Published var isLoading = false\\n    @Published var items: [Item] = []\\n    @Published var error: String?';

  let adr002 = '';
  if (arch === 'TCA') {
    adr002 = \`### ADR-002 — TCA Pattern: Reducer + Store + View
- **Date**: \${today}
- **Decision**: All feature screens follow the TCA contract below.
- **Reason**: Unidirectional data flow, exhaustive testing of state mutations, composable state.
- **Consequence**: Every screen ships with a \\\`Reducer\\\`, a \\\`Store\\\`, and a stateless \\\`View\\\`.

\\\`\\\`\\\`swift
@Reducer
struct ExampleFeature {
    @ObservableState
    struct State: Equatable {
        var isLoading = false
        var items: [Item] = []
        var error: String?
    }

    enum Action {
        case loadItems
        case itemsResponse(Result<[Item], Error>)
        case deleteItem(id: String)
    }

    @Dependency(\\\\.exampleClient) var client

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .loadItems:
                state.isLoading = true
                return .run { send in
                    await send(.itemsResponse(
                        Result { try await client.fetchItems() }
                    ))
                }
            case let .itemsResponse(.success(items)):
                state.isLoading = false
                state.items = items
                return .none
            case let .itemsResponse(.failure(error)):
                state.isLoading = false
                state.error = error.localizedDescription
                return .none
            case let .deleteItem(id):
                state.items.removeAll { $0.id == id }
                return .none
            }
        }
    }
}

struct ExampleView: View {
    @Bindable var store: StoreOf<ExampleFeature>

    var body: some View {
        List(store.items) { item in
            Text(item.name)
        }
        .onAppear { store.send(.loadItems) }
    }
}
\\\`\\\`\\\`\`;
  } else if (arch === 'MVVM' || !arch) {
    adr002 = \`### ADR-002 — MVVM Pattern: ViewModel + View
- **Date**: \${today}
- **Decision**: All feature screens follow the MVVM contract below.
- **Reason**: Clear separation between UI and business logic; ViewModel is independently testable.
- **Consequence**: Every screen ships with a \\\`ViewModel\\\` and a stateless \\\`View\\\`.

\\\`\\\`\\\`swift
// ✅ ViewModel — \${hasObservable ? '@Observable (iOS 17+)' : 'ObservableObject'}
\${stateAnnotation} ExampleViewModel\${stateConformance} {
    \${stateProp}

    private let repository: ExampleRepository

    init(repository: ExampleRepository) {
        self.repository = repository
    }

    func loadItems() async {
        isLoading = true
        error = nil
        do {
            items = try await repository.fetchItems()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// ✅ View — stateless, receives ViewModel via environment or init
struct ExampleView: View {
    \${hasObservable ? '@State private var viewModel: ExampleViewModel' : '@StateObject private var viewModel: ExampleViewModel'}

    var body: some View {
        Group {
            if viewModel.isLoading { ProgressView() }
            else if let error = viewModel.error { Text(error).foregroundStyle(.red) }
            else { List(viewModel.items) { Text($0.name) } }
        }
        .task { await viewModel.loadItems() }
    }
}
\\\`\\\`\\\`\`;
  }

  // ── ADR-003: DI ──────────────────────────────────────
  const diName = di || 'Manual';
  let adr003 = '';
  if (diName === 'Manual') {
    adr003 = \`### ADR-003 — Dependency Injection (Manual / Protocol-based)
- **Date**: \${today}
- **Decision**: Dependencies injected via constructor. No DI framework.
- **Reason**: Simple, compile-time safe, no additional dependencies.
- **Consequence**: All dependencies declared in \\\`init()\\\`. Use protocols for testability.

\\\`\\\`\\\`swift
// ✅ Protocol for testability
protocol ExampleRepository {
    func fetchItems() async throws -> [Item]
}

// ✅ Constructor injection
final class ExampleViewModel {
    private let repository: ExampleRepository

    init(repository: ExampleRepository = ExampleRepositoryImpl()) {
        self.repository = repository
    }
}

// ✅ Root composition — wire in SceneDelegate / App struct
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            let repo = ExampleRepositoryImpl(apiClient: URLSessionAPIClient())
            ExampleView(viewModel: ExampleViewModel(repository: repo))
        }
    }
}
\\\`\\\`\\\`\`;
  } else {
    adr003 = \`### ADR-003 — Dependency Injection with \${diName}
- **Date**: \${today}
- **Decision**: \${diName} is the sole DI framework. No manual service locator singletons.
- **Reason**: Consistent dependency resolution across modules.
- **Consequence**: All dependencies registered at app startup. Direct instantiation of injectable types is forbidden.\`;
  }

  // ── ADR-004: Navigation ──────────────────────────────
  let adr004 = '';
  if (nav === 'NavigationStack') {
    adr004 = \`### ADR-004 — Navigation with NavigationStack (iOS 16+)
- **Date**: \${today}
- **Decision**: All navigation handled by SwiftUI \\\`NavigationStack\\\` with typed paths.
- **Reason**: Type-safe, composable, and testable navigation native to SwiftUI.
- **Consequence**: No \\\`NavigationLink(destination:))\\\` with closures. All routes declared in \\\`AppRoute\\\`.

\\\`\\\`\\\`swift
enum AppRoute: Hashable {
    case home
    case detail(itemId: String)
    case settings
}

struct RootView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path)
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .home:            HomeView(path: $path)
                    case .detail(let id): DetailView(itemId: id)
                    case .settings:        SettingsView()
                    }
                }
        }
    }
}
\\\`\\\`\\\`\`;
  } else if (nav === 'Coordinator') {
    adr004 = \`### ADR-004 — Navigation via Coordinator Pattern
- **Date**: \${today}
- **Decision**: All navigation handled by Coordinators. ViewControllers do not push/present directly.
- **Reason**: Decouples navigation logic from ViewControllers; Coordinators are independently testable.
- **Consequence**: Every feature has a \\\`Coordinator\\\` protocol. Direct \\\`navigationController.pushViewController\\\` calls outside a Coordinator are forbidden.

\\\`\\\`\\\`swift
protocol Coordinator: AnyObject {
    var navigationController: UINavigationController { get }
    func start()
}

final class AppCoordinator: Coordinator {
    let navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() {
        let vc = HomeViewController(coordinator: self)
        navigationController.pushViewController(vc, animated: false)
    }

    func showDetail(itemId: String) {
        let vc = DetailViewController(itemId: itemId, coordinator: self)
        navigationController.pushViewController(vc, animated: true)
    }
}
\\\`\\\`\\\`\`;
  }

  // ── ADR-005: Async / State ───────────────────────────
  const hasRxSwift  = asyncLib.includes('RxSwift');
  const hasCombine  = asyncLib.includes('Combine');
  const hasAsyncAwait = asyncLib.includes('async/await') || asyncLib.length === 0;

  const adr005 = \`### ADR-005 — Async and State Management
- **Date**: \${today}
- **Decision**: \${hasAsyncAwait ? 'Swift async/await' : asyncLib.join(' + ')} for async; \${stateLib.join(' + ') || '@Observable'} for state.\${hasRxSwift ? ' RxSwift is legacy and being removed incrementally.' : ''}\${hasCombine ? ' Combine is legacy for state; new code uses @Observable or ObservableObject.' : ''}
- **Reason**: Swift Concurrency is the platform-recommended structured concurrency model with first-class actor isolation.
- **Consequence**: All new async work uses \\\`async/await\\\` and \\\`Task\\\`. All new UI state uses \\\`@Observable\\\` (iOS 17+) or \\\`@Published\\\`. No new GCD or callback-based APIs.

| Legacy | Modern replacement | Migration status |
|--------|-------------------|-----------------|
\${[
  hasRxSwift  ? '| RxSwift Observable | async/await + AsyncStream | Incremental — remove on touch |' : '',
  hasCombine  ? '| Combine Publisher | async/await + AsyncStream | Incremental — replace on touch |' : '',
  '| DispatchQueue.async | Task { } / await | Must be replaced when adding new async work |',
  '| completionHandler | async throws | Must be replaced when adding new async work |',
].filter(Boolean).join('\\n')}\`;

  // ── ADR-006: Mixed UI ────────────────────────────────
  const adr006 = ui === 'Mixed'
    ? \`### ADR-006 — Mixed UI: SwiftUI for new screens; UIKit stays until migration ticket
- **Date**: \${today}
- **Decision**: Do not rewrite existing UIKit screens to SwiftUI unless a ticket explicitly scopes it.
- **Reason**: Rewriting UI without adding user value introduces risk and churn.
- **Consequence**: The codebase contains both UIKit and SwiftUI. The agent must not assume all UI is SwiftUI. When touching an existing UIKit screen, keep it in UIKit unless the ticket says otherwise.\`
    : '';

  const adrBlocks = [adr001, adr002, adr003, adr004, adr005, adr006]
    .filter(a => a && a.trim() !== '').join('\\n\\n');

  const langDisplay = langs.join(' + ') || 'Swift';
  const diDisplay   = di || 'Manual';
  let moduleTableRows = '';
  if (state.detectedModuleDetails && state.detectedModuleDetails.length > 0) {
    moduleTableRows = state.detectedModuleDetails.map(m =>
      \`| \${m.name} | \${langDisplay} | \${m.type === 'MVVM' ? (arch || 'MVVM') : m.type} | \${m.diCol} | \${m.notes} |\`
    ).join('\\n');
  } else {
    moduleTableRows =
\`| \${appName} | \${langDisplay} | Single App | \${diDisplay} | App entry point, root view, deep links |
| \${appName}Feature | Swift | \${arch || 'MVVM'} | \${diDisplay} | [describe feature] |
| \${appName}Core | Swift | Repository | \${diDisplay} | Shared domain layer |
| \${appName}Network | Swift | — | \${diDisplay} | URLSession, interceptors |
| \${appName}UI | Swift | — | — | Shared SwiftUI components, theme |\`;
  }

  const interceptorList = state.detectedInterceptors && state.detectedInterceptors.length > 0
    ? state.detectedInterceptors.join(', ') : '[list each]';

  return \`# Architecture
# ─────────────────────────────────────────────────────────────────────────────
# AI-GENERATED ARTIFACT. Re-run setup wizard to update — do not edit manually.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read this entire file before writing any code. Every decision here is final. Do not deviate.

---

## Current State

### Module Structure

| Module / Target | Language | Pattern | DI | Notes |
|----------------|----------|---------|-----|-------|
\${moduleTableRows}

### Navigation

\${nav === 'NavigationStack' ? 'SwiftUI NavigationStack with typed AppRoute enum. Root NavigationStack in App struct.' :
  nav === 'Coordinator'     ? 'Coordinator pattern — AppCoordinator manages UINavigationController stack.' :
  nav === 'UINavController' ? 'Direct UINavigationController push/pop. Legacy single-ViewController navigation.' :
  '[Describe navigation approach]'}

### Threading Model

| Approach | Where used |
|----------|-----------|
\${asyncRows || '| async/await | All new code — network, business logic |'}

### State Management

| Approach | Where used |
|----------|-----------|
\${stateRows || '| @Observable | All new ViewModels (iOS 17+) |'}

### Networking

| Property | Value |
|----------|-------|
| Library | \${network.join(' + ') || 'URLSession'} |
| Base URL strategy | \${baseUrl || '[single base URL / per-environment via InfoPlist / remote config]'} |
| Auth mechanism | \${authMech || '[Bearer token via URLProtocol / API key in header / none]'} |
| Custom interceptors | \${interceptorList} |

### Local Storage

| Approach | Where used |
|----------|-----------|
\${storageRows || '| SwiftData | [describe usage] |'}

### Image Loading
\${img && img !== 'NoneImg' ? \`\${img} — \${imgUsage.split('\\n').map(l=>l.trim()).filter(Boolean).join(', ') || '[describe usage]'}\` : 'No image loading library — using AsyncImage.'}

### Known Architecture Violations

\${violationsBlock}

---

## Target State

### Architecture Pattern
\${arch === 'TCA'   ? 'TCA — Reducer + Store + Effect. Fully unidirectional.' :
  arch === 'Clean' ? 'Clean Architecture — View → ViewModel → UseCase → Repository → DataSource' :
  arch === 'VIPER' ? 'VIPER — View, Interactor, Presenter, Entity, Router' :
  (arch || 'MVVM') + '\\n[describe target state]'}

### DI
\${di || 'Manual / Protocol-based'} everywhere. No singletons except AppConfig.

### Async
Swift async/await everywhere.\${hasRxSwift ? ' RxSwift being removed incrementally.' : ''}\${hasCombine ? ' Combine being replaced with async/await + AsyncStream.' : ''}

### UI
\${ui === 'SwiftUI' ? '- All screens: SwiftUI + Material Design tokens' :
  ui === 'Mixed'   ? '- New screens: SwiftUI\\n- Existing UIKit screens: kept until explicit migration ticket\\n- No new UIKit ViewControllers' :
  ui === 'UIKit'   ? '- Current: UIKit\\n- Target: Migrate to SwiftUI incrementally' :
  '- [Describe UI target state]'}

### Navigation
\${nav === 'NavigationStack' || nav === 'Coordinator' ? \`\${nav}. No direct navigation calls from Views/ViewControllers.\` : '[Describe navigation target]'}
\${targetNotes ? '\\n### Additional Notes\\n' + targetNotes : ''}

---

## Architecture Decision Records

\${adrBlocks}

<!-- ─────────────────────────────────────────────────────────────────────────
     END OF ARCHITECTURE.md — Every decision above is final.
     ───────────────────────────────────────────────────────────────────── -->
\`;
}

// ══════════════════════════════════════════════════════
//  CONVENTIONS STEP
// ══════════════════════════════════════════════════════
function buildConventionsScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-conventions">
    <div class="form-section">
      <h3>Package / Module Prefix \${infoBtn('Used in the generated package structure example. e.g. <code>com.example.myapp</code> or simply <code>MyApp</code> for Swift.')}</h3>
      <div class="form-row">
        <input type="text" id="conv-package" placeholder="e.g. MyApp" oninput="updatePreview('conventions')">
      </div>
    </div>
    <div class="form-section">
      <h3>Swift Core Rules</h3>
      <div class="dynamic-list" id="conv-null-rules">
        \${[
          ['conv-no-force-unwrap','No force-unwrap (!)','Use guard let, if let, or ?? instead'],
          ['conv-no-force-cast',  'No force-cast (as!)','Use conditional cast as? with guard or if let'],
          ['conv-prefer-struct',  'Prefer struct over class for value types','Use class only when identity or inheritance is required'],
          ['conv-prefer-let',     'Prefer let over var','Immutability by default — use var only when mutation is strictly needed'],
          ['conv-exhaustive-switch','Exhaustive switch on enum (no default for known cases)','Compiler catches missing branches when new cases are added'],
        ].map(([id, label, sub]) => \`
        <div class="toggle-row">
          <div><div class="toggle-label">\${label}</div><div class="toggle-sub">\${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="\${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>\`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>ViewModel Rules</h3>
      <div class="dynamic-list">
        \${[
          ['conv-observable',    '@Observable / ObservableObject for state (no Combine PassthroughSubject for state)','All state mutations happen on @MainActor'],
          ['conv-no-uikit-vm',   'No UIKit imports in ViewModel','UIViewController, UIView, UIColor are banned — keeps ViewModel unit-testable'],
          ['conv-task-scope',    'All async work in Task {} scoped to ViewModel lifetime','Structured concurrency — no detached tasks without explicit cancellation'],
          ['conv-no-singleton',  'No singleton state in ViewModels','Use constructor injection — singletons make testing impossible'],
        ].map(([id, label, sub]) => \`
        <div class="toggle-row">
          <div><div class="toggle-label">\${label}</div><div class="toggle-sub">\${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="\${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>\`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>SwiftUI Rules</h3>
      <div class="dynamic-list">
        \${[
          ['conv-stateless-view', 'Stateless Views — receive state, emit events via closures/bindings','Views only render and forward events — all decisions live in ViewModel'],
          ['conv-no-logic-view',  'No business logic inside View body','View body only formats and renders — no network calls, no data processing'],
          ['conv-task-on-appear', 'Use .task { } not .onAppear { Task { } }','.task modifier auto-cancels when view disappears — no leak'],
          ['conv-main-actor',     '@MainActor on all ViewModels','Guarantees UI updates on main thread without manual DispatchQueue.main'],
        ].map(([id, label, sub]) => \`
        <div class="toggle-row">
          <div><div class="toggle-label">\${label}</div><div class="toggle-sub">\${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="\${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>\`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>Quality Gate \${infoBtn('The agent runs this checklist on every task during Step 6b self-verification.')}</h3>
      <div class="dynamic-list">
        \${[
          ['qg-no-force-unwrap', 'No force-unwrap (!)', 'Use guard let, if let, or ??'],
          ['qg-no-force-cast',   'No force-cast (as!)', 'Use conditional cast as?'],
          ['qg-no-uikit-vm',     'No UIKit in ViewModel', 'No UIViewController, UIView, UIColor imports'],
          ['qg-no-strings',      'No hardcoded user-visible strings', 'All localised text in Localizable.strings'],
          ['qg-exhaustive-switch','Exhaustive switch on enum', 'No default: on known-case enums'],
          ['qg-no-logic-view',   'No business logic in View', 'Views, ViewControllers call ViewModel only'],
          ['qg-dto-not-exposed', 'DTOs not exposed to View', 'Repository returns domain models only'],
          ['qg-main-actor',      '@MainActor on ViewModels', 'All state-mutating ViewModels annotated @MainActor'],
          ['qg-test-naming',     'Test naming convention', 'test_functionName_scenario_expectedResult'],
        ].map(([id, label, sub]) => \`
        <div class="toggle-row">
          <div><div class="toggle-label">\${label}</div><div class="toggle-sub">\${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="\${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>\`).join('')}
      </div>
      <div class="form-row" style="margin-top:10px">
        <textarea id="conv-qg-extra" rows="2" placeholder="Extra checks — one per line" oninput="updatePreview('conventions')"></textarea>
      </div>
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateConventionsMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('conventions')">💾 Save CONVENTIONS.md</button>
      <button class="btn btn-secondary" onclick="goTo('migrations')">Next →</button>
    </div>
  </div>\`;
}

function generateConventionsMD() {
  const pkg          = document.getElementById('conv-package')?.value.trim() || 'MyApp';
  const noForceUnwrap = document.getElementById('conv-no-force-unwrap')?.checked;
  const noForceCast   = document.getElementById('conv-no-force-cast')?.checked;
  const preferStruct  = document.getElementById('conv-prefer-struct')?.checked;
  const preferLet     = document.getElementById('conv-prefer-let')?.checked;
  const exhaustive    = document.getElementById('conv-exhaustive-switch')?.checked;
  const observable    = document.getElementById('conv-observable')?.checked;
  const noUIKitVM     = document.getElementById('conv-no-uikit-vm')?.checked;
  const taskScope     = document.getElementById('conv-task-scope')?.checked;
  const statelessView = document.getElementById('conv-stateless-view')?.checked;
  const noLogicView   = document.getElementById('conv-no-logic-view')?.checked;
  const mainActor     = document.getElementById('conv-main-actor')?.checked;

  const qgNoForce  = document.getElementById('qg-no-force-unwrap')?.checked;
  const qgNoCast   = document.getElementById('qg-no-force-cast')?.checked;
  const qgNoUIKit  = document.getElementById('qg-no-uikit-vm')?.checked;
  const qgStrings  = document.getElementById('qg-no-strings')?.checked;
  const qgExhaust  = document.getElementById('qg-exhaustive-switch')?.checked;
  const qgNoLogic  = document.getElementById('qg-no-logic-view')?.checked;
  const qgNoDTO    = document.getElementById('qg-dto-not-exposed')?.checked;
  const qgMainAct  = document.getElementById('qg-main-actor')?.checked;
  const qgNaming   = document.getElementById('qg-test-naming')?.checked;
  const qgExtra    = (document.getElementById('conv-qg-extra')?.value || '').trim();

  const rule = (active, text) => active ? \`- \${text}\` : null;

  const coreRules = [
    rule(noForceUnwrap, 'No force-unwrap (\`!\`). Use \`guard let\`, \`if let\`, or \`?? defaultValue\`.'),
    rule(noForceCast,   'No force-cast (\`as!\`). Use \`guard let x = y as? Type else { return }\`.'),
    rule(preferStruct,  'Prefer \`struct\` over \`class\` for value types. Use \`class\` only when identity or inheritance is required.'),
    rule(preferLet,     'Prefer \`let\` over \`var\`. Declare \`var\` only when mutation is required.'),
    rule(exhaustive,    'Every \`switch\` on an \`enum\` must be exhaustive. No \`default:\` on known-case enums.'),
    '- Use \`Result<T, Error>\` for operations that can fail — no throwing across layer boundaries via uncaught exceptions.',
    '- Extension functions in a dedicated \`[Subject]+Extensions.swift\` file.',
  ].filter(Boolean).join('\\n');

  const coreAntiPatterns = (noForceUnwrap || noForceCast || exhaustive) ? \`
### Anti-patterns (agent must never write these)

\\\`\\\`\\\`swift
\${noForceUnwrap ? \`// ❌ Force-unwrap
let name = user!.name

// ✅ Safe unwrap
guard let user = user else { return }
let name = user.name
\` : ''}\${noForceCast ? \`
// ❌ Force-cast
let vc = storyboard.instantiateViewController(withIdentifier: "Home") as! HomeViewController

// ✅ Conditional cast
guard let vc = storyboard.instantiateViewController(withIdentifier: "Home") as? HomeViewController else { return }
\` : ''}\${exhaustive ? \`
// ❌ default hides missing cases
switch state {
case .loading: showSpinner()
default: hideSpinner()
}

// ✅ Exhaustive — compiler catches missing cases
switch state {
case .loading:       showSpinner()
case .success(let d): showContent(d)
case .failure(let e): showError(e)
}
\` : ''}\\\`\\\`\\\`\` : '';

  const vmRules = [
    rule(observable,  '\`@MainActor\` annotation on all ViewModels. Use \`@Observable\` (iOS 17+) or \`@Published\` + \`ObservableObject\`.'),
    rule(noUIKitVM,   'No UIKit imports in ViewModel (\`UIViewController\`, \`UIView\`, \`UIColor\` are banned).'),
    rule(taskScope,   'Async work lives in \`Task {}\` stored on ViewModel. Always cancel in \`deinit\` or via structured concurrency.'),
    '- No direct DataSource calls — always through UseCase or Repository.',
    '- Repository functions return \`Result<T, Error>\` — never throw across layer boundaries.',
  ].filter(Boolean).join('\\n');

  const vmCodeBlock = observable ? \`
\\\`\\\`\\\`swift
// ✅ Correct ViewModel structure
@MainActor
@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    var isLoading = false
    var emailError: String?
    var generalError: String?

    var navigationEvent: NavigationEvent?

    private let loginUseCase: LoginUseCase

    init(loginUseCase: LoginUseCase) {
        self.loginUseCase = loginUseCase
    }

    func submitLogin() async {
        isLoading = true
        generalError = nil
        switch await loginUseCase.execute(email: email, password: password) {
        case .success:
            navigationEvent = .toHome
        case .failure(let error):
            generalError = error.localizedDescription
        }
        isLoading = false
    }
}
\\\`\\\`\\\`\` : '';

  const swiftUIRules = [
    rule(statelessView, 'Views are **stateless** — receive state via bindings or environment, emit events via closures.'),
    rule(noLogicView,   'No business logic in \`body\`. Views only render and forward events.'),
    '- No ViewModel access deep inside subviews — hoist to screen-level View only.',
    rule(mainActor,     'Use \`.task { await viewModel.load() }\` — not \`.onAppear { Task { } }\`.'),
    '- Previews use \`#Preview\` macro with mock data.',
  ].filter(Boolean).join('\\n');

  return \`# Conventions
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads this and follows it exactly. Never modifies it.
# These rules override the defaults in CLAUDE.md where they conflict.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: follow every convention in this file exactly. These are non-negotiable.

---

## Swift Core Rules

\${coreRules}
\${coreAntiPatterns}

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Types (class, struct, enum, protocol) | PascalCase | \\\`LoginViewModel\\\`, \\\`AuthRepository\\\` |
| Functions, properties, variables | camelCase, verb-first for functions | \\\`loadUser()\\\`, \\\`onLoginTapped()\\\` |
| Constants | camelCase in \\\`enum\\\` namespace or \\\`let\\\` at top-level | \\\`Constants.maxRetryCount\\\` |
| MARK sections | \\\`// MARK: - Section Name\\\` | \\\`// MARK: - Private helpers\\\` |
| Test files | \\\`[SourceClass]Tests\\\` | \\\`LoginViewModelTests\\\` |
| Test functions | \\\`test_functionName_scenario_expectedResult\\\` | \\\`test_submitLogin_invalidEmail_showsError\\\` |

---

## Package Structure (per feature module)

\\\`\\\`\\\`
\${pkg}/
└── Features/
    └── <FeatureName>/
        ├── <Name>View.swift              (SwiftUI View — stateless)
        ├── <Name>ViewModel.swift         (@Observable / ObservableObject)
        ├── <Name>Repository.swift        (protocol + impl)
        ├── Domain/
        │   ├── <Name>Model.swift         (pure Swift struct — no framework imports)
        │   └── <Name>UseCase.swift       (one struct per use case)
        └── Data/
            ├── <Name>RemoteDataSource.swift
            └── <Name>DTO.swift           (Codable — never exposed to View)
\\\`\\\`\\\`

---

## ViewModel Conventions

\${vmRules}
\${vmCodeBlock}

---

## SwiftUI (new screens only)

\${swiftUIRules}

---

## Dependency Injection

- Constructor injection for all dependencies. No shared singletons except \\\`AppConfig\\\`.
- Protocol for every Repository and DataSource — enables test mocks.
- Composition root in \\\`App\\\` struct or \\\`SceneDelegate\\\` — wire dependencies once.

---

## Quality Gate

> Agent: run this checklist on every file you create or modify (Step 6b).

| Check | Rule |
|-------|------|
\${[
  qgNoForce ? '| No force-unwrap (\`!\`) | Use \`guard let\`, \`if let\`, or \`??\` |' : null,
  qgNoCast  ? '| No force-cast (\`as!\`) | Use conditional cast \`as?\` with guard |' : null,
  qgNoUIKit ? '| No UIKit in ViewModel | No \`UIViewController\`, \`UIView\`, \`UIColor\` imports |' : null,
  qgStrings ? '| No hardcoded user-visible strings | All localised text in \`Localizable.strings\` |' : null,
  qgExhaust ? '| Exhaustive switch | No \`default:\` on known-case \`enum\` |' : null,
  qgNoLogic ? '| No business logic in View | Views and ViewControllers call ViewModel only |' : null,
  qgNoDTO   ? '| DTOs not exposed to View | Repository returns domain models only |' : null,
  qgMainAct ? '| @MainActor on ViewModels | All state-mutating ViewModels annotated \`@MainActor\` |' : null,
  qgNaming  ? '| Tests follow naming convention | \`test_functionName_scenario_expectedResult\` |' : null,
  ...(qgExtra ? qgExtra.split('\\n').map(l => l.trim()).filter(Boolean).map(l => '| ' + l + ' | — |') : []),
].filter(Boolean).join('\\n')}
\`;
}

// ══════════════════════════════════════════════════════
//  MIGRATIONS STEP
// ══════════════════════════════════════════════════════
function buildMigrationsScreen(fp) {
  const legacyPatterns = [
    { id: 'objc',       label: 'Objective-C files exist',          sub: 'Mixed Swift/ObjC project' },
    { id: 'uikit',      label: 'UIKit ViewControllers exist',       sub: 'Legacy imperative UI' },
    { id: 'combine',    label: 'Combine publishers for state',      sub: 'Legacy reactive state' },
    { id: 'rxswift',    label: 'RxSwift chains exist',              sub: 'Legacy reactive framework' },
    { id: 'callbacks',  label: 'Completion-handler async APIs',     sub: 'Pre-async/await pattern' },
    { id: 'delegates',  label: 'Delegate pattern for data flow',    sub: 'Legacy UIKit data passing' },
    { id: 'singleton',  label: 'Singleton managers (shared)',       sub: 'Hidden dependencies' },
    { id: 'userdef',    label: 'UserDefaults direct access',        sub: 'Untestable storage' },
  ];

  fp.innerHTML += \`
  <div class="step-screen" id="screen-migrations">
    <div class="callout callout-info" style="margin-bottom:20px">
      <strong>This file does not tell the agent to migrate anything.</strong><br>
      It tells the agent what to do when a task lands it inside a file that still uses legacy patterns —
      keep the old code untouched, use the modern pattern only for new lines it adds.
    </div>
    <div class="form-section">
      <h3>Legacy Patterns Present</h3>
      <div class="dynamic-list">
        \${legacyPatterns.map(p => \`
        <div class="dynamic-item" style="padding:10px 12px">
          <div class="toggle-row" style="margin-bottom:0">
            <div><div class="toggle-label">\${p.label}</div><div class="toggle-sub">\${p.sub}</div></div>
            <label class="toggle">
              <input type="checkbox" id="mig-\${p.id}" onchange="toggleMigScope('\${p.id}'); updatePreview('migrations')">
              <div class="toggle-track"></div><div class="toggle-thumb"></div>
            </label>
          </div>
          <div id="mig-scope-row-\${p.id}" style="display:none;margin-top:8px">
            <input type="text" id="mig-scope-\${p.id}" placeholder="Affected modules — e.g. AuthFeature, HomeFeature" oninput="updatePreview('migrations')" style="width:100%;font-size:12px">
          </div>
        </div>\`).join('')}
      </div>
    </div>
    <div class="form-section" style="margin-top:24px">
      <h3>Custom Rules <span style="font-size:12px;font-weight:400;color:var(--text-muted)">— project-specific patterns not covered above</span></h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">
        Add any rule the agent should follow when touching files with your own legacy or project-specific patterns — e.g. a custom networking layer, an internal design system, or a third-party SDK wrapper.
      </p>
      <div class="dynamic-list" id="custom-rules-list"></div>
      <button class="btn btn-secondary" style="margin-top:8px" onclick="addCustomRuleRow()">+ Add Custom Rule</button>
      <input type="hidden" id="custom-rule-count" value="0">
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateMigrationsMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('migrations')">💾 Save MIGRATION_RULES.md</button>
      <button class="btn btn-secondary" onclick="goTo('modules')">Next →</button>
    </div>
  </div>\`;
}

let customRuleCounter = 0;
function addCustomRuleRow(defaults = {}) {
  const id = ++customRuleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'custom-rule-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('custom-rule-row-\${id}').remove(); updatePreview('migrations'); saveDraft()">✕</button>
    <div class="form-row">
      <label>Rule title</label>
      <input type="text" id="custom-rule-title-\${id}" value="\${esc(defaults.title||'')}" placeholder="e.g. Kingfisher → SDWebImage, Custom Logger" oninput="updatePreview('migrations');saveDraft()" style="font-size:13px">
    </div>
    <div class="form-row">
      <label style="align-self:flex-start;padding-top:4px">Rule body</label>
      <textarea id="custom-rule-body-\${id}" rows="4" placeholder="Describe what the agent should do when touching files that use this pattern. Use the same style as the rules above — bullet points work well." oninput="updatePreview('migrations');saveDraft()" style="font-size:12px;font-family:var(--mono);resize:vertical;width:100%">\${esc(defaults.body||'')}</textarea>
    </div>\`;
  document.getElementById('custom-rules-list').appendChild(row);
  const countEl = document.getElementById('custom-rule-count');
  if (countEl) { countEl.value = customRuleCounter; saveDraft(); }
}

function toggleMigScope(id) {
  const checked = document.getElementById('mig-' + id)?.checked;
  const row     = document.getElementById('mig-scope-row-' + id);
  if (row) row.style.display = checked ? 'block' : 'none';
}

function generateNewScreensTable() {
  const ui      = getRadio('ui')   || 'SwiftUI';
  const di      = getRadio('di')   || 'Manual';
  const arch    = getRadio('arch') || 'MVVM';
  const asyncLibs = getPills('async');
  const stateLibs = getPills('state');

  const uiRule     = ui === 'UIKit'  ? 'UIKit ViewControllers (programmatic or XIB)'
                   : ui === 'Mixed'  ? 'SwiftUI for new screens — no new UIKit ViewControllers'
                   :                   'SwiftUI View + @Observable ViewModel';
  const stateRule  = stateLibs.includes('@Observable') ? '@Observable (iOS 17+)' : 'ObservableObject + @Published';
  const vmRule     = \`MVVM — \${stateRule}\`;
  const asyncRule  = asyncLibs.includes('async/await') || asyncLibs.length === 0 ? 'async/await + Task' : asyncLibs[0];
  const diRule     = di === 'Manual' ? 'Constructor injection — no singletons'
                   : \`\${di} — register at app startup\`;

  return \`| Layer | Rule |
|-------|------|
| UI | \${uiRule} |
| ViewModel | \${vmRule} |
| Data | Repository + RemoteDataSource / LocalDataSource |
| DI | \${diRule} |
| Async | \${asyncRule} |\`;
}

function generateMigrationsMD() {
  const has   = id => document.getElementById('mig-' + id)?.checked;
  const scope = id => { const v = document.getElementById('mig-scope-' + id)?.value.trim(); return v ? \`\\n> **Affected modules:** \${v}\\n\` : ''; };

  const objcBlock = has('objc') ? \`
## Objective-C Files
\${scope('objc')}
- Do not convert Objective-C to Swift unless the task explicitly instructs it.
- When touching an ObjC file: write new logic in a separate Swift file that ObjC calls via \\\`@objc\\\` bridge.
- Do not add Swift-specific patterns inside \\\`.m\\\` files.
\` : '';

  const uikitBlock = has('uikit') ? \`
## UIKit ViewControllers → SwiftUI
\${scope('uikit')}
- Do not rewrite existing UIKit screens to SwiftUI unless the task scopes it.
- When touching a UIViewController: keep it in UIKit. Add a ViewModel if none exists, but do not change the VC structure.
- New features added to a UIKit screen live in a ViewModel — not in the VC.
- If wrapping in SwiftUI is required: use \\\`UIViewControllerRepresentable\\\`.

\\\`\\\`\\\`swift
// ❌ Rewriting UIKit VC to SwiftUI without a ticket
struct HomeView: View { ... }  // banned if HomeViewController already exists

// ✅ Add ViewModel alongside existing VC
class HomeViewController: UIViewController {
    private let viewModel: HomeViewModel  // inject via init — new addition OK
}
\\\`\\\`\\\`
\` : '';

  const combineBlock = has('combine') ? \`
## Combine → async/await
\${scope('combine')}
- Do not add new Combine pipelines. Do not remove existing ones.
- When touching a file with Combine: write all new async logic using async/await.
- If new logic must interact with existing Combine: use \\\`AsyncPublisher\\\` or \\\`values\\\` property.

\\\`\\\`\\\`swift
// ❌ Adding a new Combine pipeline
cancellables.insert(
    apiService.fetchUser(id: id)
        .receive(on: DispatchQueue.main)
        .sink(receiveCompletion: { _ in }, receiveValue: { user in ... })
)

// ✅ New work uses async/await
Task {
    let user = try await repository.getUser(id: id)
    await MainActor.run { self.user = user }
}
// TODO [DEBT-XXX]: replace existing Combine pipeline
\\\`\\\`\\\`
\` : '';

  const rxBlock = has('rxswift') ? \`
## RxSwift → async/await
\${scope('rxswift')}
- Do not add new RxSwift chains. Do not remove existing ones.
- When touching a file with RxSwift: write all new async logic using async/await.
- Bridge only when required: \\\`Observable.values\\\` or wrap in \\\`withCheckedThrowingContinuation\\\`.
\` : '';

  const callbackBlock = has('callbacks') ? \`
## Completion Handlers → async/await
\${scope('callbacks')}
- Do not add new completion-handler-based APIs. Do not change existing ones.
- When adding new functions that call existing callback APIs: wrap in \\\`withCheckedContinuation\\\`.

\\\`\\\`\\\`swift
// ❌ New function with completion handler
func loadUser(id: String, completion: @escaping (User?) -> Void) { ... }

// ✅ New function uses async/await; wraps legacy callback only if needed
func loadUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        legacyService.loadUser(id: id) { user, error in
            if let user { continuation.resume(returning: user) }
            else { continuation.resume(throwing: error ?? AppError.unknown) }
        }
    }
}
\\\`\\\`\\\`
\` : '';

  const delegateBlock = has('delegates') ? \`
## Delegate Pattern → Closures / async/await
\${scope('delegates')}
- Do not add new delegate protocols for data passing. Use closures or async/await.
- Existing delegate implementations: leave untouched unless the task scopes them.
- New data-passing between ViewControllers or Views: use \\\`@escaping\\\` closure or \\\`async\\\` function.
\` : '';

  const singletonBlock = has('singleton') ? \`
## Singleton Managers → Constructor Injection
\${scope('singleton')}
- Do not add new singleton \\\`shared\\\` instances.
- When touching a class that uses a singleton: inject the dependency via constructor in new code you add.
- Do not refactor the singleton itself unless the task scopes it.

\\\`\\\`\\\`swift
// ❌ Using singleton in new code
class NewViewModel {
    func load() { AuthManager.shared.getToken() }  // banned
}

// ✅ Inject the dependency
class NewViewModel {
    private let authManager: AuthManaging
    init(authManager: AuthManaging) { self.authManager = authManager }
}
\\\`\\\`\\\`
\` : '';

  const userDefaultsBlock = has('userdef') ? \`
## Direct UserDefaults → Repository / DataSource
\${scope('userdef')}
- Do not add new direct \\\`UserDefaults\\\` access in ViewModels or Views.
- All preference reads/writes go through a \\\`PreferencesRepository\\\` or \\\`PreferencesDataSource\\\`.
- Do not migrate existing direct access unless the task scopes it.
\` : '';

  const hasAny = ['objc','uikit','combine','rxswift','callbacks','delegates','singleton','userdef'].some(has);

  // Collect custom rules
  const customBlocks = [];
  document.querySelectorAll('[id^="custom-rule-row-"]').forEach(row => {
    const idNum = row.id.replace('custom-rule-row-', '');
    const title = document.getElementById(\`custom-rule-title-\${idNum}\`)?.value.trim();
    const body  = document.getElementById(\`custom-rule-body-\${idNum}\`)?.value.trim();
    if (title || body) customBlocks.push(\`\\n## \${title || 'Custom Rule'}\\n\\n\${body || ''}\\n\`);
  });

  return \`# Migration Rules
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads and applies automatically. Never modifies.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read every rule before touching any file that matches the patterns below.
> Apply rules only to lines you add or the immediate surrounding context.
> Do not refactor untouched code — log it instead.

## The Principle

When a task modifies an existing file, the agent must:
1. Do what the task asks (primary obligation — always)
2. Apply relevant rules below to lines it adds or the immediate surrounding context
3. NOT refactor the entire file unless the task explicitly scopes it

---
\${hasAny ? [objcBlock, uikitBlock, combineBlock, rxBlock, callbackBlock, delegateBlock, singletonBlock, userDefaultsBlock].join('') : '\\n_No legacy patterns selected._\\n'}

## New Screens and Features

\${generateNewScreensTable()}

---

## Scope Guard

The agent does not apply migration rules to code it did not add or modify.
If the agent notices a violation in untouched code, it logs it in the completion
report under "Follow-up recommended" with the file path and line number.
\${customBlocks.length > 0 ? '\\n---\\n' + customBlocks.join('\\n---\\n') : ''}
\`;
}

// ══════════════════════════════════════════════════════
//  MODULES STEP
// ══════════════════════════════════════════════════════
function buildModulesScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-modules">
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">
      Add one entry per SPM target, framework, or feature module. The agent uses this table to route task keywords to context files.
    </p>
    <div class="dynamic-list" id="modules-list"></div>
    <button class="add-btn" onclick="addModuleRow()" style="margin-top:10px">+ Add Module</button>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateModulesMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('modules')">⚡ Generate &amp; Save MODULE_MAP.md</button>
      <button class="btn btn-secondary" onclick="goTo('debt')">Next →</button>
    </div>
  </div>\`;
  addModuleRow({ name: 'AppCore',     path: 'Sources/AppCore/',    pattern: 'Repository', keywords: 'core, shared, common, util' });
  addModuleRow({ name: 'AuthFeature', path: 'Sources/AuthFeature/', pattern: 'MVVM',       keywords: 'login, logout, auth, session, token' });
}

let moduleCounter = 0;
function addModuleRow(defaults = {}) {
  const id  = ++moduleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'module-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('module-row-\${id}').remove(); updatePreview('modules')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Module / Target name</label>
        <input type="text" class="mod-name" value="\${esc(defaults.name||'')}" placeholder="AuthFeature" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="mod-path" value="\${esc(defaults.path||'')}" placeholder="Sources/AuthFeature/" oninput="updatePreview('modules')"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Language</label>
        <select class="mod-lang" onchange="updatePreview('modules')">
          <option>Swift</option><option>Objective-C</option><option>Swift + ObjC</option>
        </select></div>
      <div class="form-row"><label>Pattern</label>
        <select class="mod-pattern" onchange="updatePreview('modules')">
          \${['MVVM','TCA','VIPER','Repository','Infrastructure','Single App'].map(p =>
            \`<option\${(defaults.pattern||'MVVM')===p?' selected':''}>\${p}</option>\`).join('')}
        </select></div>
      <div class="form-row"><label>DI</label>
        <select class="mod-di" onchange="updatePreview('modules')">
          <option>Manual</option><option>Resolver</option><option>Swinject</option><option>Needle</option>
        </select></div>
    </div>
    <div class="form-row"><label>Keywords (comma-separated)</label>
      <input type="text" class="mod-keywords" value="\${esc(defaults.keywords||'')}" placeholder="home, dashboard, feed" oninput="updatePreview('modules')"></div>
    <div class="form-row"><label>Purpose (one sentence)</label>
      <input type="text" class="mod-purpose" value="\${esc(defaults.purpose||'')}" placeholder="Handles user authentication and session management" oninput="updatePreview('modules')"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Key classes (comma-separated)</label>
        <input type="text" class="mod-keyclasses" value="\${esc(defaults.keyClasses||'')}" placeholder="AuthViewModel, AuthRepository" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Depends on</label>
        <input type="text" class="mod-depends" value="\${esc(defaults.depends||'')}" placeholder="AppCore, NetworkKit" oninput="updatePreview('modules')"></div>
    </div>
  \`;
  document.getElementById('modules-list').appendChild(row);
  updatePreview('modules');
}

function generateModulesMD() {
  const rows         = Array.from(document.querySelectorAll('[id^="module-row-"]'));
  const moduleBlocks = rows.map(row => {
    const name       = row.querySelector('.mod-name')?.value.trim()      || '[module]';
    const path       = row.querySelector('.mod-path')?.value.trim()      || '[path]';
    const lang       = row.querySelector('.mod-lang')?.value             || 'Swift';
    const pattern    = row.querySelector('.mod-pattern')?.value          || 'MVVM';
    const di         = row.querySelector('.mod-di')?.value               || 'Manual';
    const purpose    = row.querySelector('.mod-purpose')?.value.trim()   || '[describe purpose]';
    const keyClasses = row.querySelector('.mod-keyclasses')?.value.trim()|| '[fill in]';
    const depends    = row.querySelector('.mod-depends')?.value.trim()   || '[fill in]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';
    return \`### \${name}

| Field | Value |
|-------|-------|
| Path | \\\`\${path}\\\` |
| Language | \${lang} |
| Pattern | \${pattern} |
| DI | \${di} |
| Purpose | \${purpose} |
| Key classes | \${keyClasses} |
| Depends on | \${depends} |
| Context file | \\\`\${contextFile}\\\` |
| Known debt | see \\\`TECH_DEBT.md#\${name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}\\\` |

---\`;
  }).join('\\n\\n');

  return \`# Module Map
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED after initial wizard generation. Edit directly to update modules.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: route via \\\`context/_index.md\\\` (keyword → context-file table) to decide which
> modules a task touches. Then come here for each module's \\\`Path\\\`, \\\`Key classes\\\`, and
> \\\`Known debt\\\` anchor. Never skip the routing step.

## How the Agent Uses This File

1. After routing via \\\`context/_index.md\\\`, come here for module paths, key classes, and debt anchors.
2. If a context file is missing: use \\\`Key classes\\\` to identify the 5–8 source files to read.
3. After completing a task on a new module: generate \\\`context/<module>.md\\\` via \\\`context/TEMPLATE.md\\\`.

**Routing lives in \\\`context/_index.md\\\`, not here.**
Keywords are intentionally NOT duplicated in this file — they live only in
\\\`context/_index.md\\\` to avoid drift. This file is the registry (paths, key classes,
debt anchors); \\\`_index.md\\\` is the router (keyword → context file).

---

## Module Index

\${moduleBlocks || '_No modules added yet._'}

<!-- Add one entry per module using the format above.
     Keywords live only in context/_index.md — add a routing row there for the
     agent. Do not add a Keywords field here (single source of truth = _index.md). -->
\`;
}

function generateIndexMD() {
  const rows     = Array.from(document.querySelectorAll('[id^="module-row-"]'));
  const tableRows = rows.map(row => {
    const name     = row.querySelector('.mod-name')?.value.trim()     || '[module]';
    const keywords = row.querySelector('.mod-keywords')?.value.trim() || '[add keywords]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';
    return \`| \${keywords} | \${name} | \\\`\${contextFile}\\\` |\`;
  }).join('\\n');

  return \`# Context Index
# ─────────────────────────────────────────────────────────────────────────────
# THIS IS THE AUTHORITATIVE ROUTING TABLE.
# ─────────────────────────────────────────────────────────────────────────────

## Keyword Routing Table

| Keywords | Module | Context File |
|----------|--------|--------------|
\${tableRows || '| [keywords] | [module] | \`context/[module].md\` |'}

<!-- Add a row here whenever you add a new context/<module>.md file. -->
\`;
}

// ══════════════════════════════════════════════════════
//  TECH DEBT STEP
// ══════════════════════════════════════════════════════
function buildDebtScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-debt">
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">
      Document known legacy patterns, workarounds, and code smells. The agent loads these rules and avoids replicating the debt.
    </p>
    <div class="dynamic-list" id="debt-list"></div>
    <button class="add-btn" onclick="addDebtRow()" style="margin-top:10px">+ Add Debt Entry</button>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateDebtMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('debt')">💾 Save TECH_DEBT.md</button>
      <button class="btn btn-secondary" onclick="goTo('testing')">Next →</button>
    </div>
  </div>\`;
  addDebtRow({ title: 'Example — replace with real debt', module: 'AuthFeature', status: 'OPEN' });
}

let debtCounter = 0;
function addDebtRow(defaults = {}) {
  const id  = ++debtCounter;
  const num = String(id).padStart(3, '0');
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'debt-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('debt-row-\${id}').remove(); updatePreview('debt')">✕</button>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">DEBT-\${num}</span>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Title</label>
        <input type="text" class="debt-title" value="\${esc(defaults.title||'')}" placeholder="LoginViewModel uses Combine instead of async/await" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Module</label>
        <input type="text" class="debt-module" value="\${esc(defaults.module||'')}" placeholder="AuthFeature" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Status</label>
        <select class="debt-status" onchange="updatePreview('debt')">
          <option value="OPEN"\${(defaults.status||'OPEN')==='OPEN'?' selected':''}>OPEN</option>
          <option value="SCHEDULED"\${defaults.status==='SCHEDULED'?' selected':''}>SCHEDULED</option>
          <option value="RESOLVED"\${defaults.status==='RESOLVED'?' selected':''}>RESOLVED</option>
        </select></div>
    </div>
    <div class="form-row"><label>Location (file path)</label>
      <input type="text" class="debt-location" placeholder="Sources/AuthFeature/AuthViewModel.swift" oninput="updatePreview('debt')"></div>
    <div class="form-row"><label>Impact</label>
      <input type="text" class="debt-impact" placeholder="Cannot test async flows with XCTestExpectation cleanly." oninput="updatePreview('debt')"></div>
    <div class="form-row"><label>Agent Rule (exact instruction)</label>
      <input type="text" class="debt-rule" placeholder="Do not add new Combine pipelines here. New async work uses async/await." oninput="updatePreview('debt')"></div>
    <div class="form-row"><label>Scheduled Ticket (if any)</label>
      <input type="text" class="debt-ticket" placeholder="APP-88 or —" oninput="updatePreview('debt')"></div>
  \`;
  document.getElementById('debt-list').appendChild(row);
  updatePreview('debt');
}

function generateDebtMD() {
  const rows     = Array.from(document.querySelectorAll('[id^="debt-row-"]'));
  const byModule = {};
  rows.forEach((row, i) => {
    const module   = row.querySelector('.debt-module')?.value.trim()   || 'AppCore';
    const title    = row.querySelector('.debt-title')?.value.trim()    || '[describe debt]';
    const status   = row.querySelector('.debt-status')?.value          || 'OPEN';
    const location = row.querySelector('.debt-location')?.value.trim() || '[file path]';
    const impact   = row.querySelector('.debt-impact')?.value.trim()   || '[impact]';
    const rule     = row.querySelector('.debt-rule')?.value.trim()     || '[agent rule]';
    const ticket   = row.querySelector('.debt-ticket')?.value.trim()   || '—';
    const num      = String(i + 1).padStart(3, '0');
    const badge    = row.querySelector('span[style*="color:var(--accent)"]');
    if (badge) badge.textContent = 'DEBT-' + num;
    if (!byModule[module]) byModule[module] = [];
    byModule[module].push({ num, title, status, location, impact, rule, ticket });
  });

  const moduleBlocks = Object.entries(byModule).map(([mod, entries]) => {
    const anchor = mod.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return \`## \${mod} {#\${anchor}}\\n\\n\` + entries.map(e => \`### DEBT-\${e.num} — \${e.title}

| Field | Value |
|-------|-------|
| Status | \${e.status} |
| Location | \\\`\${e.location}\\\` |
| Impact | \${e.impact} |
| Agent rule | \${e.rule} |
| Scheduled ticket | \${e.ticket} |\`).join('\\n\\n');
  }).join('\\n\\n---\\n\\n');

  return \`# Tech Debt Register
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads only the sections for modules a task touches.
# Never modifies this file.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: load only the module sections relevant to the current task.
> For every OPEN or SCHEDULED entry in scope: do not replicate the pattern.

## Status Legend

| Status | Meaning |
|--------|---------|
| OPEN | Exists in codebase. Not yet scheduled. |
| SCHEDULED | Assigned to a ticket. See "Scheduled ticket" field. |
| RESOLVED | Fixed. Entry kept for history. |

---

\${moduleBlocks || '_No debt entries added. Add entries as discovered._'}

---

## Resolved {#resolved}

<!-- Move entries here when fixed. -->
\`;
}

// ══════════════════════════════════════════════════════
//  TESTING STEP
// ══════════════════════════════════════════════════════
function buildTestingScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-testing">
    <div class="form-section">
      <h3>Test Frameworks</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        \${[
          ['test-runner',    'Test Runner',         'XCTest',          ['XCTest','Swift Testing']],
          ['mocking',        'Mocking',             'Manual Mocks',    ['Manual Mocks','Mockingbird','Cuckoo']],
          ['flow-test',      'Async testing',       'XCTestExpectation',['XCTestExpectation','async/await','None']],
          ['assertions',     'Assertions',          'XCTAssert',       ['XCTAssert','Nimble','None']],
          ['coroutines-test','Concurrency helpers', 'None',            ['None','swift-concurrency-extras']],
          ['ui-test',        'UI Tests',            'XCUITest',        ['XCUITest','None']],
        ].map(([id, label, def, opts]) => \`
        <div class="form-row">
          <label>\${label}</label>
          <select id="test-\${id}" onchange="updatePreview('testing')">
            \${opts.map(o => \`<option\${o===def?' selected':''}>\${o}</option>\`).join('')}
          </select>
        </div>\`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>Coverage Targets</h3>
      \${[['vm','ViewModel','80'],['usecase','UseCase','90'],['repo','Repository','70'],['util','Utility functions','80']]
        .map(([id, label, def]) => \`
      <div class="slider-row">
        <label>\${label}</label>
        <input type="range" id="cov-\${id}" min="0" max="100" value="\${def}" oninput="document.getElementById('cov-val-\${id}').textContent=this.value+'%'; updatePreview('testing')">
        <span class="slider-val" id="cov-val-\${id}">\${def}%</span>
      </div>\`).join('')}
    </div>
    <div class="form-section">
      <h3>Testing Rules</h3>
      <div class="dynamic-list">
        \${[
          ['test-rule-one-class',   'One class per test file',              'LoginViewModelTests tests only LoginViewModel', true],
          ['test-rule-no-sleep',    'No XCTestExpectation for coroutines',  'Use async/await test functions with await directly', true],
          ['test-rule-main-actor',  '@MainActor on async test functions',   'Prevents data races when testing @MainActor ViewModels', true],
          ['test-rule-no-mock-struct','Never mock structs or concrete classes','Mock protocols only', true],
          ['test-rule-verify-sparse','Use verify() sparingly',              'Only when testing side effects', true],
        ].map(([id, label, sub, checked]) => \`
        <div class="toggle-row">
          <div><div class="toggle-label">\${label}</div><div class="toggle-sub">\${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="\${id}" \${checked?'checked':''} onchange="updatePreview('testing')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>\`).join('')}
      </div>
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateTestingMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('testing')">💾 Save TESTING.md</button>
      <button class="btn btn-secondary" onclick="goTo('datamodel')">Next →</button>
    </div>
  </div>\`;
}

function generateTestingMD() {
  const fw  = id => document.getElementById('test-' + id)?.value || '';
  const cov = id => document.getElementById('cov-' + id)?.value  || '80';
  const rule = id => document.getElementById(id)?.checked;

  const fwTable = [
    ['Unit test runner', fw('test-runner')],
    ['Mocking',          fw('mocking')],
    ['Async testing',    fw('flow-test')],
    ['Assertions',       fw('assertions')],
    ['Concurrency',      fw('coroutines-test')],
    ['UI tests',         fw('ui-test')],
  ].map(([p, l]) => \`| \${p} | \${l} | [version] |\`).join('\\n');

  const rules = [
    rule('test-rule-one-class')    && '**One class per test file.** \`LoginViewModelTests\` tests only \`LoginViewModel\`.',
    rule('test-rule-no-sleep')     && 'Use \`async/await\` test functions — \`func test_xxx() async throws\`. No \`XCTestExpectation\` for coroutine-based code.',
    rule('test-rule-main-actor')   && 'Annotate async test functions with \`@MainActor\` when testing \`@MainActor\` ViewModels.',
    rule('test-rule-no-mock-struct')&& 'Mock protocols only. Never mock structs or concrete classes.',
    rule('test-rule-verify-sparse')&& 'Use verification only for side-effect tests — not as a default assertion.',
  ].filter(Boolean).map(r => \`- \${r}\`).join('\\n');

  return \`# Testing Standards
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads this whenever a task requires writing tests.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read this file in full before writing any test. Follow every rule exactly.

## Framework Stack

| Purpose | Library | Version |
|---------|---------|---------|
\${fwTable}

---

## Unit Test Rules

**What to test:**
- Every ViewModel (state transitions, async flows, error paths)
- Every UseCase (business logic, validation, mapping)
- Every Repository (caching strategy, error handling)
- Non-trivial utility functions

**What NOT to test:**
- UIKit/SwiftUI framework internals
- Structs with no logic (DTOs, pure data)
- Code you did not write or modify in this task

\${rules}

### Test Function Naming — \\\`test_functionName_scenario_expectedResult\\\`

\\\`\\\`\\\`swift
// ✅ Correct
func test_submitLogin_withInvalidEmail_showsEmailError() async throws
func test_submitLogin_withValidCredentials_navigatesToHome() async throws
func test_loadUser_whenNetworkFails_setsErrorState() async throws

// ❌ Wrong
func testLogin()
func shouldWorkCorrectly()
\\\`\\\`\\\`

---

## Async / Concurrency Testing

\\\`\\\`\\\`swift
// ✅ async/await test — no XCTestExpectation needed
@MainActor
func test_submitLogin_withValidCredentials_navigatesToHome() async throws {
    // Arrange
    let mockUseCase = MockLoginUseCase()
    mockUseCase.stubbedResult = .success(fakeUser)
    let sut = LoginViewModel(loginUseCase: mockUseCase)

    // Act
    await sut.submitLogin()

    // Assert
    XCTAssertEqual(sut.navigationEvent, .toHome)
    XCTAssertFalse(sut.isLoading)
}

// ❌ Never block for async work
func test_submitLogin_blocksThread() {
    let expectation = expectation(description: "login")
    // ... banned for async/await ViewModels
}
\\\`\\\`\\\`

---

## Mocking Rules

- Use **protocol mocks** — never mock structs or concrete classes.
- Create \\\`Mock[Protocol].swift\\\` files in the test target.
- Stub return values via \\\`stubbedResult\\\` property.

\\\`\\\`\\\`swift
// ✅ Protocol mock
final class MockLoginUseCase: LoginUseCase {
    var stubbedResult: Result<User, Error> = .failure(AppError.unknown)
    func execute(email: String, password: String) async -> Result<User, Error> {
        stubbedResult
    }
}

// ❌ Mocking a struct or concrete class — banned
\\\`\\\`\\\`

---

## Coverage Expectations

| Layer | Minimum |
|-------|---------|
| ViewModel | \${cov('vm')}% |
| UseCase | \${cov('usecase')}% |
| Repository | \${cov('repo')}% |
| Utility functions | \${cov('util')}% |
\`;
}

// ══════════════════════════════════════════════════════
//  DATA MODEL STEP
// ══════════════════════════════════════════════════════
function buildDataModelScreen(fp) {
  fp.innerHTML += \`
  <div class="step-screen" id="screen-datamodel">
    <div class="form-section">
      <h3>Domain Entities</h3>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
        Core business objects. API contracts belong in each module's <code>context/</code> file — not here.
      </div>
      <div class="dynamic-list" id="entities-list"></div>
      <button class="add-btn" onclick="addEntityRow()" style="margin-top:8px">+ Add Entity</button>
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateDataModelMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('datamodel')">⚡ Generate &amp; Save DATA_MODEL.md</button>
      <button class="btn btn-secondary" onclick="goTo('done')">Finish ✨</button>
    </div>
  </div>\`;
  addEntityRow({ name: 'User', fields: 'id: String, email: String, displayName: String, createdAt: Date' });
}

let entityCounter = 0;
function addEntityRow(defaults = {}) {
  const id  = ++entityCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'entity-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('entity-row-\${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">
      <div class="form-row"><label>Entity Name</label>
        <input type="text" class="entity-name" value="\${esc(defaults.name||'')}" placeholder="User" oninput="updatePreview('datamodel')"></div>
      <div class="form-row"><label>Fields (comma-separated: name: Type)</label>
        <input type="text" class="entity-fields" value="\${esc(defaults.fields||'')}" placeholder="id: String, email: String, createdAt: Date" oninput="updatePreview('datamodel')"></div>
    </div>\`;
  document.getElementById('entities-list').appendChild(row);
  updatePreview('datamodel');
}

let endpointCounter = 0;
function addEndpointRow(defaults = {}) {
  const id  = ++endpointCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'endpoint-row-' + id;
  row.innerHTML = \`
    <button class="remove-btn" onclick="document.getElementById('endpoint-row-\${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:120px 1fr;gap:10px">
      <div class="form-row"><label>Method</label>
        <select class="ep-method" onchange="updatePreview('datamodel')">
          <option\${defaults.method==='POST'?' selected':''}>POST</option>
          <option\${defaults.method==='GET'?' selected':''}>GET</option>
          <option\${defaults.method==='PUT'?' selected':''}>PUT</option>
          <option\${defaults.method==='PATCH'?' selected':''}>PATCH</option>
          <option\${defaults.method==='DELETE'?' selected':''}>DELETE</option>
        </select></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="ep-path" value="\${esc(defaults.path||'')}" placeholder="/users/me" oninput="updatePreview('datamodel')"></div>
    </div>
    <div class="form-row"><label>Request body (JSON)</label>
      <textarea class="ep-req" rows="2" placeholder='{"key":"value"}' oninput="updatePreview('datamodel')">\${esc(defaults.reqBody||'')}</textarea></div>
    <div class="form-row"><label>Response 200 (JSON)</label>
      <textarea class="ep-resp" rows="2" placeholder='{"key":"value"}' oninput="updatePreview('datamodel')">\${esc(defaults.respBody||'')}</textarea></div>
    <div class="form-row"><label>Error codes</label>
      <input type="text" class="ep-errors" value="\${esc(defaults.errors||'')}" placeholder="401 unauthorized, 404 not found" oninput="updatePreview('datamodel')"></div>
  \`;
  document.getElementById('endpoints-list').appendChild(row);
  updatePreview('datamodel');
}

function generateDataModelMD() {
  const entities = Array.from(document.querySelectorAll('[id^="entity-row-"]')).map(row => {
    const name   = row.querySelector('.entity-name')?.value.trim()   || 'Entity';
    const fields = row.querySelector('.entity-fields')?.value.trim() || 'id: String';
    const parsedFields = fields.split(',').map(f => {
      const parts = f.trim().split(':');
      return { fname: (parts[0]||'field').trim(), ftype: (parts[1]||'String').trim() };
    });
    const fieldLines = parsedFields.map(({ fname, ftype }) => \`    let \${fname}: \${ftype}\`).join('\\n');
    const fieldTable = parsedFields.map(({ fname, ftype }) => \`| \\\`\${fname}\\\` | \\\`\${ftype}\\\` | [add rule] |\`).join('\\n');
    return \`### \${name}

\\\`\\\`\\\`swift
struct \${name}: Codable, Equatable {
\${fieldLines}
}
\\\`\\\`\\\`

| Field | Type | Validation |
|-------|------|-----------|
\${fieldTable}
\`;
  }).join('\\n');

  return \`# Data Model
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED after initial wizard generation. Edit directly to add domain entities.
# API contracts belong in each module's context/ file, not here.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: load this file for tasks involving domain models, DB schema, or layer mapping rules.
> API contracts (request/response shapes) live in context/<module>.md — not here.
> The mapping rules below are non-negotiable — never expose DTOs or DB entities to the View layer.

---

## Mapping Conventions

\\\`\\\`\\\`
Network DTO (Codable)  ──→  Domain model (pure Swift)  ──→  UI model / ViewState
DB Entity (@Model)     ──→  Domain model               ──→  UI model / ViewState
\\\`\\\`\\\`

| Mapping | Where it happens | Example |
|---------|-----------------|---------|
| Network DTO → Domain | \\\`*RemoteDataSource.swift\\\` or \\\`*Mapper.swift\\\` | \\\`AuthMapper.swift\\\` |
| DB Entity → Domain | \\\`*LocalDataSource.swift\\\` | \\\`UserMapper.swift\\\` |
| Domain → UI model | ViewModel or \\\`*UiMapper.swift\\\` | \\\`UserViewMapper.swift\\\` |

### Anti-patterns (agent must never do these)

\\\`\\\`\\\`swift
// ❌ Exposing a Codable DTO to the ViewModel
class AuthRepository {
    func login() async throws -> AuthResponse  // banned — map to domain model
}

// ❌ Domain model conforming to Codable or @Model
@Model class User { ... }  // banned — domain is pure Swift, no framework annotations

// ✅ Correct — repository returns domain model
class AuthRepositoryImpl: AuthRepository {
    func login(email: String, password: String) async throws -> User {
        let response = try await apiService.login(LoginRequest(email: email, password: password))
        return response.toDomain()
    }
}

// ✅ Extension mapper — DTO → Domain
extension AuthResponse {
    func toDomain() -> User {
        User(id: id, email: email, displayName: displayName ?? "")
    }
}
\\\`\\\`\\\`

---

## Domain Entities

\${entities || '_No entities added yet._'}

---

## API Contracts

> API contracts (request/response shapes, error codes, base URLs) live in each module's
> \\\`context/<module>.md\\\` under "What the Agent Should Know".
> Add them there so the agent loads only the contracts relevant to the task at hand.
\`;
}

// ══════════════════════════════════════════════════════
//  PLATFORM config — consumed by wizard-core.js init()
// ══════════════════════════════════════════════════════
const PLATFORM = {
  id:   'ios',
  name: 'iOS (Swift)',

  steps: [
    { id: 'welcome', icon: '👋', label: 'Welcome', file: null },
    {
      id: 'projectconfig', icon: '⚙️', label: 'Project Config', file: 'project.config.md',
      who: 'Tech lead fills once',
      desc: 'Codebase path, platform, bundle ID, deployment target, and team preferences. Read by the agent at the start of every session.',
      critical: [
        '<strong>codebase_path must be an absolute path</strong> — the agent resolves every file reference from here.',
        'bundle_id must be the base production identifier, not a scheme-specific override.',
        'Build schemes are for agent awareness — they prevent confusion between Debug/Staging bundle IDs and the production one.',
      ],
      mistakes: [
        'Using a scheme-specific bundle ID (e.g. com.example.app.debug) as bundle_id instead of the base production bundle ID',
        'Leaving codebase_path as a placeholder — the agent cannot find any files without it',
      ],
    },
    {
      id: 'architecture', icon: '🏛️', label: 'Architecture', file: 'spec-kit/ARCHITECTURE.md',
      artifact: true,
      who: 'Wizard generates from form input',
      desc: 'Module structure, navigation, ADRs, patterns, and known violations.',
      critical: [
        'ADRs are the most important part — document <strong>why</strong> each major decision was made.',
        'List known violations (screens that break the pattern). Without this, the agent "fixes" intentional exceptions.',
        'Keep base URLs and auth here — not in DATA_MODEL.md.',
      ],
      mistakes: [
        'Leaving the ADR section empty — the agent will make architectural decisions without context',
        "Documenting only the \\"what\\" without the \\"why\\"",
      ],
    },
    {
      id: 'conventions', icon: '📐', label: 'Conventions', file: 'spec-kit/CONVENTIONS.md',
      who: 'Tech lead writes',
      desc: 'Non-negotiable Swift coding standards with ❌/✅ examples. Every rule the agent must follow exactly.',
      critical: [
        'The <strong>Quality Gate section</strong> is read by the agent in Step 6b for every task.',
        'Rules here override CLAUDE.md defaults — use this to make platform-specific exceptions.',
        'Include ❌ anti-patterns alongside ✅ correct patterns.',
      ],
      mistakes: [
        'Writing rules without Swift code examples — abstract rules are ignored or misapplied',
        'Not updating the Quality Gate after changing coding standards',
      ],
    },
    {
      id: 'migrations', icon: '🔄', label: 'Migration Rules', file: 'spec-kit/MIGRATION_RULES.md',
      who: 'Tech lead writes',
      desc: 'How to handle legacy patterns (UIKit, Combine, ObjC, callbacks). Never forces a full migration.',
      critical: [
        '<strong>Scope Guard</strong>: rules apply only to lines the agent adds or the immediate surrounding context.',
        "List every legacy pattern that exists. If it's not here, the agent may replicate it.",
      ],
      mistakes: [
        'Not specifying scope — without the Scope Guard, the agent rewrites entire files',
        'Omitting a legacy pattern that exists — the agent will see it and try to "fix" it',
      ],
    },
    {
      id: 'modules', icon: '📦', label: 'Modules', file: 'spec-kit/MODULE_MAP.md',
      artifact: true,
      who: 'Wizard generates from project scan + form input',
      desc: 'Module registry — one entry per SPM target or feature module.',
      critical: [
        '<strong>Keywords here are for human reference only.</strong> Agent routing uses <code>context/_index.md</code>.',
        'The <code>Key classes</code> field is the fallback when no context file exists.',
        'Every module entry must have a matching section in TECH_DEBT.md.',
      ],
      mistakes: [
        'Thinking this file routes the agent — routing is in context/_index.md',
        'Leaving Key classes blank — the agent has nothing to fall back on',
      ],
    },
    {
      id: 'debt', icon: '🔧', label: 'Tech Debt', file: 'spec-kit/TECH_DEBT.md',
      who: 'Team writes',
      desc: 'Known debt by module with status and precise agent rules per entry.',
      critical: [
        '<strong>The Agent rule field is the most important.</strong> Must be an exact instruction.',
        'Section anchors must exactly match the Known debt links in MODULE_MAP.md.',
      ],
      mistakes: [
        'Writing impact descriptions instead of agent rules',
        'Anchor ID mismatch with MODULE_MAP',
      ],
    },
    {
      id: 'testing', icon: '🧪', label: 'Testing', file: 'spec-kit/TESTING.md',
      who: 'Tech lead writes',
      desc: 'Framework stack, ViewModel test pattern with async/await, mocking rules, coverage targets.',
      critical: [
        'Test naming convention (<code>test_functionName_scenario_expectedResult</code>) enforced by Quality Gate.',
        'Specify protocol mock approach — the agent defaults to whatever it sees first.',
      ],
      mistakes: [
        'Leaving coverage targets blank',
        'Not specifying @MainActor requirement for ViewModel tests',
      ],
    },
    {
      id: 'datamodel', icon: '🗄️', label: 'Data Model', file: 'spec-kit/DATA_MODEL.md',
      artifact: true,
      who: 'Wizard generates from form input',
      desc: 'Domain entities, API contracts, and field-level notes.',
      critical: [
        '<strong>Mapping direction is non-negotiable</strong>: DTO → Domain model → UI model. Never expose DTOs.',
        'Document "already exists" vs "must be added" for every request body field.',
      ],
      mistakes: [
        'Putting base URLs here instead of ARCHITECTURE.md',
        'Documenting only the response, not the request body',
      ],
    },
    { id: 'done', icon: '✅', label: 'Done', file: null },
  ],

  buildScreens: {
    projectconfig: fp => buildProjectConfigScreen(fp),
    architecture:  fp => buildArchitectureScreen(fp),
    conventions:   fp => buildConventionsScreen(fp),
    migrations:    fp => buildMigrationsScreen(fp),
    modules:       fp => buildModulesScreen(fp),
    debt:          fp => buildDebtScreen(fp),
    testing:       fp => buildTestingScreen(fp),
    datamodel:     fp => buildDataModelScreen(fp),
  },

  generate: {
    projectconfig: () => generateProjectConfigMD(),
    architecture:  () => generateArchitectureMD(),
    conventions:   () => generateConventionsMD(),
    migrations:    () => generateMigrationsMD(),
    modules:       () => generateModulesMD(),
    debt:          () => generateDebtMD(),
    testing:       () => generateTestingMD(),
    datamodel:     () => generateDataModelMD(),
  },

  extraSave: {
    modules: async () => {
      const idx = generateIndexMD();
      await saveFile('context/_index.md', idx);
    },
  },

  onFolderGranted: () => analyzeProject(),

  onDraftRestored: () => {
    renderApproachRows('async');
    renderApproachRows('state');
    refreshModuleChips();
    updateArchProgress();
    // Recreate custom rule rows so restoreDraft can fill their inputs/textareas
    const count = parseInt(document.getElementById('custom-rule-count')?.value || '0', 10);
    for (let i = 0; i < count; i++) addCustomRuleRow();
  },

  onConfigLoaded: (text) => {
    const get    = key => text.match(new RegExp(\`^\${key}:\\\\s*(.+)\`, 'm'))?.[1]?.trim() ?? '';
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

    setVal('cfg-codebase-path',  get('codebase_path'));
    setVal('cfg-bundle-id',      get('bundle_id'));
    setVal('cfg-deploy-target',  get('deployment_target'));
    setVal('cfg-xcode-ver',      get('xcode_version'));
    setVal('cfg-branch',         get('branch_convention'));

    const platform = get('platform');
    const lang     = get('primary_language');
    const defTests = get('default_tests');
    if (platform) selectPill('cfg-platform', platform, 'radio');
    if (lang)     selectPill('cfg-lang', lang, 'radio');
    if (defTests) selectPill('cfg-tests', defTests, 'radio');

    // Restore build schemes
    const schemeMatches = [...text.matchAll(/^#\\s{2,4}(\\w+):\\s+(\\S+)(?:\\s+#\\s*(.+))?$/gm)];
    const schemes = schemeMatches
      .filter(([, name]) => !['Relative','Resolved','All','Use','bundleId','bundle_id'].includes(name))
      .map(([, name, bundleId, note = '']) => ({ name, bundleId, note: note.trim() }));
    if (schemes.length > 0) {
      const list = document.getElementById('cfg-schemes-list');
      if (list) { list.innerHTML = ''; schemeCounter = 0; schemes.forEach(s => addSchemeRow(s)); }
    }

    const banner = document.getElementById('cfg-existing-banner');
    if (banner) banner.style.display = 'flex';
    updatePreview('projectconfig');
    showToast('Existing project.config.md loaded — review and save or skip', 'success');
  },

  taskDefaults: {
    qualityGate: [
      { id: 'no-force-unwrap',   label: 'No force unwrap (\`!\`) — use \`guard let\`, \`if let\`, or \`??\`' },
      { id: 'no-dispatch-main',  label: 'No \`DispatchQueue.main\` in ViewModel — use \`@MainActor\`' },
      { id: 'no-biz-view',       label: 'No business logic in View or ViewController' },
      { id: 'no-userdefaults',   label: 'No \`UserDefaults\` direct access — use storage abstraction' },
      { id: 'exhaustive-switch', label: 'All \`switch\` on enums are exhaustive — no \`default\` on known types' },
      { id: 'test-naming',       label: 'Tests follow \`test_functionName_scenario_expectedResult\` naming' },
    ],
  },
};
`;

const SKELETON_CHANGELOG = {"1.2":{"date":"2026-06-08","notes":["Context freshness check: the agent verifies a context file's Key Files still exist before trusting it, and re-derives from source if any are missing.","Keywords are no longer duplicated in `MODULE_MAP.md` — `context/_index.md` is the single routing source of truth, eliminating spec-to-spec drift.","Closed the verification loop: the agent now builds/compiles and runs tests in Step 6 and must report real outcomes — code it cannot build or test can no longer report PASS.","Warn-only security scan: the agent flags hardcoded secrets (file:line) and surfaces them in the completion report, but never fixes, redacts, or moves them — remediation stays human.","Branch ownership made explicit: the agent assumes the correct branch is checked out and stops if it lands on main/master/develop.","CLAUDE.md viewer readability: stylesheet now applies, numbered lists and bare comment dividers render correctly, and the maintainer header is hidden in the preview."]},"1.1":{"date":"2026-06-07","notes":["Version manifest (`agent-artifacts/.sdd-version`) and a wizard \"Update available\" banner so projects know when their snapshot is behind the skeleton.","Single source of truth: clean source files are embedded into the wizard by `engine/generate-embedded.js` (no drift between source and the shipped copies).","Git safety: `git-guard.sh` hook plus git deny rules, and absolute-path normalization in the hook scripts."]}};
const EMBEDDED_CLAUDE_MD = `# CLAUDE.md — Agent Entry Point
# Snapshot version: 1.2 — regenerate via the SDD setup wizard to update
# ─────────────────────────────────────────────────────────────────────────────
# READ THIS FILE COMPLETELY BEFORE DOING ANYTHING ELSE.
# This file governs every session. No exceptions.
# ─────────────────────────────────────────────────────────────────────────────
#
# 📋 HOW THIS FILE IS USED:
#
# 1. This file is generated by the SDD setup wizard and written to
#    agent-artifacts/CLAUDE.md when setup completes.
#    → Projects use: claude "Read agent-artifacts/CLAUDE.md and execute ..."
#    → It is self-contained — no runtime path dependency on the agent-sdd/ tool.
# 2. Protection: agent-artifacts/CLAUDE.md is read-only (hooks block edits).
#    → To update, re-run the setup wizard to get the latest version.
# 3. Maintainers: this file (agent-sdd/CLAUDE.md) is the master source.
#    Edit it here, bump agent-sdd/VERSION, then run
#    \`node agent-sdd/engine/generate-embedded.js\` to sync it into
#    wizard-core.js (EMBEDDED_CLAUDE_MD). Never hand-edit the embedded copy.
# ─────────────────────────────────────────────────────────────────────────────

## Agentic AI Principles — Read This First

You are an **autonomous AI agent**, not a one-shot code generator.
You plan before you act, verify before you report, and stop when you are uncertain.

### How You Operate

Every session follows this loop — no exceptions:

\`\`\`
PERCEIVE  → Load context. Understand what already exists.
PLAN      → Break the goal into steps. State your plan before touching anything.
EXECUTE   → Work through each step. One step at a time.
EVALUATE  → Verify your own work. Fix what fails. Surface what is blocked.
REPORT    → Tell the developer exactly what was done and what was not.
\`\`\`

### What You Never Do

These are non-negotiable. No exceptions. No reasoning around them.

| Action | Why |
|--------|-----|
| \`git commit\` | All commits are a human decision — you write code, developer reviews and commits |
| \`git push\` | Remote history is owned by the developer — never push anything |
| \`git add\` / stage | Staging is part of the commit workflow — off limits |
| \`git merge\` / \`rebase\` / \`tag\` | Branch and history operations are human decisions |
| \`git reset --hard\` / \`git clean\` | These destroy work permanently — never run them |
| Modify \`agent-sdd/\` files | The skeleton is read-only for everyone including you |
| Modify \`agent-artifacts/spec-kit/\` files | These are read-only inputs — wizard-generated or human-authored |
| Fix things outside task scope | Out-of-scope changes make diffs unreviable — log and move on |

> **Why no commits?** The developer must review every change before it enters git history.
> Your job is to produce correct, reviewable code changes. Their job is to commit them.

### When to Stop

Stop immediately and surface the issue to the developer when:
- An acceptance criterion is **ambiguous** — quote the unclear text, ask one specific question
- A criterion is **blocked** by a missing dependency — name exactly what is missing
- You discover something **unexpected** in the codebase that changes the task — describe what you found
- A quality gate check **cannot be fixed** — explain why

**Never guess. Never proceed on uncertainty. Stopping is the right answer.**

### How You Handle a Goal vs a Task

- **Task file exists** (\`agent-artifacts/tasks/PROJ-1234.md\`) → follow Steps 0–8 below. Developer has already approved the spec — execute it.

- **Goal stated in plain English** → do NOT touch any code yet. First:
  1. Load context — bootstrap any missing modules
  2. Propose a task breakdown in this format:

  \`\`\`
  ### Plan

  **Goal:** [restate the goal]

  **Modules affected:** [list]

  **Proposed tasks:**
  1. [Task title] — [what it does] — Acceptance criteria: [list]
  2. [Task title] — [what it does] — Acceptance criteria: [list]
  ...

  **Out of scope:** [anything you are explicitly NOT doing]

  **Estimated files touched:** [list key files]

  Does this plan look right? Say **yes** to proceed or tell me what to change.
  \`\`\`

  3. **STOP. Wait for developer approval.** Do not write a single line of code until the developer confirms.
  4. Once approved — execute each task in order, following Steps 0–8 for each one.

---

## What This Is

You are an AI agent executing a development task on a software project.
This SDD skeleton gives you everything you need to work accurately and safely:
- Project configuration (\`agent-artifacts/project.config.md\`)
- Architecture knowledge (\`agent-artifacts/spec-kit/\`)
- Per-module living docs (\`agent-artifacts/context/\`)
- Optional plug-n-play skills (\`agent-artifacts/skills/\`) — activated per ticket
- The task to execute (\`agent-artifacts/tasks/<TICKET-ID>.md\`)

**Directory layout:**
- \`agent-sdd/\` — the skeleton tool (wizard, templates, **this CLAUDE.md file**). Read-only — never modify anything here.
- \`agent-artifacts/\` — your project's generated spec-kit, context files, and tasks. All agent reads and writes go here. **Does NOT contain CLAUDE.md.**

**What "module" means in this framework:**
A module is a **logical grouping of code** defined in \`agent-artifacts/spec-kit/MODULE_MAP.md\`.
It is NOT necessarily a Gradle module, an SPM package, or any build-system concept.
It could be a feature folder in a single-module app, a Gradle subproject in a multi-module Android app,
an SPM package in iOS, or any other organisation the project uses.
The \`Path\` field in MODULE_MAP.md is the only thing that matters — it tells you exactly where the code lives.
Never assume. Always follow the \`Path\`.

Your job: read the task MD, load the right context, write the code, update
the context files, and produce a completion report. Nothing more.

---

## Step 0 — Read project.config.md

Read \`agent-artifacts/project.config.md\` first. Extract:
- \`codebase_path\` — all source file paths resolve from here
- \`platform\` and \`primary_language\` — governs which conventions apply
- \`default_tests\` — Y means write tests unless task says otherwise
- \`branch_convention\` — for completion report

**Resolving codebase_path:** If the value starts with \`.\` (e.g. \`..\`), it is a
relative path from the \`agent-artifacts/\` folder. Resolve it to an absolute path before
using it. Example: if \`agent-artifacts/\` is at \`/project/agent-artifacts/\` and
\`codebase_path: ..\`, the resolved path is \`/project/\`.

**Branch ownership:** Assume the developer has already checked out the correct branch.
You never create, switch, merge, or push branches — all git write operations are off limits
(see Git rules). \`branch_convention\` is read only so your completion report can reference it.
If \`git status\` shows you are on \`main\` / \`master\` / \`develop\`, do not start — stop and ask the
developer to check out the right branch first.

---

## Spec-Kit File Types

Two types of files exist in \`spec-kit/\`. Both are read-only for the agent. They differ in
**how a human updates them**.

### AI Artifacts
Generated by the setup wizard from structured form input.
The file header reads \`AI-GENERATED ARTIFACT\`.
**Update workflow: re-run the wizard step → Generate & Save. Do not edit manually.**

| File | Generated by |
|------|-------------|
| \`ARCHITECTURE.md\` | Architecture wizard step |
| \`MODULE_MAP.md\` | Modules wizard step |
| \`DATA_MODEL.md\` | Data Model wizard step |

### Human-Authored Specs
Written and maintained directly by the tech lead in markdown.
The file header reads \`HUMAN-AUTHORED\`.
**Update workflow: open the file, edit, commit.**

| File | Content |
|------|---------|
| \`CONVENTIONS.md\` | Coding standards, naming conventions, quality gate |
| \`MIGRATION_RULES.md\` | Legacy → modern migration rules with scope guard |
| \`TESTING.md\` | Test patterns, naming, framework stack, coverage targets |
| \`TECH_DEBT.md\` | Known debt register with per-entry agent rules |

**Agent rule: reads all spec-kit files. Modifies none. Ever.**

---

## Step 1 — Load Tiered Context (always in this order)

Attempt every tier before reading the task. **If a file does not exist, skip it silently and
note the gap — do not stop execution.** A missing optional spec file means reduced guidance
in that area, not a blocking error.

| Tier | What to load | Condition |
|------|-------------|-----------|
| 1 | \`agent-artifacts/spec-kit/ARCHITECTURE.md\` + \`agent-artifacts/spec-kit/MODULE_MAP.md\` | Always — if missing, note the gap and continue with reduced accuracy |
| 2 | \`agent-artifacts/spec-kit/CONVENTIONS.md\` + \`agent-artifacts/spec-kit/MIGRATION_RULES.md\` + \`agent-artifacts/spec-kit/TESTING.md\` | Load each if present — skip silently if not |
| 3 | \`agent-artifacts/context/_index.md\` → match task keywords → load \`agent-artifacts/context/<module>.md\` for each match | Load if present — if \`_index.md\` is missing, skip Tier 3 entirely |
| 4 | Relevant sections of \`agent-artifacts/spec-kit/TECH_DEBT.md\` | If present and touching legacy code or files listed in debt register |
| 5 | Relevant sections of \`agent-artifacts/spec-kit/DATA_MODEL.md\` | If present and task touches data models, APIs, DB, or network |
| 6 | Source files listed in the loaded context files that are expected to change | Per task |

**Missing file behaviour:**
- Tier 1 missing → state in Understanding: "ARCHITECTURE.md / MODULE_MAP.md not found — proceeding without structural context"
- Tier 2 file missing → skip that file, apply platform defaults for that area
- Tier 3 missing → skip module context lookup, read source files directly
- Tiers 4–5 missing → skip, do not mention

**Multi-module tasks:** If the task touches more than one module, load all matching
context files (Tier 3) before reading any source files.

**Context freshness check (do this for every Tier 3 context file you load):**
A context file is a snapshot — code may have changed since it was written, by a human
or another agent. Before you trust its contents:
1. Read the **Key Files** table in the context file.
2. Verify each listed path still exists (relative to \`codebase_path\`).
3. **If every Key File exists → trust the context** and proceed normally.
4. **If any Key File is missing or renamed → treat the context as STALE.** Do not trust its
   file paths, state shapes, or "Key Files" list. Re-derive from reality: read the actual
   source at the module's \`Path\` (per \`MODULE_MAP.md\`), proceed using what you observe, and
   record \`**Context status:** stale — re-derived from source\` in your Understanding.
   You MUST refresh that context file in Step 7 (correct the Key Files table and any
   state/behaviour that changed).

Do not silently rely on a context file whose Key Files no longer exist — a confidently wrong
map is worse than no map. When in doubt, verify against source before acting.

**Module not in context/:** Check \`agent-artifacts/spec-kit/MODULE_MAP.md\` by module name.
Use the \`Path\` field as the source of truth for where to find the code — this may be a
Gradle module, an SPM package, a feature folder, or any directory structure depending on the project.
Do not assume any particular project layout. Follow the path exactly as written.
If the module has no context file yet: **stop and bootstrap it first** — read the source files
at the given \`Path\`, generate \`agent-artifacts/context/<module>.md\` using \`agent-artifacts/context/TEMPLATE.md\`,
then resume the task with full context. Do not execute the task blind.

**Evidence-only rule (applies to all bootstrapping):** Record only what you can confirm directly
from the source files at \`Path\`. Any claim you cannot verify from the code — ownership, intent,
external dependencies, runtime behaviour — must be written as \`[not confirmed — verify with team]\`
rather than inferred or guessed. Never fabricate module facts to fill the template.
**Never copy secret values** (keys, tokens, credentials) into a context file — reference the file
where one lives, but do not reproduce the value.

---

## Step 2 — Read the Task MD

Read the task file the developer has provided (e.g., \`agent-artifacts/tasks/[PROJ]-1234.md\`).
Extract:
- Ticket ID and title
- Type (Feature / Bug / Refactor / Task)
- **Skills** (the \`Skills:\` line — see "Skills (plug-n-play)" below)
- Description
- Acceptance criteria (these are your definition of done)
- Out of scope (treat these as hard constraints — do not implement them)
- Affected areas (use to confirm or expand Tier 3 context loading)
- Testing requirements
- Any designs or reference links

### Skills (plug-n-play)

A skill is an **optional instruction module** that adds requirements for a single ticket.
Skills are **off by default**.

1. Read the task's \`Skills:\` line. If it is missing or says \`none\` → no skills active; run the
   normal workflow unchanged.
2. For each skill named, load \`agent-artifacts/skills/<skill>.md\` (the registry of available
   skills is \`agent-artifacts/skills/_index.md\`).
3. Apply each active skill's rules **on top of** Steps 3–8 — typically an added line in your
   Understanding (Step 3), extra checks in Self-Verification (Step 6), and an extra section in
   the completion report (Step 8). Each skill file states exactly what it adds.
4. A skill only **adds** requirements — it never relaxes a Hard Rule or the base quality gate.
5. If a named skill has no matching file in \`agent-artifacts/skills/\`, note the gap in your
   Understanding and continue — do not stop.

---

## Step 3 — State Your Understanding BEFORE Touching Code

Write out the following before writing a single line of code.
If anything is ambiguous, stop here (see Ambiguity Protocol below).

\`\`\`
### Understanding

**Affected modules:** [list each module]

**Context files loaded:** [list each agent-artifacts/context/<module>.md]

**Context status:** fresh / stale — re-derived from source [name any context file whose Key Files were missing]

**Files to create:**
- path/to/NewFile.[kt|swift] — [one-line reason]

**Files to modify:**
- path/to/ExistingFile.[kt|swift] — [one-line reason]

**Migration rules that apply:**
- [RULE-ID]: [how it affects this task]

**Tech debt in scope:**
- [DEBT-ID]: [what it means for this task]

**Ambiguities:** None / [list if any]
\`\`\`

### Ambiguity Protocol

If any acceptance criterion is unclear or contradictory:
1. Quote the exact text that is unclear
2. Ask ONE specific question
3. STOP — do not write code until the developer responds

Do not assume. Do not interpret charitably and proceed. Stop and ask.

---

## Step 4 — Confirm Tests

If the task MD specifies \`Required: Y\` or \`Required: N\` → use that.
If the task MD is silent AND \`default_tests: Y\` in \`project.config.md\` → write tests, no need to ask.
If the task MD is silent AND \`default_tests: N\` → ask: "Do you want tests for this task? [Y/N]"

---

## Step 5 — Execute

Write code following \`agent-artifacts/spec-kit/CONVENTIONS.md\` and \`agent-artifacts/spec-kit/MIGRATION_RULES.md\` exactly.
Apply \`agent-artifacts/spec-kit/TESTING.md\` for all test files.

**Execution order:**
1. Create new files first (models, repositories, use cases)
2. Modify existing files
3. Write test files last (or interleaved per TDD if specified)

---

## Step 6 — Self-Verification (do not skip)

Before writing the completion report, verify your own work.
This step is not optional. If verification fails, self-correct first, then re-verify.

### 6a — Acceptance Criteria Check

For each acceptance criterion in the task MD, state exactly how it is satisfied:

\`\`\`
- [x] Criterion 1 — verified: [specific evidence — file, function, line, test name]
- [x] Criterion 2 — verified: [specific evidence]
- [ ] Criterion 3 — BLOCKED: [exact reason — missing API / external dependency / out of scope]
\`\`\`

"I implemented it" is not evidence. Name the file, function, or test that proves it.

If a criterion is **blocked**, stop here. Surface it to the developer before proceeding.
Do not mark it done. Do not work around it silently.

### 6b — Build & Test Execution

Static checks are not proof. Code that passes the quality gate below can still fail to compile.
Close the loop by actually running the project:

1. **Build / compile** the code you changed using the project's toolchain — prefer the narrowest task:
   - Android / Kotlin → \`./gradlew <module>:assembleDebug\` (or \`:compileDebugKotlin\`)
   - iOS / Swift → \`xcodebuild build\` for the scheme, or \`swift build\`
   - If \`agent-artifacts/spec-kit/CONVENTIONS.md\` or \`project.config.md\` names a build command, use that.
2. **Run the tests** you wrote, plus those covering the code you touched (\`./gradlew test\`, \`xcodebuild test\`, etc.).
3. Report the actual outcome — compiler errors, test pass/fail counts. Not "should compile." The real result.

If you **cannot** execute (no toolchain, build exceeds a reasonable time, missing environment), do
NOT claim success. State \`Build/tests not run — <reason>\` and reflect that in the verdict so the
developer knows verification is incomplete. **Never report PASS for code you could neither build nor test.**

### 6c — Quality Gate

Read \`platform\` from \`agent-artifacts/project.config.md\`. Apply the matching defaults below.
\`agent-artifacts/spec-kit/CONVENTIONS.md\` takes precedence over these defaults if it defines the same check.

Scan every file you created or modified against the checks for your platform:

**Android / Kotlin**

| Check | Rule |
|-------|------|
| No \`!!\` operators | Use \`?.let {}\`, \`?: return\`, or \`requireNotNull\` |
| No new \`LiveData\` | New state uses \`StateFlow\` only |
| No \`GlobalScope\` | All coroutines in \`viewModelScope\` or \`lifecycleScope\` |
| No hardcoded strings | All user-visible text in \`strings.xml\` |
| No hardcoded colors or dimensions | Use theme attributes or \`dimens.xml\` |
| Sealed types are exhaustive | No \`else\` on \`when\` over sealed class/interface |
| No business logic in UI layer | Composables, Fragments, Activities call ViewModel only |
| ViewModel has no Android imports | No \`Context\`, \`View\`, \`FragmentManager\` |
| DTOs/Entities not exposed to UI | Repository returns domain models only |
| Tests follow TESTING.md naming | \`functionName_scenario_expectedResult\` |

**iOS / Swift**

| Check | Rule |
|-------|------|
| No force unwrap (\`!\`) | Use \`guard let\`, \`if let\`, or \`??\` |
| No force cast (\`as!\`) | Use \`as?\` with a guard or safe fallback |
| No \`DispatchQueue.main.sync\` | Use \`await MainActor.run\` or \`@MainActor\` annotation |
| No hardcoded strings | All user-visible text in \`Localizable.strings\` or \`LocalizedStringKey\` |
| No hardcoded colors or dimensions | Use \`Assets.xcassets\` named colors or a \`DesignTokens\` extension |
| No business logic in Views | SwiftUI Views and ViewControllers call ViewModel/Presenter only |
| ViewModel has no UIKit imports | No \`UIView\`, \`UIViewController\`, \`UIApplication\` in ViewModel files |
| DTOs/Entities not exposed to UI | Repository returns domain models only |
| No \`@State\` for shared state | Cross-view state uses \`@StateObject\` / \`@ObservedObject\` / \`@Observable\` |
| Tests follow TESTING.md naming | \`functionName_scenario_expectedResult\` |

For each failure found: **fix it before proceeding.** Log what you fixed under Self-Corrections.

**Active skills:** if the task activated any skills (Step 2), run each active skill's own gate now
as well (e.g. the Accessibility Gate, the Analytics Gate). Their checks are additional to — never a
replacement for — the base quality gate above.

### 6d — Security Scan (warn only — NEVER fix)

Scan every file you created or modified for hardcoded secrets: API keys, tokens, passwords,
private keys, connection strings, or any credential embedded in source instead of secure config.

**Do NOT fix, remove, redact, rotate, or move anything you find.** Touching a secret can break a
build, mask a leak that needs proper rotation, or destroy evidence the developer needs. Unlike the
quality gate, this step is **warn-only** — you flag, the developer remediates.

For each finding, record \`file:line\` and the suspected secret type, then:
- Surface it prominently in your response to the developer, and
- Capture it under **Security warnings** in the completion report (Step 8).

This covers code you wrote AND any pre-existing secret you happen to notice in files you read —
report it even if it is out of task scope. Security warnings do **not** block the verdict, but they
must never be silently dropped.

**Prevention:** never inline a secret in code you write in the first place — reference secure
config / environment variables and note what value the developer must supply.

### 6e — Self-Corrections

List every fix you made during verification:

\`\`\`
- [File:line] — [what was wrong] → [what was changed]
\`\`\`

If none: write "None."

### 6f — Verdict

\`\`\`
Verdict: PASS / BLOCKED

Build:  [passed / FAILED / not run — reason]
Tests:  [N passed, M failed / not run — reason]

If BLOCKED: [state exactly what is missing and what the developer needs to provide]
\`\`\`

A failing build or failing tests means **BLOCKED**, not PASS. "Not run" is not a pass either —
say so honestly. Security warnings do not block the verdict but must be carried into the report.
Only proceed to Step 7 if verdict is **PASS**.

---

## Step 7 — Update Context Files

After verification passes, update \`agent-artifacts/context/<module>.md\` for every module you touched:
- Add new files to the Key Files table
- Update State Management if ViewModel state changed
- Update Known Debt if new debt was introduced
- Update Tests section with new test files
- Update "What the Agent Should Know" with any non-obvious discoveries
- Set "Last updated" to today's date and the ticket ID
- **If you flagged this context as STALE in Step 1**, fully repair it now: correct the Key Files
  table to match the real source, and fix any state/dependency/behaviour that had drifted — not
  just the lines your task touched. The whole file must reflect current reality before you finish.

If a module had no context file, create one using \`agent-artifacts/context/TEMPLATE.md\`.
Apply the **evidence-only rule** from Step 1 — mark anything you cannot confirm from source
as \`[not confirmed — verify with team]\`.

---

## Step 8 — Write Completion Report

Use this exact format:

\`\`\`
## Done — [TICKET-ID]: [Title]

### Files created
- path/to/NewFile.[kt|swift]

### Files modified
- path/to/ExistingFile.[kt|swift] — [one line: what changed and why]

### Context files updated
- agent-artifacts/context/[module].md — [one line: what was added or changed]

### Tests written
- path/to/NewFileTest.[kt|swift] — [scenarios covered]

### Acceptance criteria
- [x] Criterion 1 — verified: [specific evidence]
- [x] Criterion 2 — verified: [specific evidence]
- [ ] Criterion 3 — BLOCKED: [reason]

### Build & tests
- Build: [passed / FAILED / not run — reason]
- Tests: [N passed, M failed / not run — reason]

### Quality gate
- [x] All checks passed
- [ ] [Any check that required a self-correction — describe what was fixed]

### Security warnings
- [file:line] — [suspected secret type] — NOT modified; developer must remediate
- None (if no secrets found)

### Self-corrections
- [File:line] — [what was wrong] → [what was changed]
- None (if no corrections were needed)

### Excluded from this ticket
- [anything intentionally omitted and why]

### Follow-up recommended
- [new debt introduced: DEBT-ID, location, description]
- [violation noticed but out of scope: file:line, what was observed]
\`\`\`

---

## Hard Rules

These rules have no exceptions. Do not reason around them.
The full list of non-negotiables is in **Agentic AI Principles** at the top of this file.

### Git rules (enforced by hooks AND this file)
- **Never run \`git commit\`, \`git push\`, \`git add\`, or any git write operation.**
- **Never run \`git reset --hard\`, \`git clean\`, \`git merge\`, \`git rebase\`, or \`git tag\`.**
- You MAY run \`git status\`, \`git diff\`, \`git log\` — read-only git is fine.
- The project's \`.claude/settings.json\` hooks will block these commands even if you try. Don't try.

### Scope rules
- **Never modify \`agent-sdd/\` files.** This is the skeleton submodule — wizard, templates, this CLAUDE.md. Read-only for everyone including the agent.
- **Never modify \`agent-artifacts/spec-kit/\` files.** These are read-only inputs — some are AI artifacts generated by the wizard, some are human-authored specs. The agent reads both and modifies neither.
- **Never create new top-level directories** in the codebase without explicit instruction.
- **Never fix tech debt outside task scope.** Log it in the completion report instead.
- **Never refactor code the task did not ask you to touch.** Diffs must be reviewable.

### Code quality rules

\`agent-artifacts/spec-kit/CONVENTIONS.md\` is the authoritative source. The defaults below apply
when CONVENTIONS.md is absent or silent on a rule.

**Android / Kotlin defaults**
- No \`!!\` null assertions. Use \`?.let {}\`, \`?: return\`, or \`requireNotNull(x) { "message" }\`.
- No hardcoded strings, colors, or dimensions. Use \`strings.xml\`, theme attributes, \`dimens.xml\`.
- No business logic in the UI layer (Composables, XML layouts, Fragments, Views, Activities).
- Every \`when\` on a sealed class or sealed interface must be exhaustive. No \`else\` on sealed types.
- No \`GlobalScope\`. All coroutines in \`viewModelScope\` (or \`lifecycleScope\` for one-shot UI ops).
- Never introduce new \`LiveData\`. New state uses \`StateFlow\` only.
- Never convert Java to Kotlin unless the task explicitly instructs it.
- No \`lateinit var\` except for Hilt-injected fields.

**iOS / Swift defaults**
- No force unwrap (\`!\`). Use \`guard let\`, \`if let\`, or \`??\` with a safe fallback.
- No force cast (\`as!\`). Use \`as?\` with a guard or safe fallback.
- No \`DispatchQueue.main.sync\`. Use \`await MainActor.run\` or \`@MainActor\` annotation.
- No hardcoded strings. Use \`Localizable.strings\` or \`LocalizedStringKey\`.
- No hardcoded colors or dimensions. Use \`Assets.xcassets\` named colors or a \`DesignTokens\` extension.
- No business logic in Views. SwiftUI Views and ViewControllers delegate to ViewModel/Presenter only.
- No UIKit imports in ViewModel files (\`UIView\`, \`UIViewController\`, \`UIApplication\`).
- No \`@State\` for shared or cross-view state. Use \`@StateObject\`, \`@ObservedObject\`, or \`@Observable\`.
- Never mix SwiftUI and UIKit in the same screen unless the task explicitly requires it.

---

## Runtime Protection (Claude Code Hooks)

The project's \`.claude/settings.json\` (installed from \`agent-artifacts/hooks/\`) enforces protection rules that run **before** this file is even read:

| Layer | What it enforces |
|-------|-----------------|
| \`permissions.deny\` | Blocks writes to \`agent-sdd/**\`, \`agent-artifacts/spec-kit/**\`, generated files (\`.xcodeproj\`, \`R.java\`, \`BuildConfig.java\`, \`*.generated.kt\`, \`build/\`), and all git write commands (\`git commit\`, \`git push\`, \`git add\`) |
| \`protected-paths.sh\` (PreToolUse) | Script-level catch for file-write edge cases the glob patterns miss |
| \`git-guard.sh\` (PreToolUse) | Blocks all git write operations — commit, push, add, merge, rebase, tag, reset --hard, clean |
| \`lint-gate.sh\` (PostToolUse) | Runs ktlint (Android) or SwiftLint (iOS) after every file edit |
| \`done-gate.sh\` (Stop) | Audits \`git diff\` on session end and warns about any protected-file touches |

These hooks are **deterministic** — they run regardless of what this file says. CLAUDE.md is the fallback for behavior the hooks don't cover (logic, naming, structure). Never attempt to write to protected paths; the hook will block it and the task will stall.

---

## What Good Looks Like

A well-executed task:
- Every acceptance criterion is verified with **specific evidence** (file, function, test name) — not just checked off
- Quality gate is clean — no violations slipped through to the completion report
- Self-corrections are logged transparently — the developer can see what the agent caught and fixed
- Diffs are minimal — only code the task required was touched
- Context files are updated so the next agent session starts smarter
- Completion report is honest — blocked criteria and new debt are surfaced, not hidden
- Code follows CONVENTIONS.md exactly — naming, structure, patterns
`;

// ── Embedded: tasks/TASK_TEMPLATE.md ──────────────────
const EMBEDDED_TASK_TEMPLATE = `# Task: [TICKET-ID] — [Title]
# ─────────────────────────────────────────────────────────────────────────────
# HOW TO USE:
# 1. Rename this file: PROJ-1234.md
# 2. Fill in every section below (remove comments as you go)
# 3. From your project terminal run:
#    claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md"
# ─────────────────────────────────────────────────────────────────────────────

## Type

- [ ] Feature
- [ ] Bug
- [ ] Refactor
- [ ] Task

## Skills

<!--
Plug-n-play skill modules to activate for THIS ticket. Off by default.
Available skills (see agent-artifacts/skills/_index.md):
  - ada       → accessibility (a11y) compliance for UI you touch
  - analytics → analytics event instrumentation for user actions / screen views
List the ones this ticket needs, or "none".
-->

Skills: none

## Description

<!--
What needs to be done and why.
Include user-facing impact if relevant.
1–5 sentences. Be specific about what changes, not just what the outcome is.

Good: "Add a store_selected Firebase event fired when the user taps a store in
SelectStoreFragment. The event must include store_id as a property."
Bad: "Track store selection in analytics."
-->

[Description here]

## Acceptance Criteria

<!--
Each criterion must be verifiable — the agent should be able to point to a
specific file, function, or test result as evidence.

Good: "TrackStoreSelectedEvent is called in SelectStoreFragment.onStoreClicked()
with the correct store_id property."
Bad: "Store selection is tracked."

The agent checks each one with evidence in the completion report.
If a criterion cannot be verified, it is marked BLOCKED with a reason.
-->

- [ ] [Criterion 1 — what is true when this is done, stated precisely]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Quality Gate

<!--
Technical checks the agent must pass before marking the task complete.
Leave defaults unless your task has specific overrides.
-->

- [ ] No \`!!\` operators introduced
- [ ] No new \`LiveData\` introduced — new state uses \`StateFlow\`
- [ ] No hardcoded strings, colors, or dimensions
- [ ] All \`when\` on sealed types are exhaustive — no \`else\`
- [ ] No business logic in UI layer
- [ ] Tests follow \`functionName_scenario_expectedResult\` naming
- [ ] [Add task-specific check if needed]

## Out of Scope

<!--
Explicitly state what NOT to do. This prevents over-engineering.
Even if related, if it's not in scope, list it here.

Example: "Do not track this event in Adjust — Firebase only."
-->

- [Out of scope item 1]

## Affected Areas

<!--
A one-line hint that helps the agent load the right context files faster.
Use module names, feature names, or file names.

Example: "analytics, store selection flow, SelectStoreFragment"
-->

[e.g., analytics, basket flow, checkout screen]

## Testing

Required: Y / N

<!--
If Y, specify the level and key scenarios.
Write scenarios as verifiable statements — the agent checks each one off.
If N, the agent will still log what could be tested in the completion report.
-->

Level: Unit / Integration / Both

Scenarios:
- [ ] [Scenario 1 — e.g., "event fires with correct store_id when store is tapped"]
- [ ] [Scenario 2 — e.g., "event does not fire when store selection is cancelled"]

## Designs / References

<!--
Figma links, Confluence pages, API docs, Jira tickets, local file paths.
If none, write "None."
-->

- [Link or file path]

## Notes

<!--
Backend changes required? API contracts changing?
Known gotchas or edge cases?
Dependency on another in-progress ticket?
Leave blank if none.
-->

[Notes here or remove section]
`;

// ── Embedded: tasks/BOOTSTRAP_TEMPLATE.md ─────────────
const EMBEDDED_BOOTSTRAP_TEMPLATE = `# Task: BOOTSTRAP — Generate context file for [Module Name]

## Type

- [ ] Bug
- [ ] Feature
- [ ] Refactor
- [x] Task

## Description

**This is a context discovery run — no code changes.**

On day 1 of adopting the Agentic SDD system, context files do not exist yet.
Without them, the agent falls back to scanning source files on every task, which
is slower and more error-prone.

Run this task once per module to generate its \`context/<module>.md\` file.
The agent reads the source files, extracts structure, and writes the context file.
No production code is created or modified.

Replace \`[Module Name]\` and the file paths below with the actual module details
from \`spec-kit/MODULE_MAP.md\` before running.

---

## ⚠ EVIDENCE-ONLY RULE — Read this before writing anything

Every line in the context file must be directly supported by something you read
in a source file during this task.

**Never infer. Never assume. Never fill gaps with what a library "typically" does.**

Specific prohibitions:

- **Dependencies**: List only what appears in \`import\` statements of the files you
  read. Do NOT describe what an imported SDK does internally — only list its name.
  Violation example: "NomNomCore SDK handles authentication."
  Correct: "Depends on: NomNomCore (import seen in AuthViewModel.kt)"

- **State Management**: Only describe \`StateFlow\`, \`LiveData\`, or \`sealed class\` shapes
  you directly read. Do NOT invent domain types (e.g., \`AppBasket\`) that you did not
  see declared in a source file.

- **What the Agent Should Know**: Only document concrete behaviors you observed in code
  (e.g., "ProfileFragment calls authService.logout() directly on line 84"). Never infer
  a behavior from a class name or SDK reputation.

- **Purpose / "Does NOT handle"**: Only exclude a responsibility if you read a file and
  confirmed it is absent. Do not assume from folder names alone.

If you cannot confirm something from the files you read, write:
\`[not confirmed — verify with team]\`

Do not leave sections blank to avoid this — write the placeholder explicitly.
A visible gap is safer than a confident wrong answer.

---

## Acceptance Criteria

- [ ] \`context/<module>.md\` exists and follows the structure in \`context/TEMPLATE.md\`
- [ ] Key Files table lists only files that were actually read and verified to exist
- [ ] State Management describes only ViewModel/StateFlow shapes seen in source, or "N/A"
- [ ] Dependencies lists import names only — no description of what SDKs do internally
- [ ] "What the Agent Should Know" contains only facts directly observed in source, or "None found"
- [ ] Known Debt lists debt patterns actually seen in scanned files, or "None found"
- [ ] Tests section lists existing test files found, or "No tests found"
- [ ] A routing row for this module is added to \`context/_index.md\`
- [ ] No section contains an inference — every claim traces to a file you read

## Quality Gate

- [ ] No production source files were created or modified
- [ ] No \`spec-kit/\` files were modified (read-only)
- [ ] Context file uses the exact section structure from \`context/TEMPLATE.md\`
- [ ] All file paths in Key Files table are verified to exist (attempted to open each)
- [ ] Any unconfirmed claim is explicitly marked \`[not confirmed — verify with team]\`

## Out of Scope

- Do NOT fix any code issues discovered during the scan — log them in the completion report
- Do NOT create unit tests — this is a read-only discovery run
- Do NOT modify \`spec-kit/MODULE_MAP.md\` — add routing to \`context/_index.md\` only
- Do NOT describe SDK internals beyond what the import statement shows

## Module to Bootstrap

Fill in before running:

\`\`\`
Module name:    [e.g., :app/profile]
Source path:    [e.g., app/src/main/java/com/example/views/profile/]
Key classes:    [list from MODULE_MAP.md — e.g., ProfileViewModel.kt, ProfileFragment.kt]
Context file:   [e.g., context/profile.md]
\`\`\`

## Affected Areas

[Copy keywords from MODULE_MAP.md entry for this module]

## Testing

- [ ] Not required — this is a read-only context generation task

## Steps for the Agent

1. Read \`agent-artifacts/spec-kit/MODULE_MAP.md\` — find the entry for the module being bootstrapped.
2. Read each source file listed in the \`Key classes\` field. If a file cannot be opened, note it as
   \`[not read]\` in the Key Files table — do not infer its contents.
3. For each file you successfully read:
   - Note the exact class name, file path, and declared purpose (from KDoc/comments if present)
   - Note any \`StateFlow\`, \`LiveData\`, or \`sealed class\` shapes declared in the file
   - Note \`import\` statements for the Dependencies section (list names only — no descriptions)
   - Note any \`!!\` operators, \`GlobalScope\`, or \`LiveData\` fields for the Known Debt section
4. Scan for existing test files (\`*Test.kt\`, \`*Spec.kt\`) in the module path.
5. Write the context file filling in ONLY what you directly observed in steps 2–4.
   For anything you could not confirm, write \`[not confirmed — verify with team]\`.
6. Save as \`agent-artifacts/context/<module>.md\`.
7. Add a routing row to \`agent-artifacts/context/_index.md\`.
8. Write a completion report:
   - Files successfully read
   - Files that could not be opened (list as gaps)
   - Any \`[not confirmed]\` placeholders left — the team must review these before the file is used

## Notes

Bootstrap runs are fast — typically 5–8 source file reads per module.
Do all modules in \`spec-kit/MODULE_MAP.md\` before starting feature tickets.
Modules bootstrapped first: those most commonly touched by the current backlog.

**A context file with \`[not confirmed]\` placeholders is better than one with confident wrong answers.**
The team can fill gaps in minutes; they cannot easily detect silent errors.
`;

// ── Embedded: context/TEMPLATE.md ─────────────────────
const EMBEDDED_CONTEXT_TEMPLATE = `# context/[module-name].md
# ─────────────────────────────────────────────────────────────────────────────
# COPY THIS FILE to create a new module context file.
# Rename to match the module: context/auth.md, context/ordering.md, etc.
# Add a row to context/_index.md pointing to this file.
#
# This file is updated by the agent after every task that touches this module.
# Review context file changes in PRs alongside the code changes.
# ─────────────────────────────────────────────────────────────────────────────

## Module: [Module Name]

**Last updated**: [YYYY-MM-DD] by [agent / human], after [TICKET-ID or "bootstrap"]
**Architecture**: [MVVM / MVP / Clean / None / Mixed]
**Language**: [Kotlin / Kotlin + Java / Swift / TypeScript]
**DI**: [Hilt / Dagger / Manual / None]

---

## Purpose

[2–3 sentences. What user-facing features live here. What this module does NOT do — boundaries matter.]

---

## Key Files

<!-- Selection principle: this is a MAP, not a file inventory.
     List entry points, base classes, DI wiring, and files with non-obvious roles
     or known debt. OMIT routine API interfaces, one-line impls, and files an agent
     would find trivially by name. Prefer ~10–15 high-signal rows; if you exceed
     that, you're probably inventorying, not mapping — cut the obvious ones. -->
| File (relative to codebase_path) | Role |
|----------------------------------|------|
| \`path/to/[Name]ViewModel.kt\` | [one-line description] |
| \`path/to/[Name]Repository.kt\` | [one-line description] |
| \`path/to/[Name]Fragment.kt\` | [one-line description] |
| \`path/to/di/[Name]Module.kt\` | [one-line description] |

---

## State Management

[Only describe StateFlow / LiveData / sealed class shapes you directly read in source.
Do NOT invent domain types not seen in the code.]

\`\`\`kotlin
// Example — fill in actual state for this module:
sealed interface [Name]UiState {
    data object Idle : [Name]UiState
    data object Loading : [Name]UiState
    data class Error(val message: String) : [Name]UiState
    data object Success : [Name]UiState
}
\`\`\`

---

## Dependencies

<!-- Evidence rule: list only what appears in import statements of files you read.
     Do NOT describe what an SDK does internally — list its name only.
     For anything unconfirmed write: [not confirmed — verify with team] -->
- **Depends on**: [list import names — e.g., \`:core-network\`, \`OloSDK\`]
- **Depended on by**: [list modules that import this — e.g., \`:app\` (NavGraph)]

---

## Known Debt

- [DEBT-XXX — one-line description. See \`spec-kit/TECH_DEBT.md#[section]\` for agent rules.]

No debt — leave this section empty if none.

---

## Tests

| Test file | What it covers |
|-----------|---------------|
| \`path/to/[Name]ViewModelTest.kt\` | [scenarios covered] |
| \`path/to/[Name]RepositoryTest.kt\` | [scenarios covered] |

**Coverage gaps**: [list untested scenarios that would be valuable to add]

---

## What the Agent Should Know

<!-- Evidence rule: only document concrete behaviors observed in source code.
     Example of valid entry: "ProfileFragment calls authService.logout() directly — not via ViewModel"
     Example of invalid entry: "The SDK handles session management internally"
     For anything unconfirmed write: [not confirmed — verify with team] -->

- "Never call [Class] directly from ViewModel — always through [UseCase]"
- "[Field] is nullable in the API response but the UI assumes non-null — guard here"
- "The [workaround] in [File]:L42 exists because [reason] — do not simplify it"
`;

// ── Embedded: context/_index.md ───────────────────────
const EMBEDDED_CONTEXT_INDEX = `# Context Index
# ─────────────────────────────────────────────────────────────────────────────
# THIS IS THE AUTHORITATIVE ROUTING TABLE.
# Agent uses this table — and only this table — to decide which
# context/<module>.md files to load for a given task.
# spec-kit/MODULE_MAP.md is the module registry (metadata); this file routes.
# Seeded by humans; grows as new modules are added.
# ─────────────────────────────────────────────────────────────────────────────

## How to Use (Agent)

1. Read the task MD: description, acceptance criteria, affected areas.
2. Match task keywords against the Keywords column in this file.
3. Load every context file that matches before reading any source files.
4. If no match: check \`spec-kit/MODULE_MAP.md\` by package/module name for richer metadata.
5. If still no match: read 5–8 key source files, then generate a context file afterward.

For tasks touching >1 module: load ALL matching context files, then proceed.

---

## Keyword Routing Table

| Keywords | Module | Context File |
|----------|--------|--------------|
| login, logout, sign in, sign out, session, token, auth, biometric, password, register, authentication | Authentication | \`context/auth.md\` |
| home, dashboard, feed, landing, main screen, summary | Home | \`context/home.md\` |
| profile, account, settings, preferences, avatar, edit profile | Profile / Settings | \`context/profile.md\` |
| payment, checkout, billing, card, transaction, purchase, order | Payment / Checkout | \`context/checkout.md\` |
| onboarding, splash, welcome, walkthrough, first launch | Onboarding | \`context/onboarding.md\` |
| notification, push, FCM, alert, badge, messaging | Notifications | \`context/notifications.md\` |
| network, API, http, retrofit, endpoint, interceptor, base url | Core Network | \`context/core-network.md\` |
| database, room, datastore, cache, local storage, preferences, dao | Core Data | \`context/core-data.md\` |
| theme, color, typography, design token, shared component, button, card, composable | Core UI | \`context/core-ui.md\` |
| analytics, tracking, firebase, event, screen view | Analytics | \`context/analytics.md\` |

<!-- Add a row here whenever you add a new context/<module>.md file. -->

---

## Notes for Humans

- \`_index.md\` (this file) — agent routing table: keyword → context file
- \`MODULE_MAP.md\` — module registry: path, pattern, DI, key classes, debt anchor
- Keep both in sync when adding a new module.
`;

// ── Embedded: skills/ (plug-n-play skill modules) ─────
// Populated by engine/generate-embedded.js from skills/*.md.
const EMBEDDED_SKILLS_INDEX = `# Skills Index
# ─────────────────────────────────────────────────────────────────────────────
# Plug-n-play skill modules. A skill is OFF by default and turns ON only when a
# task's \`Skills:\` line names it. The agent reads this index to know which skills
# exist and where to load each one from.
# ─────────────────────────────────────────────────────────────────────────────

## Available Skills

| Skill | File | What it enforces when active |
|-------|------|------------------------------|
| \`ada\` | \`skills/ada.md\` | Accessibility (a11y) compliance for UI the task touches — labels, touch targets, text scaling, color-independent signals. |
| \`analytics\` | \`skills/analytics.md\` | Analytics event instrumentation for in-scope user actions / screen views, through the project's existing analytics mechanism, no PII. |

## How a developer turns a skill on

Add the skill name to the task file's \`Skills:\` line:

\`\`\`
## Skills

Skills: ada, analytics
\`\`\`

\`Skills: none\` (or omitting the line) = no skills active; the agent runs the normal workflow.

## How the agent uses this (summary — full rules in CLAUDE.md Step 2)

1. Read the task's \`Skills:\` line.
2. For each named skill, load \`agent-artifacts/skills/<skill>.md\`.
3. Apply each active skill's rules on top of Steps 3–8. A skill never relaxes a
   Hard Rule or the base quality gate — it only adds requirements.
4. If a named skill has no matching file, note the gap and continue — do not stop.

<!-- Add a row here whenever you add a new skill module to skills/. -->
`;
const EMBEDDED_SKILL_ADA = `# Skill: ada — Accessibility (a11y) Compliance
# ─────────────────────────────────────────────────────────────────────────────
# A plug-n-play skill module. It is ACTIVE only when a task's \`Skills:\` line lists
# \`ada\`. When active, apply the rules below ON TOP OF the normal Steps 0–8.
# Scope is limited to UI the task creates or modifies — do not retrofit the
# whole app. Read-only for the agent; humans edit this in agent-sdd/skills/.
# ─────────────────────────────────────────────────────────────────────────────

## When this skill is active

The ticket touches user-facing UI and must meet accessibility standards. Apply these
checks to every screen, view, or component you **create or modify** — not to code you
only read.

If the project's \`spec-kit/CONVENTIONS.md\` defines accessibility rules, those take
precedence over the defaults here.

## What it adds to your workflow

- **Step 3 (Understanding):** add a line \`**Accessibility (ada):** active — <screens/views in scope>\`.
- **Step 5 (Execute):** build accessibility in as you write the UI — do not bolt it on after.
- **Step 6 (Self-Verification):** run the Accessibility Gate below in addition to the normal quality gate.
- **Step 8 (Completion report):** add an \`### Accessibility (ada)\` section listing what you verified and what needs manual review.

## Accessibility Gate

Scan every UI file you created or modified.

**Android**

| Check | Rule |
|-------|------|
| Content labels | Every actionable / informative view has a \`contentDescription\` (or \`contentDescription = null\` for purely decorative images). Compose: \`Modifier.semantics\` / \`contentDescription\`. |
| Touch targets | Interactive targets are at least \`48dp × 48dp\` (\`minWidth\`/\`minHeight\` or \`Modifier.sizeIn\`). |
| Text scaling | Text sizes use \`sp\`, not \`dp\`; layouts do not hard-code heights that clip scaled text. |
| Color is not the only signal | State/meaning conveyed by color also has text, icon, or shape. |
| Focus & order | Screen-reader (TalkBack) focus order is logical; related controls grouped. |
| Labels not redundant | No "button"/"image" baked into the label — the role announces that. |

**iOS**

| Check | Rule |
|-------|------|
| Labels | Every control has a meaningful \`accessibilityLabel\`; decorative images are hidden via \`accessibilityHidden(true)\`. |
| Dynamic Type | Text uses scalable styles (\`.font(.body)\` / \`UIFontMetrics\`), not fixed point sizes. |
| Touch targets | Tappable targets are at least \`44pt × 44pt\`. |
| Color is not the only signal | Meaning conveyed by color also has text/icon/shape. |
| Traits | Controls expose correct \`accessibilityTraits\` (\`.button\`, \`.header\`, etc.). |
| VoiceOver order | Reading order is logical; related elements grouped with \`accessibilityElement(children:)\`. |

## Evidence & honesty rule

- Report each view you labeled and how (file:line).
- **Color contrast** usually cannot be measured from source alone. Do NOT claim a contrast
  pass you did not verify — list color/background pairs you introduced as
  \`manual review needed — verify ≥ 4.5:1 (3:1 for large text)\`.
- Anything you cannot confirm from code → flag for manual review rather than asserting pass.

## Completion report section

\`\`\`
### Accessibility (ada)
- Labeled: [file:line — view → label]
- Touch targets verified: [file:line]
- Text scaling: [pass / issue]
- Manual review needed: [contrast pairs, anything not verifiable from source]
\`\`\`
`;
const EMBEDDED_SKILL_ANALYTICS = `# Skill: analytics — Event Instrumentation
# ─────────────────────────────────────────────────────────────────────────────
# A plug-n-play skill module. It is ACTIVE only when a task's \`Skills:\` line lists
# \`analytics\`. When active, apply the rules below ON TOP OF the normal Steps 0–8.
# Scope is limited to user actions / screen views in UI the task creates or
# modifies. Read-only for the agent; humans edit this in agent-sdd/skills/.
# ─────────────────────────────────────────────────────────────────────────────

## When this skill is active

The ticket requires user behaviour to be instrumented with analytics/tracking events.
Add events for the user actions and screen views in scope — nothing more.

## Use the project's existing analytics, never invent one

Before adding any event:
1. Find how the project already sends analytics — search the loaded context files and
   source for the existing analytics manager / wrapper / SDK call (e.g. an
   \`AnalyticsManager\`, \`Tracker\`, \`logEvent(...)\`, Firebase \`FirebaseAnalytics\`).
2. **Route every new event through that existing mechanism.** Do NOT add a new SDK,
   a new wrapper, or direct SDK calls scattered in the UI.
3. If you cannot find an existing analytics mechanism, do NOT guess one — STOP and ask
   the developer which to use (Ambiguity Protocol).

If \`spec-kit/CONVENTIONS.md\` or \`spec-kit/DATA_MODEL.md\` defines an event naming
convention or schema, follow it exactly. Otherwise default to \`snake_case\` event names.

## What it adds to your workflow

- **Step 3 (Understanding):** add \`**Analytics (analytics):** active — <actions/screens to instrument>\` and name the existing analytics mechanism you will use.
- **Step 5 (Execute):** fire events from the correct layer (prefer ViewModel/Presenter over View, matching the project's pattern), through the existing analytics wrapper.
- **Step 6 (Self-Verification):** run the Analytics Gate below.
- **Step 8 (Completion report):** add an \`### Analytics (analytics)\` section listing every event.

## Analytics Gate

| Check | Rule |
|-------|------|
| Existing mechanism | Events go through the project's existing analytics wrapper — no new SDK or ad-hoc calls. |
| Naming | Event + property names follow the project convention (or \`snake_case\` default); consistent tense/voice. |
| Coverage | Every in-scope user action and screen view has an event — no silent gaps. |
| No PII | No emails, names, phone numbers, tokens, precise location, or free-text user input in event params. Use stable IDs only. |
| Layer | Events fire from the layer the project uses (typically ViewModel/Presenter), not buried in UI callbacks unless that is the established pattern. |
| No duplicates | The same action does not fire the same event from two places. |

## Evidence & honesty rule

- List every event with its name, properties, and the exact trigger location (file:line).
- If a property value's source is unclear or could contain PII, flag it rather than shipping it.
- Do not claim an event "fires correctly" without pointing to where it is dispatched.

## Completion report section

\`\`\`
### Analytics (analytics)
- Mechanism used: [AnalyticsManager / Firebase / ... — file]
- Events added:
  - \`event_name\` — props: [key: type] — fired at [file:line] when [trigger]
- PII check: [pass — no PII in params / flagged: ...]
\`\`\`
`;

// ── Embedded: hooks/settings.json ─────────────────────
const EMBEDDED_HOOKS_SETTINGS = `{
  "permissions": {
    "deny": [
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git add:*)",
      "Bash(git merge:*)",
      "Bash(git rebase:*)",
      "Bash(git tag:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean:*)",
      "Write(agent-sdd/**)",
      "Edit(agent-sdd/**)",
      "Write(agent-artifacts/CLAUDE.md)",
      "Edit(agent-artifacts/CLAUDE.md)",
      "Write(agent-artifacts/spec-kit/**)",
      "Edit(agent-artifacts/spec-kit/**)",
      "Write(**/*.xcodeproj/**)",
      "Edit(**/*.xcodeproj/**)",
      "Write(**/*.xcworkspace/**)",
      "Edit(**/*.xcworkspace/**)",
      "Write(**/BuildConfig.java)",
      "Edit(**/BuildConfig.java)",
      "Write(**/R.java)",
      "Edit(**/R.java)",
      "Write(**/*.generated.kt)",
      "Edit(**/*.generated.kt)",
      "Write(**/build/**)",
      "Edit(**/build/**)",
      "Write(**/gradlew)",
      "Edit(**/gradlew)",
      "Write(**/gradlew.bat)",
      "Edit(**/gradlew.bat)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/scripts/protected-paths.sh"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/scripts/git-guard.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/scripts/lint-gate.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/scripts/done-gate.sh"
          }
        ]
      }
    ]
  }
}`;

// ── Embedded: hooks/scripts/git-guard.sh ─────────────
const EMBEDDED_GIT_GUARD_SH = `#!/usr/bin/env bash
# PreToolUse hook — blocks git write operations.
#
# The agent must never commit, push, stage, or alter git history.
# All git decisions are reserved for the human developer.
# This is a backup to the permissions.deny rules in settings.json.
#
# Exit 0 + JSON deny = block the command.
# Exit 0 + no output = allow through.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

deny() {
  local reason="$1"
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"'"$reason"'"}}'
  exit 0
}

# Normalize: collapse whitespace, strip leading spaces
CMD=$(echo "$COMMAND" | tr -s ' \\t' ' ' | sed 's/^ //')

# ── Block git write operations ────────────────────────────────────────────────
case "$CMD" in
  git\\ commit*)
    deny "git commit is not allowed — the agent must never create commits. Stage and commit changes yourself after reviewing." ;;
  git\\ push*)
    deny "git push is not allowed — the agent must never push to a remote. Push changes yourself after reviewing." ;;
  git\\ add*)
    deny "git add is not allowed — staging is part of the commit workflow. Stage changes yourself after reviewing the agent's work." ;;
  git\\ merge*)
    deny "git merge is not allowed — branch merges are a human decision." ;;
  git\\ rebase*)
    deny "git rebase is not allowed — history rewriting is a human decision." ;;
  git\\ tag*)
    deny "git tag is not allowed — tagging releases is a human decision." ;;
  git\\ reset\\ --hard*)
    deny "git reset --hard is not allowed — this would discard uncommitted changes permanently." ;;
  git\\ clean*)
    deny "git clean is not allowed — this would delete untracked files permanently." ;;
esac

exit 0
`;

// ── Embedded: hooks/scripts/protected-paths.sh ────────
const EMBEDDED_PROTECTED_PATHS_SH = `#!/usr/bin/env bash
# PreToolUse hook — blocks writes to generated/tool files that agents must never touch.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', '') or
          data.get('tool_input', {}).get('path', ''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize to a path relative to the project root so matching works whether the
# agent used a relative path (agent-artifacts/...) or an absolute one
# (/Users/me/project/agent-artifacts/...). The hook runs with CWD = project root.
CLEAN="$FILE_PATH"
ROOT="\${PWD%/}"
CLEAN="\${CLEAN#"$ROOT"/}"
CLEAN="\${CLEAN#./}"

deny() {
  local reason="$1"
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"'"$reason"'"}}'
  exit 0
}

# ── Tool / artifacts protection ───────────────────────────────────────────────
# Patterns match both the project-relative form and an absolute/nested form
# (*/agent-artifacts/...) so an absolute path is still caught.
[[ "$CLEAN" == agent-sdd/* || "$CLEAN" == */agent-sdd/* ]] \\
  && deny "agent-sdd/ is the read-only SDD tool — never modify it directly."
[[ "$CLEAN" == agent-artifacts/CLAUDE.md || "$CLEAN" == */agent-artifacts/CLAUDE.md ]] \\
  && deny "agent-artifacts/CLAUDE.md is a read-only snapshot — re-run the setup wizard to update it."
[[ "$CLEAN" == agent-artifacts/spec-kit/* || "$CLEAN" == */agent-artifacts/spec-kit/* ]] \\
  && deny "spec-kit/ files are read-only — re-run the wizard to regenerate AI artifacts, or edit human-authored specs directly."

# ── iOS generated / project files ────────────────────────────────────────────
[[ "$CLEAN" == *.xcodeproj/* || "$CLEAN" == *.xcodeproj ]] && deny "Xcode project files are managed by Xcode — do not modify programmatically."
[[ "$CLEAN" == *.xcworkspace/* || "$CLEAN" == *.xcworkspace ]] && deny "Xcode workspace files are managed by Xcode — do not modify programmatically."

# ── Android generated files ───────────────────────────────────────────────────
[[ "$CLEAN" == */BuildConfig.java ]]       && deny "BuildConfig.java is auto-generated by Gradle — edit build.gradle instead."
[[ "$CLEAN" == */R.java ]]                 && deny "R.java is auto-generated by AAPT — edit resource XML files instead."
[[ "$CLEAN" == *.generated.kt ]]           && deny "*.generated.kt files are auto-generated — do not modify directly."
[[ "$CLEAN" == **/gradlew || "$CLEAN" == gradlew ]] && deny "gradlew is auto-generated — do not modify."
[[ "$CLEAN" == **/gradlew.bat || "$CLEAN" == gradlew.bat ]] && deny "gradlew.bat is auto-generated — do not modify."

# ── Build output directories ──────────────────────────────────────────────────
[[ "$CLEAN" == */build/* || "$CLEAN" == build/* ]] && deny "build/ is a generated output directory — do not write files here."
[[ "$CLEAN" == DerivedData/* || "$CLEAN" == */DerivedData/* ]] && deny "DerivedData/ is Xcode's build cache — do not write files here."

exit 0
`;

// ── Embedded: hooks/scripts/lint-gate.sh ──────────────
const EMBEDDED_LINT_GATE_SH = `#!/usr/bin/env bash
# PostToolUse hook — runs a fast lint check after the agent edits a source file.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', '') or
          data.get('tool_input', {}).get('path', ''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [ -z "$PLATFORM" ]; then
  if [ -f "gradlew" ] || find . -maxdepth 3 -name "*.gradle" -o -name "*.gradle.kts" 2>/dev/null | grep -q .; then
    PLATFORM="android"
  elif find . -maxdepth 3 -name "*.xcodeproj" -type d 2>/dev/null | grep -q .; then
    PLATFORM="ios"
  else
    PLATFORM="none"
  fi
fi

if [[ "$PLATFORM" == "android" && "$FILE_PATH" == *.kt ]]; then
  if command -v ktlint &>/dev/null; then
    ktlint --editorconfig=".editorconfig" "$FILE_PATH" 2>&1
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
      echo "❌ ktlint failed on $FILE_PATH — fix the formatting issues above before continuing." >&2
      exit $STATUS
    fi
  elif [ -f "gradlew" ]; then
    MODULE=$(echo "$FILE_PATH" | sed 's|/src/.*||' | sed 's|^\\./||' | sed 's|/|:|g')
    ./gradlew ":$\\{MODULE\\}:ktlintCheck" --quiet 2>&1 | tail -20
    STATUS=\${PIPESTATUS[0]}
    if [ $STATUS -ne 0 ]; then
      echo "❌ ktlint check failed — run './gradlew ktlintFormat' to auto-fix." >&2
      exit $STATUS
    fi
  fi
fi

if [[ "$PLATFORM" == "ios" && "$FILE_PATH" == *.swift ]]; then
  if command -v swiftlint &>/dev/null; then
    swiftlint lint --quiet --path "$FILE_PATH" 2>&1
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
      echo "❌ SwiftLint failed on $FILE_PATH — fix the violations above before continuing." >&2
      exit $STATUS
    fi
  fi
fi

exit 0
`;

// ── Embedded: hooks/scripts/done-gate.sh ──────────────
const EMBEDDED_DONE_GATE_SH = `#!/usr/bin/env bash
# Stop hook — runs when the agent finishes its turn.
# Checks that the agent didn't sneak edits into protected files.

VIOLATIONS=()

if git rev-parse --git-dir &>/dev/null; then
  MODIFIED=$(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      agent-artifacts/CLAUDE.md)
        VIOLATIONS+=("PROTECTED (read-only snapshot): $f") ;;
      agent-artifacts/spec-kit/ARCHITECTURE.md|\\
      agent-artifacts/spec-kit/MODULE_MAP.md|\\
      agent-artifacts/spec-kit/DATA_MODEL.md)
        VIOLATIONS+=("PROTECTED (AI artifact — re-run wizard): $f") ;;
    esac
  done <<< "$MODIFIED"
fi

if [ \${#VIOLATIONS[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  Done-gate warning: the agent modified protected files."
  echo "   These changes should NOT be committed. Review and revert if unintended:"
  for v in "\${VIOLATIONS[@]}"; do
    echo "   • $v"
  done
  echo ""
  echo "   Reminder:"
  echo "   • agent-artifacts/CLAUDE.md → re-run the setup wizard to update"
  echo "   • spec-kit/ARCHITECTURE.md, MODULE_MAP.md, DATA_MODEL.md → regenerate via wizard step"
  echo ""
fi

exit 0
`;

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
  dirty: false,              // true when the current step has unsaved changes
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

// Steps the user can skip on first run and fill in later.
// Core steps (projectconfig, architecture, modules) are not in this set.
const OPTIONAL_STEP_IDS = new Set(['conventions', 'migrations', 'debt', 'testing', 'datamodel']);

function buildSidebar() {
  const container = document.getElementById('sidebarSteps');

  const renderStep = s => `
    <div class="step-item ${s.id === state.current ? 'active' : ''} ${state.saved[s.id] ? 'done' : ''}"
         id="nav-${s.id}" onclick="goTo('${s.id}')">
      <span class="step-icon">${state.saved[s.id] ? '✅' : s.icon}</span>
      <div>
        <div class="step-label">${s.label}</div>
        ${s.file ? `<div class="step-file">${s.file}</div>` : ''}
        ${s.artifact ? `<div class="step-artifact-badge">⚡ AI artifact</div>` : ''}
      </div>
    </div>`;

  // Split content steps into core and optional — welcome/done are excluded
  const contentSteps = STEPS.filter(s => s.file);
  const coreSteps     = contentSteps.filter(s => !OPTIONAL_STEP_IDS.has(s.id));
  const optionalSteps = contentSteps.filter(s =>  OPTIONAL_STEP_IDS.has(s.id));

  const sectionLabel = text => `
    <div style="padding:8px 16px 4px;font-size:10px;font-weight:700;
      color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px">
      ${text}
    </div>`;

  container.innerHTML =
    sectionLabel('Core') +
    coreSteps.map(renderStep).join('') +
    sectionLabel('Optional') +
    optionalSteps.map(renderStep).join('');
}

function goTo(id) {
  // Warn if the current step has unsaved changes before navigating away
  const leavingStep = STEPS.find(s => s.id === state.current);
  if (state.dirty && leavingStep?.file && id !== state.current) {
    showUnsavedWarning(leavingStep.label, () => _goTo(id));
    return;
  }
  _goTo(id);
}

function showUnsavedWarning(stepLabel, onContinue) {
  const existing = document.getElementById('unsavedWarningModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'unsavedWarningModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;
      padding:24px 28px;max-width:400px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.5);">
      <div style="font-size:20px;margin-bottom:10px">⚠️</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">
        Unsaved changes
      </div>
      <div style="font-size:13px;color:var(--text-dim);margin-bottom:20px;line-height:1.5">
        <strong>${stepLabel}</strong> has unsaved changes. If you leave now the file won't be written to your project.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="document.getElementById('unsavedWarningModal').remove()"
          style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);
          background:transparent;color:var(--text);cursor:pointer;font-size:13px">
          Stay &amp; Save
        </button>
        <button id="unsavedContinueBtn"
          style="padding:8px 16px;border-radius:6px;border:none;
          background:var(--text-muted);color:var(--bg);cursor:pointer;font-size:13px">
          Leave without saving
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('unsavedContinueBtn').addEventListener('click', () => {
    modal.remove();
    state.dirty = false;
    onContinue();
  });

  // Click outside to dismiss (stay on step)
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _goTo(id) {
  state.current = id;
  state.dirty = false;
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

  // Show or hide the "Skip for now" banner depending on whether this is an optional step
  updateSkipBanner(id, step);
}

function updateSkipBanner(id, step) {
  // Remove any existing banner first
  document.getElementById('optionalSkipBanner')?.remove();
  if (!step?.file || !OPTIONAL_STEP_IDS.has(id)) return;

  // Find the next unsaved core or optional step to navigate to after skipping
  const contentSteps = STEPS.filter(s => s.file);
  const currentIdx   = contentSteps.findIndex(s => s.id === id);
  const nextStep     = contentSteps[currentIdx + 1];

  const banner = document.createElement('div');
  banner.id = 'optionalSkipBanner';
  banner.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);
    border-radius:8px;padding:10px 14px;margin-bottom:16px;flex-shrink:0;
  `;
  banner.innerHTML = `
    <div style="font-size:12px;color:var(--text-dim);line-height:1.4">
      <span style="color:var(--accent);font-weight:600">Optional</span> — you can skip this and fill it in later.
      The agent will work without it but with reduced accuracy in this area.
    </div>
    <button onclick="${nextStep ? `goTo('${nextStep.id}')` : `goTo('done')`}"
      style="flex-shrink:0;padding:6px 14px;border-radius:6px;border:1px solid var(--border);
      background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;white-space:nowrap">
      Skip for now →
    </button>
  `;

  // Inject at the top of the active screen's content
  const screen = document.getElementById('screen-' + id);
  if (screen) screen.prepend(banner);
}

// ══════════════════════════════════════════════════════
//  DRAFT PERSISTENCE  (localStorage)
//  Saves every form change so a page refresh never loses work.
//  Cleared field-by-field only when the user explicitly saves a step.
// ══════════════════════════════════════════════════════

// Namespaced by project folder so switching projects never cross-contaminates form data.
function draftKey() {
  return state.dirHandle ? `sdd-wizard-draft:${state.dirHandle.name}` : 'sdd-wizard-draft';
}

// Snapshot all current form values + selected pills → localStorage.
let _draftTimer = null;
function saveDraft() {
  // Mark dirty synchronously so goTo() sees it even if the user clicks
  // the sidebar before the debounced write fires (within 300ms).
  const currentStep = STEPS.find(s => s.id === state.current);
  if (currentStep?.file) state.dirty = true;

  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    const draft = { fields: {}, pills: {} };

    // All text inputs and textareas that carry an id
    // Skip task-* fields — task form always starts blank (no pre-fill across sessions)
    document.querySelectorAll('input[id]:not([type="checkbox"]):not([type="radio"]), textarea[id]').forEach(el => {
      if (el.id.startsWith('task-')) return;
      draft.fields[el.id] = el.value;
    });

    // Checkbox states — used by task quality gate toggles
    // Skip task-* fields for the same reason
    document.querySelectorAll('input[id][type="checkbox"]').forEach(el => {
      if (el.id.startsWith('task-')) return;
      draft.fields[el.id] = el.checked;
    });

    // Selected pills — keyed by group name (from the input's name attribute)
    // Skip task-* pill groups — task form always starts blank
    document.querySelectorAll('[id^="pill-"].selected input').forEach(input => {
      const group = input.name;
      if (group.startsWith('task-')) return;
      if (!draft.pills[group]) draft.pills[group] = [];
      draft.pills[group].push(input.value);
    });

    localStorage.setItem(draftKey(), JSON.stringify(draft));
  }, 300); // debounce — don't thrash storage on every keystroke
}

// Read the draft value for a specific field id (used by renderApproachRows
// to pre-fill cards whose textareas don't exist in the DOM yet).
function getDraftField(fieldId) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    return draft.fields?.[fieldId] ?? '';
  } catch { return ''; }
}

// Restore all saved draft values into the DOM.
// Called once after all screens are built.
function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(draftKey()) || '{}'); }
  catch { return; }
  if (!draft.fields && !draft.pills) return;

  // ── Restore plain text/number fields and checkbox states ─────────────────
  Object.entries(draft.fields || {}).forEach(([id, value]) => {
    if (id.startsWith('approach-')) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof value === 'boolean') {
      if (el.type === 'checkbox') el.checked = value;
    } else {
      el.value = value;
    }
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
      // Show "Other" expand span if this is an Other pill
      if (value === '__other__') {
        const expand = pill.querySelector('.other-expand');
        if (expand) expand.style.display = 'inline';
      }
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
    const draft = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    if (!draft.savedSteps) draft.savedSteps = [];
    if (!draft.savedSteps.includes(stepId)) draft.savedSteps.push(stepId);
    localStorage.setItem(draftKey(), JSON.stringify(draft));
  } catch { /* ignore */ }
}

// Clear all non-task form fields and pill selections.
// Called when switching to a different project folder so stale data from the
// previous project doesn't linger before restoreDraft() re-populates from the
// new project's draft.
function clearFormFields() {
  document.querySelectorAll('input[id]:not([type="checkbox"]):not([type="radio"]), textarea[id]').forEach(el => {
    if (el.id.startsWith('task-')) return;
    el.value = '';
  });
  document.querySelectorAll('input[id][type="checkbox"]').forEach(el => {
    if (el.id.startsWith('task-')) return;
    el.checked = false;
  });
  document.querySelectorAll('[id^="pill-"].selected').forEach(el => {
    el.classList.remove('selected');
    const input = el.querySelector('input');
    if (input) input.checked = false;
  });
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
//  BROWSER COMPATIBILITY
// ══════════════════════════════════════════════════════
const hasFSA = 'showDirectoryPicker' in window;

// Show a blocking modal when File System Access API is unavailable (Safari, Firefox).
// The user must acknowledge before the wizard proceeds — the dismissable banner was
// too easy to miss and led to confusion about missing files.
function applyBrowserCompat() {
  if (!hasFSA) {
    showBrowserBlockModal();
  }
}

function showBrowserBlockModal() {
  const modal = document.createElement('div');
  modal.id = 'browserBlockModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:var(--surface2);border:1px solid #f59e0b;border-radius:14px;
      padding:32px 36px;max-width:480px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.6);text-align:center;">
      <div style="font-size:36px;margin-bottom:16px">⚠️</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:10px">
        Chrome or Edge required
      </div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:20px">
        This browser doesn't support the <strong>File System Access API</strong> needed to write
        files directly into your project folder.<br><br>
        Without it, the wizard <strong>cannot auto-create</strong> your
        <code style="background:var(--bg);padding:1px 5px;border-radius:3px;font-size:11px">agent-artifacts/</code>
        folder — including <code style="background:var(--bg);padding:1px 5px;border-radius:3px;font-size:11px">CLAUDE.md</code>,
        tasks, context files, and hooks.
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="https://www.google.com/chrome/" target="_blank"
          style="padding:10px 20px;border-radius:8px;background:#4285f4;color:#fff;
          text-decoration:none;font-size:13px;font-weight:600">
          Download Chrome
        </a>
        <a href="https://www.microsoft.com/edge" target="_blank"
          style="padding:10px 20px;border-radius:8px;background:#0078d4;color:#fff;
          text-decoration:none;font-size:13px;font-weight:600">
          Download Edge
        </a>
      </div>
      <div style="margin-top:16px">
        <button onclick="acknowledgeBrowserLimit()"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;
          font-size:12px;text-decoration:underline;">
          I understand — continue anyway (files will download individually)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function acknowledgeBrowserLimit() {
  document.getElementById('browserBlockModal')?.remove();
  // Show the softer banner as a persistent reminder after dismissal
  const banner = document.getElementById('safariBanner');
  if (banner) banner.style.display = 'block';
}

// ══════════════════════════════════════════════════════
//  FILE SYSTEM ACCESS API
// ══════════════════════════════════════════════════════
async function grantFolder() {
  if (!hasFSA) {
    showToast('Direct folder access is not supported in Safari or Firefox — files will download to your Downloads folder when you save each step.', 'info');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker();
    state.dirHandle = handle;
    const badge = document.getElementById('sddBadge');
    badge.textContent = '📂 ' + handle.name;
    badge.className = 'folder-badge granted';
    showToast('Project folder set: ' + handle.name + ' — analysing…', 'success');

    // Clear form data from any previously loaded project, then restore this
    // project's own draft (keyed by folder name). Prevents cross-project bleed.
    clearFormFields();
    restoreDraft();

    // Auto-set codebase_path to '..' — always correct when agent-artifacts/ is inside project root
    const pathEl = document.getElementById('cfg-codebase-path');
    if (pathEl && !pathEl.value) pathEl.value = '..';

    // Try to load existing agent-artifacts/project.config.md and pre-fill the form
    const existing = await tryReadFile(handle, 'agent-artifacts', 'project.config.md');
    if (existing) loadExistingConfig(existing);

    // Platform hook — e.g. analyzeProject()
    PLATFORM.onFolderGranted?.();

    // Light up sidebar ✅ for any steps whose output files already exist,
    // and (for existing projects) surface an Update-available banner.
    detectExistingOutputFiles(handle);

    // Initialise base files for brand-new projects only. Existing projects are
    // never silently overwritten — the user updates them explicitly via the
    // "Update now" button on the update banner.
    await maybeInitBaseArtifacts(handle);
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Could not access folder — try selecting the folder again.', 'error');
  }
}

// ── Detect already-saved output files and light up sidebar ✅ ─────────────────
// Called after a project folder is selected. For each step that has an output
// file, checks whether agent-artifacts/<file> already exists. If it does, marks
// state.saved so the sidebar shows ✅ without the user re-running that step.
async function detectExistingOutputFiles(handle) {
  if (!handle) return;

  // Reset all step save states before checking — clears stale ✅ from
  // localStorage that belong to a previous project or session.
  const contentSteps = STEPS.filter(s => s.file);
  contentSteps.forEach(s => { state.saved[s.id] = false; });

  let completedCount = 0;

  await Promise.all(contentSteps.map(async step => {
    const parts = step.file.split('/');    // e.g. 'spec-kit/ARCHITECTURE.md' → ['spec-kit','ARCHITECTURE.md']
    const content = await tryReadFile(handle, 'agent-artifacts', ...parts);
    if (content) {
      state.saved[step.id] = true;
      completedCount++;
    }
  }));

  buildSidebar();

  if (completedCount === 0) return;

  // Update or inject the setup-status banner on the welcome screen
  const allDone = completedCount === contentSteps.length;
  showSetupBanner(completedCount, contentSteps.length, allDone);

  // Compare the project's stored snapshot version against the current skeleton.
  // Surface an update banner when the project is on an older version OR predates
  // versioning entirely (no .sdd-version manifest — set up before this feature).
  const manifestRaw = await tryReadFile(handle, 'agent-artifacts', '.sdd-version');
  let storedVersion = null;
  if (manifestRaw) {
    try { storedVersion = JSON.parse(manifestRaw).version ?? null; } catch { storedVersion = null; }
  }
  if (storedVersion !== SKELETON_VERSION) {
    // storedVersion === null = legacy project set up before versioning existed.
    showUpdateBanner(storedVersion, SKELETON_VERSION);
  }
}

// Compare dotted numeric versions ("1.2" vs "1.10"). Returns >0 if a>b, <0 if a<b.
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Changelog entries the project would gain by updating: every version newer than
// `stored`. If `stored` is null/non-numeric (legacy project), return all entries.
// Sorted newest-first.
function changelogSince(stored) {
  const all = typeof SKELETON_CHANGELOG === 'object' && SKELETON_CHANGELOG ? SKELETON_CHANGELOG : {};
  const numeric = stored != null && /^\d+(\.\d+)*$/.test(String(stored));
  return Object.keys(all)
    .filter(v => !numeric || compareVersions(v, stored) > 0)
    .sort((a, b) => compareVersions(b, a))
    .map(v => ({ version: v, date: all[v].date, notes: all[v].notes || [] }));
}

// Render the "What's new" list (versions gained by updating) as banner HTML.
function renderWhatsNew(stored) {
  const entries = changelogSince(stored);
  if (!entries.length) return '';
  const blocks = entries.map(e => {
    const items = e.notes.map(n => `<li style="margin:2px 0">${n}</li>`).join('');
    return `<div style="margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:#fb923c">v${e.version}${e.date ? ` · ${e.date}` : ''}</div>
        <ul style="margin:4px 0 0;padding-left:18px;font-size:11px;color:var(--text-muted);line-height:1.5;text-align:left">${items}</ul>
      </div>`;
  }).join('');
  return `<div style="margin-top:10px;border-top:1px solid rgba(251,146,60,0.25);padding-top:8px">
      <div style="font-size:11px;font-weight:700;color:#fb923c;text-transform:uppercase;letter-spacing:0.5px">What's new</div>
      ${blocks}
    </div>`;
}

// Amber "update available" banner shown when the project's .sdd-version manifest
// is older than the skeleton bundled with this wizard. Re-running setup (saving
// the final step) rewrites CLAUDE.md, hooks, and the manifest to the new version.
function showUpdateBanner(stored, current) {
  document.getElementById('sddUpdateBanner')?.remove();

  const welcome = document.getElementById('screen-welcome');
  if (!welcome) return;

  const storedLabel = (stored != null && /^\d/.test(String(stored))) ? stored : 'unversioned (pre-update)';

  const banner = document.createElement('div');
  banner.id = 'sddUpdateBanner';
  banner.style.cssText = 'background:rgba(251,146,60,0.10);border:1px solid rgba(251,146,60,0.4);border-radius:var(--radius);padding:14px 18px;margin-bottom:20px';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:22px">🔄</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:#fb923c">Update available — this project uses an older SDD snapshot</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Project version <code>${storedLabel}</code> → skeleton version <code>${current}</code>. Updating rewrites <code>CLAUDE.md</code>, the hooks, and templates in <code>agent-artifacts/</code>. Your spec-kit and context files are <strong>not</strong> touched.</div>
      </div>
      <button id="sddUpdateBtn" style="flex-shrink:0;background:#fb923c;color:#1a1a1a;border:none;border-radius:var(--radius);padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer">Update now</button>
    </div>
    ${renderWhatsNew(stored)}`;

  const hero = welcome.querySelector('.welcome-hero');
  if (hero) hero.insertBefore(banner, hero.firstChild);
  else welcome.insertBefore(banner, welcome.firstChild);

  document.getElementById('sddUpdateBtn')?.addEventListener('click', runSkeletonUpdate);
}

// Green confirmation banner shown after the user clicks "Update now". Reminds
// them to re-copy the refreshed hooks into .claude/ to activate them, since the
// wizard can only write inside the granted agent-artifacts/ folder.
function showUpdateDoneBanner(version) {
  document.getElementById('sddUpdateBanner')?.remove();
  const welcome = document.getElementById('screen-welcome');
  if (!welcome) return;

  const banner = document.createElement('div');
  banner.id = 'sddUpdateBanner';
  banner.style.cssText = 'background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.3);border-radius:var(--radius);padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px';
  banner.innerHTML = `
    <span style="font-size:22px">✅</span>
    <div>
      <div style="font-size:13px;font-weight:600;color:#4ade80">Updated to v${version}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:3px"><code>CLAUDE.md</code>, hooks, and templates refreshed. To activate the updated hooks, re-copy them into <code>.claude/</code> from your project terminal:<br><code>cp -r agent-artifacts/hooks/.  .claude/  &amp;&amp;  chmod +x .claude/scripts/*.sh</code></div>
    </div>`;

  const hero = welcome.querySelector('.welcome-hero');
  if (hero) hero.insertBefore(banner, hero.firstChild);
  else welcome.insertBefore(banner, welcome.firstChild);
}

function showSetupBanner(done, total, allDone) {
  // Remove any existing banner first
  document.getElementById('setupStatusBanner')?.remove();

  const welcome = document.getElementById('screen-welcome');
  if (!welcome) return;

  const banner = document.createElement('div');
  banner.id = 'setupStatusBanner';

  if (allDone) {
    banner.style.cssText = 'background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.3);border-radius:var(--radius);padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px';
    banner.innerHTML = `
      <span style="font-size:22px">✅</span>
      <div>
        <div style="font-size:13px;font-weight:600;color:#4ade80">Setup already complete for this project</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">All ${total} spec-kit files found in <code>agent-artifacts/</code>. You can jump to any step to review or update a file — no need to redo the whole setup.</div>
      </div>`;
  } else {
    banner.style.cssText = 'background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:var(--radius);padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px';
    banner.innerHTML = `
      <span style="font-size:22px">⚠️</span>
      <div>
        <div style="font-size:13px;font-weight:600;color:#fbbf24">Partial setup detected (${done}/${total} steps)</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Some spec-kit files are missing. Steps marked ✅ in the sidebar are already saved — continue from where you left off.</div>
      </div>`;
  }

  // Insert at the top of the welcome screen content
  const hero = welcome.querySelector('.welcome-hero');
  if (hero) hero.insertBefore(banner, hero.firstChild);
  else welcome.insertBefore(banner, welcome.firstChild);
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
    // Support both: project root selected (agent-artifacts/ created inside) or agent-artifacts/ selected directly.
    const sddDir = state.dirHandle.name === 'agent-artifacts'
      ? state.dirHandle
      : await state.dirHandle.getDirectoryHandle('agent-artifacts', { create: true });

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

// Initialise base files for a brand-new project ONLY. If agent-artifacts/CLAUDE.md
// already exists the project is considered initialised and is left untouched — the
// user refreshes it explicitly via the "Update now" button on the update banner.
// This prevents the wizard from silently overwriting an existing project's files.
async function maybeInitBaseArtifacts(handle) {
  if (!handle || !hasFSA) return;
  const existing = await tryReadFile(handle, 'agent-artifacts', 'CLAUDE.md');
  if (existing) return;            // already initialised — never auto-overwrite
  await writeBaseArtifacts();       // brand-new project — seed base files
}

// Explicit user-triggered update: rewrites the project-agnostic base files
// (CLAUDE.md, hooks, templates) and the .sdd-version manifest to the current
// skeleton version. Wired to the "Update now" button on the update banner.
async function runSkeletonUpdate() {
  const btn = document.getElementById('sddUpdateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }

  await writeBaseArtifacts(true);   // silent — we show our own confirmation below
  document.getElementById('sddUpdateBanner')?.remove();
  showUpdateDoneBanner(SKELETON_VERSION);
  showToast(`✅ Updated to v${SKELETON_VERSION} — CLAUDE.md, hooks, and templates refreshed.`, 'success');

  console.log('📌 Re-install hooks to activate the updated protections:');
  console.log('   cp -r agent-artifacts/hooks/.  .claude/');
  console.log('   chmod +x .claude/scripts/*.sh');
}

// Writes all project-agnostic base files to agent-artifacts/.
// Called by maybeInitBaseArtifacts (new projects), runSkeletonUpdate (explicit
// update), and when the final wizard step is saved. Safe to call repeatedly.
async function writeBaseArtifacts(silent = false) {
  if (!state.dirHandle || !hasFSA) return;

  const files = [
    ['CLAUDE.md',                          EMBEDDED_CLAUDE_MD],
    ['tasks/TASK_TEMPLATE.md',             EMBEDDED_TASK_TEMPLATE],
    ['tasks/BOOTSTRAP_TEMPLATE.md',        EMBEDDED_BOOTSTRAP_TEMPLATE],
    ['context/TEMPLATE.md',                EMBEDDED_CONTEXT_TEMPLATE],
    ['context/_index.md',                  EMBEDDED_CONTEXT_INDEX],
    ['skills/_index.md',                   EMBEDDED_SKILLS_INDEX],
    ['skills/ada.md',                      EMBEDDED_SKILL_ADA],
    ['skills/analytics.md',                EMBEDDED_SKILL_ANALYTICS],
    ['hooks/settings.json',                EMBEDDED_HOOKS_SETTINGS],
    ['hooks/scripts/protected-paths.sh',   EMBEDDED_PROTECTED_PATHS_SH],
    ['hooks/scripts/git-guard.sh',         EMBEDDED_GIT_GUARD_SH],
    ['hooks/scripts/lint-gate.sh',         EMBEDDED_LINT_GATE_SH],
    ['hooks/scripts/done-gate.sh',         EMBEDDED_DONE_GATE_SH],
  ];

  let failed = 0;
  for (const [path, content] of files) {
    const ok = await saveFile(path, content);
    if (!ok) failed++;
  }

  // Stamp a version manifest so a later wizard run can detect when this
  // project's snapshot is older than the current skeleton (update banner).
  const manifest = JSON.stringify({
    version: SKELETON_VERSION,
    generated: new Date().toISOString(),
  }, null, 2) + '\n';
  if (!await saveFile('.sdd-version', manifest)) failed++;

  if (!silent) {
    if (failed === 0) {
      showToast('✅ Base files written — CLAUDE.md, tasks, context, and hooks are ready.', 'success');
    } else {
      showToast(`⚠️  ${failed} file(s) could not be written — check console`, 'info');
    }
  }
}

// Called when final wizard step is saved — re-writes base files (picks up latest
// CLAUDE.md content) and confirms setup is complete.
async function createCompleteArtifactsStructure() {
  if (!state.dirHandle || !hasFSA) {
    // Non-FSA browser (Safari) — download the auto-generated files individually
    // with an overlay explaining where to place each one.
    downloadArtifactsFallback();
    return;
  }

  await writeBaseArtifacts(true); // silent — toast shown below
  showToast('✅ Setup complete! All agent-artifacts files are ready.', 'success');

  console.log('📌 Final step — install Claude Code hooks from your project terminal:');
  console.log('   cp -r agent-artifacts/hooks/.  .claude/');
  console.log('   chmod +x .claude/scripts/*.sh');
}

function downloadFallback(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.split('/').pop();
  a.click(); URL.revokeObjectURL(url);
}

// Safari/Firefox fallback — downloads all auto-generated files one by one
// and shows an overlay telling the user exactly where to place each file.
function downloadArtifactsFallback() {
  const files = [
    { path: 'agent-artifacts/CLAUDE.md',                           content: EMBEDDED_CLAUDE_MD },
    { path: 'agent-artifacts/tasks/TASK_TEMPLATE.md',              content: EMBEDDED_TASK_TEMPLATE },
    { path: 'agent-artifacts/tasks/BOOTSTRAP_TEMPLATE.md',         content: EMBEDDED_BOOTSTRAP_TEMPLATE },
    { path: 'agent-artifacts/context/TEMPLATE.md',                 content: EMBEDDED_CONTEXT_TEMPLATE },
    { path: 'agent-artifacts/context/_index.md',                   content: EMBEDDED_CONTEXT_INDEX },
    { path: 'agent-artifacts/hooks/settings.json',                 content: EMBEDDED_HOOKS_SETTINGS },
    { path: 'agent-artifacts/hooks/scripts/protected-paths.sh',    content: EMBEDDED_PROTECTED_PATHS_SH },
    { path: 'agent-artifacts/hooks/scripts/git-guard.sh',          content: EMBEDDED_GIT_GUARD_SH },
    { path: 'agent-artifacts/hooks/scripts/lint-gate.sh',          content: EMBEDDED_LINT_GATE_SH },
    { path: 'agent-artifacts/hooks/scripts/done-gate.sh',          content: EMBEDDED_DONE_GATE_SH },
  ];

  // Stagger downloads so the browser doesn't block them
  files.forEach((f, i) => {
    setTimeout(() => {
      const blob = new Blob([f.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.path.split('/').pop();
      a.click();
      URL.revokeObjectURL(url);
    }, i * 400);
  });

  // Show placement instructions overlay
  const modal = document.createElement('div');
  modal.id = 'safariDownloadModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;
    display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px 0;
  `;
  modal.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;
      padding:28px 32px;max-width:560px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.5);">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">
        📥 ${files.length} files downloaded
      </div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:18px;line-height:1.6">
        Move each downloaded file into your project folder using the paths below.
        Create any missing folders as needed.
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;
        padding:12px 16px;font-family:var(--mono);font-size:11px;line-height:2;color:var(--accent)">
        ${files.map(f => `<div>${f.path}</div>`).join('')}
      </div>
      <div style="margin-top:16px;padding:12px 14px;background:rgba(245,158,11,0.08);
        border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:11px;color:#f59e0b;line-height:1.6">
        💡 <strong>Tip:</strong> Switch to <strong>Chrome or Edge</strong> to have the wizard place all files
        automatically. You won't need to do this manually.
      </div>
      <div style="margin-top:18px;text-align:right">
        <button onclick="document.getElementById('safariDownloadModal').remove()"
          style="padding:8px 20px;border-radius:6px;border:none;background:var(--accent);
          color:var(--bg);cursor:pointer;font-size:13px;font-weight:600">
          Got it
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleSave(stepId, filename, content) {
  // No folder selected yet — prompt the user to pick one before saving
  if (hasFSA && !state.dirHandle) {
    showToast('Select your project root or agent-artifacts/ folder to save directly…', 'info');
    try {
      const handle = await window.showDirectoryPicker();
      state.dirHandle = handle;
      const badge = document.getElementById('sddBadge');
      if (badge) { badge.textContent = '📂 ' + handle.name; badge.className = 'folder-badge granted'; }
      showToast('Folder set: ' + handle.name + ' — saving…', 'success');
    } catch (e) {
      // User cancelled or picker failed — fall back to download
      downloadFallback(filename, content);
      showToast('No folder selected — file downloaded to Downloads instead', 'info');
      return;
    }
  }

  if (hasFSA && state.dirHandle) {
    const ok = await saveFile(filename, content);
    if (ok) {
      state.saved[stepId] = true;
      state.dirty = false;
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
    state.dirty = false;
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
  let html = '', inTable = false, tableHead = true, tableHtml = '', inList = false, inOList = false;

  const flushTable = () => { html += tableHtml + '</tbody></table>'; inTable = false; tableHead = true; tableHtml = ''; };
  const flushList  = () => { if (inList) { html += '</ul>'; inList = false; } if (inOList) { html += '</ol>'; inOList = false; } };

  for (const raw of lines) {
    const line = raw;

    // Code block placeholder
    if (/\x00BLOCK\d+\x00/.test(line)) {
      flushList();
      if (inTable) flushTable();
      html += blocks[parseInt(line.match(/\d+/)[0])];
      continue;
    }

    // Bare comment-divider line (just "#" with nothing after it) — render as a
    // small spacer instead of a literal "#".
    if (/^#\s*$/.test(line)) {
      flushList();
      if (inTable) flushTable();
      html += '<div class="md-spacer"></div>';
      continue;
    }

    // File header comment lines:  # ──── or # HUMAN-AUTHORED
    if (/^# /.test(line) && !/^#{2,}/.test(line)) {
      flushList();
      if (inTable) flushTable();
      if (/^# [─═\-]{4,}/.test(line)) { html += '<hr class="md-hr">'; continue; }
      html += `<div class="md-comment">${escHtml(line.slice(2))}</div>`;
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,3}) (.+)/);
    if (hm) {
      flushList();
      if (inTable) flushTable();
      const lvl = hm[1].length;
      html += `<div class="md-h${lvl}">${inlineMd(hm[2])}</div>`;
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      flushList();
      if (inTable) flushTable();
      html += '<hr class="md-hr">';
      continue;
    }

    // Table row
    if (/^\|.+\|$/.test(line.trim())) {
      flushList();
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

    // Unordered list item
    if (/^- /.test(line)) {
      if (inOList) flushList();
      if (!inList) { html += '<ul class="md-list">'; inList = true; }
      html += `<li>${inlineMd(line.slice(2))}</li>`;
      continue;
    }

    // Ordered list item  (1. , 2. , ...)
    const om = line.match(/^\d+\.\s+(.+)/);
    if (om) {
      if (inList) flushList();
      if (!inOList) { html += '<ol class="md-list md-olist">'; inOList = true; }
      html += `<li>${inlineMd(om[1])}</li>`;
      continue;
    }

    if (inList || inOList) flushList();

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

// "Other" pill — expands an inline text input when selected.
// Use for any pill group where a project might use a library not in the hardcoded list.
function otherPill(group, type = 'check') {
  const id = group + '___other__';
  return `<label class="${type}-pill other-pill" id="pill-${id}" onclick="event.preventDefault();toggleOtherPill(this,'${group}','${type}')">
    <input type="${type === 'radio' ? 'radio' : 'checkbox'}" name="${group}" value="__other__">
    Other<span class="other-expand" style="display:none">:&nbsp;<input type="text" class="other-text-input" id="other-input-${group}" placeholder="specify…" onclick="event.stopPropagation()" oninput="updatePreview(state.current);saveDraft()" style="border:none;background:transparent;outline:none;font:inherit;color:inherit;width:90px;margin-left:2px"></span>
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

function toggleOtherPill(el, group, type) {
  togglePill(el, group, '__other__', type);
  const expand = el.querySelector('.other-expand');
  if (!expand) return;
  const selected = el.classList.contains('selected');
  expand.style.display = selected ? 'inline' : 'none';
  if (selected) el.querySelector('.other-text-input')?.focus();
}

function getPills(group) {
  return Array.from(document.querySelectorAll(`[id^="pill-${group}_"]`))
    .filter(p => p.classList.contains('selected'))
    .map(p => {
      const val = p.querySelector('input[type="checkbox"],input[type="radio"]').value;
      if (val === '__other__') {
        const txt = (document.getElementById(`other-input-${group}`)?.value || '').trim();
        return txt || null;
      }
      return val;
    })
    .filter(Boolean);
}

function getRadio(group) {
  const sel = document.querySelector(`[id^="pill-${group}_"].selected`);
  if (!sel) return '';
  const val = sel.querySelector('input').value;
  if (val === '__other__')
    return (document.getElementById(`other-input-${group}`)?.value || '').trim();
  return val;
}

// Selects a pill by value. If the value isn't in the hardcoded list, automatically
// selects "Other" and fills in the freeform text — used by analyzeProject().
function selectPill(group, value, type = 'check') {
  const el = document.getElementById(`pill-${group}_${value}`);
  if (el) {
    if (!el.classList.contains('selected')) togglePill(el, group, value, type);
    return;
  }
  // Value not in known pills — fall back to "Other"
  const otherEl = document.getElementById(`pill-${group}___other__`);
  if (otherEl && value) {
    if (!otherEl.classList.contains('selected')) toggleOtherPill(otherEl, group, type);
    const inp = document.getElementById(`other-input-${group}`);
    if (inp) { inp.value = value; updatePreview(state.current); saveDraft(); }
  }
}

// ══════════════════════════════════════════════════════
//  DONE SCREEN
// ══════════════════════════════════════════════════════
function updateDoneScreen() {
  const screen = document.getElementById('screen-done');
  if (!screen) return;

  const files        = STEPS.filter(s => s.file);
  const coreSteps    = files.filter(s => !OPTIONAL_STEP_IDS.has(s.id));
  const optionalSteps = files.filter(s =>  OPTIONAL_STEP_IDS.has(s.id));

  const renderFile = s => `
    <div class="done-file">
      <div class="status-dot ${state.saved[s.id] ? '' : 'pending'}"></div>
      <span style="color:${state.saved[s.id] ? 'var(--success)' : 'var(--text-muted)'}">${s.file}</span>
      ${!state.saved[s.id] && OPTIONAL_STEP_IDS.has(s.id)
        ? `<span onclick="goTo('${s.id}')" style="margin-left:auto;font-size:10px;color:var(--accent);
            cursor:pointer;text-decoration:underline;flex-shrink:0">Fill in →</span>`
        : ''}
    </div>`;

  const pendingOptional = optionalSteps.filter(s => !state.saved[s.id]);

  screen.querySelector('.done-files').innerHTML =
    `<div style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;
       letter-spacing:0.8px;margin-bottom:6px">Core</div>` +
    coreSteps.map(renderFile).join('') +
    `<div style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;
       letter-spacing:0.8px;margin-top:14px;margin-bottom:6px">Optional</div>` +
    optionalSteps.map(renderFile).join('') +
    (pendingOptional.length > 0
      ? `<div style="margin-top:14px;padding:10px 12px;background:rgba(99,102,241,0.08);
           border:1px solid rgba(99,102,241,0.2);border-radius:8px;font-size:12px;
           color:var(--text-dim);line-height:1.5">
           ${pendingOptional.length} optional step${pendingOptional.length > 1 ? 's' : ''} pending.
           The agent will work now — fill these in when you're ready to improve accuracy.
         </div>`
      : '');
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

  // Warn before overwriting files that are manually maintained after first generation
  const protectedSteps = { modules: 'MODULE_MAP.md', datamodel: 'DATA_MODEL.md' };
  if (protectedSteps[stepId] && state.dirHandle) {
    const filename = protectedSteps[stepId];
    const exists   = await tryReadFile(state.dirHandle, 'agent-artifacts', 'spec-kit', filename)
                  ?? await tryReadFile(state.dirHandle, 'spec-kit', filename);
    if (exists) {
      const go = confirm(
        `⚠️  Overwrite ${filename}?\n\n` +
        `This file may contain manually added content (purposes, key classes, API contracts).\n\n` +
        `Saving will regenerate it from the wizard form only — anything added directly in the file will be lost.\n\n` +
        `Click OK to overwrite, or Cancel to keep the existing file.`
      );
      if (!go) return;
    }
  }

  const content = PLATFORM.generate[stepId]?.() ?? '';
  await handleSave(stepId, step.file, content);

  // Platform-specific extra saves (e.g. modules also writes context/_index.md)
  await PLATFORM.extraSave?.[stepId]?.();

  // When final step (datamodel) is saved, create the complete artifacts structure
  if (stepId === 'datamodel') {
    await createCompleteArtifactsStructure();
  }
}

// ══════════════════════════════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════════════════════════════
function init() {
  // Populate STEPS from platform definition
  STEPS.length = 0;
  PLATFORM.steps.forEach(s => STEPS.push(s));

  // Show the bundled skeleton version in the sidebar header.
  const verLabel = document.getElementById('sddVersionLabel');
  if (verLabel) verLabel.textContent = `· v${SKELETON_VERSION}`;

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
            ['2','Select your project folder','Point to your project root (e.g. <code>MyApp/</code>). The wizard auto-detects your stack and writes all generated files into <code>agent-artifacts/</code> inside it.'],
            ['3','Fill in each step','Work through the sidebar steps left to right. Select your stack options, add modules and debt entries. The MD preview on the right updates live.'],
            ['4','Save each file','Click the green <strong>💾 Save</strong> button on each step. Files are written directly to <code>agent-artifacts/spec-kit/</code> inside the folder you selected. The sidebar shows ✅ for saved steps.'],
            ['5','Review the generated files','Open the saved <code>.md</code> files in your editor. Replace any <code>[fill in]</code> placeholders with your project-specific details.'],
            ['6','Run your first agent task','Copy <code>agent-sdd/tasks/TASK_TEMPLATE.md</code> to <code>agent-artifacts/tasks/</code>, fill in a real ticket, open a Claude session, and let the agent execute it.'],
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
      <button class="btn btn-primary" onclick="goTo('projectconfig')">Start Setup →</button>
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

  // Build platform-agnostic task creation screen
  buildTaskScreen(fp);
  attachDraftListeners('screen-newtask');

  // Build CLAUDE.md viewer screen
  buildClaudeMdScreen(fp);

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
//  TASK SCREEN
//  Platform-agnostic task MD creation form.
//  Quality gate defaults come from PLATFORM.taskDefaults.
// ══════════════════════════════════════════════════════

function goToTaskScreen() {
  const leavingStep = STEPS.find(s => s.id === state.current);
  if (state.dirty && leavingStep?.file) {
    showUnsavedWarning(leavingStep.label, () => _goToTaskScreen());
    return;
  }
  _goToTaskScreen();
}

function _goToTaskScreen() {
  state.dirty = false;
  state.current = 'newtask';
  document.querySelectorAll('.step-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-newtask')?.classList.add('active');
  const fp = document.querySelector('.form-panel');
  if (fp) fp.scrollTop = 0;
  buildSidebar();
  document.getElementById('headerTitle').textContent = 'Create Task';
  document.getElementById('headerDesc').textContent = 'Generate a task MD file ready for Claude to execute';
  const tutLink = document.getElementById('headerTutorial');
  if (tutLink) { tutLink.href = 'tutorial.html#writing-tasks'; tutLink.style.display = 'inline-flex'; }
  document.getElementById('previewPanel').classList.remove('collapsed');
  updateTaskPreview();
  document.querySelectorAll('.tool-link').forEach(l => l.classList.remove('tool-active'));
  document.getElementById('tool-newtask')?.classList.add('tool-active');
}

function generateTaskMd() {
  const id    = document.getElementById('task-id')?.value.trim()    || '[PROJ]-1234';
  const title = document.getElementById('task-title')?.value.trim() || '[Title]';
  const type  = getRadio('task-type') || 'Feature';
  const desc  = document.getElementById('task-desc')?.value.trim()  || '[Description here]';

  const lines = id => (document.getElementById(id)?.value.trim() || '').split('\n').map(l => l.trim()).filter(Boolean);

  const criteria  = lines('task-criteria');
  const oos       = lines('task-oos');
  const areas     = document.getElementById('task-areas')?.value.trim() || '[Affected areas]';
  const testReq   = getRadio('task-test-req') || 'N';
  const testLevel = getRadio('task-level')    || 'Unit';
  const scenarios = lines('task-scenarios');
  const refs      = lines('task-refs');
  const notes     = document.getElementById('task-notes')?.value.trim();
  const qgCustom  = lines('task-qg-custom');

  const qgDefaults = (PLATFORM?.taskDefaults?.qualityGate || [])
    .filter(item => document.getElementById('task-qg-' + item.id)?.checked !== false)
    .map(item => `- [ ] ${item.label}`);
  const allQg = [...qgDefaults, ...qgCustom.map(l => `- [ ] ${l}`)];

  const types = ['Feature', 'Bug', 'Refactor', 'Task'];

  return `# Task: ${id} — ${title}

## Type

${types.map(t => `- [${t === type ? 'x' : ' '}] ${t}`).join('\n')}

## Description

${desc}

## Acceptance Criteria

${criteria.length ? criteria.map(c => `- [ ] ${c}`).join('\n') : '- [ ] [Criterion 1]'}

## Quality Gate

${allQg.length ? allQg.join('\n') : '- [ ] [Add quality gate items]'}

## Out of Scope

${oos.length ? oos.map(o => `- ${o}`).join('\n') : '- [None]'}

## Affected Areas

${areas}

## Testing

Required: ${testReq}

Level: ${testLevel}

Scenarios:
${scenarios.length ? scenarios.map(s => `- [ ] ${s}`).join('\n') : '- [ ] [Scenario 1]'}

## Designs / References

${refs.length ? refs.map(r => `- ${r}`).join('\n') : '- None'}

## Notes

${notes || '[Notes here or remove section]'}
`;
}

function updateTaskPreview() {
  if (state.current !== 'newtask') return;
  document.getElementById('previewContent').innerHTML = renderMarkdown(generateTaskMd());
}

async function saveTask() {
  const id = document.getElementById('task-id')?.value.trim();
  if (!id) { showToast('Enter a Ticket ID first', 'error'); return; }
  await handleSave('newtask-' + id, 'tasks/' + id + '.md', generateTaskMd());
}

function resetTaskForm() {
  ['task-id','task-title','task-desc','task-criteria','task-qg-custom',
   'task-oos','task-areas','task-scenarios','task-refs','task-notes'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = '';
  });
  ['task-type','task-test-req','task-level'].forEach(group => {
    document.querySelectorAll(`[id^="pill-${group}_"]`).forEach(p => {
      p.classList.remove('selected');
      const inp = p.querySelector('input');
      if (inp) inp.checked = false;
    });
  });
  (PLATFORM?.taskDefaults?.qualityGate || []).forEach(item => {
    const el = document.getElementById('task-qg-' + item.id);
    if (el) el.checked = true;
  });
  updateTaskPreview();
  showToast('Form cleared — ready for next task', 'info');
}

function buildTaskScreen(fp) {
  const qgItems = PLATFORM?.taskDefaults?.qualityGate || [];
  fp.innerHTML += `
  <div class="step-screen" id="screen-newtask">
    <div style="max-width:700px">

      <div class="form-section">
        <h3>Ticket</h3>
        <div style="display:flex;gap:12px">
          <div class="form-row" style="width:160px;flex-shrink:0;margin-bottom:0">
            <label>Ticket ID</label>
            <input type="text" id="task-id" placeholder="[PROJ]-1234" oninput="updateTaskPreview();saveDraft()">
          </div>
          <div class="form-row" style="flex:1;margin-bottom:0">
            <label>Title</label>
            <input type="text" id="task-title" placeholder="Short descriptive title" oninput="updateTaskPreview();saveDraft()">
          </div>
        </div>
        <div class="form-row" style="margin-top:12px">
          <label>Type</label>
          <div class="radio-group">
            ${['Feature','Bug','Refactor','Task'].map(t => pill(t, t, 'task-type', 'radio')).join('')}
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Description</h3>
        <div class="form-row">
          <label>What needs to be done and why — 1–5 sentences, specific about what changes</label>
          <textarea id="task-desc" rows="4"
            placeholder="e.g. Add a store_selected Firebase event fired when the user taps a store. The event must include store_id as a property."
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3>Acceptance Criteria</h3>
        <div class="form-row">
          <label>One criterion per line — each must be verifiable by a specific file, function, or test</label>
          <textarea id="task-criteria" rows="5"
            placeholder="TrackStoreSelectedEvent is called in SelectStoreFragment.onStoreClicked() with the correct store_id&#10;Event is NOT sent to Adjust — Firebase only&#10;Unit test covers success and cancellation paths"
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3>Quality Gate</h3>
        <p class="form-sub">Platform defaults — uncheck any that don't apply to this task</p>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:4px 14px;margin-bottom:12px">
          ${qgItems.map(item => `
          <div class="toggle-row">
            <div class="toggle-label" style="font-size:12px;flex:1;padding-right:12px">${item.label}</div>
            <label class="toggle">
              <input type="checkbox" id="task-qg-${item.id}" checked onchange="updateTaskPreview();saveDraft()">
              <div class="toggle-track"></div><div class="toggle-thumb"></div>
            </label>
          </div>`).join('')}
        </div>
        <div class="form-row">
          <label>Additional task-specific checks (one per line)</label>
          <textarea id="task-qg-custom" rows="2"
            placeholder="e.g. AppSettingsFragment does not call loadContactOptions() after this change — verify by grep"
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3>Out of Scope</h3>
        <div class="form-row">
          <label>One item per line — explicitly state what NOT to do</label>
          <textarea id="task-oos" rows="3"
            placeholder="Do not add Adjust tracking — Firebase only&#10;Do not modify existing trackBasketTransfer() method"
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3>Affected Areas</h3>
        <div class="form-row">
          <label>Module names, feature names, key files — helps agent load the right context files</label>
          <input type="text" id="task-areas"
            placeholder="e.g. analytics, store selection, SelectStoreFragment, StoreViewModel"
            oninput="updateTaskPreview();saveDraft()">
        </div>
      </div>

      <div class="form-section">
        <h3>Testing</h3>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div class="form-row" style="margin-bottom:0">
            <label>Required</label>
            <div class="radio-group">
              ${pill('Yes','Y','task-test-req','radio')}
              ${pill('No','N','task-test-req','radio')}
            </div>
          </div>
          <div class="form-row" style="margin-bottom:0">
            <label>Level</label>
            <div class="radio-group">
              ${pill('Unit','Unit','task-level','radio')}
              ${pill('Integration','Integration','task-level','radio')}
              ${pill('Both','Both','task-level','radio')}
            </div>
          </div>
        </div>
        <div class="form-row" style="margin-top:12px">
          <label>Scenarios (one per line)</label>
          <textarea id="task-scenarios" rows="3"
            placeholder="event fires with correct store_id when store is tapped&#10;event does not fire when store selection is cancelled"
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3>Designs / References</h3>
        <div class="form-row">
          <label>One link or file path per line</label>
          <textarea id="task-refs" rows="2"
            placeholder="https://figma.com/file/...&#10;docs/api-contract.md"
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3>Notes</h3>
        <div class="form-row">
          <label>Backend changes, known gotchas, ticket dependencies — leave blank if none</label>
          <textarea id="task-notes" rows="3"
            placeholder="The endpoint is not yet deployed to production — test against staging only."
            oninput="updateTaskPreview();saveDraft()"></textarea>
        </div>
      </div>

      <div class="btn-actions">
        <button class="btn btn-success" onclick="saveTask()">💾 Save Task</button>
        <button class="btn btn-secondary" onclick="resetTaskForm()">↺ New Task</button>
      </div>

    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════
//  CLAUDE.MD VIEWER
//  Read-only screen showing the embedded CLAUDE.md content
//  so users understand what the agent is instructed with.
// ══════════════════════════════════════════════════════

function buildClaudeMdScreen(fp) {
  fp.innerHTML += `
  <div class="step-screen" id="screen-claudemd">
    <div style="max-width:800px">
      <div class="form-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:gap">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">
              Agent Instructions — CLAUDE.md
            </div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.5">
              This is the instruction set written to <code style="font-size:11px;background:var(--bg);padding:1px 5px;border-radius:3px;border:1px solid var(--border)">agent-artifacts/CLAUDE.md</code>
              when you complete setup. Claude reads this at the start of every task session.
              It is read-only — to customise agent behaviour use <code style="font-size:11px;background:var(--bg);padding:1px 5px;border-radius:3px;border:1px solid var(--border)">spec-kit/CONVENTIONS.md</code>.
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="copyCLAUDEmdToClipboard()"
            style="flex-shrink:0;margin-left:16px">📋 Copy</button>
        </div>
        <div id="claudemd-render" class="md-rendered" style="
          background:var(--bg);border:1px solid var(--border);border-radius:8px;
          padding:20px 24px;font-size:12.5px;line-height:1.7;color:var(--text);
          max-height:calc(100vh - 220px);overflow-y:auto;
        "></div>
      </div>
    </div>
  </div>`;
}

function goToClaudeMdScreen() {
  const leavingStep = STEPS.find(s => s.id === state.current);
  if (state.dirty && leavingStep?.file) {
    showUnsavedWarning(leavingStep.label, () => _goToClaudeMdScreen());
    return;
  }
  _goToClaudeMdScreen();
}

function _goToClaudeMdScreen() {
  state.dirty = false;
  state.current = 'claudemd';
  document.querySelectorAll('.step-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-claudemd')?.classList.add('active');
  const fp = document.querySelector('.form-panel');
  if (fp) fp.scrollTop = 0;
  buildSidebar();
  document.getElementById('headerTitle').textContent = 'CLAUDE.md';
  document.getElementById('headerDesc').textContent = 'Agent instruction set — written to agent-artifacts/CLAUDE.md on setup complete';
  const tutLink = document.getElementById('headerTutorial');
  if (tutLink) tutLink.style.display = 'none';
  document.getElementById('previewPanel').classList.add('collapsed');
  document.querySelectorAll('.tool-link').forEach(l => l.classList.remove('tool-active'));
  document.getElementById('tool-claudemd')?.classList.add('tool-active');

  // Render EMBEDDED_CLAUDE_MD as markdown. Strip the leading maintainer comment
  // header (single-`#` comment lines + blanks at the very top) — it explains how
  // to regenerate the file and is noise for someone viewing the artifact here.
  // Stop at the first real content line (a `##` heading or body text).
  const container = document.getElementById('claudemd-render');
  if (container) container.innerHTML = renderMarkdown(stripLeadingComments(EMBEDDED_CLAUDE_MD));
}

// Drop the leading block of single-`#` comment lines and blank lines from the
// top of a markdown doc, returning from the first line of real content onward.
function stripLeadingComments(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') { i++; continue; }          // blank
    if (/^#(?!#)/.test(l)) { i++; continue; }         // single-# comment (not a ## heading)
    break;                                            // first real content
  }
  return lines.slice(i).join('\n');
}

function copyCLAUDEmdToClipboard() {
  navigator.clipboard.writeText(EMBEDDED_CLAUDE_MD).then(() => {
    showToast('CLAUDE.md copied to clipboard', 'success');
  }).catch(() => {
    showToast('Copy failed — try selecting the text manually', 'error');
  });
}

// ══════════════════════════════════════════════════════
//  PLATFORM SELECTION
//  Dynamically loads platform-android.js or platform-ios.js
//  after the user picks a platform from the overlay.
// ══════════════════════════════════════════════════════
function choosePlatform(name) {
  const overlay = document.getElementById('platformOverlay');

  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
  }

  // Prefer inline injection (file:// safe) if the platform code has been embedded
  // by generate-embedded.js. Falls back to script.src when served via HTTP and the
  // embedded constant is still the placeholder (e.g. dev environment without running
  // the generator first).
  const platformCode = name === 'android' ? EMBEDDED_PLATFORM_ANDROID : EMBEDDED_PLATFORM_IOS;
  const isEmbedded = platformCode && !platformCode.startsWith('placeholder');

  if (isEmbedded) {
    // Inline execution: script.textContent runs synchronously on appendChild —
    // no onload/onerror events fire. Proceed with the post-load logic directly.
    const script = document.createElement('script');
    script.textContent = platformCode;
    document.head.appendChild(script);
    setTimeout(() => overlay?.remove(), 320);
    if (!hasFSA) { init(); return; }
    showFolderInterstitial(name);
  } else {
    // Fallback: dynamic src load (works over HTTP, fails on file://).
    const script = document.createElement('script');
    script.src = 'engine/platform-' + name + '.js';
    script.onload = () => {
      setTimeout(() => overlay?.remove(), 320);
      if (!hasFSA) { init(); return; }
      showFolderInterstitial(name);
    };
    script.onerror = () => {
      if (overlay) { overlay.style.opacity = '1'; overlay.style.pointerEvents = ''; }
      showToast('Could not load platform: ' + name, 'error');
    };
    document.head.appendChild(script);
  }
}

function showFolderInterstitial(platformName) {
  const label = platformName === 'android' ? 'Android' : 'iOS';

  const el = document.createElement('div');
  el.id = 'folderInterstitial';
  el.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:var(--bg)';
  el.innerHTML = `
    <div style="text-align:center;max-width:460px;padding:48px 28px">
      <div style="font-size:48px;margin-bottom:20px">📂</div>
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:700">Select your ${label} project folder</h2>
      <p style="color:var(--text-muted);font-size:14px;line-height:1.7;margin:0 0 32px">
        Point the wizard at your project root so it can auto-detect your stack and save all generated files directly into <code>agent-artifacts/</code> inside it.
      </p>
      <button id="folderInterstitialBtn" class="btn btn-primary" style="width:100%;justify-content:center;font-size:15px;padding:14px 24px;margin-bottom:16px">
        📂 Select Project Folder
      </button>
      <div>
        <button id="folderInterstitialSkip" style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;text-decoration:underline;padding:4px 0">
          Skip — I'll select it later
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);

  const dismiss = (handle) => {
    el.style.transition = 'opacity 0.2s';
    el.style.opacity = '0';
    setTimeout(() => {
      el.remove();
      init();
      // Fire post-init folder setup now that DOM is fully built
      if (handle) {
        const badge = document.getElementById('sddBadge');
        if (badge) { badge.textContent = '📂 ' + handle.name; badge.className = 'folder-badge granted'; }
        const pathEl = document.getElementById('cfg-codebase-path');
        if (pathEl && !pathEl.value) pathEl.value = '..';
        tryReadFile(handle, 'agent-artifacts', 'project.config.md').then(existing => {
          if (existing) loadExistingConfig(existing);
        });
        showToast('Project folder set: ' + handle.name + ' — analysing…', 'success');
        PLATFORM.onFolderGranted?.();
        // Light up sidebar ✅ for any steps whose output files already exist
        detectExistingOutputFiles(handle);
        // Initialise base files for brand-new projects only (see openFolder).
        maybeInitBaseArtifacts(handle);
      }
    }, 200);
  };

  document.getElementById('folderInterstitialBtn').onclick = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      state.dirHandle = handle;
      dismiss(handle);
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Could not access folder — try again.', 'error');
    }
  };

  document.getElementById('folderInterstitialSkip').onclick = () => dismiss(null);
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
window.addEventListener('DOMContentLoaded', () => {
  applyBrowserCompat();
});
