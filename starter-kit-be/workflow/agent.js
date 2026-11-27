#!/usr/bin/env node
// agent.js: quản lý phiên (session) và đánh thức chạy ngầm cho Coder/Tester dùng `claude` hoặc `agy` CLI trên Linux.
// Lưu session ID vào workflow/.run/sessions/<id>.json để Master hoặc watch.sh gọi lại đúng phiên cũ,
// tự tạo phiên mới khi chưa có hoặc khi có yêu cầu (--new / lệnh `new <id>`).
// Đồng bộ .run/<id>.pid, .run/<id>.job, .run/<id>.hist và workflow/logs/ để monitor.js hiển thị chính xác.
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const EXIT_OK = 0;
const EXIT_ARGS = 1;
const EXIT_STATE = 3;
const EXIT_ENV = 4;

const DEFAULT_TIMEOUT_MINUTES = 60;
const DEFAULT_WAIT_POLL_MS = 2000;
const DEFAULT_LOG_LINES = 40;
const STOP_GRACE_MS = 3000;
const WAKE_INIT_POLL_MS = 150;
const WAKE_INIT_WAIT_MS = 3500;
const MAX_RESPONSE_PREVIEW_CHARS = 4000;
const MAX_SESSION_HISTORY = 20;

const ROOT = resolveRoot();
const WORKFLOW_DIR = path.join(ROOT, 'workflow');
const RUN_DIR = path.join(WORKFLOW_DIR, '.run');
const SESSIONS_DIR = path.join(RUN_DIR, 'sessions');
const LOGS_DIR = path.join(WORKFLOW_DIR, 'logs');
const AGENTS_FILE = path.join(WORKFLOW_DIR, 'agents.txt');

function resolveRoot() {
  try {
    const out = cp.execFileSync('git', ['-C', __dirname, 'worktree', 'list', '--porcelain'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });
    const first = out.split(/\r?\n/).find(l => l.startsWith('worktree '));
    if (first) return first.slice('worktree '.length).trim();
  } catch {}
  try {
    return cp.execFileSync('git', ['-C', __dirname, 'rev-parse', '--show-toplevel'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return path.resolve(__dirname, '..');
  }
}

function nowIsoLocal() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function nowCompactHist() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function logTimestampPrefix() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function fail(message, code = EXIT_ARGS) {
  console.error(`[agent.js] Lỗi: ${message}`);
  process.exit(code);
}

function ensureDirs() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPidFile(id) {
  const raw = readText(path.join(RUN_DIR, `${id}.pid`)).trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isAgentRunning(id) {
  const pid = readPidFile(id);
  if (!pid) return false;
  if (isPidAlive(pid)) return true;
  // Dọn file .pid cũ nếu tiến trình đã tắt đột ngột.
  try { fs.unlinkSync(path.join(RUN_DIR, `${id}.pid`)); } catch {}
  return false;
}

// Tách dòng lệnh theo shell cơ bản (hỗ trợ ngoặc đơn/kép và backslash) để giữ nguyên các tham số có khoảng trắng.
function splitShellArgs(raw) {
  const args = [];
  let cur = '';
  let quote = null;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escape = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) { args.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) args.push(cur);
  return args;
}

function readAgents() {
  if (!fs.existsSync(AGENTS_FILE)) {
    fail(`Thiếu ${AGENTS_FILE}. Hãy cài workflow trước.`, EXIT_ENV);
  }
  const lines = readText(AGENTS_FILE).split(/\r?\n/);
  const agents = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/);
    if (!match) continue;
    agents.push({
      id: match[1],
      role: match[2],
      mode: match[3],
      cmdLine: (match[4] || '').trim(),
    });
  }
  return agents;
}

function findAgentOrFail(id) {
  if (!id) fail('Thiếu <id> của agent.');
  const agent = readAgents().find(a => a.id === id);
  if (!agent) {
    fail(`Không tìm thấy '${id}' trong workflow/agents.txt.`, EXIT_ARGS);
  }
  return agent;
}

function detectToolConfig(agent) {
  const tokens = splitShellArgs(agent.cmdLine);
  const envVars = {};
  let idx = 0;

  // Hỗ trợ khai báo env đầu lệnh như `env CLAUDE_CONFIG_DIR=... claude ...` hoặc `FOO=bar claude ...`.
  if (tokens[0] === 'env') idx = 1;
  while (idx < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[idx])) {
    const eq = tokens[idx].indexOf('=');
    envVars[tokens[idx].slice(0, eq)] = tokens[idx].slice(eq + 1);
    idx++;
  }

  const bin = tokens[idx] || '';
  const baseBin = path.basename(bin);
  if (baseBin !== 'claude' && baseBin !== 'agy') {
    fail(
      `Agent '${agent.id}' (mode: ${agent.mode}) không cấu hình CLI 'claude' hoặc 'agy' trong workflow/agents.txt (hiện có: '${agent.cmdLine || '(trống)'}').`,
      EXIT_ENV
    );
  }

  return {
    tool: baseBin,
    bin,
    envVars,
    rawArgs: tokens.slice(idx + 1),
  };
}

function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (!/^---/.test(lines[0] || '')) return {};
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    if (/^---/.test(lines[i])) break;
    const m = lines[i].match(/^([A-Za-z_]+):(.*)$/);
    if (m) {
      out[m[1]] = m[2]
        .replace(/\s#(\s.*)?$/, '')
        .trim()
        .replace(/^(["'])(.*)\1$/, '$2');
    }
  }
  return out;
}

function scanWaitingFiles(agentId) {
  if (!fs.existsSync(WORKFLOW_DIR)) return [];
  const results = [];
  const entries = fs.readdirSync(WORKFLOW_DIR).filter(n => /^F-\d+/.test(n)).sort();
  for (const dir of entries) {
    const featureDir = path.join(WORKFLOW_DIR, dir);
    let stat;
    try { stat = fs.statSync(featureDir); } catch { continue; }
    if (!stat.isDirectory()) continue;

    const candidates = [path.join(featureDir, 'SPEC.md')];
    for (const sub of ['tasks', 'questions', 'bugs']) {
      const subDir = path.join(featureDir, sub);
      if (!fs.existsSync(subDir)) continue;
      for (const f of fs.readdirSync(subDir).filter(n => n.endsWith('.md')).sort()) {
        candidates.push(path.join(subDir, f));
      }
    }

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const fm = frontmatter(readText(filePath));
      if ((fm.to || 'none') === agentId) {
        results.push(path.relative(WORKFLOW_DIR, filePath));
      }
    }
  }
  return results;
}

function jobLabelOf(files) {
  const labels = [];
  for (const rel of files) {
    const m = rel.match(/^(F-\d+)[^/]*\/[a-z]+\/([^/]+)\.md$/);
    if (m) labels.push(`${m[1]} ${m[2]}`);
    else {
      const fMatch = rel.match(/^(F-\d+)/);
      if (fMatch) labels.push(fMatch[1]);
    }
  }
  return [...new Set(labels)].join(', ');
}

function sessionFilePath(id) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

function loadSession(id) {
  return readJson(sessionFilePath(id));
}

function upsertSessionHistory(history, entry) {
  if (!entry || !entry.sessionId) return Array.isArray(history) ? history : [];
  const list = Array.isArray(history) ? history.filter(h => h && h.sessionId && h.sessionId !== entry.sessionId) : [];
  const prev = Array.isArray(history) ? history.find(h => h && h.sessionId === entry.sessionId) : null;
  const merged = {
    sessionId: entry.sessionId,
    tool: entry.tool || (prev && prev.tool) || '',
    createdAt: (prev && prev.createdAt) || entry.createdAt || nowIsoLocal(),
    lastUsedAt: entry.lastUsedAt || (prev && prev.lastUsedAt) || nowIsoLocal(),
    lastTask: entry.lastTask || (prev && prev.lastTask) || '',
    turnCount: typeof entry.turnCount === 'number' ? entry.turnCount : ((prev && prev.turnCount) || 0),
  };
  return [merged, ...list].slice(0, MAX_SESSION_HISTORY);
}

function saveSession(id, patch) {
  const current = loadSession(id) || {};
  const next = { ...current, ...patch, id };
  if (next.sessionId) {
    next.history = upsertSessionHistory(current.history, {
      sessionId: next.sessionId,
      tool: next.tool,
      createdAt: next.createdAt || current.createdAt,
      lastUsedAt: next.lastUsedAt || nowIsoLocal(),
      lastTask: next.lastTask,
      turnCount: typeof patch.sessionTurnCount === 'number' ? patch.sessionTurnCount : undefined,
    });
  }
  delete next.sessionTurnCount;
  writeJsonAtomic(sessionFilePath(id), next);
  return next;
}

function acquireAgentLock(id) {
  ensureDirs();
  const lockPath = path.join(RUN_DIR, `${id}.lock`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: nowIsoLocal() }) + '\n', 'utf8');
      fs.closeSync(fd);
      return () => {
        try { fs.unlinkSync(lockPath); } catch {}
      };
    } catch (err) {
      if (err && err.code !== 'EEXIST') throw err;
      const existing = readJson(lockPath);
      if (existing && isPidAlive(existing.pid)) {
        fail(`Agent '${id}' đang có tiến trình khởi chạy khác giữ khoá (pid ${existing.pid}).`, EXIT_STATE);
      }
      // Khoá mồ côi do tiến trình trước chết ngang: dọn rồi thử lại một lần.
      try { fs.unlinkSync(lockPath); } catch {}
    }
  }
  fail(`Không lấy được khoá cho '${id}'.`, EXIT_STATE);
}

// Chuẩn hoá cờ từ agents.txt để tránh đụng với cờ resume/session/output-format/print do script quản lý.
function stripManagedArgs(tool, rawArgs, overrides) {
  const cleaned = [];
  const skipWithVal = new Set(['--output-format', '--resume', '-r', '--conversation', '--session-id']);
  if (overrides.model) skipWithVal.add('--model');
  if (overrides.effort) skipWithVal.add('--effort');
  if (tool === 'claude') skipWithVal.add('--permission-mode');
  if (tool === 'agy') skipWithVal.add('--mode');

  let hasPermFlag = false;
  let permFlagArgs = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '-p' || a === '--print' || a === '-i' || a === '--prompt-interactive' || a === '-c' || a === '--continue' || a === '--verbose') {
      continue;
    }
    if (a.startsWith('-p=') || a.startsWith('--print=') || a.startsWith('--prompt=')) {
      continue;
    }
    if (tool === 'claude' && (a === '--permission-mode' || a === '--dangerously-skip-permissions')) {
      hasPermFlag = true;
      if (a === '--permission-mode' && i + 1 < rawArgs.length) {
        permFlagArgs = ['--permission-mode', rawArgs[++i]];
      } else if (a.startsWith('--permission-mode=')) {
        permFlagArgs = [a];
      } else {
        permFlagArgs = [a];
      }
      continue;
    }
    if (tool === 'agy' && (a === '--mode' || a === '--dangerously-skip-permissions')) {
      hasPermFlag = true;
      if (a === '--mode' && i + 1 < rawArgs.length) {
        permFlagArgs = ['--mode', rawArgs[++i]];
      } else if (a.startsWith('--mode=')) {
        permFlagArgs = [a];
      } else {
        permFlagArgs = [a];
      }
      continue;
    }
    const eqKey = a.includes('=') ? a.slice(0, a.indexOf('=')) : null;
    if (eqKey && skipWithVal.has(eqKey)) continue;
    if (skipWithVal.has(a)) {
      if (i + 1 < rawArgs.length) i++;
      continue;
    }
    cleaned.push(a);
  }

  if (!hasPermFlag) {
    permFlagArgs = tool === 'claude'
      ? ['--permission-mode', 'acceptEdits']
      : ['--mode', 'accept-edits'];
  }
  if (overrides.model) cleaned.push('--model', overrides.model);
  if (overrides.effort) cleaned.push('--effort', overrides.effort);

  return [...permFlagArgs, ...cleaned];
}

function buildToolInvocation(toolCfg, sessionState, prompt, opts) {
  const forceNew = Boolean(opts.newSession || (sessionState && sessionState.forceNew));
  const existingId = !forceNew && sessionState && sessionState.sessionId ? sessionState.sessionId : null;
  const extraArgs = stripManagedArgs(toolCfg.tool, toolCfg.rawArgs, opts);

  if (toolCfg.tool === 'claude') {
    const args = ['-p', '--verbose', '--output-format', 'stream-json', ...extraArgs];
    let assignedSessionId = existingId;
    if (existingId) {
      args.push('--resume', existingId);
    } else {
      assignedSessionId = crypto.randomUUID();
      args.push('--session-id', assignedSessionId);
    }
    args.push(prompt);
    return { bin: toolCfg.bin, args, envVars: toolCfg.envVars, isResume: Boolean(existingId), assignedSessionId };
  }

  // agy CLI: cờ -p phải gắn liền (-p=...) để không nuốt tham số phía sau.
  const args = ['--output-format', 'stream-json', ...extraArgs];
  if (existingId) {
    args.push(`--resume=${existingId}`);
  }
  args.push(`-p=${prompt}`);
  return { bin: toolCfg.bin, args, envVars: toolCfg.envVars, isResume: Boolean(existingId), assignedSessionId: existingId };
}

function buildPrompt({ id, role, files, msg, isResume }) {
  const fileList = files.length ? files.join(' ') : '(theo chỉ dẫn bên dưới)';
  const lines = [];
  if (isResume) {
    lines.push(`[Tiếp tục phiên làm việc | ID: ${id} | Vai: ${role} | Thư mục gốc: ${ROOT}]`);
    if (files.length) lines.push(`Các file đang chờ bạn (to: ${id}): ${fileList}`);
    lines.push(`Nhắc: đọc lại trạng thái mới nhất ở ${ROOT}/workflow/ (không sửa bản workflow/ trong worktree), chỉ xử lý các file được giao, xong phần của mình thì đổi to: sang người kế tiếp. Trả lời ngắn (<15 dòng).`);
  } else {
    lines.push(`Đọc AGENTS.md và workflow/roles/${role}.md rồi làm theo.`);
    lines.push(`ID của bạn: ${id}. Vai: ${role}. Thư mục gốc dự án: ${ROOT}.`);
    if (files.length) lines.push(`Các file đang chờ bạn (to: ${id}): ${fileList}.`);
    lines.push(`Chỉ xử lý những file được giao. File trong workflow/ luôn đọc và sửa ở thư mục gốc (${ROOT}/workflow/), không sửa bản trong worktree. Xong phần của mình thì đổi to: sang người kế tiếp. Trả lời ngắn (<15 dòng).`);
  }
  if (msg) {
    lines.push('');
    lines.push(`Lời nhắn từ Master: ${msg}`);
  }
  return lines.join('\n');
}

function notifyOwner(message) {
  const notifyScript = path.join(WORKFLOW_DIR, 'notify.sh');
  if (!fs.existsSync(notifyScript)) return;
  try {
    cp.spawnSync('sh', [notifyScript, message], { cwd: ROOT, stdio: 'ignore', timeout: 10000 });
  } catch {}
}

function createStreamParser(tool, onSessionId, onText, onResult, logStream) {
  let buffer = '';
  let lastWasDelta = false;

  const writeLine = text => {
    if (lastWasDelta) {
      logStream.write('\n');
      lastWasDelta = false;
    }
    logStream.write(text + '\n');
  };

  const handleClaudeLine = obj => {
    if (obj.session_id) onSessionId(obj.session_id);
    if (obj.type === 'system' && obj.subtype === 'init') {
      writeLine(`[init claude session=${obj.session_id || ''}]`);
      return;
    }
    if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
      for (const block of obj.message.content) {
        if (block.type === 'text' && block.text) {
          onText(block.text);
          writeLine(block.text);
        } else if (block.type === 'tool_use') {
          writeLine(`[tool] ${block.name}`);
        }
      }
      return;
    }
    if (obj.type === 'result') {
      onResult({
        sessionId: obj.session_id || null,
        response: typeof obj.result === 'string' ? obj.result : '',
        isError: Boolean(obj.is_error),
        costUsd: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : null,
      });
    }
  };

  const handleAgyLine = obj => {
    if (obj.conversation_id) onSessionId(obj.conversation_id);
    if (obj.event === 'init') {
      writeLine(`[init agy session=${obj.conversation_id || ''}]`);
      return;
    }
    if (obj.event === 'step_update' && obj.step_update) {
      const su = obj.step_update;
      if (su.conversation_id) onSessionId(su.conversation_id);
      if (su.step_type === 'agent_response' && su.text_delta) {
        onText(su.text_delta);
        logStream.write(su.text_delta);
        lastWasDelta = true;
      } else if (su.step_type && su.step_type !== 'agent_response' && su.step_type !== 'user_input' && su.step_type !== 'system_message' && su.state === 'ACTIVE') {
        writeLine(`[step] ${su.step_type}`);
      }
      return;
    }
    if (obj.event === 'result' && obj.result) {
      if (obj.result.conversation_id) onSessionId(obj.result.conversation_id);
      onResult({
        sessionId: obj.result.conversation_id || null,
        response: typeof obj.result.response === 'string' ? obj.result.response : '',
        isError: obj.result.status !== 'SUCCESS',
        costUsd: null,
      });
    }
  };

  return {
    push(chunk) {
      buffer += chunk;
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const raw = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          if (tool === 'claude') handleClaudeLine(obj);
          else handleAgyLine(obj);
        } catch {
          writeLine(raw);
        }
      }
    },
    flush() {
      const rem = buffer.trim();
      buffer = '';
      if (rem) {
        try {
          const obj = JSON.parse(rem);
          if (tool === 'claude') handleClaudeLine(obj);
          else handleAgyLine(obj);
        } catch {
          writeLine(rem);
        }
      }
      if (lastWasDelta) {
        logStream.write('\n');
        lastWasDelta = false;
      }
    },
  };
}

async function executeWorker(payload) {
  ensureDirs();
  const { id, role, tool, bin, envVars, args, isResume, assignedSessionId, files, jobLabel, timeoutMin, logPath } = payload;
  const startIso = nowIsoLocal();
  const startHist = nowCompactHist();
  const pidFile = path.join(RUN_DIR, `${id}.pid`);
  const jobFile = path.join(RUN_DIR, `${id}.job`);
  const histFile = path.join(RUN_DIR, `${id}.hist`);

  fs.writeFileSync(pidFile, `${process.pid}\n`, 'utf8');
  if (jobLabel) fs.writeFileSync(jobFile, `${jobLabel}\n`, 'utf8');

  const logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
  logStream.write(`[bắt đầu ${startIso}, id=${id}, tool=${tool}, mode=${isResume ? 'resume' : 'new'}, session=${assignedSessionId || '(chờ init)'}]\n`);

  let capturedSessionId = assignedSessionId || null;
  let capturedResult = null;
  let streamedText = '';
  let timedOut = false;

  const persistSessionId = sid => {
    if (!sid || sid === capturedSessionId && loadSession(id)?.sessionId === sid) return;
    capturedSessionId = sid;
    saveSession(id, {
      role,
      tool,
      sessionId: sid,
      forceNew: false,
      lastLog: path.relative(ROOT, logPath),
      lastTask: jobLabel || loadSession(id)?.lastTask || '',
      lastPid: process.pid,
      lastRunAt: startIso,
    });
  };

  // Nếu là claude với UUID sinh sẵn, lưu ngay từ đầu để tiến trình khác biết phiên đang được tạo.
  if (capturedSessionId) persistSessionId(capturedSessionId);

  const parser = createStreamParser(
    tool,
    persistSessionId,
    text => { streamedText += text; },
    res => { capturedResult = res; },
    logStream
  );

  const childEnv = { ...process.env, ...envVars };
  const child = cp.spawn(bin, args, {
    cwd: ROOT,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Cập nhật .pid sang PID tiến trình con (hoặc giữ supervisor PID — cả hai đều sống trong suốt lượt chạy).
  fs.writeFileSync(pidFile, `${child.pid}\n`, 'utf8');

  let killTimer = null;
  let forceKillTimer = null;
  if (timeoutMin > 0) {
    killTimer = setTimeout(() => {
      timedOut = true;
      logStream.write(`\n[hết giờ: chạy quá ${timeoutMin} phút nên dừng tiến trình]\n`);
      try { child.kill('SIGTERM'); } catch {}
      forceKillTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, STOP_GRACE_MS);
    }, timeoutMin * 60 * 1000);
  }

  const forwardSignal = () => {
    try { child.kill('SIGTERM'); } catch {}
  };
  process.on('SIGTERM', forwardSignal);
  process.on('SIGINT', forwardSignal);

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => parser.push(chunk));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => logStream.write(`[stderr] ${chunk}`));

  const exitCode = await new Promise(resolve => {
    child.on('error', err => {
      logStream.write(`[lỗi chạy lệnh ${bin}: ${err.message}]\n`);
      resolve(EXIT_ENV);
    });
    child.on('close', code => resolve(typeof code === 'number' ? code : 1));
  });

  if (killTimer) clearTimeout(killTimer);
  if (forceKillTimer) clearTimeout(forceKillTimer);
  process.removeListener('SIGTERM', forwardSignal);
  process.removeListener('SIGINT', forwardSignal);

  parser.flush();

  const finalSessionId = (capturedResult && capturedResult.sessionId) || capturedSessionId;
  const finalCode = timedOut ? 124 : (capturedResult && capturedResult.isError && exitCode === 0 ? 1 : exitCode);
  const endHist = nowCompactHist();

  logStream.write(`\n[kết thúc, mã ${finalCode}]\n`);
  await new Promise(resolve => logStream.end(resolve));

  const prev = loadSession(id) || {};
  const activeSid = finalSessionId || prev.sessionId || null;
  const prevHistEntry = Array.isArray(prev.history) ? prev.history.find(h => h && h.sessionId === activeSid) : null;
  saveSession(id, {
    role,
    tool,
    sessionId: activeSid,
    forceNew: false,
    createdAt: (prevHistEntry && prevHistEntry.createdAt) || prev.createdAt || startIso,
    lastUsedAt: nowIsoLocal(),
    lastTask: jobLabel || prev.lastTask || '',
    lastExitCode: finalCode,
    lastLog: path.relative(ROOT, logPath),
    turnCount: (prev.turnCount || 0) + 1,
    sessionTurnCount: ((prevHistEntry && prevHistEntry.turnCount) || 0) + 1,
    lastPid: null,
  });

  const histSummary = `${startHist} ${endHist} ${jobLabel || '-'} exit=${finalCode}${finalSessionId ? ` session=${finalSessionId.slice(0, 8)}` : ''}\n`;
  fs.appendFileSync(histFile, histSummary, 'utf8');

  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(jobFile); } catch {}

  if (timedOut) {
    notifyOwner(`${id} (${role}) chạy quá ${timeoutMin} phút nên bị dừng. Xem log ${path.relative(ROOT, logPath)}`);
  } else if (finalCode !== 0) {
    notifyOwner(`${id} (${role}) kết thúc với lỗi (mã ${finalCode}). Xem log ${path.relative(ROOT, logPath)}`);
  }

  return {
    id,
    role,
    tool,
    mode: isResume ? 'resumed' : 'new',
    sessionId: finalSessionId,
    exitCode: finalCode,
    logPath: path.relative(ROOT, logPath),
    response: (capturedResult && capturedResult.response) || streamedText.trim(),
    costUsd: capturedResult ? capturedResult.costUsd : null,
  };
}

function parseActionFlags(argv) {
  const opts = {
    id: '',
    newSession: false,
    msg: '',
    msgFile: '',
    files: [],
    timeoutMin: DEFAULT_TIMEOUT_MINUTES,
    model: '',
    effort: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--new') opts.newSession = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--msg') opts.msg = argv[++i] ?? fail('--msg thiếu nội dung.');
    else if (a === '--msg-file') opts.msgFile = argv[++i] ?? fail('--msg-file thiếu đường dẫn.');
    else if (a === '--files') {
      const val = argv[++i] ?? fail('--files thiếu danh sách.');
      opts.files.push(...val.split(/[\s,]+/).filter(Boolean));
    } else if (a === '--task') {
      const val = argv[++i] ?? fail('--task thiếu đường dẫn.');
      opts.files.push(val);
    } else if (a === '--timeout') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0) fail('--timeout phải là số nguyên >= 0.');
      opts.timeoutMin = n;
    } else if (a === '--model') opts.model = argv[++i] ?? fail('--model thiếu tên model.');
    else if (a === '--effort') opts.effort = argv[++i] ?? fail('--effort thiếu mức.');
    else if (a.startsWith('-')) fail(`Tham số không hiểu: ${a}`);
    else if (!opts.id) opts.id = a;
    else fail(`Dư tham số: ${a}`);
  }
  return opts;
}

function preparePayload(opts) {
  ensureDirs();
  const agent = findAgentOrFail(opts.id);
  const toolCfg = detectToolConfig(agent);

  if (isAgentRunning(agent.id)) {
    const pid = readPidFile(agent.id);
    fail(`Agent '${agent.id}' đang chạy (pid ${pid}). Dùng 'sh workflow/agent.sh status ${agent.id}' hoặc 'stop ${agent.id}'.`, EXIT_STATE);
  }

  let msg = opts.msg;
  if (opts.msgFile) {
    const fileContent = readText(path.resolve(ROOT, opts.msgFile)).trim();
    if (!fileContent) fail(`File lời nhắn rỗng hoặc không đọc được: ${opts.msgFile}`);
    msg = msg ? `${msg}\n${fileContent}` : fileContent;
  }

  const waitingFiles = opts.files.length ? opts.files : scanWaitingFiles(agent.id);
  if (!waitingFiles.length && !msg) {
    fail(`Không có file nào đang có 'to: ${agent.id}' và cũng không có --msg.`, EXIT_ARGS);
  }

  const sessionState = loadSession(agent.id);
  const willResume = Boolean(!opts.newSession && sessionState && !sessionState.forceNew && sessionState.sessionId);
  const prompt = buildPrompt({
    id: agent.id,
    role: agent.role,
    files: waitingFiles,
    msg,
    isResume: willResume,
  });

  const invocation = buildToolInvocation(toolCfg, sessionState, prompt, opts);
  const logPath = path.join(LOGS_DIR, `${logTimestampPrefix()}-${agent.id}.log`);
  const jobLabel = jobLabelOf(waitingFiles);

  return {
    id: agent.id,
    role: agent.role,
    tool: toolCfg.tool,
    bin: invocation.bin,
    envVars: invocation.envVars,
    args: invocation.args,
    isResume: invocation.isResume,
    assignedSessionId: invocation.assignedSessionId,
    files: waitingFiles,
    jobLabel,
    timeoutMin: opts.timeoutMin,
    logPath,
  };
}

function printSummary(res, asJson) {
  const afterWaiting = scanWaitingFiles(res.id);
  if (asJson) {
    console.log(JSON.stringify({ ...res, stillWaiting: afterWaiting }, null, 2));
    return;
  }
  console.log(`Agent: ${res.id} (${res.role}, ${res.tool})`);
  console.log(`Phiên: ${res.sessionId || '(chưa có)'} [${res.mode === 'resumed' ? 'dùng lại phiên cũ' : 'tạo phiên mới'}]`);
  console.log(`Mã thoát: ${res.exitCode} | Log: ${res.logPath}`);
  if (afterWaiting.length) {
    console.log(`Cảnh báo: vẫn còn file có to: ${res.id}: ${afterWaiting.join(', ')}`);
  }
  if (res.response) {
    console.log('--- Phản hồi ---');
    console.log(res.response.slice(0, MAX_RESPONSE_PREVIEW_CHARS));
  }
}

async function cmdRun(argv) {
  const opts = parseActionFlags(argv);
  const release = acquireAgentLock(opts.id);
  let payload;
  try {
    payload = preparePayload(opts);
  } catch (err) {
    release();
    throw err;
  }
  release();
  const res = await executeWorker(payload);
  printSummary(res, opts.json);
  process.exit(res.exitCode);
}

async function cmdWake(argv) {
  const opts = parseActionFlags(argv);
  const release = acquireAgentLock(opts.id);
  let payload;
  try {
    payload = preparePayload(opts);
  } catch (err) {
    release();
    throw err;
  }

  const payloadFile = path.join(RUN_DIR, `${payload.id}.payload.${process.pid}.json`);
  writeJsonAtomic(payloadFile, payload);

  const beforeTurnCount = (loadSession(payload.id) && loadSession(payload.id).turnCount) || 0;
  const worker = cp.spawn(process.execPath, [__filename, '_worker', payloadFile], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  // Ghi tạm PID của supervisor trước khi nhả khoá để chặn đánh thức trùng trong lúc tiến trình con đang khởi động.
  if (worker.pid) {
    fs.writeFileSync(path.join(RUN_DIR, `${payload.id}.pid`), `${worker.pid}\n`, 'utf8');
  }
  worker.unref();
  release();

  // Chờ ngắn để phiên mới kịp ghi sessionId (hoặc hoàn tất sớm) trước khi trả lời Master.
  const deadline = Date.now() + WAKE_INIT_WAIT_MS;
  while (Date.now() < deadline) {
    const s = loadSession(payload.id);
    const pid = readPidFile(payload.id);
    const finishedTurn = Boolean(s && (s.turnCount || 0) > beforeTurnCount);
    if (finishedTurn || (pid && (payload.isResume || (s && s.sessionId)))) break;
    await new Promise(r => setTimeout(r, WAKE_INIT_POLL_MS));
  }

  const session = loadSession(payload.id);
  const pid = readPidFile(payload.id);
  const info = {
    id: payload.id,
    role: payload.role,
    tool: payload.tool,
    mode: payload.isResume ? 'resumed' : 'new',
    sessionId: (session && session.sessionId) || payload.assignedSessionId || null,
    pid: pid || worker.pid,
    files: payload.files,
    logPath: path.relative(ROOT, payload.logPath),
  };

  if (opts.json) {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(`Đã đánh thức ${info.id} (${info.role}, ${info.tool}, ${info.mode === 'resumed' ? 'resume phiên cũ' : 'tạo phiên mới'})`);
    console.log(`Session: ${info.sessionId || '(đang khởi tạo)'} | PID: ${info.pid} | Log: ${info.logPath}`);
  }
}

async function cmdWorker(argv) {
  const payloadFile = argv[0];
  if (!payloadFile || !fs.existsSync(payloadFile)) {
    fail(`Thiếu payload file cho _worker: ${payloadFile}`, EXIT_ENV);
  }
  const payload = readJson(payloadFile);
  try { fs.unlinkSync(payloadFile); } catch {}
  if (!payload) fail('Payload file hỏng.', EXIT_ENV);
  const res = await executeWorker(payload);
  process.exit(res.exitCode);
}

function cmdNew(argv) {
  ensureDirs();
  const id = argv[0];
  findAgentOrFail(id);
  if (isAgentRunning(id)) {
    fail(`Agent '${id}' đang chạy; hãy 'stop ${id}' trước khi đặt lại phiên.`, EXIT_STATE);
  }
  const prev = loadSession(id) || {};
  saveSession(id, {
    ...prev,
    sessionId: null,
    forceNew: true,
    resetAt: nowIsoLocal(),
  });
  console.log(`Đã đánh dấu tạo phiên mới cho ${id} ở lần gọi/đánh thức tiếp theo.`);
}

function cmdUse(argv) {
  ensureDirs();
  const id = argv[0];
  const targetSessionId = argv[1];
  findAgentOrFail(id);
  if (!targetSessionId) fail('Thiếu <sessionId> cho lệnh use.');
  if (isAgentRunning(id)) {
    fail(`Agent '${id}' đang chạy; hãy 'stop ${id}' trước khi đổi phiên.`, EXIT_STATE);
  }
  const prev = loadSession(id) || {};
  const found = Array.isArray(prev.history) ? prev.history.find(h => h && h.sessionId === targetSessionId) : null;
  saveSession(id, {
    ...prev,
    sessionId: targetSessionId,
    tool: (found && found.tool) || prev.tool || '',
    forceNew: false,
    lastUsedAt: nowIsoLocal(),
  });
  console.log(`Đã chuyển phiên hoạt động của ${id} sang ${targetSessionId}.`);
}

function cmdStop(argv) {
  const id = argv[0];
  findAgentOrFail(id);
  const pid = readPidFile(id);
  if (!pid || !isPidAlive(pid)) {
    try { fs.unlinkSync(path.join(RUN_DIR, `${id}.pid`)); } catch {}
    console.log(`${id} hiện không chạy.`);
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    fail(`Không gửi được SIGTERM tới ${id} (pid ${pid}): ${err.message}`, EXIT_ENV);
  }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline && isPidAlive(pid)) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (isPidAlive(pid)) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  try { fs.unlinkSync(path.join(RUN_DIR, `${id}.pid`)); } catch {}
  try { fs.unlinkSync(path.join(RUN_DIR, `${id}.job`)); } catch {}
  console.log(`Đã dừng ${id} (pid ${pid}). Session ID vẫn được giữ lại để resume nếu cần.`);
}

function lastLogOf(id) {
  if (!fs.existsSync(LOGS_DIR)) return null;
  const names = fs.readdirSync(LOGS_DIR).filter(n => n.endsWith(`-${id}.log`)).sort();
  return names.length ? path.join(LOGS_DIR, names[names.length - 1]) : null;
}

function cmdLogs(argv) {
  let id = '';
  let linesCount = DEFAULT_LOG_LINES;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lines') {
      linesCount = Number(argv[++i]);
      if (!Number.isInteger(linesCount) || linesCount <= 0) fail('--lines phải > 0.');
    } else if (!id) {
      id = argv[i];
    } else {
      fail(`Tham số thừa: ${argv[i]}`);
    }
  }
  findAgentOrFail(id);
  const lp = lastLogOf(id);
  if (!lp) {
    console.log(`Chưa có log nào cho ${id}.`);
    return;
  }
  const all = readText(lp).trimEnd().split(/\r?\n/);
  console.log(`=== ${path.relative(ROOT, lp)} (${all.length} dòng) ===`);
  console.log(all.slice(-linesCount).join('\n'));
}

function cmdStatus(argv) {
  let targetId = '';
  let asJson = false;
  for (const a of argv) {
    if (a === '--json') asJson = true;
    else if (a.startsWith('-')) fail(`Tham số không hiểu: ${a}`);
    else if (!targetId) targetId = a;
    else fail(`Tham số thừa: ${a}`);
  }
  const agents = readAgents().filter(a => !targetId || a.id === targetId);
  if (targetId && !agents.length) findAgentOrFail(targetId);

  const rows = agents.map(a => {
    const sess = loadSession(a.id);
    const running = isAgentRunning(a.id);
    const pid = running ? readPidFile(a.id) : null;
    const waiting = scanWaitingFiles(a.id);
    return {
      id: a.id,
      role: a.role,
      mode: a.mode,
      running,
      pid,
      tool: (sess && sess.tool) || (a.mode === 'auto'
        ? (splitShellArgs(a.cmdLine).map(t => path.basename(t)).find(b => b === 'claude' || b === 'agy') || '')
        : ''),
      sessionId: (sess && sess.sessionId) || null,
      forceNew: Boolean(sess && sess.forceNew),
      turnCount: (sess && sess.turnCount) || 0,
      lastExitCode: sess ? sess.lastExitCode : null,
      lastUsedAt: (sess && sess.lastUsedAt) || null,
      lastLog: (sess && sess.lastLog) || null,
      history: Array.isArray(sess && sess.history) ? sess.history : [],
      waiting,
    };
  });

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const r of rows) {
    const state = r.running ? `ĐANG CHẠY (pid ${r.pid})` : 'rảnh';
    const sessText = r.forceNew
      ? 'sẽ tạo mới'
      : (r.sessionId ? `${r.sessionId} (${r.turnCount} lượt)` : 'chưa có');
    const waitText = r.waiting.length ? r.waiting.join(', ') : '-';
    console.log(`${r.id} [${r.role}/${r.mode}] | ${state} | session: ${sessText} | chờ: ${waitText}`);
  }
}

async function cmdWait(argv) {
  const ids = [];
  let timeoutMin = DEFAULT_TIMEOUT_MINUTES;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') asJson = true;
    else if (a === '--timeout') {
      timeoutMin = Number(argv[++i]);
      if (!Number.isInteger(timeoutMin) || timeoutMin < 0) fail('--timeout phải >= 0.');
    } else if (a.startsWith('-')) fail(`Tham số không hiểu: ${a}`);
    else ids.push(a);
  }
  if (!ids.length) fail('Thiếu ít nhất một <id> cho lệnh wait.');
  for (const id of ids) findAgentOrFail(id);

  const deadline = timeoutMin > 0 ? Date.now() + timeoutMin * 60 * 1000 : Infinity;
  while (true) {
    const alive = ids.filter(id => isAgentRunning(id));
    if (!alive.length) break;
    if (Date.now() >= deadline) {
      fail(`Hết giờ chờ (${timeoutMin} phút), vẫn còn đang chạy: ${alive.join(', ')}`, EXIT_STATE);
    }
    await new Promise(r => setTimeout(r, DEFAULT_WAIT_POLL_MS));
  }

  const results = ids.map(id => {
    const s = loadSession(id) || {};
    return {
      id,
      sessionId: s.sessionId || null,
      exitCode: typeof s.lastExitCode === 'number' ? s.lastExitCode : null,
      logPath: s.lastLog || null,
      waiting: scanWaitingFiles(id),
    };
  });

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`${r.id}: mã=${r.exitCode ?? '?'} | session=${r.sessionId || '-'} | log=${r.logPath || '-'} | còn chờ=${r.waiting.join(', ') || '-'}`);
    }
  }
  const hasFailed = results.some(r => r.exitCode && r.exitCode !== 0);
  if (hasFailed) process.exit(1);
}

function printHelp() {
  console.log(`Dùng: sh workflow/agent.sh <lệnh> [tuỳ chọn]

Các lệnh:
  wake <id> [--new] [--msg "..."] [--files "a,b"] [--timeout <phút>]
      Đánh thức agent chạy ngầm (-p). Dùng lại session cũ trong workflow/.run/sessions/<id>.json;
      chưa có hoặc có --new thì tạo session mới và lưu lại ID.
  run <id> [--new] [--msg "..."] [--files "a,b"] [--timeout <phút>]
      Như wake nhưng chạy đồng bộ (chờ xong) và in phản hồi + session ID.
  new <id>
      Đánh dấu tạo session mới ở lần wake/run tiếp theo (kể cả khi watch.sh đánh thức).
  use <id> <sessionId>
      Chuyển session hoạt động của agent về một session ID cũ đã lưu.
  wait <id...> [--timeout <phút>]
      Chờ một hoặc nhiều agent đang chạy ngầm hoàn thành.
  status [id] [--json]
      Xem trạng thái chạy, session ID và các file đang chờ (to: <id>).
  logs <id> [--lines <n>]
      Xem các dòng log gần nhất của agent.
  stop <id>
      Dừng tiến trình đang chạy của agent (giữ nguyên session ID).`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    return;
  }
  if (cmd === 'run') await cmdRun(rest);
  else if (cmd === 'wake') await cmdWake(rest);
  else if (cmd === '_worker') await cmdWorker(rest);
  else if (cmd === 'new') cmdNew(rest);
  else if (cmd === 'use') cmdUse(rest);
  else if (cmd === 'stop') cmdStop(rest);
  else if (cmd === 'logs') cmdLogs(rest);
  else if (cmd === 'status') cmdStatus(rest);
  else if (cmd === 'wait') await cmdWait(rest);
  else fail(`Lệnh không hợp lệ: '${cmd}'. Chạy 'sh workflow/agent.sh --help' để xem cách dùng.`);
}

main().catch(err => {
  fail(err && err.message ? err.message : String(err), EXIT_ENV);
});
