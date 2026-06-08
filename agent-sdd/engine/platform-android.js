// ══════════════════════════════════════════════════════
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
  const hasPill = group => document.querySelectorAll(`[id^="pill-${group}_"].selected`).length > 0;

  // Core — pill selections (agent needs these for ADR generation)
  const coreChecks = [
    hasPill('arch'), hasPill('di'), hasPill('async'),
    hasPill('state'), hasPill('ui'), hasPill('nav'),
  ];
  // Returns true if at least one approach card in the group has text entered.
  const hasApproachNote = group =>
    [...document.querySelectorAll(`#arch-${group}-detail .approach-card textarea`)]
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
  track.innerHTML = `
    ${coreW > 0 ? `<div class="arch-seg core"        style="flex:${coreW}"></div>` : ''}
    ${recW  > 0 ? `<div class="arch-seg recommended" style="flex:${recW}"></div>`  : ''}
    ${optW  > 0 ? `<div class="arch-seg optional"    style="flex:${optW}"></div>`  : ''}
    ${emptyW > 0 ? `<div class="arch-seg empty"      style="flex:${emptyW}"></div>` : ''}
  `;
  document.getElementById('arch-progress-core-label').textContent = `${coreDone}/${coreTotal} Core`;
  document.getElementById('arch-progress-rec-label').textContent  = `${recDone}/${recTotal} Recommended`;
  document.getElementById('arch-progress-opt-label').textContent  = `${optDone}/${optTotal} Optional`;

  const hint = document.getElementById('arch-progress-hint');
  if (hint) {
    hint.textContent = coreDone === coreTotal
      ? recDone === recTotal
        ? '★ Fully configured — agent has maximum context.'
        : '✓ Core complete — agent can start. Fill Recommended fields for better output quality.'
      : `Fill the ${coreTotal - coreDone} remaining Core section${coreTotal - coreDone > 1 ? 's' : ''} before running tasks.`;
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
  const prefix = (prevChar !== '' && prevChar !== '\n' && prevChar !== ' ' && prevChar !== ',') ? ', ' : '';
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
      `<div class="module-chips-title">Modules</div>` +
      modules.map(m =>
        `<span class="mod-chip" onclick="insertModuleChip('${targetId}','${m.name}')">${m.name}</span>`
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
    `<div class="module-chips-title">Modules</div>` +
    modules.map(m =>
      `<span class="mod-chip" onclick="insertModuleChip('${targetId}','${m.name}')">${m.name}</span>`
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
  const containerId = `arch-${group}-detail`;
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
    const taId = `approach-${group}-${approach}`;
    const ph   = notes[approach] || 'describe which modules use this approach';
    // Prefer current DOM value, then localStorage draft, then empty.
    const val  = saved[approach] ?? getDraftField(taId);
    return `<div class="approach-card" data-approach="${approach}">
      <div class="approach-card-label">${approach}</div>
      <textarea id="${taId}" rows="2"
        placeholder="${ph}"
        oninput="updatePreview('architecture'); updateArchProgress()">${val}</textarea>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="${taId}"></div>
      </div>
    </div>`;
  }).join('');

  // Populate chips in the newly rendered cards.
  container.querySelectorAll('.approach-card .module-chips[data-target]').forEach(c => populateApproachChips(c));
}

// Reads all approach-card textareas for a group → array of {approach, note} pairs.
function getApproachRows(group) {
  const rows = [];
  document.querySelectorAll(`#arch-${group}-detail .approach-card`).forEach(card => {
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
  const domainSection = text.match(/^## Domain Entities([\s\S]*?)(?=^## )/m)?.[1] ?? '';
  for (const block of domainSection.split(/^### /m).slice(1)) {
    const name = block.split('\n')[0].trim();
    if (!name || name.includes('[')) continue;
    const dataClassMatch = block.match(/data class \w+\s*\(([\s\S]*?)\)/);
    if (dataClassMatch) {
      const fields = dataClassMatch[1]
        .split('\n')
        .map(l => l.trim().replace(/^va[lr]\s+/, '').replace(/,$/, '').trim())
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
    const firstLine  = block.split('\n')[0].trim();
    const spaceIdx   = firstLine.indexOf(' ');
    if (spaceIdx === -1) continue;
    const method = firstLine.slice(0, spaceIdx).toUpperCase();
    const path   = firstLine.slice(spaceIdx + 1).trim();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;

    const reqBody  = block.match(/Request:\s*```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim()  ?? '';
    const respBody = block.match(/Response 200:\s*```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? '';
    const errRows  = [...block.matchAll(/\|\s*`([^`\n]+)`\s*\|\s*([^|\n]+)\|/g)];
    const errors   = errRows
      .map(m => `${m[1].trim()} — ${m[2].trim()}`)
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
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
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
    const re = new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, 'i');
    return (block.match(re)?.[1] ?? '').replace(/`/g, '').trim();
  };

  const sections = text.split(/^### /m).slice(1);
  for (const section of sections) {
    const name = section.split('\n')[0].trim();
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
          names.push(name.replace(/\.(kt|java)$/, ''));
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
    const moduleNames = [...settings.matchAll(/include\s*['"]:?([\w\-]+)['"]/g)].map(m => m[1]);
    for (const mod of moduleNames) {
      if (mod === 'app') continue; // already tried
      const candidate = await tryReadFile(state.dirHandle, mod, 'build.gradle')
                     ?? await tryReadFile(state.dirHandle, mod, 'build.gradle.kts');
      if (candidate && /com\.android\.application/.test(candidate)) { appGradle = candidate; break; }
    }
  }

  const gradle = ((rootGradle || '') + '\n' + (appGradle || '')).toLowerCase();
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
  const moduleNames = [...((settings || '').matchAll(/include\s*[\(]?\s*["':]([\w\-:]+)["']/g))]
    .map(m => (m[1].startsWith(':') ? m[1] : ':' + m[1]));

  // ── Extract Project Config fields (preserve case — do not use lowercased gradle) ──
  const appIdMatch    = (appGradle || '').match(/\bapplicationId\b\s*=?\s*["']([^"']+)["']/);
  const baseAppId     = appIdMatch ? appIdMatch[1] : '';
  const minSdkMatch   = (appGradle || '').match(/\bminSdk(?:Version)?\b\s*=?\s*(\d+)/);
  const targetSdkMatch= (appGradle || '').match(/\btargetSdk(?:Version)?\b\s*=?\s*(\d+)/);

  // productFlavors — Groovy: flavorName { ... }  /  KTS: create("flavorName") { ... }
  // Use brace-counting to extract the full block (lazy regex stops at the first inner `}`)
  const detectedVariants = [];
  const flavorsStart = (appGradle || '').search(/productFlavors\s*\{/);
  if (flavorsStart !== -1) {
    const openAt = appGradle.indexOf('{', flavorsStart);
    let depth = 0, i = openAt, flavorsInner = '';
    for (; i < appGradle.length; i++) {
      if (appGradle[i] === '{') depth++;
      else if (appGradle[i] === '}') { depth--; if (depth === 0) { flavorsInner = appGradle.slice(openAt + 1, i); break; } }
    }
    // Extract each inner flavor block the same way
    const flavorRe = /\b(\w+)\s*\{|create\s*\(\s*["'](\w+)["']\s*\)\s*\{/g;
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
      const suffixMatch = body.match(/applicationIdSuffix\s*=?\s*["']([^"']+)["']/);
      const idMatch     = body.match(/\bapplicationId\b\s*=?\s*["']([^"']+)["']/);
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
    ? `${parsedModules.length} modules loaded from MODULE_MAP.md`
    : `${moduleNames.length} modules detected from Gradle`;
  showToast(`Auto-filled · ${moduleSource}, ${state.detectedInterceptors.length} interceptors · review & adjust`, 'success');
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
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('variant-row-${id}').remove(); updatePreview('projectconfig')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:10px">
      <div class="form-row"><label>Variant name</label>
        <input type="text" class="var-name" value="${esc(defaults.name||'')}" placeholder="dev" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>applicationId</label>
        <input type="text" class="var-app-id" value="${esc(defaults.applicationId||'')}" placeholder="com.example.app.dev" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>Note (optional)</label>
        <input type="text" class="var-note" value="${esc(defaults.note||'')}" placeholder="Dev build — internal testing only" oninput="updatePreview('projectconfig')"></div>
    </div>
  `;
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
      .map(v => `#   ${v.name}:${' '.repeat(Math.max(1, maxNameLen - v.name.length + 2))}${v.applicationId || '[fill in]'}${v.note ? `  # ${v.note}` : ''}`)
      .join('\n');
    pkgComment = `# Base source package — matches source directory structure.\n# applicationId varies by build variant:\n${variantLines}\n# Use the base package_name above for all file path and import generation.`;
  }

  const androidSection = platform === 'Android' ? `
## Android-specific (remove section if not Android)

package_name: ${pkg}
${pkgComment}
min_sdk: ${minSdk}
target_sdk: ${targetSdk}
` : '';

  const langOut = lang === 'Kotlin+Java' ? 'Kotlin' : lang;

  return `# Project Configuration
# ─────────────────────────────────────────────────────────────────────────────
# Edit this file once when adopting this skeleton for a new project.
# Every Claude session reads this file first (Step 0 of CLAUDE.md protocol).
# ─────────────────────────────────────────────────────────────────────────────

## Codebase

codebase_path: ${codebasePath}
# All file paths in context/*.md are resolved relative to this path.

## Platform

platform: ${platform}
# Options: Android | iOS | Web | Backend | Flutter | React Native

primary_language: ${langOut}
# Options: Kotlin | Java | Swift | TypeScript | JavaScript | Dart | Python | etc.
${androidSection}
## Team Preferences

default_tests: ${defaultTests}
# Y = Claude always writes tests unless the task MD explicitly says N.
# N = Claude asks each time.

branch_convention: ${branch}
# Naming hint shown in task completion reports.
# Example: feature/[PROJ]-1234 | bugfix/[PROJ]-1234 | chore/[PROJ]-1234
`;
}

function buildProjectConfigScreen(fp) {
  fp.innerHTML += `
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
        ${pill('Android','Android','cfg-platform','radio')}
        ${pill('iOS','iOS','cfg-platform','radio')}
        ${pill('Web','Web','cfg-platform','radio')}
        ${pill('Backend','Backend','cfg-platform','radio')}
        ${pill('Flutter','Flutter','cfg-platform','radio')}
        ${pill('React Native','React Native','cfg-platform','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Primary Language</h3>
      <div class="radio-group">
        ${pill('Kotlin','Kotlin','cfg-lang','radio')}
        ${pill('Java','Java','cfg-lang','radio')}
        ${pill('Kotlin + Java','Kotlin+Java','cfg-lang','radio')}
        ${pill('Swift','Swift','cfg-lang','radio')}
        ${pill('TypeScript','TypeScript','cfg-lang','radio')}
        ${pill('Dart','Dart','cfg-lang','radio')}
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
        ${pill('Y — always write tests','Y','cfg-tests','radio')}
        ${pill('N — ask each time','N','cfg-tests','radio')}
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

  </div>`;

  // Seed with three blank variant rows so the table is always visible
  addVariantRow({ name: 'dev',     applicationId: '', note: 'Development build' });
  addVariantRow({ name: 'staging', applicationId: '', note: 'Staging build' });
  addVariantRow({ name: 'prod',    applicationId: '', note: 'Production build' });
}

// ══════════════════════════════════════════════════════
//  ARCHITECTURE STEP
// ══════════════════════════════════════════════════════
function buildArchitectureScreen(fp) {
  fp.innerHTML += `
  <div class="step-screen" id="screen-architecture">

    <div class="form-section">
      <h3>Language</h3>
      <div class="form-sub">Primary language(s) in the codebase — affects which conventions and migration rules apply.</div>
      <div class="check-group" id="lang-group">
        ${pill('Kotlin','Kotlin','lang')}
        ${pill('Java','Java','lang')}
        ${pill('Kotlin + Java','Kotlin+Java','lang')}
      </div>
    </div>

    <div class="form-section">
      <h3>Architecture Pattern ${tierBadge('core')}</h3>
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
        ${pill('MVVM','MVVM','arch','radio')}
        ${pill('MVP','MVP','arch','radio')}
        ${pill('MVC','MVC','arch','radio')}
        ${pill('Clean Architecture','Clean','arch','radio')}
        ${pill('Clean + MVI','Clean+MVI','arch','radio')}
        ${otherPill('arch','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Dependency Injection ${tierBadge('core')}</h3>
      <div class="radio-group" id="di-group">
        ${pill('Hilt','Hilt','di','radio')}
        ${pill('Dagger','Dagger','di','radio')}
        ${pill('Koin','Koin','di','radio')}
        ${pill('Manual','Manual','di','radio')}
        ${pill('None','None','di','radio')}
        ${otherPill('di','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Async / Threading ${tierBadge('core')} ${infoBtn('Select every async approach currently in the codebase. Then describe <strong>where each one is used</strong> in the text area below — the agent uses this to decide which async primitive to reach for in each module.')}</h3>
      <div class="check-group" id="async-group">
        ${pill('Coroutines + Flow','Coroutines','async')}
        ${pill('RxJava 2','RxJava2','async')}
        ${pill('RxJava 3','RxJava3','async')}
        ${pill('AsyncTask (legacy)','AsyncTask','async')}
        ${pill('Threads','Threads','async')}
        ${otherPill('async')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> above to get a separate card. One card = one approach. Use module chips to specify which modules use it.</p>
      <div class="approach-detail" id="arch-async-detail"></div>
    </div>

    <div class="form-section">
      <h3>State Management ${tierBadge('core')} ${infoBtn('Select <strong>all</strong> state approaches in the codebase — including legacy ones.<br><br><strong>Each selected approach gets its own card.</strong> In each card, describe which modules use that approach and any migration rules.<br><br>Example — LiveData card:<br><code>:app, :libs:featureOrder — existing ViewModels only, do not migrate unless task explicitly scopes it</code><br><br>This tells the agent exactly where LiveData lives and to leave it alone.')}</h3>
      <div class="check-group" id="state-group">
        ${pill('StateFlow','StateFlow','state')}
        ${pill('LiveData','LiveData','state')}
        ${pill('RxSubjects','RxSubjects','state')}
        ${pill('MVI Store','MVI','state')}
        ${otherPill('state')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> above to get a separate card. One card = one approach. Use module chips to specify which modules use it.</p>
      <div class="approach-detail" id="arch-state-detail"></div>
    </div>

    <div class="form-section">
      <h3>UI Layer ${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>Jetpack Compose</strong> — declarative UI, all new screens use Composables + Material 3.<br>
        <strong>XML Layouts</strong> — View system only; agent writes XML + ViewBinding, no Compose.<br>
        <strong>Mixed</strong> — both exist; agent uses Compose for new screens and leaves XML screens untouched.
      </div>
      <div class="radio-group" id="ui-group">
        ${pill('Jetpack Compose','Compose','ui','radio')}
        ${pill('XML Layouts','XML','ui','radio')}
        ${pill('Mixed (Compose + XML)','Mixed','ui','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Navigation ${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>Jetpack Navigation</strong> — NavController + nav graph XML; single Activity model.<br>
        <strong>Compose Navigation</strong> — NavHost + composable routes; used with full Compose apps.<br>
        <strong>Manual Fragments</strong> — FragmentManager.beginTransaction(); legacy multi-Activity or no nav graph.<br>
        <strong>Mixed</strong> — Jetpack Nav for some flows, manual transactions for others.
      </div>
      <div class="radio-group" id="nav-group">
        ${pill('Jetpack Navigation','JetpackNav','nav','radio')}
        ${pill('Manual Fragments','ManualFragments','nav','radio')}
        ${pill('Mixed','MixedNav','nav','radio')}
        ${pill('Compose Navigation','ComposeNav','nav','radio')}
        ${otherPill('nav','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Networking ${tierBadge('recommended')} ${infoBtn('<strong>Base URL strategy</strong> — describe HOW the URL is managed, not the actual value. Examples:<br><code>per-environment via BuildConfig.BASE_URL</code><br><code>injected via NomNom SDK config</code><br><br><strong>Auth mechanism</strong> — describe the approach:<br><code>Bearer token injected by AuthInterceptor</code><br><code>API key in request header</code><br><br>No actual URLs, tokens, or secrets here.')}</h3>
      <div class="check-group" id="network-group">
        ${pill('Retrofit','Retrofit','network')}
        ${pill('OkHttp','OkHttp','network')}
        ${pill('Ktor','Ktor','network')}
        ${pill('Volley','Volley','network')}
        ${otherPill('network')}
      </div>
      <div class="form-row" style="margin-top:8px;display:flex;gap:12px">
        <input type="text" id="arch-base-url" placeholder="Strategy only, not the URL — e.g. per-environment via BuildConfig.BASE_URL" oninput="updatePreview('architecture')" style="flex:1">
        <input type="text" id="arch-auth" placeholder="Auth — e.g. Bearer token via AuthInterceptor" oninput="updatePreview('architecture')" style="flex:1">
      </div>
    </div>

    <div class="form-section">
      <h3>Local Storage ${tierBadge('optional')} ${infoBtn('Select every storage approach in use. Then describe what each one stores — one line per approach:<br><code>DataStore — user preferences, session tokens</code><br><code>Realm — order history, product cache</code><br><code>SharedPreferences — legacy feature flags (read-only, do not add new keys)</code>')}</h3>
      <div class="check-group" id="storage-group">
        ${pill('Room','Room','storage')}
        ${pill('DataStore','DataStore','storage')}
        ${pill('SharedPreferences','SharedPrefs','storage')}
        ${pill('SQLite','SQLite','storage')}
        ${pill('Realm','Realm','storage')}
        ${otherPill('storage')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-storage-usage" rows="2" placeholder="One line per approach e.g.&#10;DataStore — user preferences, session tokens&#10;Realm — order history cache" oninput="updatePreview('architecture')"></textarea>
      </div>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="arch-storage-usage"></div>
      </div>
    </div>

    <div class="form-section">
      <h3>Image Loading ${tierBadge('optional')} ${infoBtn('Select the primary image loading library. In the text area, briefly describe where images are loaded — helps the agent pick the right approach when building new UI:<br><code>product images, restaurant logos, user avatars</code>')}</h3>
      <div class="radio-group" id="img-group">
        ${pill('Coil','Coil','img','radio')}
        ${pill('Glide','Glide','img','radio')}
        ${pill('Picasso','Picasso','img','radio')}
        ${pill('None','NoneImg','img','radio')}
        ${otherPill('img','radio')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-img-usage" rows="2" placeholder="Where used — e.g. product images, restaurant logos, user avatars" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Known Architecture Violations ${tierBadge('optional')} ${infoBtn('<strong>New to the codebase? Leave this empty — "None documented yet" is the correct default.</strong><br><br>The agent flags violations it discovers during task execution under <em>Follow-up recommended</em> in the completion report. Once you confirm a violation is real, add it here so the agent avoids spreading the same pattern.<br><br>Format — <code>File.kt — what the violation is and why it exists</code><br>Examples:<br><code>HomeFragment.kt — business logic in onViewCreated, pre-dates MVVM adoption</code><br><code>OrdersManager.kt — network calls outside a Repository, legacy service class</code>')}</h3>
      <div class="form-row">
        <textarea id="arch-violations" rows="3" placeholder="e.g. HomeFragment.kt: business logic in onViewCreated — pre-dates MVVM adoption" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Target Architecture Notes ${tierBadge('recommended')}</h3>
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
  </div>`;

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
        `| ${approach} | ${note || placeholder} |`
      ).join('\n');
    }
    // Fallback: pills selected but no cards rendered yet (shouldn't happen normally)
    return pills.map(p => `| ${p} | ${placeholder} |`).join('\n');
  }

  // Multiline textarea → table rows (used for storage, not async/state).
  function textareaToRows(lines, pills, placeholder) {
    const filled = lines.split('\n').map(l => l.trim()).filter(Boolean);
    if (filled.length > 0) return filled.map(l => {
      const sep = l.indexOf('—') !== -1 ? l.indexOf('—') : l.indexOf('-');
      if (sep > 0) return `| ${l.slice(0, sep).trim()} | ${l.slice(sep + 1).trim()} |`;
      return `| ${l} | |`;
    }).join('\n');
    return pills.map(p => `| ${p} | ${placeholder} |`).join('\n');
  }

  const asyncRows   = approachRowsToMD('async', asyncLib, '[describe which modules]');
  const stateRows   = approachRowsToMD('state', stateLib, '[describe which ViewModels]');
  const storageRows = textareaToRows(storageUsage, storage, '[describe usage]');
  const violationsBlock = violations
    ? violations.split('\n').map(v => `- ${v.trim()}`).join('\n')
    : '- None documented yet.';

  // ── ADR helpers ──────────────────────────────────────────────────────────

  // ADR-001: Layer Structure
  const layerPackageTree = arch === 'Clean+MVI' || arch === 'Clean'
    ? `\`\`\`
${pkgName}/
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
└── di/                  ← ${di || 'Hilt'} modules
\`\`\``
    : arch === 'MVVM'
    ? `\`\`\`
${pkgName}/
├── ui/         ← Composables / Fragments
├── viewmodel/  ← ViewModels
├── repository/ ← Repository interfaces + impls
├── model/      ← Data / domain models
└── di/         ← ${di || 'Hilt'} modules
\`\`\``
    : `\`\`\`
${pkgName}/
├── ui/
├── viewmodel/
├── repository/
└── di/
\`\`\``;

  const dependencyRule = arch === 'Clean+MVI' || arch === 'Clean'
    ? `**Dependency Rule**: dependencies point inward only.\n\`ui → viewmodel → usecase → repository → datasource\`\nNo layer may import from a layer above it.`
    : `**Dependency Rule**: \`ui → viewmodel → repository\`\nViewModels must not import from the \`ui\` package.`;

  const violationExamples = arch === 'Clean+MVI' || arch === 'Clean'
    ? `**Violations the agent must refuse to introduce:**\n- Calling a \`UseCase\` directly from a \`@Composable\` or \`Fragment\`\n- Importing an Android \`Context\` inside a \`UseCase\`\n- Returning a \`Response<T>\` (Retrofit type) from a \`Repository\` interface`
    : `**Violations the agent must refuse to introduce:**\n- Business logic inside a \`@Composable\` or \`Fragment\`\n- Network calls made outside a \`Repository\`\n- ViewModel depending on \`View\` or \`Activity\` references`;

  const adr001 = `### ADR-001 — Layer Structure and Dependency Rule
- **Date**: ${today}
- **Decision**: Adopt ${arch || 'MVVM'} with strict unidirectional dependency flow.
- **Reason**: Enforces separation of concerns, testability, and prevents coupling between layers.
- **Consequence**: Every new file must be placed in the correct layer package. PRs that violate the dependency rule are rejected.

#### Package Tree

${layerPackageTree}

#### Dependency Rule

${dependencyRule}

#### Violation Examples

${violationExamples}`;

  // ADR-002: Architecture Pattern (MVI or MVVM code template)
  let adr002 = '';
  if (arch === 'Clean+MVI' || arch === 'MVI') {
    adr002 = `### ADR-002 — MVI Pattern: UiState + Intent + ViewModel + Screen
- **Date**: ${today}
- **Decision**: All feature screens follow the MVI contract below. No exceptions.
- **Reason**: Unidirectional data flow makes state mutations predictable and testable.
- **Consequence**: Every screen ships with a \`UiState\`, a sealed \`Intent\`, a \`ViewModel\`, and a stateless \`Screen\` composable.

\`\`\`kotlin
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
\`\`\``;
  } else if (arch === 'MVVM') {
    adr002 = `### ADR-002 — MVVM Pattern: UiState + ViewModel + Screen
- **Date**: ${today}
- **Decision**: All feature screens follow the MVVM contract below. No exceptions.
- **Reason**: Clear separation between UI and business logic; ViewModel survives configuration changes.
- **Consequence**: Every screen ships with a \`UiState\`, a \`ViewModel\`, and a stateless \`Screen\` composable.

\`\`\`kotlin
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
\`\`\``;
  }

  // ADR-003: DI
  const diName = di || 'Hilt';
  let adr003 = '';
  if (diName === 'Hilt') {
    adr003 = `### ADR-003 — Dependency Injection with Hilt
- **Date**: ${today}
- **Decision**: Hilt is the sole DI framework. No manual \`object\` singletons or service locators.
- **Reason**: Hilt provides compile-time validation, scoped components, and first-class ViewModel injection.
- **Consequence**: Every dependency must be provided through a \`@Module\`. Direct instantiation of injected types is forbidden.

\`\`\`kotlin
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
\`\`\``;
  } else if (diName === 'Koin') {
    adr003 = `### ADR-003 — Dependency Injection with Koin
- **Date**: ${today}
- **Decision**: Koin is the sole DI framework. No manual singletons or service locators.
- **Reason**: Koin provides lightweight runtime DI with a Kotlin-first DSL.
- **Consequence**: All modules declared in the \`di/\` package and loaded at \`Application.onCreate\`.

\`\`\`kotlin
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
\`\`\``;
  } else {
    adr003 = `### ADR-003 — Dependency Injection with ${diName}
- **Date**: ${today}
- **Decision**: ${diName} is the sole DI framework.
- **Reason**: Chosen for consistency and to avoid mixing DI approaches.
- **Consequence**: All dependencies wired through ${diName}. Manual instantiation of injectable types is forbidden.`;
  }

  // ADR-004: Navigation
  let adr004 = '';
  if (nav === 'ComposeNav') {
    adr004 = `### ADR-004 — Navigation with Compose Navigation
- **Date**: ${today}
- **Decision**: All navigation is handled by Jetpack Compose Navigation. A single \`NavHost\` lives in \`MainActivity\`.
- **Reason**: Type-safe, lifecycle-aware navigation native to Compose.
- **Consequence**: No \`startActivity\` calls for in-app navigation. All routes declared in \`NavRoutes\`.

\`\`\`kotlin
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
\`\`\``;
  } else if (nav === 'JetpackNav') {
    adr004 = `### ADR-004 — Navigation with Jetpack Navigation Component
- **Date**: ${today}
- **Decision**: Single-Activity architecture with Jetpack Navigation Component. NavGraph defined in XML.
- **Reason**: Standardised back-stack management, deep-link support, and Safe Args for type safety.
- **Consequence**: No manual \`FragmentTransaction\` calls for in-app navigation. All destinations in \`nav_graph.xml\`.

\`\`\`kotlin
// Safe Args — generated NavDirections
val action = HomeFragmentDirections.actionHomeToDetail(itemId = item.id)
findNavController().navigate(action)

// Deep link declared in nav_graph.xml:
// <deepLink app:uri="myapp://detail/{itemId}" />
\`\`\``;
  } else if (nav === 'ManualFragments') {
    adr004 = `### ADR-004 — Navigation via FragmentManager
- **Date**: ${today}
- **Decision**: Navigation is handled via manual \`FragmentTransaction\` through a shared \`NavigationManager\`.
- **Reason**: Legacy codebase; migration to Jetpack Navigation is tracked separately.
- **Consequence**: All fragment transactions must go through \`NavigationManager\`. No direct \`supportFragmentManager\` calls outside that class.`;
  }

  // ADR-005: Async / State
  const hasRx = asyncLib.includes('RxJava2') || asyncLib.includes('RxJava3');
  const hasLiveData = stateLib.includes('LiveData');
  const hasCoroutines = asyncLib.includes('Coroutines') || asyncLib.length === 0;
  const hasStateFlow = stateLib.includes('StateFlow') || stateLib.length === 0;

  const adr005 = `### ADR-005 — Async and State Management
- **Date**: ${today}
- **Decision**: ${hasCoroutines ? 'Kotlin Coroutines + Flow' : asyncLib.join(' + ')} for async operations; ${hasStateFlow ? 'StateFlow' : stateLib.join(' + ')} for UI state.${hasRx ? ' RxJava is legacy and being removed incrementally.' : ''}${hasLiveData ? ' LiveData is legacy and being replaced with StateFlow.' : ''}
- **Reason**: Coroutines + StateFlow are the Android-recommended, lifecycle-aware primitives with structured concurrency.
- **Consequence**: All new async work uses \`viewModelScope.launch\` or \`flow { }\`. All new UI state uses \`StateFlow\`. No new RxJava or LiveData usage.

| Legacy | Modern replacement | Migration status |
|--------|-------------------|-----------------|
${[
  hasRx       ? `| ${asyncLib.filter(a => a.startsWith('RxJava')).join('/')} | Kotlin Coroutines + Flow | Incremental — remove on touch |` : '',
  hasLiveData ? '| LiveData | StateFlow + collectAsStateWithLifecycle() | Incremental — replace on touch |' : '',
  '| AsyncTask *(if any)* | `viewModelScope.launch` | Must be replaced immediately |',
  '| Threads / Executors *(if any)* | `withContext(Dispatchers.IO)` | Must be replaced immediately |',
].filter(Boolean).join('\n')}`;

  // ADR-006: Mixed UI (only if Mixed selected)
  const adr006 = ui === 'Mixed'
    ? `### ADR-006 — Mixed UI: Compose for new screens; XML stays until migration ticket
- **Date**: ${today}
- **Decision**: Do not rewrite existing XML screens to Compose unless a ticket explicitly scopes it.
- **Reason**: Rewriting UI without adding user value introduces risk and churn with no product benefit.
- **Consequence**: The codebase contains both XML layouts and Composables. The agent must not assume all UI is Compose. When touching an existing XML screen, keep it in XML unless the ticket says otherwise.`
    : '';

  // ── Migration Contrast Map ───────────────────────────────────────────────
  const migrationRows = [];
  if (hasLiveData) {
    migrationRows.push('| `LiveData<T>` in ViewModel | `StateFlow<T>` (MutableStateFlow + asStateFlow()) |');
    migrationRows.push('| `observe(viewLifecycleOwner)` in Fragment/Activity | `collectAsStateWithLifecycle()` in Composable |');
  }
  if (hasRx) {
    migrationRows.push('| `Observable` / `Single` (RxJava) | `Flow` / `suspend fun` |');
    migrationRows.push('| `.subscribeOn(Schedulers.io())` | `withContext(Dispatchers.IO)` |');
    migrationRows.push('| `.observeOn(AndroidSchedulers.mainThread())` | `flowOn(Dispatchers.Main)` or emit on main in ViewModel |');
  }
  if (ui === 'Mixed' || ui === 'XML') {
    migrationRows.push('| XML layout (`activity_*.xml` / `fragment_*.xml`) | `@Composable` Screen function |');
    migrationRows.push('| `ViewBinding` / `DataBinding` | Compose state hoisting (`state: UiState, onIntent: (Intent) -> Unit`) |');
  }
  if (nav === 'ManualFragments') {
    migrationRows.push('| `supportFragmentManager.beginTransaction()` | `NavController.navigate(NavRoutes.*)` |');
  }
  if (di === 'Koin' || (!di && false)) {
    migrationRows.push('| Koin `inject()` / `get()` | `@Inject constructor(...)` with Hilt |');
  }
  migrationRows.push('| `AsyncTask` | `viewModelScope.launch { withContext(Dispatchers.IO) { … } }` |');
  migrationRows.push('| `GlobalScope.launch` | `viewModelScope.launch` |');

  const migrationSection = migrationRows.length > 0
    ? `---

## Migration Contrast Map

> Patterns the agent must recognise as legacy and replace with the modern equivalent on every touch.

| Legacy Pattern | Modern Equivalent |
|---------------|------------------|
${migrationRows.join('\n')}`
    : '';

  // ── ADR block assembly ───────────────────────────────────────────────────
  const adrBlocks = [adr001, adr002, adr003, adr004, adr005, adr006]
    .filter(a => a.trim() !== '')
    .join('\n\n');

  // ── Module Structure rows ────────────────────────────────────────────────
  const langDisplay = langs.join(' + ') || 'Kotlin';
  const diDisplay   = di || 'Hilt';
  let moduleTableRows;
  if (state.detectedModuleDetails && state.detectedModuleDetails.length > 0) {
    moduleTableRows = state.detectedModuleDetails.map(m => {
      // Promote generic pattern based on arch selection when module is MVVM-flagged
      const pattern = m.type === 'MVVM' ? (arch || 'MVVM') : m.type;
      return `| ${m.name} | ${langDisplay} | ${pattern} | ${m.diCol} | ${m.notes} |`;
    }).join('\n');
  } else {
    moduleTableRows =
`| :app | ${langDisplay} | Single Activity | ${diDisplay} | App entry point, NavHost, deep links |
| :feature-[name] | ${primaryLang} | ${arch || 'MVVM'} | ${diDisplay} | [describe feature] |
| :core-network | ${primaryLang} | — | ${diDisplay} | Retrofit, OkHttp, interceptors |
| :core-data | ${primaryLang} | Repository | ${diDisplay} | Room, DataStore |
| :core-ui | ${primaryLang} | — | — | Shared composables, theme |`;
  }

  // ── Interceptors ─────────────────────────────────────────────────────────
  const interceptorList = state.detectedInterceptors && state.detectedInterceptors.length > 0
    ? state.detectedInterceptors.join(', ')
    : '[list each]';

  return `# Architecture
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
${moduleTableRows}

### Navigation

${nav === 'JetpackNav' ? 'Single-activity with Jetpack Navigation Component. NavGraph in app/src/main/res/navigation/nav_graph.xml.' :
  nav === 'ComposeNav' ? 'Compose Navigation — NavHost in MainActivity.kt.' :
  nav === 'ManualFragments' ? 'Manual fragment transactions via FragmentManager.' :
  '[Describe navigation approach]'}

### Threading Model

| Approach | Where used |
|----------|-----------|
${asyncRows || '| Kotlin Coroutines + Flow | All new code |'}

### State Management

| Approach | Where used |
|----------|-----------|
${stateRows || '| StateFlow | All new ViewModels |'}

### Networking

| Property | Value |
|----------|-------|
| Library | ${network.join(' + ') || 'Retrofit + OkHttp'} |
| Base URL strategy | ${baseUrl || '[single base URL / per-environment via BuildConfig / remote config]'} |
| Auth mechanism | ${authMech || '[Bearer token injected by AuthInterceptor / API key / none]'} |
| Custom interceptors | ${interceptorList} |

### Local Storage

| Approach | Where used |
|----------|-----------|
${storageRows || '| Room | [describe usage] |'}

### Image Loading
${img && img !== 'NoneImg' ? `${img} — ${imgUsage.split('\n').map(l=>l.trim()).filter(Boolean).join(', ') || '[describe usage]'}` : 'No image loading library.'}

### Known Architecture Violations

${violationsBlock}

---

## Target State

### Architecture Pattern
${arch === 'Clean+MVI' ? 'Clean Architecture + MVI\nUI → ViewModel (MVI: intent → state) → UseCase → Repository → DataSource' :
  arch === 'Clean' ? 'Clean Architecture\nUI → ViewModel → UseCase → Repository → DataSource' :
  arch ? arch + '\n[describe target state]' :
  'Clean Architecture + MVI\nUI → ViewModel → UseCase → Repository → DataSource'}

### DI
${di || 'Hilt'} everywhere. No manual wiring.

### Async
Kotlin Coroutines + Flow everywhere.${hasRx ? ' RxJava being removed incrementally.' : ''}

### UI
${ui === 'Compose' ? '- All screens: Jetpack Compose + Material 3' :
  ui === 'Mixed' ? '- New screens: Jetpack Compose + Material 3\n- Existing XML screens: kept until explicit migration ticket\n- No new XML screens' :
  ui === 'XML' ? '- Current: XML layouts\n- Target: Migrate to Jetpack Compose incrementally' :
  '- [Describe UI target state]'}

### Navigation
${nav === 'JetpackNav' || nav === 'ComposeNav' ? 'Jetpack Navigation Component. Single-Activity. Type-safe destinations.' : '[Describe navigation target]'}
${targetNotes ? '\n### Additional Notes\n' + targetNotes : ''}

---

## Architecture Decision Records

${adrBlocks}

${migrationSection}

<!-- ─────────────────────────────────────────────────────────────────────────
     END OF ARCHITECTURE.md — Every decision above is final.
     The agent must not modify this file or deviate from its constraints.
     ───────────────────────────────────────────────────────────────────── -->
`;
}

// ══════════════════════════════════════════════════════
//  CONVENTIONS STEP
// ══════════════════════════════════════════════════════
function buildConventionsScreen(fp) {
  fp.innerHTML += `
  <div class="step-screen" id="screen-conventions">

    <div class="form-section">
      <h3>Package Name Prefix ${infoBtn('Used to fill in the package structure example in the generated CONVENTIONS.md.<br><br>e.g. if your app root package is <code>com.example.app</code>, enter that here. It replaces the placeholder in the feature module path: <code>com.example.app.feature.[name]/ui/...</code>')}</h3>
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
      <h3>Quality Gate ${infoBtn('The agent runs this checklist on <strong>every task</strong> during Step 6b self-verification.<br><br>Each enabled check becomes a row in the Quality Gate table. If the agent finds a violation, it must fix it before writing the completion report.<br><br>Enable every check that applies to your project — the more specific, the better the agent\'s output quality.')}</h3>
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
  </div>`;
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

  const rule = (active, text) => active ? `- ${text}` : null;
  const coreRules = [
    rule(banBang,  'No `!!` null assertions. Use `?.let {}`, `?: return`, or `requireNotNull(x) { "msg" }`.'),
    rule(banLate,  'No `lateinit var` except Hilt-injected fields (`@Inject lateinit var`). Prefer constructor injection.'),
    rule(prefVal,  'Prefer `val` over `var`.'),
    rule(dataCls,  'Use `data class` for all model/state/event types. No mutable `var` fields in data classes.'),
    rule(exhaust,  'Every `when` on a sealed class or sealed interface must be exhaustive. Never use `else` on sealed types.'),
    '- Use `object` for singletons.',
    '- Prefer named arguments when calling functions with 3+ parameters of the same type.',
    '- Extension functions go in a dedicated `[Subject]Extensions.kt` file in the same package.',
  ].filter(Boolean).join('\n');

  const coreAntiPatterns = (banBang || dataCls || exhaust) ? `
### Anti-patterns (agent must never write these)

\`\`\`kotlin
${banBang ? `// \u274c Null assertion
val name = user!!.name

// \u2705 Safe unwrap
val name = user?.name ?: return
` : ''}${exhaust ? `
// \u274c else on sealed type — misses future cases
when (state) {
    is Loading -> showSpinner()
    else -> hideSpinner()
}

// \u2705 Exhaustive — compiler catches missing cases
when (state) {
    is Loading -> showSpinner()
    is Success -> showContent(state.data)
    is Error   -> showError(state.message)
}
` : ''}${dataCls ? `
// \u274c var in data class
data class User(var name: String, var email: String)

// \u2705 Immutable data class
data class User(val name: String, val email: String)
` : ''}\`\`\`` : '';

  const vmRules = [
    rule(stateflow, 'Expose state as `StateFlow<[Name]UiState>` — never `LiveData`.'),
    stateflow ? '- Expose one-shot navigation/events as `SharedFlow<NavigationEvent>` — separate from UiState.' : null,
    rule(noAndVM,   'No Android framework imports in ViewModel (`Context`, `View`, `FragmentManager` are banned).'),
    '- No direct DataSource calls — always through UseCase or Repository.',
    rule(vmscope,   'All coroutines launched with `viewModelScope.launch { }`. Never `GlobalScope`.'),
    '- Process user actions via a single `processIntent(intent: [Name]Intent)` function.',
  ].filter(Boolean).join('\n');

  const vmCodeBlock = stateflow ? `
\`\`\`kotlin
// \u2705 Correct ViewModel structure
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
\`\`\`

\`\`\`kotlin
// \u2705 Correct UiState — data class, all fields have defaults
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val emailError: String? = null,
    val passwordError: String? = null,
    val generalError: String? = null
    // \u274c Never add navigation flags here: navigateToHome: Boolean = false
)
\`\`\`

\`\`\`kotlin
// \u2705 Correct Intent — sealed class, one subclass per user action
sealed class LoginIntent {
    data class EmailChanged(val value: String) : LoginIntent()
    data class PasswordChanged(val value: String) : LoginIntent()
    object SubmitLogin : LoginIntent()
    object NavigateToRegister : LoginIntent()
}
\`\`\`` : '';

  const vmAntiPatterns = `
### Anti-patterns (agent must never write these)

\`\`\`kotlin
// \u274c Multiple LiveData fields instead of unified state
private val _isLoading = MutableLiveData<Boolean>()
private val _errorMessage = MutableLiveData<String>()
private val _email = MutableLiveData<String>()

// \u274c Navigation flag inside UiState
data class LoginUiState(val navigateToHome: Boolean = false)

// \u274c Android import in ViewModel
class LoginViewModel : ViewModel() {
    fun showToast(context: Context) { ... }  // banned
}

// \u274c Direct DataSource call from ViewModel
class LoginViewModel @Inject constructor(
    private val authRemoteDataSource: AuthRemoteDataSource  // banned — use UseCase
)
\`\`\``;

  const coroutinesSection = `
## Coroutines and Flow

- \`Dispatchers.IO\` for all database and network operations.
- \`Dispatchers.Main\` is the default in \`viewModelScope\` — no need to specify for UI updates.
${noGlobal ? '- Never use `GlobalScope` — always scope to `viewModelScope` or a DI-provided `CoroutineScope`.' : ''}
- Never use \`Thread.sleep()\` — use \`delay()\`.
- Cold-to-warm flows: \`stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initialValue)\`.
- Repository functions return \`Result<T>\` — never throw across layer boundaries.

\`\`\`kotlin
// \u2705 Correct repository suspend function
suspend fun login(email: String, password: String): Result<User> = runCatching {
    val response = apiService.login(LoginRequest(email, password))
    response.toDomain()
}

// \u274c Callback-based (legacy — do not add new ones)
fun login(email: String, onSuccess: (User) -> Unit, onError: (Throwable) -> Unit)
\`\`\``;

  const composeRules = [
    rule(stateless, 'Composables are **stateless** — receive state as parameters, emit events via lambda callbacks.'),
    rule(noLogic,   'No business logic inside `@Composable` functions.'),
    '- No ViewModel access inside composables — hoist to screen-level composable only.',
    rule(lifecycle, 'Use `collectAsStateWithLifecycle()` — not `collectAsState()`.'),
    rule(m3,        'Material 3 components only. No Material 2 imports in new screens.'),
    '- Previews use `@PreviewLightDark` or `@Preview(showBackground = true)`.',
  ].filter(Boolean).join('\n');

  const composeCodeBlock = `
\`\`\`kotlin
// \u2705 Correct Screen composable — stateless, ViewModel at top level only
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

// \u2705 Pure content composable — no ViewModel, fully testable
@Composable
fun LoginContent(
    uiState: LoginUiState,
    onIntent: (LoginIntent) -> Unit
) { ... }

// \u274c ViewModel inside a non-screen composable
@Composable
fun LoginButton() {
    val viewModel: LoginViewModel = hiltViewModel()  // banned — hoist to screen level
}
\`\`\``;

  const resourceRules = [
    rule(strings,  'All user-visible text in `strings.xml`. No hardcoded strings in code or layouts.'),
    rule(noHex,    'Colors: `?attr/colorPrimary` in XML, `MaterialTheme.colorScheme.*` in Compose. Never hardcode hex values.'),
    rule(noMagic,  'Dimensions: use `dimens.xml` or design token system. No magic number `dp` values inline.'),
    rule(vectors,  'Drawables: vector XML only (`VectorDrawable`). No raster PNG/JPG unless strictly required by brand asset.'),
  ].filter(Boolean).join('\n');

  return `# Conventions
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads this and follows it exactly. Never modifies it.
# These rules override the defaults in CLAUDE.md where they conflict.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: follow every convention in this file exactly. These are non-negotiable.
> When in doubt between two approaches, the one described here wins.

---

## Kotlin Core Rules

${coreRules}
${coreAntiPatterns}

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes, Objects, Interfaces | PascalCase | \`LoginViewModel\`, \`AuthRepository\` |
| Functions, Properties | camelCase, verb-first for functions | \`loadUser()\`, \`onLoginClicked()\` |
| Constants | \`SCREAMING_SNAKE_CASE\` in \`companion object\` | \`MAX_RETRY_COUNT\` |
| Resource IDs — Views | \`type_description\` | \`tv_title\`, \`btn_submit\`, \`iv_avatar\` |
| Resource IDs — Layouts | \`fragment_name\` / \`item_name\` | \`fragment_login\`, \`item_order\` |
| Drawables | \`ic_name\` (icons), \`bg_name\` (backgrounds) | \`ic_back\`, \`bg_card\` |
| String resources | \`module_element_description\` | \`login_error_invalid_email\` |
| Test files | \`[SourceClass]Test\` | \`LoginViewModelTest\` |
| Test functions | \`functionName_scenario_expectedResult\` | \`onLoginClicked_invalidEmail_showsError\` |

---

## Package Structure (per feature module)

\`\`\`
${pkg}.feature.[name]/
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
\`\`\`

---

## ViewModel Conventions

${vmRules}
${vmCodeBlock}
${vmAntiPatterns}

---
${coroutinesSection}

---

## Jetpack Compose (new screens only)

${composeRules}
${composeCodeBlock}

---

## Resources

${resourceRules}

---

## Dependency Injection (Hilt)

- All ViewModels: \`@HiltViewModel\` + \`@Inject constructor\`. No manual instantiation.
- All repositories and data sources: \`@Inject constructor\`. No \`companion object\` factories.
- DI module files live in \`di/\` package inside each feature or core module.
- Repositories scoped \`@Singleton\`. ViewModels are automatically scoped by Hilt.
- No \`@ActivityScoped\` or \`@FragmentScoped\` for business logic — only for UI-bound resources.

\`\`\`kotlin
// \u2705 Correct Hilt module
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
\`\`\`

---

## Quality Gate

> Agent: run this checklist on every file you create or modify (Step 6b).
> For each failure: fix it before writing the completion report.

| Check | Rule |
|-------|------|
${[
  qgNoBang      ? '| No `!!` operators | Use `?.let {}`, `?: return`, or `requireNotNull(x) { "message" }` |' : null,
  qgNoLivedata  ? '| No new `LiveData` | New state uses `StateFlow` only |' : null,
  qgNoGlobal    ? '| No `GlobalScope` | All coroutines in `viewModelScope` (or `lifecycleScope` for one-shot UI ops) |' : null,
  qgNoStrings   ? '| No hardcoded strings | All user-visible text in `strings.xml` |' : null,
  qgNoHardRes   ? '| No hardcoded colors or dimensions | Use theme attributes or `dimens.xml` |' : null,
  qgSealed      ? '| Sealed types are exhaustive | No \`else\` on \`when\` over sealed class/interface |' : null,
  qgNoLogicUI   ? '| No business logic in UI layer | Composables, Fragments, Activities call ViewModel only |' : null,
  qgVmNoAndroid ? '| ViewModel has no Android imports | No \`Context\`, \`View\`, \`FragmentManager\` in ViewModel |' : null,
  qgNoDtoUI     ? '| DTOs/Entities not exposed to UI | Repository returns domain models only |' : null,
  qgTestNaming  ? '| Tests follow naming convention | \`functionName_scenario_expectedResult\` |' : null,
  ...(qgExtra ? qgExtra.split('\n').map(l => l.trim()).filter(Boolean).map(l => '| ' + l + ' | — |') : []),
].filter(Boolean).join('\n')}
`;
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

  fp.innerHTML += `
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
        ${legacyPatterns.map(p => `
        <div class="dynamic-item" style="padding:10px 12px">
          <div class="toggle-row" style="margin-bottom:0">
            <div>
              <div class="toggle-label">${p.label}</div>
              <div class="toggle-sub">${p.sub}</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="mig-${p.id}" onchange="toggleMigScope('${p.id}'); updatePreview('migrations')">
              <div class="toggle-track"></div><div class="toggle-thumb"></div>
            </label>
          </div>
          <div id="mig-scope-row-${p.id}" style="display:none;margin-top:8px">
            <input type="text" id="mig-scope-${p.id}" placeholder="Affected modules — e.g. :app, :feature-order" oninput="updatePreview('migrations')" style="width:100%;font-size:12px">
          </div>
        </div>`).join('')}
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
  </div>`;
}

let customRuleCounter = 0;
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
    ? '`StateFlow` for state, `SharedFlow` for one-shot events'
    : stateLibs[0] ? stateLibs[0] : '`StateFlow` for state, `SharedFlow` for one-shot events';
  const vmRule = (arch === 'Clean+MVI' || arch === 'Clean Architecture')
    ? `MVI — ${stateRule}`
    : `MVVM — ${stateRule}`;

  const asyncRule = asyncLibs.includes('Coroutines') || asyncLibs.includes('Coroutines+Flow')
    ? 'Coroutines + Flow only'
    : asyncLibs[0] ? asyncLibs[0] : 'Coroutines + Flow only';

  const diRule = di === 'Hilt'   ? `Hilt — \`@HiltViewModel\`, \`@Singleton\` for repositories`
               : di === 'Koin'   ? `Koin — \`viewModel { }\`, single-scoped repositories`
               : di === 'Dagger' ? `Dagger — component-scoped ViewModel and repository bindings`
               :                   di;

  const hasDomain = arch === 'Clean Architecture' || arch === 'Clean+MVI';
  const domainRow = hasDomain ? `| Domain | UseCase(s) per operation |\n` : '';

  return `| Layer | Rule |
|-------|------|
| UI | ${uiRule} |
| ViewModel | ${vmRule} |
${domainRow}| Data | Repository + RemoteDataSource / LocalDataSource |
| DI | ${diRule} |
| Async | ${asyncRule} |`;
}

function generateMigrationsMD() {
  const has   = id => document.getElementById('mig-' + id)?.checked;
  const scope = id => { const v = document.getElementById('mig-scope-' + id)?.value.trim(); return v ? `\n> **Affected modules:** ${v}\n` : ''; };

  const javaBlock = has('java') ? `
## Java Files
${scope('java')}
- Do not convert Java to Kotlin unless the task explicitly instructs it.
- When touching a Java file: write new logic in a separate Kotlin file that the Java calls.
- Do not add Kotlin-specific patterns inside \`.java\` files.
- Fix null-safety issues that the agent's own changes introduce. Not pre-existing ones.

Comment format when adding a TODO near Java code:
\`\`\`java
// TODO [DEBT-XXX]: migrate to Kotlin — [brief reason]
\`\`\`
` : '';

  const liveDataBlock = has('livedata') ? `
## LiveData → StateFlow
${scope('livedata')}
- Do not migrate existing \`LiveData\` to \`StateFlow\` unless the task scopes it.
- When touching a ViewModel that uses \`LiveData\`:
  - Do not change existing \`MutableLiveData\` declarations.
  - Use \`MutableStateFlow\` for any new state added by this task.
  - Do not mix \`observe()\` and \`collectAsStateWithLifecycle()\` for the same state property.

\`\`\`kotlin
// ❌ Adding new state as LiveData in a task
private val _isLoading = MutableLiveData<Boolean>()  // banned — new state uses StateFlow

// ✅ New state uses StateFlow alongside existing LiveData
private val _legacyUser = MutableLiveData<User>()        // existing — do not touch
private val _isLoading = MutableStateFlow(false)          // new state — StateFlow only
// TODO [DEBT-XXX]: migrate existing LiveData state to StateFlow
\`\`\`
` : '';

  const rxBlock = has('rxjava') ? `
## RxJava → Coroutines
${scope('rxjava')}
- Do not add new RxJava chains. Do not remove existing ones.
- When touching a file with RxJava:
  - Write all new async logic using Coroutines + Flow.
  - If new logic must interact with existing Rx: use \`asFlow()\` or \`awaitFirst()\` bridges.

\`\`\`kotlin
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
\`\`\`
` : '';

  const mvpBlock = has('mvp') ? `
## MVP / MVC → MVVM
${scope('mvp')}
- Do not rewrite existing Presenters or Controllers.
- When a task adds functionality to an MVP/MVC screen:
  - Create a new ViewModel for the new logic only.
  - Wire the ViewModel alongside the existing Presenter.
  - Do not move existing Presenter logic into the ViewModel.
  - Add comment: \`// TODO [DEBT-XXX]: consolidate into ViewModel once Presenter is removed\`
` : '';

  const nvmBlock = has('nvm') ? `
## Fragment with No ViewModel
${scope('nvm')}
- Do not add business logic directly to a Fragment.
- When adding state or business logic to a Fragment that has no ViewModel:
  - Create \`[FeatureName]ViewModel.kt\` in the same package.
  - Put the new logic in the ViewModel.
  - Do not refactor existing Fragment code.
` : '';

  const retrofitBlock = has('retrofit') ? `
## Direct Retrofit / API Calls (no Repository or DataSource)
${scope('retrofit')}
- Do not add more direct API calls in Repositories or ViewModels.
- When touching a file that makes direct Retrofit calls:
  - Do not add more direct calls.
  - If the task requires a new network call: create \`[Feature]RemoteDataSource.kt\`, call it from the Repository.
  - Do not refactor existing direct calls.
` : '';

  const sharedPrefBlock = has('sharedpref') ? `
## SharedPreferences → DataStore
${scope('sharedpref')}
- Do not add new SharedPreferences usage. Do not remove existing usage.
- When a task requires reading or writing preferences:
  - Use DataStore Preferences for all new preference keys.
  - Do not migrate existing SharedPreferences keys in the same task.
  - Add comment: \`// TODO [DEBT-XXX]: migrate key to DataStore\`
` : '';

  const asyncBlock = has('asynctask') ? `
## AsyncTask
${scope('asynctask')}
- AsyncTask is deprecated. Never add or extend it.
- When touching a class that contains AsyncTask:
  - Do not add new work to the AsyncTask.
  - Implement new async work as a \`suspend fun\` called from ViewModel.
  - Add comment: \`// TODO [DEBT-XXX]: replace AsyncTask with coroutine\`
` : '';

  const hasAny = ['java','livedata','rxjava','mvp','nvm','retrofit','sharedpref','asynctask'].some(has);

  // Collect custom rules
  const customBlocks = [];
  document.querySelectorAll('[id^="custom-rule-row-"]').forEach(row => {
    const idNum = row.id.replace('custom-rule-row-', '');
    const title = document.getElementById(`custom-rule-title-${idNum}`)?.value.trim();
    const body  = document.getElementById(`custom-rule-body-${idNum}`)?.value.trim();
    if (title || body) customBlocks.push(`\n## ${title || 'Custom Rule'}\n\n${body || ''}\n`);
  });

  return `# Migration Rules
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
${hasAny ? [javaBlock, liveDataBlock, rxBlock, mvpBlock, nvmBlock, retrofitBlock, sharedPrefBlock, asyncBlock].join('') : '\n_No legacy patterns selected. Add rules here if legacy code is discovered._\n'}

## New Screens and Features

All new screens and features use the target architecture. No exceptions.

When a task creates a new screen or feature:

${generateNewScreensTable()}

No new MVP, MVC, Activities as feature containers${getRadio('ui') !== 'Compose' ? ', or XML layouts for new screens' : ''}.${getRadio('arch') === 'MVP' || getRadio('arch') === 'MVC' ? '' : '\nNo new MVP or MVC patterns.'}

---

## Scope Guard

The agent does not apply migration rules to code it did not add or modify.
If the agent notices a violation in untouched code, it logs it in the completion
report under "Follow-up recommended" with the file path and line number.
It does not touch it.
${customBlocks.length > 0 ? '\n---\n' + customBlocks.join('\n---\n') : ''}
`;
}

// ══════════════════════════════════════════════════════
//  MODULES STEP
// ══════════════════════════════════════════════════════
function buildModulesScreen(fp) {
  fp.innerHTML += `
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
  </div>`;

  addModuleRow({ name: ':app', path: 'app/src/main/java/', pattern: 'Single Activity', keywords: 'app, main, navhost, startup' });
  addModuleRow({ name: ':feature-auth', path: 'feature/auth/', pattern: 'MVVM', keywords: 'login, logout, auth, session, token' });
}

let moduleCounter = 0;
function addModuleRow(defaults = {}) {
  const id = ++moduleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'module-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('module-row-${id}').remove(); updatePreview('modules')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Module / Gradle name</label>
        <input type="text" class="mod-name" value="${esc(defaults.name||'')}" placeholder=":feature-home" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="mod-path" value="${esc(defaults.path||'')}" placeholder="feature/home/" oninput="updatePreview('modules')"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Language</label>
        <select class="mod-lang" onchange="updatePreview('modules')">
          <option>Kotlin</option><option>Java</option><option>Kotlin + Java</option>
        </select></div>
      <div class="form-row"><label>Pattern</label>
        <select class="mod-pattern" onchange="updatePreview('modules')">
          ${['MVVM','MVP','Clean','Repository','Infrastructure','Single Activity'].map(p =>
            `<option${(defaults.pattern||'MVVM')===p?' selected':''}>${p}</option>`).join('')}
        </select></div>
      <div class="form-row"><label>DI</label>
        <select class="mod-di" onchange="updatePreview('modules')">
          <option>Hilt</option><option>Dagger</option><option>Manual</option><option>None</option>
        </select></div>
    </div>
    <div class="form-row"><label>Keywords (comma-separated — used to route tasks)</label>
      <input type="text" class="mod-keywords" value="${esc(defaults.keywords||'')}" placeholder="home, dashboard, feed, landing" oninput="updatePreview('modules')"></div>
    <div class="form-row"><label>Purpose (one sentence)</label>
      <input type="text" class="mod-purpose" value="${esc(defaults.purpose||'')}" placeholder="Main dashboard shown after login" oninput="updatePreview('modules')"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Key classes (comma-separated)</label>
        <input type="text" class="mod-keyclasses" value="${esc(defaults.keyClasses||'')}" placeholder="HomeViewModel, HomeRepository" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Depends on</label>
        <input type="text" class="mod-depends" value="${esc(defaults.depends||'')}" placeholder=":core, :libs:network" oninput="updatePreview('modules')"></div>
    </div>
  `;
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

    return `### ${name}

| Field | Value |
|-------|-------|
| Path | \`${path}\` |
| Language | ${lang} |
| Pattern | ${pattern} |
| DI | ${di} |
| Purpose | ${purpose} |
| Key classes | ${keyClasses} |
| Depends on | ${depends} |
| Context file | \`${contextFile}\` |
| Known debt | see \`TECH_DEBT.md#${name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}\` |

---`;
  }).join('\n\n');

  return `# Module Map
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED after initial wizard generation. Edit directly to update modules.
# Agent reads this file but never modifies it.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: route via \`context/_index.md\` (the keyword → context-file table) to decide
> which modules a task touches. Then come here for each module's \`Path\`, \`Key classes\`,
> and \`Known debt\` anchor, and read only the source files the context file references.
> Never skip the routing step.

## How the Agent Uses This File

1. After routing via \`context/_index.md\`, come here for module paths, key classes, and debt anchors.
2. If a context file is missing: use \`Key classes\` to identify the 5–8 source files to read.
3. After completing a task on a new module: generate \`context/<module>.md\` via \`context/TEMPLATE.md\`,
   then add a routing row to \`context/_index.md\`.

**Routing lives in \`context/_index.md\`, not here.**
Keywords are intentionally NOT duplicated in this file — they live only in
\`context/_index.md\` to avoid drift. This file is the registry (paths, key classes,
debt anchors); \`_index.md\` is the router (keyword → context file).

---

## Module Index

${moduleBlocks || '_No modules added yet._'}

<!-- Add one entry per module using the format above.
     Keywords live only in context/_index.md — add a routing row there for the
     agent. Do not add a Keywords field here (single source of truth = _index.md). -->
`;
}

function generateIndexMD() {
  const rows = Array.from(document.querySelectorAll('[id^="module-row-"]'));
  const tableRows = rows.map(row => {
    const name     = row.querySelector('.mod-name')?.value.trim() || '[module]';
    const keywords = row.querySelector('.mod-keywords')?.value.trim() || '[add keywords]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';
    return `| ${keywords} | ${name} | \`${contextFile}\` |`;
  }).join('\n');

  return `# Context Index
# ─────────────────────────────────────────────────────────────────────────────
# THIS IS THE AUTHORITATIVE ROUTING TABLE.
# Agent uses this table to decide which context/<module>.md files to load.
# spec-kit/MODULE_MAP.md is the module registry (metadata); this file routes.
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
${tableRows || '| [keywords] | [module] | `context/[module].md` |'}

<!-- Add a row here whenever you add a new context/<module>.md file.
     Do NOT put routing logic in MODULE_MAP.md — this file is the single routing source of truth. -->

---

## Notes for Humans

- This file and \`spec-kit/MODULE_MAP.md\` serve different roles:
  - \`_index.md\` (this file) — agent routing table: keyword → context file
  - \`MODULE_MAP.md\` — module registry: path, pattern, DI, key classes, debt anchor
- Keep both in sync when adding a new module.
`;
}

// ══════════════════════════════════════════════════════
//  TECH DEBT STEP
// ══════════════════════════════════════════════════════
function buildDebtScreen(fp) {
  fp.innerHTML += `
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
  </div>`;
  addDebtRow({ title: 'Example — replace with real debt', module: ':app', status: 'OPEN' });
}

let debtCounter = 0;
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
    return `## ${mod} {#${anchor}}\n\n` + entries.map(e => `### DEBT-${e.num} — ${e.title}

| Field | Value |
|-------|-------|
| Status | ${e.status} |
| Location | \`${e.location}\` |
| Impact | ${e.impact} |
| Agent rule | ${e.rule} |
| Scheduled ticket | ${e.ticket} |`).join('\n\n');
  }).join('\n\n---\n\n');

  return `# Tech Debt Register
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

${moduleBlocks || '_No debt entries added. Add entries as discovered._'}

---

## Resolved {#resolved}

<!-- Move entries here when fixed. Keep for historical reference. -->
`;
}

// ══════════════════════════════════════════════════════
//  TESTING STEP
// ══════════════════════════════════════════════════════
function buildTestingScreen(fp) {
  fp.innerHTML += `
  <div class="step-screen" id="screen-testing">

    <div class="form-section">
      <h3>Test Frameworks</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['test-runner',   'Test Runner',    'JUnit 4', ['JUnit 4','JUnit 5','TestNG']],
          ['mocking',       'Mocking',        'MockK',   ['MockK','Mockito','None']],
          ['flow-test',     'Flow/StateFlow', 'Turbine', ['Turbine','None']],
          ['assertions',    'Assertions',     'Truth',   ['Truth','AssertJ','JUnit Assert','None']],
          ['coroutines-test','Coroutines Test','kotlinx-coroutines-test',['kotlinx-coroutines-test','None']],
          ['ui-test',       'UI Tests',       'Espresso',['Espresso','Compose UI Test','None']],
        ].map(([id, label, def, opts]) => `
        <div class="form-row">
          <label>${label}</label>
          <select id="test-${id}" onchange="updatePreview('testing')">
            ${opts.map(o => `<option${o===def?' selected':''}>${o}</option>`).join('')}
          </select>
        </div>`).join('')}
      </div>
    </div>

    <div class="form-section">
      <h3>Coverage Targets</h3>
      ${[
        ['vm',      'ViewModel',        '80'],
        ['usecase', 'UseCase',          '90'],
        ['repo',    'Repository',       '70'],
        ['util',    'Utility functions','80'],
      ].map(([id, label, def]) => `
      <div class="slider-row">
        <label>${label}</label>
        <input type="range" id="cov-${id}" min="0" max="100" value="${def}" oninput="document.getElementById('cov-val-${id}').textContent=this.value+'%'; updatePreview('testing')">
        <span class="slider-val" id="cov-val-${id}">${def}%</span>
      </div>`).join('')}
    </div>

    <div class="form-section">
      <h3>Testing Rules</h3>
      <div class="dynamic-list">
        ${[
          ['test-rule-one-class', 'One class per test file', 'LoginViewModelTest tests only LoginViewModel', true],
          ['test-rule-no-sleep',  'No Thread.sleep() in tests', 'Use advanceUntilIdle() instead', true],
          ['test-rule-no-blocking','No runBlocking in tests', 'Use runTest from kotlinx-coroutines-test', true],
          ['test-rule-no-mock-data','Never mock data classes', 'Mock interfaces and abstract classes only', true],
          ['test-rule-verify-sparingly','Use verify() sparingly', 'Only when testing side effects, not by default', true],
        ].map(([id, label, sub, checked]) => `
        <div class="toggle-row">
          <div><div class="toggle-label">${label}</div><div class="toggle-sub">${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="${id}" ${checked?'checked':''} onchange="updatePreview('testing')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>`).join('')}
      </div>
    </div>

    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateTestingMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('testing')">💾 Save TESTING.md</button>
      <button class="btn btn-secondary" onclick="goTo('datamodel')">Next →</button>
    </div>
  </div>`;
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
  ].map(([p, l]) => `| ${p} | ${l} | [version] |`).join('\n');

  const rules = [
    rule('test-rule-one-class')       && '**One class per test file.** `LoginViewModelTest` tests only `LoginViewModel`.',
    rule('test-rule-no-sleep')        && 'Never use `Thread.sleep()` — use `advanceUntilIdle()` to drain coroutines.',
    rule('test-rule-no-blocking')     && 'Use `runTest` from `kotlinx-coroutines-test` — never `runBlocking`.',
    rule('test-rule-no-mock-data')    && 'Mock interfaces and abstract classes. Never mock data classes or concrete implementations.',
    rule('test-rule-verify-sparingly')&& "Use `verify` to assert interaction counts only when testing side effects. Don't add `verify` to every test.",
  ].filter(Boolean).map(r => `- ${r}`).join('\n');

  return `# Testing Standards
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
${fwTable}

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

**One class per test file.** \`LoginViewModelTest\` tests only \`LoginViewModel\`.

${rules}

### Test Function Naming — \`functionName_scenario_expectedResult\`

\`\`\`kotlin
// ✅ Correct
fun onLoginClicked_withInvalidEmail_showsEmailError()
fun onLoginClicked_withValidCredentials_emitsNavigateToHome()
fun loadUser_whenNetworkFails_showsErrorState()

// ❌ Wrong — no scenario, no expected result
fun testLogin()
fun shouldWorkCorrectly()
fun loginTest()
\`\`\`

---

## Flow / StateFlow Testing

- Always use ${fw('flow-test') !== 'None' ? fw('flow-test') : 'a Flow testing library'} for testing Flows and Channels.
- Use \`runTest\` from \`kotlinx-coroutines-test\` — never \`runBlocking\`.
- Use \`advanceUntilIdle()\` to drain pending coroutines before asserting state.
- Never use \`Thread.sleep()\` or \`delay()\` in tests.

\`\`\`kotlin
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
\`\`\`

---

## Mocking Rules

- **${fw('mocking')} only.**${fw('mocking') === 'MockK' ? ' Do not use Mockito.' : ''}
- Mock interfaces and abstract classes. Never mock data classes or concrete implementations.
- Use \`coEvery\` for suspend functions, \`every\` for regular functions.
- Use \`verify\` to assert interaction counts only when testing side effects. Don't add it to every test.

\`\`\`kotlin
// ✅ Mock the interface, not the implementation
private val repository: AuthRepository = mockk()  // interface ✅

// ❌ Never mock a data class or concrete class
private val user: User = mockk()                    // data class — banned

// ✅ coEvery for suspend functions
coEvery { repository.login(any(), any()) } returns Result.success(fakeUser())

// ✅ verify only for side-effect tests
verify(exactly = 1) { analyticsTracker.trackLogin() }
\`\`\`

---

## Test File Location

| Source file | Test file |
|-------------|-----------|
| \`app/src/main/.../LoginViewModel.kt\` | \`app/src/test/.../LoginViewModelTest.kt\` |
| \`feature/auth/.../AuthRepository.kt\` | \`feature/auth/src/test/.../AuthRepositoryTest.kt\` |

---

## Coverage Expectations

| Layer | Minimum |
|-------|---------|
| ViewModel | ${cov('vm')}% |
| UseCase | ${cov('usecase')}% |
| Repository | ${cov('repo')}% |
| Utility functions | ${cov('util')}% |

These are targets for new code written in tasks. Pre-existing untouched code
is not subject to these targets per task.
`;
}

// ══════════════════════════════════════════════════════
//  DATA MODEL STEP
// ══════════════════════════════════════════════════════
function buildDataModelScreen(fp) {
  fp.innerHTML += `
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
  </div>`;

  addEntityRow({ name: 'User', fields: 'id: String, email: String, displayName: String, createdAt: Long' });
}

let entityCounter = 0;
function addEntityRow(defaults = {}) {
  const id = ++entityCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'entity-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('entity-row-${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">
      <div class="form-row"><label>Entity Name</label>
        <input type="text" class="entity-name" value="${esc(defaults.name||'')}" placeholder="User" oninput="updatePreview('datamodel')"></div>
      <div class="form-row"><label>Fields (comma-separated: name: Type)</label>
        <input type="text" class="entity-fields" value="${esc(defaults.fields||'')}" placeholder="id: String, email: String, createdAt: Long" oninput="updatePreview('datamodel')"></div>
    </div>`;
  document.getElementById('entities-list').appendChild(row);
  updatePreview('datamodel');
}

let endpointCounter = 0;
function addEndpointRow(defaults = {}) {
  const id = ++endpointCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'endpoint-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('endpoint-row-${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:120px 1fr;gap:10px">
      <div class="form-row"><label>Method</label>
        <select class="ep-method" onchange="updatePreview('datamodel')">
          <option${defaults.method==='POST'?' selected':''}>POST</option>
          <option${defaults.method==='GET'?' selected':''}>GET</option>
          <option${defaults.method==='PUT'?' selected':''}>PUT</option>
          <option${defaults.method==='PATCH'?' selected':''}>PATCH</option>
          <option${defaults.method==='DELETE'?' selected':''}>DELETE</option>
        </select></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="ep-path" value="${esc(defaults.path||'')}" placeholder="/users/me" oninput="updatePreview('datamodel')"></div>
    </div>
    <div class="form-row"><label>Request body (JSON)</label>
      <textarea class="ep-req" rows="2" placeholder='{"key":"value"}' oninput="updatePreview('datamodel')">${esc(defaults.reqBody||'')}</textarea></div>
    <div class="form-row"><label>Response 200 (JSON)</label>
      <textarea class="ep-resp" rows="2" placeholder='{"key":"value"}' oninput="updatePreview('datamodel')">${esc(defaults.respBody||'')}</textarea></div>
    <div class="form-row"><label>Error codes</label>
      <input type="text" class="ep-errors" value="${esc(defaults.errors||'')}" placeholder="401 unauthorized, 404 not found" oninput="updatePreview('datamodel')"></div>
  `;
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
    const fieldLines = parsedFields.map(({ fname, ftype }) => `    val ${fname}: ${ftype},`).join('\n');
    const fieldTable = parsedFields.map(({ fname, ftype }) => `| \`${fname}\` | \`${ftype}\` | [add rule] |`).join('\n');
    return `### ${name}

\`\`\`kotlin
data class ${name}(
${fieldLines}
)
\`\`\`

| Field | Type | Validation |
|-------|------|-----------|
${fieldTable}
`;
  }).join('\n');

  return `# Data Model
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

\`\`\`
Network DTO  ──→  Domain model  ──→  UI model
DB Entity    ──→  Domain model  ──→  UI model
\`\`\`

| Mapping | Where it happens | Class name |
|---------|-----------------|------------|
| Network DTO → Domain model | \`*RemoteDataSource.kt\` or \`*Mapper.kt\` | \`AuthMapper.kt\` |
| DB Entity → Domain model | \`*LocalDataSource.kt\` or \`*Mapper.kt\` | \`UserMapper.kt\` |
| Domain model → UI model | ViewModel or \`*UiMapper.kt\` | \`UserUiMapper.kt\` |

### Anti-patterns (agent must never do these)

\`\`\`kotlin
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
\`\`\`

### Mapper pattern

\`\`\`kotlin
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
\`\`\`

---

## Domain Entities

<!-- Add one section per core entity. Include Kotlin definition and validation rules. -->

${entities || '_No entities added yet._'}

---

## Database Schema

### AppDatabase

> Note: Never use domain models as Room entities. Always have a separate \`*Entity\` class.

<!-- Add one table per Room table: column name, type, notes. -->

---

## API Contracts

> API contracts (request/response shapes, error codes, base URLs) live in each module's
> \`context/<module>.md\` under "What the Agent Should Know".
> Add them there so the agent loads only the contracts relevant to the task at hand.
`;
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
        "Documenting only the \"what\" (we use MVVM) without the \"why\" (because of testability, not because it's default)",
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
        'Section anchors (e.g. <code>{#profile}</code>) must exactly match the <code>Known debt</code> links in MODULE_MAP.md. A mismatch means the agent\'t find the rules.',
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
    const get    = key => text.match(new RegExp(`^${key}:\\s*(.+)`, 'm'))?.[1]?.trim() ?? '';
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

    const variantMatches = [...text.matchAll(/^#\s{2,4}(\w+):\s+(\S+)(?:\s+#\s*(.+))?$/gm)];
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
      { id: 'no-bang-bang',    label: 'No `!!` operators introduced' },
      { id: 'no-livedata',     label: 'No new `LiveData` — new state uses `StateFlow`' },
      { id: 'no-globalscope',  label: 'No `GlobalScope` — use `viewModelScope` or `lifecycleScope`' },
      { id: 'no-hardcoded',    label: 'No hardcoded strings, colors, or dimensions' },
      { id: 'exhaustive-when', label: 'All `when` on sealed types are exhaustive — no `else`' },
      { id: 'no-biz-ui',       label: 'No business logic in UI layer' },
      { id: 'test-naming',     label: 'Tests follow `functionName_scenario_expectedResult` naming' },
    ],
  },
};
