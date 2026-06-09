#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  generate-embedded.js  —  MAINTAINER-ONLY build step. NOT shipped to users.
// ─────────────────────────────────────────────────────────────────────────────
//
//  Single source of truth lives in the clean, editable files listed in MAP
//  below (CLAUDE.md, hooks/**, task & context templates). The wizard, however,
//  ships those file contents as EMBEDDED_* template-literal constants inside
//  engine/wizard-core.js so the browser wizard can write them to a project's
//  agent-artifacts/ folder without filesystem access to the agent-sdd/ tool.
//
//  This script is the FORWARD generator: it reads each source file, escapes it
//  for a JS template literal, and rewrites the matching `const EMBEDDED_* = ` ... `
//  block in wizard-core.js. It also stamps the version from the VERSION file
//  into CLAUDE.md's {{SDD_VERSION}} placeholder and emits a SKELETON_VERSION
//  constant the wizard uses for update detection.
//
//  Workflow for maintainers:
//    1. Edit the clean source files (CLAUDE.md, hooks/scripts/*.sh, etc.).
//    2. Bump agent-sdd/VERSION if the change should notify existing projects.
//    3. Run:  node agent-sdd/engine/generate-embedded.js
//    4. Commit the regenerated wizard-core.js alongside your source edits.
//
//  End users NEVER run this — the wizard only reads the already-embedded
//  constants. No Node footprint is added to the project being set up.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // agent-sdd/
const WIZARD = path.join(ROOT, 'engine', 'wizard-core.js');
const WIZARD_HTML = path.join(ROOT, 'setup-wizard.html');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const CHANGELOG_FILE = path.join(ROOT, 'CHANGELOG.md');

// const name  →  source file (relative to agent-sdd/)
const MAP = {
  EMBEDDED_PLATFORM_ANDROID:   'engine/platform-android.js',
  EMBEDDED_PLATFORM_IOS:       'engine/platform-ios.js',
  EMBEDDED_CLAUDE_MD:          'CLAUDE.md',
  EMBEDDED_TASK_TEMPLATE:      'tasks/TASK_TEMPLATE.md',
  EMBEDDED_BOOTSTRAP_TEMPLATE: 'tasks/BOOTSTRAP_TEMPLATE.md',
  EMBEDDED_CONTEXT_TEMPLATE:   'context/TEMPLATE.md',
  EMBEDDED_CONTEXT_INDEX:      'context/_index.md',
  EMBEDDED_SKILLS_INDEX:       'skills/_index.md',
  EMBEDDED_SKILL_ADA:          'skills/ada.md',
  EMBEDDED_SKILL_ANALYTICS:    'skills/analytics.md',
  EMBEDDED_HOOKS_SETTINGS:     'hooks/settings.json',
  EMBEDDED_GIT_GUARD_SH:       'hooks/scripts/git-guard.sh',
  EMBEDDED_PROTECTED_PATHS_SH: 'hooks/scripts/protected-paths.sh',
  EMBEDDED_LINT_GATE_SH:       'hooks/scripts/lint-gate.sh',
  EMBEDDED_DONE_GATE_SH:       'hooks/scripts/done-gate.sh',
};

// Escape a raw string so it survives inside a JS template literal (`...`).
// Order matters: backslash first, then backtick, then ${ interpolation.
function escapeForTemplate(s) {
  return s
    .replace(/\\/g, '\\\\')   // \  → \\
    .replace(/`/g, '\\`')     // `  → \`
    .replace(/\$\{/g, '\\${'); // ${ → \${
}

// Replace `const NAME = \`...\`` in the source, scanning for the matching
// UNESCAPED closing backtick so backticks inside the literal don't fool us.
function replaceConst(js, name, escapedBody) {
  const marker = 'const ' + name + ' = `';
  const start = js.indexOf(marker);
  if (start < 0) throw new Error('const not found in wizard-core.js: ' + name);

  let i = start + marker.length;
  while (i < js.length) {
    const c = js[i];
    if (c === '\\') { i += 2; continue; }   // skip escaped char
    if (c === '`') break;                   // unescaped backtick = closing delimiter
    i++;
  }
  if (i >= js.length) throw new Error('unterminated template literal for: ' + name);

  const bodyStart = start + marker.length;
  const before = js.slice(0, bodyStart);
  const after = js.slice(i);                // includes the closing backtick
  return before + escapedBody + after;
}

// Parse CHANGELOG.md into { "<version>": { date, notes: [...] } }. Only numbered
// version headings (## 1.2 — date) are captured; prose sections like "Unreleased"
// are skipped so in-progress notes don't leak into a release.
function parseChangelog(md) {
  const out = {};
  let cur = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^##\s+(\d+(?:\.\d+)+)\s*[—-]\s*(.*)$/);
    if (h) { cur = h[1]; out[cur] = { date: h[2].trim(), notes: [] }; continue; }
    if (/^##\s/.test(line)) { cur = null; continue; }   // non-version section
    if (cur) {
      const b = line.match(/^\s*[-*]\s+(.*\S)\s*$/);
      if (b) out[cur].notes.push(b[1].trim());
      else if (out[cur].notes.length && /\S/.test(line)) {
        // continuation line of the previous bullet (wrapped text)
        out[cur].notes[out[cur].notes.length - 1] += ' ' + line.trim();
      }
    }
  }
  return out;
}

// Insert or update `const SKELETON_CHANGELOG = {...};` (single line) right after
// the SKELETON_VERSION declaration.
function setSkeletonChangelog(js, obj) {
  const decl = `const SKELETON_CHANGELOG = ${JSON.stringify(obj)};`;
  const re = /^const SKELETON_CHANGELOG = .*;$/m;
  if (re.test(js)) return js.replace(re, decl);

  const vre = /^const SKELETON_VERSION = '[^']*';$/m;
  const mt = js.match(vre);
  if (!mt) throw new Error('SKELETON_VERSION not found to anchor SKELETON_CHANGELOG');
  const idx = js.indexOf(mt[0]) + mt[0].length;
  return js.slice(0, idx) +
    `\n// What's-new notes per version, parsed from agent-sdd/CHANGELOG.md.\n` +
    `// The wizard shows the relevant entries in the "Update available" banner.\n` +
    decl +
    js.slice(idx);
}

// Insert or update `const SKELETON_VERSION = '...';` just above EMBEDDED_CLAUDE_MD.
function setSkeletonVersion(js, version) {
  const decl = `const SKELETON_VERSION = '${version}';`;
  const re = /const SKELETON_VERSION = '[^']*';/;
  if (re.test(js)) return js.replace(re, decl);

  const anchor = 'const EMBEDDED_CLAUDE_MD = `';
  const idx = js.indexOf(anchor);
  if (idx < 0) throw new Error('cannot find EMBEDDED_CLAUDE_MD anchor to insert SKELETON_VERSION');
  return js.slice(0, idx) +
    `// Skeleton version — stamped from agent-sdd/VERSION by generate-embedded.js.\n` +
    `// The wizard writes this into agent-artifacts/.sdd-version and compares it\n` +
    `// against the stored manifest to flag projects with an outdated snapshot.\n` +
    decl + '\n' +
    js.slice(idx);
}

function main() {
  const version = fs.readFileSync(VERSION_FILE, 'utf8').trim();
  if (!version) throw new Error('VERSION file is empty');

  let js = fs.readFileSync(WIZARD, 'utf8');

  for (const [name, rel] of Object.entries(MAP)) {
    let content = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    // Stamp the live version into CLAUDE.md's placeholder so the snapshot
    // written to agent-artifacts/ carries a concrete version number.
    if (name === 'EMBEDDED_CLAUDE_MD') {
      content = content.replace(/\{\{SDD_VERSION\}\}/g, version);
    }

    js = replaceConst(js, name, escapeForTemplate(content));
    console.log('embedded', name, '←', rel, `(${content.length} chars)`);
  }

  js = setSkeletonVersion(js, version);

  // Embed the changelog so the wizard can show "what's new" in the update banner.
  const changelog = fs.existsSync(CHANGELOG_FILE)
    ? parseChangelog(fs.readFileSync(CHANGELOG_FILE, 'utf8'))
    : {};
  js = setSkeletonChangelog(js, changelog);
  console.log('changelog versions:', Object.keys(changelog).join(', ') || '(none)');

  fs.writeFileSync(WIZARD, js);
  console.log(`\nSKELETON_VERSION = ${version}`);

  // ── Inline wizard-core.js into setup-wizard.html ────────────────────────────
  //  Opening a `file://` HTML that loads a sibling JS via <script src> is blocked
  //  by Chrome's security sandbox (ERR_ACCESS_DENIED). Fix: replace the external
  //  <script src="engine/wizard-core.js"> with an inline <script> block so the
  //  HTML is a self-contained, single-file artifact — no server needed.
  //
  //  Source files (wizard-core.js, setup-wizard.html) stay separate for editing;
  //  this step merges them at generate time. setup-wizard.html is the deliverable.
  // ────────────────────────────────────────────────────────────────────────────
  const SCRIPT_TAG_RE = /<script\s+src=["']engine\/wizard-core\.js["']\s*><\/script>/;
  let html = fs.readFileSync(WIZARD_HTML, 'utf8');

  if (!SCRIPT_TAG_RE.test(html)) {
    // Already inlined by a previous run — the <script src> has been replaced.
    // Re-inline by extracting between the sentinel comments or just replace the
    // block. For simplicity we re-read the final js and replace any existing
    // inline block delimited by our markers.
    const BEGIN = '<!-- wizard-core:inline -->';
    const END   = '<!-- /wizard-core:inline -->';
    const bi = html.indexOf(BEGIN);
    const ei = html.indexOf(END);
    if (bi >= 0 && ei >= 0) {
      html = html.slice(0, bi) +
             BEGIN + `\n<script>\n${js}\n</script>\n` +
             END +
             html.slice(ei + END.length);
    } else {
      console.warn('WARNING: could not locate wizard-core.js script tag or inline markers in setup-wizard.html — skipping HTML inline step.');
    }
  } else {
    html = html.replace(
      SCRIPT_TAG_RE,
      `<!-- wizard-core:inline -->\n<script>\n${js}\n</script>\n<!-- /wizard-core:inline -->`
    );
  }

  fs.writeFileSync(WIZARD_HTML, html);
  console.log('inlined wizard-core.js → setup-wizard.html (standalone, file:// safe)');
  console.log('DONE — wizard-core.js regenerated. Run `node --check` and commit.');
}

main();
