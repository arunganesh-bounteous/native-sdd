#!/usr/bin/env node
/**
 * companion.js — SDD Claude Companion
 *
 * A tiny HTTP server that lets the setup wizard run the `claude` CLI on your
 * behalf and stream the output back in real time.
 *
 * Usage — from your project root (the folder the wizard's "Select Project" points at):
 *
 *   node agent-sdd/companion.js
 *
 * If your agent-sdd copy lives outside the project, pass the project path explicitly:
 *
 *   node /tools/agent-sdd/companion.js --project /path/to/MyProject
 *
 * The server listens on http://localhost:7842
 * Keep it running while you use the wizard. Ctrl+C to stop.
 *
 * Endpoints:
 *   GET  /health  → { ok: true, projectRoot: "...", agentSddRoot: "...", version: "1.0" }
 *   POST /run     → SSE stream; body: { "taskPath": "agent-sdd-output/tasks/PROJ-1234.md" }
 *
 * Requirements:
 *   - Node.js 18+ (uses built-in http, child_process, path, url)
 *   - `claude` CLI must be on your PATH  (installed via `npm i -g @anthropic-ai/claude-code`)
 */

'use strict';

const http         = require('http');
const fs           = require('fs');
const { spawn }    = require('child_process');
const path         = require('path');
const { URL }      = require('url');

const PORT        = 7842;
const AGENT_SDD   = path.dirname(__filename);            // always the agent-sdd/ folder
const CLAUDE_MD   = path.join(AGENT_SDD, 'CLAUDE.md');  // absolute path to CLAUDE.md
const CLAUDE_BIN  = process.env.CLAUDE_BIN || 'claude';

// ─── Resolve project root ─────────────────────────────────────────────────────
// Priority:
//   1. --project <path> CLI flag  (explicit override)
//   2. Parent of this file        (standard: companion.js lives inside agent-sdd/ which is inside project)
// The project root must contain agent-sdd-output/ (or will create it on first save).
function resolveProjectRoot() {
  const flagIdx = process.argv.indexOf('--project');
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    const p = path.resolve(process.argv[flagIdx + 1]);
    if (!fs.existsSync(p)) {
      console.error(`\n❌  --project path does not exist: ${p}\n`);
      process.exit(1);
    }
    return p;
  }
  // Default: parent of agent-sdd/ folder
  return path.dirname(AGENT_SDD);
}

const PROJECT_ROOT = resolveProjectRoot();

// ─── CORS headers (wizard is a local file:// page) ───────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { ...CORS, 'Content-Type': 'application/json' });
  res.end(body);
}

function sseHead(res) {
  res.writeHead(200, {
    ...CORS,
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── /run handler ─────────────────────────────────────────────────────────────
function handleRun(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let taskPath;
    try {
      taskPath = JSON.parse(body).taskPath;
    } catch (_) { /* handled below */ }

    if (!taskPath) {
      return json(res, 400, { error: 'Missing taskPath in request body' });
    }

    // Resolve task path against the project root
    const absTask = path.isAbsolute(taskPath)
      ? taskPath
      : path.resolve(PROJECT_ROOT, taskPath);

    if (!fs.existsSync(absTask)) {
      return json(res, 400, { error: `Task file not found: ${absTask}` });
    }

    // The prompt uses the absolute path to CLAUDE.md (works even when agent-sdd is outside project)
    // and the absolute task path.
    const prompt = `Read ${CLAUDE_MD} and execute ${absTask}`;

    sseHead(res);
    sseWrite(res, 'start', { projectRoot: PROJECT_ROOT, taskPath: absTask });

    const proc = spawn(CLAUDE_BIN, [
      '--print',
      '--dangerously-skip-permissions',
      prompt,
    ], {
      cwd: PROJECT_ROOT,           // ← claude runs with the project as its working directory
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', chunk => {
      sseWrite(res, 'chunk', { text: chunk.toString() });
    });

    proc.stderr.on('data', chunk => {
      sseWrite(res, 'chunk', { text: chunk.toString(), stderr: true });
    });

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        sseWrite(res, 'error', {
          message: `"${CLAUDE_BIN}" not found on PATH.\nMake sure Claude Code CLI is installed:\n  npm install -g @anthropic-ai/claude-code`,
        });
      } else {
        sseWrite(res, 'error', { message: err.message });
      }
      res.end();
    });

    proc.on('close', code => {
      sseWrite(res, 'done', { exitCode: code ?? 0 });
      res.end();
    });

    // If the browser disconnects, kill the claude process
    req.on('close', () => {
      if (!proc.killed) proc.kill('SIGTERM');
    });
  });
}

// ─── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && pathname === '/health') {
    return json(res, 200, {
      ok:           true,
      projectRoot:  PROJECT_ROOT,
      projectName:  path.basename(PROJECT_ROOT),
      agentSddRoot: AGENT_SDD,
      version:      '1.0',
    });
  }

  if (req.method === 'POST' && pathname === '/run') {
    return handleRun(req, res);
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ SDD Companion running on http://localhost:${PORT}`);
  console.log(`   Project root  : ${PROJECT_ROOT}`);
  console.log(`   agent-sdd/    : ${AGENT_SDD}`);
  console.log(`   Claude CLI    : ${CLAUDE_BIN}`);
  if (PROJECT_ROOT === path.dirname(AGENT_SDD)) {
    console.log(`   Mode          : standard (agent-sdd is inside the project)`);
  } else {
    console.log(`   Mode          : external (agent-sdd lives outside the project)`);
  }
  console.log('\n   Open setup-wizard.html in Chrome, select your project folder, and start building.');
  console.log('   Press Ctrl+C to stop.\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use.`);
    console.error(`   Another companion instance may already be running.\n`);
  } else {
    console.error('\n❌  Server error:', err.message);
  }
  process.exit(1);
});
