// ══════════════════════════════════════════════════════
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
  const hasPill = group => document.querySelectorAll(`[id^="pill-${group}_"].selected`).length > 0;

  const coreChecks = [
    hasPill('arch'), hasPill('di'), hasPill('async'),
    hasPill('state'), hasPill('ui'), hasPill('nav'),
  ];
  const hasApproachNote = group =>
    [...document.querySelectorAll(`#arch-${group}-detail .approach-card textarea`)]
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
  track.innerHTML = `
    ${coreW  > 0 ? `<div class="arch-seg core"        style="flex:${coreW}"></div>`  : ''}
    ${recW   > 0 ? `<div class="arch-seg recommended" style="flex:${recW}"></div>`   : ''}
    ${optW   > 0 ? `<div class="arch-seg optional"    style="flex:${optW}"></div>`   : ''}
    ${emptyW > 0 ? `<div class="arch-seg empty"       style="flex:${emptyW}"></div>` : ''}
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

function insertModuleChip(targetId, name) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const start   = el.selectionStart ?? el.value.length;
  const end     = el.selectionEnd   ?? el.value.length;
  const before  = el.value.slice(0, start);
  const prevChar = before.length > 0 ? before[before.length - 1] : '';
  const prefix  = (prevChar !== '' && prevChar !== '\n' && prevChar !== ' ' && prevChar !== ',') ? ', ' : '';
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
      `<div class="module-chips-title">Modules</div>` +
      modules.map(m =>
        `<span class="mod-chip" onclick="insertModuleChip('${targetId}','${m.name}')">${m.name}</span>`
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
    `<div class="module-chips-title">Modules</div>` +
    modules.map(m =>
      `<span class="mod-chip" onclick="insertModuleChip('${targetId}','${m.name}')">${m.name}</span>`
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
  const containerId = `arch-${group}-detail`;
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
    const taId = `approach-${group}-${approach}`;
    const ph   = notes[approach] || 'describe which modules use this approach';
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

  container.querySelectorAll('.approach-card .module-chips[data-target]').forEach(c => populateApproachChips(c));
}

function getApproachRows(group) {
  const rows = [];
  document.querySelectorAll(`#arch-${group}-detail .approach-card`).forEach(card => {
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

  const domainSection = text.match(/^## Domain Entities([\s\S]*?)(?=^## )/m)?.[1] ?? '';
  for (const block of domainSection.split(/^### /m).slice(1)) {
    const name = block.split('\n')[0].trim();
    if (!name || name.includes('[')) continue;
    const dataClassMatch = block.match(/(?:data class|struct) \w+[\s\S]*?\{?([\s\S]*?)\}?\)/);
    const simpleMatch    = block.match(/data class \w+\s*\(([\s\S]*?)\)/);
    if (simpleMatch) {
      const fields = simpleMatch[1]
        .split('\n')
        .map(l => l.trim().replace(/^va[lr]\s+|^let\s+|^var\s+/, '').replace(/,$/, '').trim())
        .filter(l => l && l.includes(':'))
        .join(', ');
      entities.push({ name, fields });
    } else {
      entities.push({ name, fields: '' });
    }
  }

  for (const block of text.split(/^#### /m).slice(1)) {
    const firstLine = block.split('\n')[0].trim();
    const spaceIdx  = firstLine.indexOf(' ');
    if (spaceIdx === -1) continue;
    const method = firstLine.slice(0, spaceIdx).toUpperCase();
    const path   = firstLine.slice(spaceIdx + 1).trim();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;

    const reqBody  = block.match(/Request:\s*```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim()      ?? '';
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
    const re = new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, 'i');
    return (block.match(re)?.[1] ?? '').replace(/`/g, '').trim();
  };
  const sections = text.split(/^### /m).slice(1);
  for (const section of sections) {
    const name = section.split('\n')[0].trim();
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
          names.push(name.replace(/\.swift$/, ''));
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
              [...text.matchAll(/^import\s+(\w+)/gm)].forEach(m => swiftImports.add(m[1]));
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
  const src    = ((packageSwift || '') + '\n' + (podfile || '')).toLowerCase();
  const hasSrc = (...terms) => terms.some(t => src.includes(t.toLowerCase()));

  // ── Step 4: Parse project.pbxproj for bundle ID + configs ─
  let mainBundleId = '';
  let buildConfigs = [];
  if (pbxproj) {
    const allIds = [...pbxproj.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^\s;]+)\s*;/g)]
      .map(m => m[1].trim())
      .filter(id => id.includes('.') &&
        !/(test|widget|extension|watch|notification|clip)/i.test(id));
    mainBundleId = allIds[0] || '';

    // XCBuildConfiguration names (Debug, Release, Staging, etc.)
    const cfgMatches = [...pbxproj.matchAll(/isa\s*=\s*XCBuildConfiguration[\s\S]*?name\s*=\s*([A-Za-z][A-Za-z0-9\-_ ]+?)\s*;/g)];
    buildConfigs = [...new Set(cfgMatches.map(m => m[1].trim()))].filter(n => n.length < 30);
  }

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
    ? [...packageSwift.matchAll(/\.target\s*\(\s*name:\s*["']([^"']+)["']/g)].map(m => m[1])
    : [];
  const podTargets = podfile
    ? [...podfile.matchAll(/target\s+['"]([^'"]+)['"]\s+do/g)].map(m => m[1]).filter(t => !/[Tt]est/.test(t))
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
  if (bundleEl) bundleEl.value = mainBundleId || (xcodeTarget ? `com.example.${xcodeTarget.toLowerCase()}` : '');
  selectPill('cfg-platform', 'iOS', 'radio');
  if (lang === 'Swift')            selectPill('cfg-lang', 'Swift', 'radio');
  else if (lang === 'Objective-C') selectPill('cfg-lang', 'Objective-C', 'radio');
  else                             selectPill('cfg-lang', 'Swift+ObjC', 'radio');
  updatePreview('projectconfig');

  // ── Step 9: Populate scheme rows ─────────────────────────
  const schemeList = document.getElementById('cfg-schemes-list');
  if (schemeList) { schemeList.innerHTML = ''; schemeCounter = 0; }

  const schemeSrc = schemeNames.length > 0 ? schemeNames : buildConfigs;
  if (schemeSrc.length > 0) {
    schemeSrc.forEach(name => {
      const nl   = name.toLowerCase();
      const sfx  = nl.includes('debug') || nl === 'debug'     ? '.debug'
                 : nl.includes('stag')  || nl.includes('uat') ? '.staging'
                 :                                               '';
      addSchemeRow({
        name,
        bundleId: mainBundleId ? mainBundleId + sfx : '',
        note: nl.includes('debug') ? 'Development build' : nl.includes('stag') || nl.includes('uat') ? 'Staging build' : nl.includes('release') || nl.includes('prod') ? 'Production build' : '',
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
  const existingModuleMap = await tryReadFile(state.dirHandle, 'agent-sdd', 'spec-kit', 'MODULE_MAP.md');
  const parsedModules = existingModuleMap ? parseModuleMapMD(existingModuleMap) : [];

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
  const existingDataModel = await tryReadFile(state.dirHandle, 'agent-sdd', 'spec-kit', 'DATA_MODEL.md');
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
    ? `${parsedModules.length} modules from MODULE_MAP.md`
    : allModules.length ? `${allModules.length} modules detected` : null;
  const summary = [
    mainBundleId    ? `bundle ID`    : null,
    moduleSource,
    schemeNames.length  ? `${schemeNames.length} schemes`  :
    buildConfigs.length ? `${buildConfigs.length} configs` : null,
    state.detectedInterceptors.length ? `${state.detectedInterceptors.length} interceptors` : null,
  ].filter(Boolean).join(', ');
  showToast(`Auto-filled · ${summary || 'basic settings'} · review & adjust`, 'success');
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
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('scheme-row-${id}').remove(); updatePreview('projectconfig')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:10px">
      <div class="form-row"><label>Scheme name</label>
        <input type="text" class="scheme-name" value="${esc(defaults.name||'')}" placeholder="Debug" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>Bundle ID</label>
        <input type="text" class="scheme-bundle" value="${esc(defaults.bundleId||'')}" placeholder="com.example.app.debug" oninput="updatePreview('projectconfig')" style="font-family:var(--mono);font-size:12px"></div>
      <div class="form-row"><label>Note (optional)</label>
        <input type="text" class="scheme-note" value="${esc(defaults.note||'')}" placeholder="Dev build — internal testing only" oninput="updatePreview('projectconfig')"></div>
    </div>
  `;
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
      .map(s => `#   ${s.name}:${' '.repeat(Math.max(1, maxLen - s.name.length + 2))}${s.bundleId || '[fill in]'}${s.note ? `  # ${s.note}` : ''}`)
      .join('\n');
    bundleComment = `# Base bundle ID — production bundle identifier.\n# Bundle ID varies by scheme:\n${schemeLines}\n# Use the base bundle_id above for all import and namespace generation.`;
  }

  const iosSection = platform === 'iOS' ? `
## iOS-specific (remove section if not iOS)

bundle_id: ${bundleId}
${bundleComment}
deployment_target: ${deployTarget}
xcode_version: ${xcodeVer}
` : '';

  const langOut = lang === 'Swift+ObjC' ? 'Swift' : lang;

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
# Options: Swift | Objective-C | Kotlin | TypeScript | etc.
${iosSection}
## Team Preferences

default_tests: ${defaultTests}
# Y = Claude always writes tests unless the task MD explicitly says N.
# N = Claude asks each time.

branch_convention: ${branch}
# Naming hint shown in task completion reports.
# Example: feature/APP-1234 | bugfix/APP-1234 | chore/APP-1234
`;
}

function buildProjectConfigScreen(fp) {
  fp.innerHTML += `
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
        ${pill('iOS','iOS','cfg-platform','radio')}
        ${pill('Android','Android','cfg-platform','radio')}
        ${pill('Web','Web','cfg-platform','radio')}
        ${pill('Backend','Backend','cfg-platform','radio')}
        ${pill('Flutter','Flutter','cfg-platform','radio')}
        ${pill('React Native','React Native','cfg-platform','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Primary Language</h3>
      <div class="radio-group">
        ${pill('Swift','Swift','cfg-lang','radio')}
        ${pill('Objective-C','Objective-C','cfg-lang','radio')}
        ${pill('Swift + Obj-C','Swift+ObjC','cfg-lang','radio')}
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
        ${pill('Y — always write tests','Y','cfg-tests','radio')}
        ${pill('N — ask each time','N','cfg-tests','radio')}
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

  </div>`;

  addSchemeRow({ name: 'Debug',   bundleId: '', note: 'Development build' });
  addSchemeRow({ name: 'Staging', bundleId: '', note: 'Staging build' });
  addSchemeRow({ name: 'Release', bundleId: '', note: 'Production build' });
}

// ══════════════════════════════════════════════════════
//  ARCHITECTURE STEP
// ══════════════════════════════════════════════════════
function buildArchitectureScreen(fp) {
  fp.innerHTML += `
  <div class="step-screen" id="screen-architecture">

    <div class="form-section">
      <h3>Language</h3>
      <div class="check-group" id="lang-group">
        ${pill('Swift','Swift','lang')}
        ${pill('Objective-C','ObjC','lang')}
        ${pill('Swift + Obj-C','Swift+ObjC','lang')}
      </div>
    </div>

    <div class="form-section">
      <h3>Architecture Pattern ${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>MVVM</strong> — ViewModel + StateFlow/@Published + Repository. Recommended for SwiftUI.<br>
        <strong>MVC</strong> — ViewController as controller. Default UIKit pattern; use Migration Rules to guard new code.<br>
        <strong>VIPER</strong> — View, Interactor, Presenter, Entity, Router. Complex but fully testable.<br>
        <strong>TCA</strong> — The Composable Architecture. Unidirectional, testable, composable state.<br>
        <strong>Clean Architecture</strong> — Domain layer (UseCases) between ViewModel and Repository.
      </div>
      <div class="radio-group" id="arch-group">
        ${pill('MVVM','MVVM','arch','radio')}
        ${pill('MVC','MVC','arch','radio')}
        ${pill('VIPER','VIPER','arch','radio')}
        ${pill('TCA','TCA','arch','radio')}
        ${pill('Clean Architecture','Clean','arch','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Dependency Injection ${tierBadge('core')}</h3>
      <div class="radio-group" id="di-group">
        ${pill('Manual','Manual','di','radio')}
        ${pill('Resolver','Resolver','di','radio')}
        ${pill('Swinject','Swinject','di','radio')}
        ${pill('Needle','Needle','di','radio')}
        ${pill('Factory','Factory','di','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Async / Threading ${tierBadge('core')} ${infoBtn('Select every async approach in the codebase. Then describe <strong>where each is used</strong> — the agent uses this to decide which async primitive to reach for.')}</h3>
      <div class="check-group" id="async-group">
        ${pill('async/await','async/await','async')}
        ${pill('Combine','Combine','async')}
        ${pill('RxSwift','RxSwift','async')}
        ${pill('GCD','GCD','async')}
        ${pill('OperationQueue','OperationQueue','async')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> to get a separate card. Use module chips to specify which modules use it.</p>
      <div class="approach-detail" id="arch-async-detail"></div>
    </div>

    <div class="form-section">
      <h3>State Management ${tierBadge('core')} ${infoBtn('Select <strong>all</strong> state approaches — including legacy ones. Each gets its own card.')}</h3>
      <div class="check-group" id="state-group">
        ${pill('@Observable','@Observable','state')}
        ${pill('ObservableObject','ObservableObject','state')}
        ${pill('CurrentValueSubject','CurrentValueSubject','state')}
        ${pill('RxRelay','RxRelay','state')}
      </div>
      <p class="approach-hint">Select <strong>each approach</strong> to get a separate card.</p>
      <div class="approach-detail" id="arch-state-detail"></div>
    </div>

    <div class="form-section">
      <h3>UI Layer ${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>SwiftUI</strong> — declarative UI, all new screens use Views + @Observable / ObservableObject.<br>
        <strong>UIKit</strong> — imperative UI only; agent writes ViewControllers + Storyboard/XIB or programmatic layout.<br>
        <strong>Mixed</strong> — both exist; agent uses SwiftUI for new screens, leaves UIKit screens untouched.
      </div>
      <div class="radio-group" id="ui-group">
        ${pill('SwiftUI','SwiftUI','ui','radio')}
        ${pill('UIKit','UIKit','ui','radio')}
        ${pill('Mixed (SwiftUI + UIKit)','Mixed','ui','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Navigation ${tierBadge('core')}</h3>
      <div class="form-sub">
        <strong>NavigationStack</strong> — SwiftUI NavigationStack with typed paths. iOS 16+.<br>
        <strong>Coordinator</strong> — Coordinator pattern managing UINavigationController. Common UIKit pattern.<br>
        <strong>UINavigationController</strong> — Direct push/pop; legacy single-Activity equivalent.<br>
        <strong>Mixed</strong> — NavigationStack for SwiftUI flows, Coordinator for UIKit flows.
      </div>
      <div class="radio-group" id="nav-group">
        ${pill('NavigationStack','NavigationStack','nav','radio')}
        ${pill('Coordinator','Coordinator','nav','radio')}
        ${pill('UINavigationController','UINavController','nav','radio')}
        ${pill('Mixed','MixedNav','nav','radio')}
      </div>
    </div>

    <div class="form-section">
      <h3>Networking ${tierBadge('recommended')} ${infoBtn('<strong>Base URL strategy</strong> — describe HOW the URL is managed. Examples:<br><code>per-environment via InfoPlist BASE_URL</code><br><code>injected via AppConfig singleton</code><br><br><strong>Auth mechanism</strong>:<br><code>Bearer token injected by AuthURLProtocol</code><br><code>API key in request header via URLRequestInterceptor</code>')}</h3>
      <div class="check-group" id="network-group">
        ${pill('URLSession','URLSession','network')}
        ${pill('Alamofire','Alamofire','network')}
        ${pill('Moya','Moya','network')}
      </div>
      <div class="form-row" style="margin-top:8px;display:flex;gap:12px">
        <input type="text" id="arch-base-url" placeholder="Strategy only — e.g. per-environment via InfoPlist BASE_URL" oninput="updatePreview('architecture')" style="flex:1">
        <input type="text" id="arch-auth" placeholder="Auth — e.g. Bearer token via AuthURLProtocol" oninput="updatePreview('architecture')" style="flex:1">
      </div>
    </div>

    <div class="form-section">
      <h3>Local Storage ${tierBadge('optional')}</h3>
      <div class="check-group" id="storage-group">
        ${pill('SwiftData','SwiftData','storage')}
        ${pill('Core Data','CoreData','storage')}
        ${pill('Realm','Realm','storage')}
        ${pill('UserDefaults','UserDefaults','storage')}
        ${pill('Keychain','Keychain','storage')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-storage-usage" rows="2" placeholder="One line per approach e.g.&#10;SwiftData — user preferences, order history&#10;Keychain — auth tokens, secure credentials" oninput="updatePreview('architecture')"></textarea>
      </div>
      <div class="module-chips-wrapper">
        <div class="module-chips" data-target="arch-storage-usage"></div>
      </div>
    </div>

    <div class="form-section">
      <h3>Image Loading ${tierBadge('optional')}</h3>
      <div class="radio-group" id="img-group">
        ${pill('Kingfisher','Kingfisher','img','radio')}
        ${pill('SDWebImage','SDWebImage','img','radio')}
        ${pill('Nuke','Nuke','img','radio')}
        ${pill('None','NoneImg','img','radio')}
      </div>
      <div class="form-row" style="margin-top:8px">
        <textarea id="arch-img-usage" rows="2" placeholder="Where used — e.g. product images, restaurant logos, user avatars" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Known Architecture Violations ${tierBadge('optional')}</h3>
      <div class="form-row">
        <textarea id="arch-violations" rows="3" placeholder="e.g. HomeViewController.swift — business logic in viewDidLoad, pre-dates MVVM adoption" oninput="updatePreview('architecture')"></textarea>
      </div>
    </div>

    <div class="form-section">
      <h3>Target Architecture Notes ${tierBadge('recommended')}</h3>
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
  </div>`;

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
    if (rows.length > 0) return rows.map(({ approach, note }) => `| ${approach} | ${note || placeholder} |`).join('\n');
    return pills.map(p => `| ${p} | ${placeholder} |`).join('\n');
  }
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

  // ── ADR-001: Layer Structure ──────────────────────────
  const isTCA   = arch === 'TCA';
  const isClean = arch === 'Clean';
  const isVIPER = arch === 'VIPER';

  const layerPackageTree = isTCA
    ? `\`\`\`\n${appName}/\n├── Features/\n│   └── <Name>/\n│       ├── <Name>Feature.swift    ← TCA Reducer\n│       ├── <Name>View.swift       ← SwiftUI View\n│       └── <Name>Client.swift     ← Effect dependencies\n├── Core/\n│   ├── Network/\n│   └── Storage/\n└── App/\n    └── AppFeature.swift           ← Root reducer\n\`\`\``
    : isVIPER
    ? `\`\`\`\n${appName}/\n├── Modules/\n│   └── <Name>/\n│       ├── View/          ← UIViewController / SwiftUI View\n│       ├── Presenter/     ← Presentation logic\n│       ├── Interactor/    ← Business logic\n│       ├── Router/        ← Navigation\n│       └── Entity/        ← Data models\n├── Services/\n└── Common/\n\`\`\``
    : isClean
    ? `\`\`\`\n${appName}/\n├── Features/\n│   └── <name>/\n│       ├── Presentation/  ← View + ViewModel\n│       ├── Domain/        ← UseCase + Repository protocol\n│       └── Data/          ← RepositoryImpl + DTOs\n├── Core/\n│   ├── Network/\n│   └── Storage/\n└── App/\n\`\`\``
    : `\`\`\`\n${appName}/\n├── Features/\n│   └── <name>/\n│       ├── View/          ← SwiftUI View / UIViewController\n│       ├── ViewModel/     ← ObservableObject / @Observable\n│       └── Repository/    ← Data access\n├── Core/\n│   ├── Network/\n│   └── Storage/\n└── App/\n\`\`\``;

  const dependencyRule = isTCA
    ? `**Dependency Rule**: \`View → Reducer (Store) → Effect (Client)\`\nAll side effects go through \`Effect\`. No direct API calls from the Reducer.`
    : isClean
    ? `**Dependency Rule**: \`View → ViewModel → UseCase → Repository → DataSource\`\nNo layer may import from a layer above it.`
    : `**Dependency Rule**: \`View → ViewModel → Repository\`\nViewModels must not import the View layer.`;

  const adr001 = `### ADR-001 — Layer Structure and Dependency Rule
- **Date**: ${today}
- **Decision**: Adopt ${arch || 'MVVM'} with strict unidirectional dependency flow.
- **Reason**: Enforces separation of concerns, testability, and prevents coupling between layers.
- **Consequence**: Every new file must be placed in the correct layer. PRs that violate the dependency rule are rejected.

#### Package Tree

${layerPackageTree}

#### ${dependencyRule}

**Violations the agent must refuse to introduce:**
- Business logic or network calls directly inside a \`View\` or \`UIViewController\`
- Importing a DTO or network response type into the ViewModel or View layer
- Accessing \`UserDefaults\` / Keychain directly from a ViewModel`;

  // ── ADR-002: Pattern example ──────────────────────────
  const hasObservable = stateLib.includes('@Observable');
  const stateAnnotation = hasObservable ? '@Observable\nclass' : '@MainActor\nclass';
  const stateConformance = hasObservable ? '' : ': ObservableObject';
  const stateProp = hasObservable ? 'var isLoading = false\n    var items: [Item] = []\n    var error: String?'
                                   : '@Published var isLoading = false\n    @Published var items: [Item] = []\n    @Published var error: String?';

  let adr002 = '';
  if (arch === 'TCA') {
    adr002 = `### ADR-002 — TCA Pattern: Reducer + Store + View
- **Date**: ${today}
- **Decision**: All feature screens follow the TCA contract below.
- **Reason**: Unidirectional data flow, exhaustive testing of state mutations, composable state.
- **Consequence**: Every screen ships with a \`Reducer\`, a \`Store\`, and a stateless \`View\`.

\`\`\`swift
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

    @Dependency(\\.exampleClient) var client

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
\`\`\``;
  } else if (arch === 'MVVM' || !arch) {
    adr002 = `### ADR-002 — MVVM Pattern: ViewModel + View
- **Date**: ${today}
- **Decision**: All feature screens follow the MVVM contract below.
- **Reason**: Clear separation between UI and business logic; ViewModel is independently testable.
- **Consequence**: Every screen ships with a \`ViewModel\` and a stateless \`View\`.

\`\`\`swift
// ✅ ViewModel — ${hasObservable ? '@Observable (iOS 17+)' : 'ObservableObject'}
${stateAnnotation} ExampleViewModel${stateConformance} {
    ${stateProp}

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
    ${hasObservable ? '@State private var viewModel: ExampleViewModel' : '@StateObject private var viewModel: ExampleViewModel'}

    var body: some View {
        Group {
            if viewModel.isLoading { ProgressView() }
            else if let error = viewModel.error { Text(error).foregroundStyle(.red) }
            else { List(viewModel.items) { Text($0.name) } }
        }
        .task { await viewModel.loadItems() }
    }
}
\`\`\``;
  }

  // ── ADR-003: DI ──────────────────────────────────────
  const diName = di || 'Manual';
  let adr003 = '';
  if (diName === 'Manual') {
    adr003 = `### ADR-003 — Dependency Injection (Manual / Protocol-based)
- **Date**: ${today}
- **Decision**: Dependencies injected via constructor. No DI framework.
- **Reason**: Simple, compile-time safe, no additional dependencies.
- **Consequence**: All dependencies declared in \`init()\`. Use protocols for testability.

\`\`\`swift
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
\`\`\``;
  } else {
    adr003 = `### ADR-003 — Dependency Injection with ${diName}
- **Date**: ${today}
- **Decision**: ${diName} is the sole DI framework. No manual service locator singletons.
- **Reason**: Consistent dependency resolution across modules.
- **Consequence**: All dependencies registered at app startup. Direct instantiation of injectable types is forbidden.`;
  }

  // ── ADR-004: Navigation ──────────────────────────────
  let adr004 = '';
  if (nav === 'NavigationStack') {
    adr004 = `### ADR-004 — Navigation with NavigationStack (iOS 16+)
- **Date**: ${today}
- **Decision**: All navigation handled by SwiftUI \`NavigationStack\` with typed paths.
- **Reason**: Type-safe, composable, and testable navigation native to SwiftUI.
- **Consequence**: No \`NavigationLink(destination:))\` with closures. All routes declared in \`AppRoute\`.

\`\`\`swift
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
\`\`\``;
  } else if (nav === 'Coordinator') {
    adr004 = `### ADR-004 — Navigation via Coordinator Pattern
- **Date**: ${today}
- **Decision**: All navigation handled by Coordinators. ViewControllers do not push/present directly.
- **Reason**: Decouples navigation logic from ViewControllers; Coordinators are independently testable.
- **Consequence**: Every feature has a \`Coordinator\` protocol. Direct \`navigationController.pushViewController\` calls outside a Coordinator are forbidden.

\`\`\`swift
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
\`\`\``;
  }

  // ── ADR-005: Async / State ───────────────────────────
  const hasRxSwift  = asyncLib.includes('RxSwift');
  const hasCombine  = asyncLib.includes('Combine');
  const hasAsyncAwait = asyncLib.includes('async/await') || asyncLib.length === 0;

  const adr005 = `### ADR-005 — Async and State Management
- **Date**: ${today}
- **Decision**: ${hasAsyncAwait ? 'Swift async/await' : asyncLib.join(' + ')} for async; ${stateLib.join(' + ') || '@Observable'} for state.${hasRxSwift ? ' RxSwift is legacy and being removed incrementally.' : ''}${hasCombine ? ' Combine is legacy for state; new code uses @Observable or ObservableObject.' : ''}
- **Reason**: Swift Concurrency is the platform-recommended structured concurrency model with first-class actor isolation.
- **Consequence**: All new async work uses \`async/await\` and \`Task\`. All new UI state uses \`@Observable\` (iOS 17+) or \`@Published\`. No new GCD or callback-based APIs.

| Legacy | Modern replacement | Migration status |
|--------|-------------------|-----------------|
${[
  hasRxSwift  ? '| RxSwift Observable | async/await + AsyncStream | Incremental — remove on touch |' : '',
  hasCombine  ? '| Combine Publisher | async/await + AsyncStream | Incremental — replace on touch |' : '',
  '| DispatchQueue.async | Task { } / await | Must be replaced when adding new async work |',
  '| completionHandler | async throws | Must be replaced when adding new async work |',
].filter(Boolean).join('\n')}`;

  // ── ADR-006: Mixed UI ────────────────────────────────
  const adr006 = ui === 'Mixed'
    ? `### ADR-006 — Mixed UI: SwiftUI for new screens; UIKit stays until migration ticket
- **Date**: ${today}
- **Decision**: Do not rewrite existing UIKit screens to SwiftUI unless a ticket explicitly scopes it.
- **Reason**: Rewriting UI without adding user value introduces risk and churn.
- **Consequence**: The codebase contains both UIKit and SwiftUI. The agent must not assume all UI is SwiftUI. When touching an existing UIKit screen, keep it in UIKit unless the ticket says otherwise.`
    : '';

  const adrBlocks = [adr001, adr002, adr003, adr004, adr005, adr006]
    .filter(a => a && a.trim() !== '').join('\n\n');

  const langDisplay = langs.join(' + ') || 'Swift';
  const diDisplay   = di || 'Manual';
  let moduleTableRows = '';
  if (state.detectedModuleDetails && state.detectedModuleDetails.length > 0) {
    moduleTableRows = state.detectedModuleDetails.map(m =>
      `| ${m.name} | ${langDisplay} | ${m.type === 'MVVM' ? (arch || 'MVVM') : m.type} | ${m.diCol} | ${m.notes} |`
    ).join('\n');
  } else {
    moduleTableRows =
`| ${appName} | ${langDisplay} | Single App | ${diDisplay} | App entry point, root view, deep links |
| ${appName}Feature | Swift | ${arch || 'MVVM'} | ${diDisplay} | [describe feature] |
| ${appName}Core | Swift | Repository | ${diDisplay} | Shared domain layer |
| ${appName}Network | Swift | — | ${diDisplay} | URLSession, interceptors |
| ${appName}UI | Swift | — | — | Shared SwiftUI components, theme |`;
  }

  const interceptorList = state.detectedInterceptors && state.detectedInterceptors.length > 0
    ? state.detectedInterceptors.join(', ') : '[list each]';

  return `# Architecture
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
${moduleTableRows}

### Navigation

${nav === 'NavigationStack' ? 'SwiftUI NavigationStack with typed AppRoute enum. Root NavigationStack in App struct.' :
  nav === 'Coordinator'     ? 'Coordinator pattern — AppCoordinator manages UINavigationController stack.' :
  nav === 'UINavController' ? 'Direct UINavigationController push/pop. Legacy single-ViewController navigation.' :
  '[Describe navigation approach]'}

### Threading Model

| Approach | Where used |
|----------|-----------|
${asyncRows || '| async/await | All new code — network, business logic |'}

### State Management

| Approach | Where used |
|----------|-----------|
${stateRows || '| @Observable | All new ViewModels (iOS 17+) |'}

### Networking

| Property | Value |
|----------|-------|
| Library | ${network.join(' + ') || 'URLSession'} |
| Base URL strategy | ${baseUrl || '[single base URL / per-environment via InfoPlist / remote config]'} |
| Auth mechanism | ${authMech || '[Bearer token via URLProtocol / API key in header / none]'} |
| Custom interceptors | ${interceptorList} |

### Local Storage

| Approach | Where used |
|----------|-----------|
${storageRows || '| SwiftData | [describe usage] |'}

### Image Loading
${img && img !== 'NoneImg' ? `${img} — ${imgUsage.split('\n').map(l=>l.trim()).filter(Boolean).join(', ') || '[describe usage]'}` : 'No image loading library — using AsyncImage.'}

### Known Architecture Violations

${violationsBlock}

---

## Target State

### Architecture Pattern
${arch === 'TCA'   ? 'TCA — Reducer + Store + Effect. Fully unidirectional.' :
  arch === 'Clean' ? 'Clean Architecture — View → ViewModel → UseCase → Repository → DataSource' :
  arch === 'VIPER' ? 'VIPER — View, Interactor, Presenter, Entity, Router' :
  (arch || 'MVVM') + '\n[describe target state]'}

### DI
${di || 'Manual / Protocol-based'} everywhere. No singletons except AppConfig.

### Async
Swift async/await everywhere.${hasRxSwift ? ' RxSwift being removed incrementally.' : ''}${hasCombine ? ' Combine being replaced with async/await + AsyncStream.' : ''}

### UI
${ui === 'SwiftUI' ? '- All screens: SwiftUI + Material Design tokens' :
  ui === 'Mixed'   ? '- New screens: SwiftUI\n- Existing UIKit screens: kept until explicit migration ticket\n- No new UIKit ViewControllers' :
  ui === 'UIKit'   ? '- Current: UIKit\n- Target: Migrate to SwiftUI incrementally' :
  '- [Describe UI target state]'}

### Navigation
${nav === 'NavigationStack' || nav === 'Coordinator' ? `${nav}. No direct navigation calls from Views/ViewControllers.` : '[Describe navigation target]'}
${targetNotes ? '\n### Additional Notes\n' + targetNotes : ''}

---

## Architecture Decision Records

${adrBlocks}

<!-- ─────────────────────────────────────────────────────────────────────────
     END OF ARCHITECTURE.md — Every decision above is final.
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
      <h3>Package / Module Prefix ${infoBtn('Used in the generated package structure example. e.g. <code>com.example.myapp</code> or simply <code>MyApp</code> for Swift.')}</h3>
      <div class="form-row">
        <input type="text" id="conv-package" placeholder="e.g. MyApp" oninput="updatePreview('conventions')">
      </div>
    </div>
    <div class="form-section">
      <h3>Swift Core Rules</h3>
      <div class="dynamic-list" id="conv-null-rules">
        ${[
          ['conv-no-force-unwrap','No force-unwrap (!)','Use guard let, if let, or ?? instead'],
          ['conv-no-force-cast',  'No force-cast (as!)','Use conditional cast as? with guard or if let'],
          ['conv-prefer-struct',  'Prefer struct over class for value types','Use class only when identity or inheritance is required'],
          ['conv-prefer-let',     'Prefer let over var','Immutability by default — use var only when mutation is strictly needed'],
          ['conv-exhaustive-switch','Exhaustive switch on enum (no default for known cases)','Compiler catches missing branches when new cases are added'],
        ].map(([id, label, sub]) => `
        <div class="toggle-row">
          <div><div class="toggle-label">${label}</div><div class="toggle-sub">${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>ViewModel Rules</h3>
      <div class="dynamic-list">
        ${[
          ['conv-observable',    '@Observable / ObservableObject for state (no Combine PassthroughSubject for state)','All state mutations happen on @MainActor'],
          ['conv-no-uikit-vm',   'No UIKit imports in ViewModel','UIViewController, UIView, UIColor are banned — keeps ViewModel unit-testable'],
          ['conv-task-scope',    'All async work in Task {} scoped to ViewModel lifetime','Structured concurrency — no detached tasks without explicit cancellation'],
          ['conv-no-singleton',  'No singleton state in ViewModels','Use constructor injection — singletons make testing impossible'],
        ].map(([id, label, sub]) => `
        <div class="toggle-row">
          <div><div class="toggle-label">${label}</div><div class="toggle-sub">${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>SwiftUI Rules</h3>
      <div class="dynamic-list">
        ${[
          ['conv-stateless-view', 'Stateless Views — receive state, emit events via closures/bindings','Views only render and forward events — all decisions live in ViewModel'],
          ['conv-no-logic-view',  'No business logic inside View body','View body only formats and renders — no network calls, no data processing'],
          ['conv-task-on-appear', 'Use .task { } not .onAppear { Task { } }','.task modifier auto-cancels when view disappears — no leak'],
          ['conv-main-actor',     '@MainActor on all ViewModels','Guarantees UI updates on main thread without manual DispatchQueue.main'],
        ].map(([id, label, sub]) => `
        <div class="toggle-row">
          <div><div class="toggle-label">${label}</div><div class="toggle-sub">${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>`).join('')}
      </div>
    </div>
    <div class="form-section">
      <h3>Quality Gate ${infoBtn('The agent runs this checklist on every task during Step 6b self-verification.')}</h3>
      <div class="dynamic-list">
        ${[
          ['qg-no-force-unwrap', 'No force-unwrap (!)', 'Use guard let, if let, or ??'],
          ['qg-no-force-cast',   'No force-cast (as!)', 'Use conditional cast as?'],
          ['qg-no-uikit-vm',     'No UIKit in ViewModel', 'No UIViewController, UIView, UIColor imports'],
          ['qg-no-strings',      'No hardcoded user-visible strings', 'All localised text in Localizable.strings'],
          ['qg-exhaustive-switch','Exhaustive switch on enum', 'No default: on known-case enums'],
          ['qg-no-logic-view',   'No business logic in View', 'Views, ViewControllers call ViewModel only'],
          ['qg-dto-not-exposed', 'DTOs not exposed to View', 'Repository returns domain models only'],
          ['qg-main-actor',      '@MainActor on ViewModels', 'All state-mutating ViewModels annotated @MainActor'],
          ['qg-test-naming',     'Test naming convention', 'test_functionName_scenario_expectedResult'],
        ].map(([id, label, sub]) => `
        <div class="toggle-row">
          <div><div class="toggle-label">${label}</div><div class="toggle-sub">${sub}</div></div>
          <label class="toggle"><input type="checkbox" id="${id}" checked onchange="updatePreview('conventions')"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>
        </div>`).join('')}
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
  </div>`;
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

  const rule = (active, text) => active ? `- ${text}` : null;

  const coreRules = [
    rule(noForceUnwrap, 'No force-unwrap (`!`). Use `guard let`, `if let`, or `?? defaultValue`.'),
    rule(noForceCast,   'No force-cast (`as!`). Use `guard let x = y as? Type else { return }`.'),
    rule(preferStruct,  'Prefer `struct` over `class` for value types. Use `class` only when identity or inheritance is required.'),
    rule(preferLet,     'Prefer `let` over `var`. Declare `var` only when mutation is required.'),
    rule(exhaustive,    'Every `switch` on an `enum` must be exhaustive. No `default:` on known-case enums.'),
    '- Use `Result<T, Error>` for operations that can fail — no throwing across layer boundaries via uncaught exceptions.',
    '- Extension functions in a dedicated `[Subject]+Extensions.swift` file.',
  ].filter(Boolean).join('\n');

  const coreAntiPatterns = (noForceUnwrap || noForceCast || exhaustive) ? `
### Anti-patterns (agent must never write these)

\`\`\`swift
${noForceUnwrap ? `// ❌ Force-unwrap
let name = user!.name

// ✅ Safe unwrap
guard let user = user else { return }
let name = user.name
` : ''}${noForceCast ? `
// ❌ Force-cast
let vc = storyboard.instantiateViewController(withIdentifier: "Home") as! HomeViewController

// ✅ Conditional cast
guard let vc = storyboard.instantiateViewController(withIdentifier: "Home") as? HomeViewController else { return }
` : ''}${exhaustive ? `
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
` : ''}\`\`\`` : '';

  const vmRules = [
    rule(observable,  '`@MainActor` annotation on all ViewModels. Use `@Observable` (iOS 17+) or `@Published` + `ObservableObject`.'),
    rule(noUIKitVM,   'No UIKit imports in ViewModel (`UIViewController`, `UIView`, `UIColor` are banned).'),
    rule(taskScope,   'Async work lives in `Task {}` stored on ViewModel. Always cancel in `deinit` or via structured concurrency.'),
    '- No direct DataSource calls — always through UseCase or Repository.',
    '- Repository functions return `Result<T, Error>` — never throw across layer boundaries.',
  ].filter(Boolean).join('\n');

  const vmCodeBlock = observable ? `
\`\`\`swift
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
\`\`\`` : '';

  const swiftUIRules = [
    rule(statelessView, 'Views are **stateless** — receive state via bindings or environment, emit events via closures.'),
    rule(noLogicView,   'No business logic in `body`. Views only render and forward events.'),
    '- No ViewModel access deep inside subviews — hoist to screen-level View only.',
    rule(mainActor,     'Use `.task { await viewModel.load() }` — not `.onAppear { Task { } }`.'),
    '- Previews use `#Preview` macro with mock data.',
  ].filter(Boolean).join('\n');

  return `# Conventions
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads this and follows it exactly. Never modifies it.
# These rules override the defaults in CLAUDE.md where they conflict.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: follow every convention in this file exactly. These are non-negotiable.

---

## Swift Core Rules

${coreRules}
${coreAntiPatterns}

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Types (class, struct, enum, protocol) | PascalCase | \`LoginViewModel\`, \`AuthRepository\` |
| Functions, properties, variables | camelCase, verb-first for functions | \`loadUser()\`, \`onLoginTapped()\` |
| Constants | camelCase in \`enum\` namespace or \`let\` at top-level | \`Constants.maxRetryCount\` |
| MARK sections | \`// MARK: - Section Name\` | \`// MARK: - Private helpers\` |
| Test files | \`[SourceClass]Tests\` | \`LoginViewModelTests\` |
| Test functions | \`test_functionName_scenario_expectedResult\` | \`test_submitLogin_invalidEmail_showsError\` |

---

## Package Structure (per feature module)

\`\`\`
${pkg}/
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
\`\`\`

---

## ViewModel Conventions

${vmRules}
${vmCodeBlock}

---

## SwiftUI (new screens only)

${swiftUIRules}

---

## Dependency Injection

- Constructor injection for all dependencies. No shared singletons except \`AppConfig\`.
- Protocol for every Repository and DataSource — enables test mocks.
- Composition root in \`App\` struct or \`SceneDelegate\` — wire dependencies once.

---

## Quality Gate

> Agent: run this checklist on every file you create or modify (Step 6b).

| Check | Rule |
|-------|------|
${[
  qgNoForce ? '| No force-unwrap (`!`) | Use `guard let`, `if let`, or `??` |' : null,
  qgNoCast  ? '| No force-cast (`as!`) | Use conditional cast `as?` with guard |' : null,
  qgNoUIKit ? '| No UIKit in ViewModel | No `UIViewController`, `UIView`, `UIColor` imports |' : null,
  qgStrings ? '| No hardcoded user-visible strings | All localised text in `Localizable.strings` |' : null,
  qgExhaust ? '| Exhaustive switch | No `default:` on known-case `enum` |' : null,
  qgNoLogic ? '| No business logic in View | Views and ViewControllers call ViewModel only |' : null,
  qgNoDTO   ? '| DTOs not exposed to View | Repository returns domain models only |' : null,
  qgMainAct ? '| @MainActor on ViewModels | All state-mutating ViewModels annotated `@MainActor` |' : null,
  qgNaming  ? '| Tests follow naming convention | `test_functionName_scenario_expectedResult` |' : null,
  ...(qgExtra ? qgExtra.split('\n').map(l => l.trim()).filter(Boolean).map(l => '| ' + l + ' | — |') : []),
].filter(Boolean).join('\n')}
`;
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

  fp.innerHTML += `
  <div class="step-screen" id="screen-migrations">
    <div class="callout callout-info" style="margin-bottom:20px">
      <strong>This file does not tell the agent to migrate anything.</strong><br>
      It tells the agent what to do when a task lands it inside a file that still uses legacy patterns —
      keep the old code untouched, use the modern pattern only for new lines it adds.
    </div>
    <div class="form-section">
      <h3>Legacy Patterns Present</h3>
      <div class="dynamic-list">
        ${legacyPatterns.map(p => `
        <div class="dynamic-item" style="padding:10px 12px">
          <div class="toggle-row" style="margin-bottom:0">
            <div><div class="toggle-label">${p.label}</div><div class="toggle-sub">${p.sub}</div></div>
            <label class="toggle">
              <input type="checkbox" id="mig-${p.id}" onchange="toggleMigScope('${p.id}'); updatePreview('migrations')">
              <div class="toggle-track"></div><div class="toggle-thumb"></div>
            </label>
          </div>
          <div id="mig-scope-row-${p.id}" style="display:none;margin-top:8px">
            <input type="text" id="mig-scope-${p.id}" placeholder="Affected modules — e.g. AuthFeature, HomeFeature" oninput="updatePreview('migrations')" style="width:100%;font-size:12px">
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="showPreview(generateMigrationsMD()); document.getElementById('previewPanel').classList.remove('collapsed')">👁 Preview MD</button>
      <button class="btn btn-success" onclick="saveStep('migrations')">💾 Save MIGRATION_RULES.md</button>
      <button class="btn btn-secondary" onclick="goTo('modules')">Next →</button>
    </div>
  </div>`;
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
  const vmRule     = `MVVM — ${stateRule}`;
  const asyncRule  = asyncLibs.includes('async/await') || asyncLibs.length === 0 ? 'async/await + Task' : asyncLibs[0];
  const diRule     = di === 'Manual' ? 'Constructor injection — no singletons'
                   : `${di} — register at app startup`;

  return `| Layer | Rule |
|-------|------|
| UI | ${uiRule} |
| ViewModel | ${vmRule} |
| Data | Repository + RemoteDataSource / LocalDataSource |
| DI | ${diRule} |
| Async | ${asyncRule} |`;
}

function generateMigrationsMD() {
  const has   = id => document.getElementById('mig-' + id)?.checked;
  const scope = id => { const v = document.getElementById('mig-scope-' + id)?.value.trim(); return v ? `\n> **Affected modules:** ${v}\n` : ''; };

  const objcBlock = has('objc') ? `
## Objective-C Files
${scope('objc')}
- Do not convert Objective-C to Swift unless the task explicitly instructs it.
- When touching an ObjC file: write new logic in a separate Swift file that ObjC calls via \`@objc\` bridge.
- Do not add Swift-specific patterns inside \`.m\` files.
` : '';

  const uikitBlock = has('uikit') ? `
## UIKit ViewControllers → SwiftUI
${scope('uikit')}
- Do not rewrite existing UIKit screens to SwiftUI unless the task scopes it.
- When touching a UIViewController: keep it in UIKit. Add a ViewModel if none exists, but do not change the VC structure.
- New features added to a UIKit screen live in a ViewModel — not in the VC.
- If wrapping in SwiftUI is required: use \`UIViewControllerRepresentable\`.

\`\`\`swift
// ❌ Rewriting UIKit VC to SwiftUI without a ticket
struct HomeView: View { ... }  // banned if HomeViewController already exists

// ✅ Add ViewModel alongside existing VC
class HomeViewController: UIViewController {
    private let viewModel: HomeViewModel  // inject via init — new addition OK
}
\`\`\`
` : '';

  const combineBlock = has('combine') ? `
## Combine → async/await
${scope('combine')}
- Do not add new Combine pipelines. Do not remove existing ones.
- When touching a file with Combine: write all new async logic using async/await.
- If new logic must interact with existing Combine: use \`AsyncPublisher\` or \`values\` property.

\`\`\`swift
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
\`\`\`
` : '';

  const rxBlock = has('rxswift') ? `
## RxSwift → async/await
${scope('rxswift')}
- Do not add new RxSwift chains. Do not remove existing ones.
- When touching a file with RxSwift: write all new async logic using async/await.
- Bridge only when required: \`Observable.values\` or wrap in \`withCheckedThrowingContinuation\`.
` : '';

  const callbackBlock = has('callbacks') ? `
## Completion Handlers → async/await
${scope('callbacks')}
- Do not add new completion-handler-based APIs. Do not change existing ones.
- When adding new functions that call existing callback APIs: wrap in \`withCheckedContinuation\`.

\`\`\`swift
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
\`\`\`
` : '';

  const delegateBlock = has('delegates') ? `
## Delegate Pattern → Closures / async/await
${scope('delegates')}
- Do not add new delegate protocols for data passing. Use closures or async/await.
- Existing delegate implementations: leave untouched unless the task scopes them.
- New data-passing between ViewControllers or Views: use \`@escaping\` closure or \`async\` function.
` : '';

  const singletonBlock = has('singleton') ? `
## Singleton Managers → Constructor Injection
${scope('singleton')}
- Do not add new singleton \`shared\` instances.
- When touching a class that uses a singleton: inject the dependency via constructor in new code you add.
- Do not refactor the singleton itself unless the task scopes it.

\`\`\`swift
// ❌ Using singleton in new code
class NewViewModel {
    func load() { AuthManager.shared.getToken() }  // banned
}

// ✅ Inject the dependency
class NewViewModel {
    private let authManager: AuthManaging
    init(authManager: AuthManaging) { self.authManager = authManager }
}
\`\`\`
` : '';

  const userDefaultsBlock = has('userdef') ? `
## Direct UserDefaults → Repository / DataSource
${scope('userdef')}
- Do not add new direct \`UserDefaults\` access in ViewModels or Views.
- All preference reads/writes go through a \`PreferencesRepository\` or \`PreferencesDataSource\`.
- Do not migrate existing direct access unless the task scopes it.
` : '';

  const hasAny = ['objc','uikit','combine','rxswift','callbacks','delegates','singleton','userdef'].some(has);

  return `# Migration Rules
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
${hasAny ? [objcBlock, uikitBlock, combineBlock, rxBlock, callbackBlock, delegateBlock, singletonBlock, userDefaultsBlock].join('') : '\n_No legacy patterns selected._\n'}

## New Screens and Features

${generateNewScreensTable()}

---

## Scope Guard

The agent does not apply migration rules to code it did not add or modify.
If the agent notices a violation in untouched code, it logs it in the completion
report under "Follow-up recommended" with the file path and line number.
`;
}

// ══════════════════════════════════════════════════════
//  MODULES STEP
// ══════════════════════════════════════════════════════
function buildModulesScreen(fp) {
  fp.innerHTML += `
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
  </div>`;
  addModuleRow({ name: 'AppCore',     path: 'Sources/AppCore/',    pattern: 'Repository', keywords: 'core, shared, common, util' });
  addModuleRow({ name: 'AuthFeature', path: 'Sources/AuthFeature/', pattern: 'MVVM',       keywords: 'login, logout, auth, session, token' });
}

let moduleCounter = 0;
function addModuleRow(defaults = {}) {
  const id  = ++moduleCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'module-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('module-row-${id}').remove(); updatePreview('modules')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Module / Target name</label>
        <input type="text" class="mod-name" value="${esc(defaults.name||'')}" placeholder="AuthFeature" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Path</label>
        <input type="text" class="mod-path" value="${esc(defaults.path||'')}" placeholder="Sources/AuthFeature/" oninput="updatePreview('modules')"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="form-row"><label>Language</label>
        <select class="mod-lang" onchange="updatePreview('modules')">
          <option>Swift</option><option>Objective-C</option><option>Swift + ObjC</option>
        </select></div>
      <div class="form-row"><label>Pattern</label>
        <select class="mod-pattern" onchange="updatePreview('modules')">
          ${['MVVM','TCA','VIPER','Repository','Infrastructure','Single App'].map(p =>
            `<option${(defaults.pattern||'MVVM')===p?' selected':''}>${p}</option>`).join('')}
        </select></div>
      <div class="form-row"><label>DI</label>
        <select class="mod-di" onchange="updatePreview('modules')">
          <option>Manual</option><option>Resolver</option><option>Swinject</option><option>Needle</option>
        </select></div>
    </div>
    <div class="form-row"><label>Keywords (comma-separated)</label>
      <input type="text" class="mod-keywords" value="${esc(defaults.keywords||'')}" placeholder="home, dashboard, feed" oninput="updatePreview('modules')"></div>
    <div class="form-row"><label>Purpose (one sentence)</label>
      <input type="text" class="mod-purpose" value="${esc(defaults.purpose||'')}" placeholder="Handles user authentication and session management" oninput="updatePreview('modules')"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-row"><label>Key classes (comma-separated)</label>
        <input type="text" class="mod-keyclasses" value="${esc(defaults.keyClasses||'')}" placeholder="AuthViewModel, AuthRepository" oninput="updatePreview('modules')"></div>
      <div class="form-row"><label>Depends on</label>
        <input type="text" class="mod-depends" value="${esc(defaults.depends||'')}" placeholder="AppCore, NetworkKit" oninput="updatePreview('modules')"></div>
    </div>
  `;
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
    const keywords   = row.querySelector('.mod-keywords')?.value.trim()  || '[add keywords]';
    const purpose    = row.querySelector('.mod-purpose')?.value.trim()   || '[describe purpose]';
    const keyClasses = row.querySelector('.mod-keyclasses')?.value.trim()|| '[fill in]';
    const depends    = row.querySelector('.mod-depends')?.value.trim()   || '[fill in]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';
    return `### ${name}

| Field | Value |
|-------|-------|
| Path | \`${path}\` |
| Language | ${lang} |
| Pattern | ${pattern} |
| DI | ${di} |
| Purpose | ${purpose} |
| Keywords | ${keywords} |
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

> Agent: before reading any source file, match the task keywords against the
> Keywords field below. Load the listed context file for every matching module.

## How the Agent Uses This File

1. After routing via \`context/_index.md\`, come here for module paths, key classes, and debt anchors.
2. If a context file is missing: use \`Key classes\` to identify the 5–8 source files to read.
3. After completing a task on a new module: generate \`context/<module>.md\` via \`context/TEMPLATE.md\`.

**Routing lives in \`context/_index.md\`, not here.**

---

## Module Index

${moduleBlocks || '_No modules added yet._'}

<!-- Add one entry per module using the format above. -->
`;
}

function generateIndexMD() {
  const rows     = Array.from(document.querySelectorAll('[id^="module-row-"]'));
  const tableRows = rows.map(row => {
    const name     = row.querySelector('.mod-name')?.value.trim()     || '[module]';
    const keywords = row.querySelector('.mod-keywords')?.value.trim() || '[add keywords]';
    const contextFile = 'context/' + name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.md';
    return `| ${keywords} | ${name} | \`${contextFile}\` |`;
  }).join('\n');

  return `# Context Index
# ─────────────────────────────────────────────────────────────────────────────
# THIS IS THE AUTHORITATIVE ROUTING TABLE.
# ─────────────────────────────────────────────────────────────────────────────

## Keyword Routing Table

| Keywords | Module | Context File |
|----------|--------|--------------|
${tableRows || '| [keywords] | [module] | `context/[module].md` |'}

<!-- Add a row here whenever you add a new context/<module>.md file. -->
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
  addDebtRow({ title: 'Example — replace with real debt', module: 'AuthFeature', status: 'OPEN' });
}

let debtCounter = 0;
function addDebtRow(defaults = {}) {
  const id  = ++debtCounter;
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
        <input type="text" class="debt-title" value="${esc(defaults.title||'')}" placeholder="LoginViewModel uses Combine instead of async/await" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Module</label>
        <input type="text" class="debt-module" value="${esc(defaults.module||'')}" placeholder="AuthFeature" oninput="updatePreview('debt')"></div>
      <div class="form-row"><label>Status</label>
        <select class="debt-status" onchange="updatePreview('debt')">
          <option value="OPEN"${(defaults.status||'OPEN')==='OPEN'?' selected':''}>OPEN</option>
          <option value="SCHEDULED"${defaults.status==='SCHEDULED'?' selected':''}>SCHEDULED</option>
          <option value="RESOLVED"${defaults.status==='RESOLVED'?' selected':''}>RESOLVED</option>
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
  `;
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

${moduleBlocks || '_No debt entries added. Add entries as discovered._'}

---

## Resolved {#resolved}

<!-- Move entries here when fixed. -->
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
          ['test-runner',    'Test Runner',         'XCTest',          ['XCTest','Swift Testing']],
          ['mocking',        'Mocking',             'Manual Mocks',    ['Manual Mocks','Mockingbird','Cuckoo']],
          ['flow-test',      'Async testing',       'XCTestExpectation',['XCTestExpectation','async/await','None']],
          ['assertions',     'Assertions',          'XCTAssert',       ['XCTAssert','Nimble','None']],
          ['coroutines-test','Concurrency helpers', 'None',            ['None','swift-concurrency-extras']],
          ['ui-test',        'UI Tests',            'XCUITest',        ['XCUITest','None']],
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
      ${[['vm','ViewModel','80'],['usecase','UseCase','90'],['repo','Repository','70'],['util','Utility functions','80']]
        .map(([id, label, def]) => `
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
          ['test-rule-one-class',   'One class per test file',              'LoginViewModelTests tests only LoginViewModel', true],
          ['test-rule-no-sleep',    'No XCTestExpectation for coroutines',  'Use async/await test functions with await directly', true],
          ['test-rule-main-actor',  '@MainActor on async test functions',   'Prevents data races when testing @MainActor ViewModels', true],
          ['test-rule-no-mock-struct','Never mock structs or concrete classes','Mock protocols only', true],
          ['test-rule-verify-sparse','Use verify() sparingly',              'Only when testing side effects', true],
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
  ].map(([p, l]) => `| ${p} | ${l} | [version] |`).join('\n');

  const rules = [
    rule('test-rule-one-class')    && '**One class per test file.** `LoginViewModelTests` tests only `LoginViewModel`.',
    rule('test-rule-no-sleep')     && 'Use `async/await` test functions — `func test_xxx() async throws`. No `XCTestExpectation` for coroutine-based code.',
    rule('test-rule-main-actor')   && 'Annotate async test functions with `@MainActor` when testing `@MainActor` ViewModels.',
    rule('test-rule-no-mock-struct')&& 'Mock protocols only. Never mock structs or concrete classes.',
    rule('test-rule-verify-sparse')&& 'Use verification only for side-effect tests — not as a default assertion.',
  ].filter(Boolean).map(r => `- ${r}`).join('\n');

  return `# Testing Standards
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads this whenever a task requires writing tests.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read this file in full before writing any test. Follow every rule exactly.

## Framework Stack

| Purpose | Library | Version |
|---------|---------|---------|
${fwTable}

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

${rules}

### Test Function Naming — \`test_functionName_scenario_expectedResult\`

\`\`\`swift
// ✅ Correct
func test_submitLogin_withInvalidEmail_showsEmailError() async throws
func test_submitLogin_withValidCredentials_navigatesToHome() async throws
func test_loadUser_whenNetworkFails_setsErrorState() async throws

// ❌ Wrong
func testLogin()
func shouldWorkCorrectly()
\`\`\`

---

## Async / Concurrency Testing

\`\`\`swift
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
\`\`\`

---

## Mocking Rules

- Use **protocol mocks** — never mock structs or concrete classes.
- Create \`Mock[Protocol].swift\` files in the test target.
- Stub return values via \`stubbedResult\` property.

\`\`\`swift
// ✅ Protocol mock
final class MockLoginUseCase: LoginUseCase {
    var stubbedResult: Result<User, Error> = .failure(AppError.unknown)
    func execute(email: String, password: String) async -> Result<User, Error> {
        stubbedResult
    }
}

// ❌ Mocking a struct or concrete class — banned
\`\`\`

---

## Coverage Expectations

| Layer | Minimum |
|-------|---------|
| ViewModel | ${cov('vm')}% |
| UseCase | ${cov('usecase')}% |
| Repository | ${cov('repo')}% |
| Utility functions | ${cov('util')}% |
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
  addEntityRow({ name: 'User', fields: 'id: String, email: String, displayName: String, createdAt: Date' });
}

let entityCounter = 0;
function addEntityRow(defaults = {}) {
  const id  = ++entityCounter;
  const row = document.createElement('div');
  row.className = 'dynamic-item'; row.id = 'entity-row-' + id;
  row.innerHTML = `
    <button class="remove-btn" onclick="document.getElementById('entity-row-${id}').remove(); updatePreview('datamodel')">✕</button>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">
      <div class="form-row"><label>Entity Name</label>
        <input type="text" class="entity-name" value="${esc(defaults.name||'')}" placeholder="User" oninput="updatePreview('datamodel')"></div>
      <div class="form-row"><label>Fields (comma-separated: name: Type)</label>
        <input type="text" class="entity-fields" value="${esc(defaults.fields||'')}" placeholder="id: String, email: String, createdAt: Date" oninput="updatePreview('datamodel')"></div>
    </div>`;
  document.getElementById('entities-list').appendChild(row);
  updatePreview('datamodel');
}

let endpointCounter = 0;
function addEndpointRow(defaults = {}) {
  const id  = ++endpointCounter;
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
    const name   = row.querySelector('.entity-name')?.value.trim()   || 'Entity';
    const fields = row.querySelector('.entity-fields')?.value.trim() || 'id: String';
    const parsedFields = fields.split(',').map(f => {
      const parts = f.trim().split(':');
      return { fname: (parts[0]||'field').trim(), ftype: (parts[1]||'String').trim() };
    });
    const fieldLines = parsedFields.map(({ fname, ftype }) => `    let ${fname}: ${ftype}`).join('\n');
    const fieldTable = parsedFields.map(({ fname, ftype }) => `| \`${fname}\` | \`${ftype}\` | [add rule] |`).join('\n');
    return `### ${name}

\`\`\`swift
struct ${name}: Codable, Equatable {
${fieldLines}
}
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

> Agent: load this file for tasks involving domain models, DB schema, or layer mapping rules.
> API contracts (request/response shapes) live in context/<module>.md — not here.
> The mapping rules below are non-negotiable — never expose DTOs or DB entities to the View layer.

---

## Mapping Conventions

\`\`\`
Network DTO (Codable)  ──→  Domain model (pure Swift)  ──→  UI model / ViewState
DB Entity (@Model)     ──→  Domain model               ──→  UI model / ViewState
\`\`\`

| Mapping | Where it happens | Example |
|---------|-----------------|---------|
| Network DTO → Domain | \`*RemoteDataSource.swift\` or \`*Mapper.swift\` | \`AuthMapper.swift\` |
| DB Entity → Domain | \`*LocalDataSource.swift\` | \`UserMapper.swift\` |
| Domain → UI model | ViewModel or \`*UiMapper.swift\` | \`UserViewMapper.swift\` |

### Anti-patterns (agent must never do these)

\`\`\`swift
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
\`\`\`

---

## Domain Entities

${entities || '_No entities added yet._'}

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
        "Documenting only the \"what\" without the \"why\"",
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
  },

  onConfigLoaded: (text) => {
    const get    = key => text.match(new RegExp(`^${key}:\\s*(.+)`, 'm'))?.[1]?.trim() ?? '';
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
    const schemeMatches = [...text.matchAll(/^#\s{2,4}(\w+):\s+(\S+)(?:\s+#\s*(.+))?$/gm)];
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
      { id: 'no-force-unwrap',   label: 'No force unwrap (`!`) — use `guard let`, `if let`, or `??`' },
      { id: 'no-dispatch-main',  label: 'No `DispatchQueue.main` in ViewModel — use `@MainActor`' },
      { id: 'no-biz-view',       label: 'No business logic in View or ViewController' },
      { id: 'no-userdefaults',   label: 'No `UserDefaults` direct access — use storage abstraction' },
      { id: 'exhaustive-switch', label: 'All `switch` on enums are exhaustive — no `default` on known types' },
      { id: 'test-naming',       label: 'Tests follow `test_functionName_scenario_expectedResult` naming' },
    ],
  },
};
