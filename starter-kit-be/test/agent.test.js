'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const http = require('node:http');
const net = require('node:net');

const KIT_DIR = path.resolve(__dirname, '..');

function run(cmd, args, opts = {}) {
  return cp.spawnSync(cmd, args, {
    encoding: 'utf8',
    ...opts,
  });
}

function createTempProject(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-be-agent-test-'));
  const repoDir = path.join(base, 'repo');
  const binDir = path.join(base, 'bin');
  const callLog = path.join(base, 'calls.jsonl');
  fs.mkdirSync(repoDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  // Khởi tạo git repo với 1 commit ban đầu để install-kit.sh và worktree hoạt động.
  assert.equal(run('git', ['init', '-b', 'main', repoDir]).status, 0);
  assert.equal(run('git', ['-C', repoDir, 'config', 'user.email', 'test@example.com']).status, 0);
  assert.equal(run('git', ['-C', repoDir, 'config', 'user.name', 'Test']).status, 0);
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n', 'utf8');
  assert.equal(run('git', ['-C', repoDir, 'add', 'README.md']).status, 0);
  assert.equal(run('git', ['-C', repoDir, 'commit', '-m', 'init']).status, 0);

  const inst = run('sh', [path.join(KIT_DIR, 'install-kit.sh'), repoDir]);
  assert.equal(inst.status, 0, inst.stderr || inst.stdout);

  // Tạo mock CLI `claude` và `agy` ghi lại toàn bộ argv và xuất stream-json giống CLI thật.
  const mockClaude = `#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const args = process.argv.slice(2);
const logFile = process.env.MOCK_CALL_LOG;
const sleepMs = Number(process.env.MOCK_SLEEP_MS || 0);

function argVal(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const pref = args.find(a => a.startsWith(flag + '='));
  return pref ? pref.slice(flag.length + 1) : null;
}

const resumeId = argVal('--resume');
const sessionId = resumeId || argVal('--session-id') || crypto.randomUUID();
fs.appendFileSync(logFile, JSON.stringify({ tool: 'claude', args, sessionId, resumed: Boolean(resumeId) }) + '\\n');

setTimeout(() => {
  console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId }));
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'claude ok ' + sessionId }] }, session_id: sessionId }));
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'claude ok ' + sessionId, session_id: sessionId, total_cost_usd: 0.01 }));
}, sleepMs);
`;

  const mockAgy = `#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const args = process.argv.slice(2);
const logFile = process.env.MOCK_CALL_LOG;
const sleepMs = Number(process.env.MOCK_SLEEP_MS || 0);

// Kiểm chứng đúng quy tắc của agy thật: -p không được đứng tách trước flag khác.
const barePIdx = args.indexOf('-p');
if (barePIdx !== -1 && barePIdx + 1 < args.length && args[barePIdx + 1].startsWith('-')) {
  console.error('Error: -p took flag as prompt');
  process.exit(2);
}

let resumeId = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--resume' || args[i] === '-r' || args[i] === '--conversation') resumeId = args[++i];
  else if (args[i].startsWith('--resume=')) resumeId = args[i].slice('--resume='.length);
}
const convId = resumeId || crypto.randomUUID();
fs.appendFileSync(logFile, JSON.stringify({ tool: 'agy', args, convId, resumed: Boolean(resumeId) }) + '\\n');

setTimeout(() => {
  console.log(JSON.stringify({ event: 'init', conversation_id: convId, init: { cwd: process.cwd() } }));
  console.log(JSON.stringify({ event: 'step_update', step_update: { conversation_id: convId, step_type: 'agent_response', text_delta: 'agy ok ' + convId } }));
  console.log(JSON.stringify({ event: 'result', result: { conversation_id: convId, status: 'SUCCESS', response: 'agy ok ' + convId } }));
}, sleepMs);
`;

  const claudeBin = path.join(binDir, 'claude');
  const agyBin = path.join(binDir, 'agy');
  fs.writeFileSync(claudeBin, mockClaude, { mode: 0o755 });
  fs.writeFileSync(agyBin, mockAgy, { mode: 0o755 });

  // Tạo sẵn một file task mẫu trong workflow/.
  const featDir = path.join(repoDir, 'workflow', 'F-001-demo');
  fs.mkdirSync(path.join(featDir, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(featDir, 'SPEC.md'), '---\nid: F-001\ntitle: Demo\nlane: full\nstatus: in_dev\nto: none\nmaster: master-01\n---\n', 'utf8');
  fs.writeFileSync(path.join(featDir, 'tasks', 'T-01.md'), '---\nid: T-01\ntitle: Lam thu\nstatus: ready\nto: coder-01\nassignee: coder-01\ntester: tester-01\n---\n', 'utf8');

  const env = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH}`,
    MOCK_CALL_LOG: callLog,
    MOCK_SLEEP_MS: '0',
  };

  t.after(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  return { base, repoDir, callLog, env };
}

function readCalls(callLog) {
  if (!fs.existsSync(callLog)) return [];
  return fs.readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

test('claude: tạo session mới khi chưa có, tự resume session cũ ở lần gọi sau và --new tạo lại mới', t => {
  const { repoDir, callLog, env } = createTempProject(t);

  const r1 = run('sh', ['workflow/agent.sh', 'run', 'coder-01', '--json'], { cwd: repoDir, env });
  assert.equal(r1.status, 0, r1.stderr);
  const out1 = JSON.parse(r1.stdout);
  assert.equal(out1.tool, 'claude');
  assert.equal(out1.mode, 'new');
  assert.ok(out1.sessionId);

  const sessionPath = path.join(repoDir, 'workflow', '.run', 'sessions', 'coder-01.json');
  const saved1 = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  assert.equal(saved1.sessionId, out1.sessionId);
  assert.equal(saved1.turnCount, 1);

  const r2 = run('sh', ['workflow/agent.sh', 'run', 'coder-01', '--msg', 'Lam tiep buoc 2', '--json'], { cwd: repoDir, env });
  assert.equal(r2.status, 0, r2.stderr);
  const out2 = JSON.parse(r2.stdout);
  assert.equal(out2.mode, 'resumed');
  assert.equal(out2.sessionId, out1.sessionId);

  const r3 = run('sh', ['workflow/agent.sh', 'run', 'coder-01', '--new', '--json'], { cwd: repoDir, env });
  assert.equal(r3.status, 0, r3.stderr);
  const out3 = JSON.parse(r3.stdout);
  assert.equal(out3.mode, 'new');
  assert.notEqual(out3.sessionId, out1.sessionId);

  const calls = readCalls(callLog);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].resumed, false);
  assert.equal(calls[1].resumed, true);
  assert.equal(calls[1].sessionId, out1.sessionId);
  assert.equal(calls[2].resumed, false);
});

test('agy: bắt conversation_id từ stream-json, resume đúng ID và lệnh `new <id>` ép tạo mới', t => {
  const { repoDir, callLog, env } = createTempProject(t);
  fs.writeFileSync(
    path.join(repoDir, 'workflow', 'F-001-demo', 'tasks', 'T-01.md'),
    '---\nid: T-01\ntitle: Kiem thu\nstatus: in_test\nto: tester-01\nassignee: coder-01\ntester: tester-01\n---\n',
    'utf8'
  );

  const r1 = run('sh', ['workflow/agent.sh', 'run', 'tester-01', '--json'], { cwd: repoDir, env });
  assert.equal(r1.status, 0, r1.stderr);
  const out1 = JSON.parse(r1.stdout);
  assert.equal(out1.tool, 'agy');
  assert.equal(out1.mode, 'new');
  assert.ok(out1.sessionId);

  const r2 = run('sh', ['workflow/agent.sh', 'run', 'tester-01', '--json'], { cwd: repoDir, env });
  assert.equal(r2.status, 0, r2.stderr);
  const out2 = JSON.parse(r2.stdout);
  assert.equal(out2.mode, 'resumed');
  assert.equal(out2.sessionId, out1.sessionId);

  const reset = run('sh', ['workflow/agent.sh', 'new', 'tester-01'], { cwd: repoDir, env });
  assert.equal(reset.status, 0, reset.stderr);

  const r3 = run('sh', ['workflow/agent.sh', 'run', 'tester-01', '--json'], { cwd: repoDir, env });
  assert.equal(r3.status, 0, r3.stderr);
  const out3 = JSON.parse(r3.stdout);
  assert.equal(out3.mode, 'new');
  assert.notEqual(out3.sessionId, out1.sessionId);

  const calls = readCalls(callLog);
  assert.equal(calls.length, 3);
  assert.ok(calls[0].args.some(a => a.startsWith('-p=')));
  assert.equal(calls[1].resumed, true);
  assert.equal(calls[1].convId, out1.sessionId);
  assert.equal(calls[2].resumed, false);
});

test('wake + wait + status + logs + stop + chặn chạy trùng khi đang chạy', t => {
  const { repoDir, env } = createTempProject(t);
  const slowEnv = { ...env, MOCK_SLEEP_MS: '600' };

  const w1 = run('sh', ['workflow/agent.sh', 'wake', 'coder-01', '--json'], { cwd: repoDir, env: slowEnv });
  assert.equal(w1.status, 0, w1.stderr);
  const info = JSON.parse(w1.stdout);
  assert.ok(info.pid);
  assert.ok(info.sessionId);

  // Đang chạy thì không cho wake/run đè.
  const dup = run('sh', ['workflow/agent.sh', 'wake', 'coder-01'], { cwd: repoDir, env: slowEnv });
  assert.equal(dup.status, 3);

  const st = run('sh', ['workflow/agent.sh', 'status', 'coder-01', '--json'], { cwd: repoDir, env });
  assert.equal(st.status, 0);
  const stData = JSON.parse(st.stdout);
  assert.equal(stData[0].running, true);

  const wt = run('sh', ['workflow/agent.sh', 'wait', 'coder-01', '--json'], { cwd: repoDir, env });
  assert.equal(wt.status, 0, wt.stderr);
  const wtData = JSON.parse(wt.stdout);
  assert.equal(wtData[0].exitCode, 0);
  assert.equal(wtData[0].sessionId, info.sessionId);

  const lg = run('sh', ['workflow/agent.sh', 'logs', 'coder-01', '--lines', '10'], { cwd: repoDir, env });
  assert.equal(lg.status, 0);
  assert.match(lg.stdout, /\[kết thúc, mã 0\]/);

  // Kiểm chứng stop dừng tiến trình ngủ dài mà vẫn giữ sessionId.
  const verySlowEnv = { ...env, MOCK_SLEEP_MS: '15000' };
  const w2 = run('sh', ['workflow/agent.sh', 'wake', 'coder-01', '--json'], { cwd: repoDir, env: verySlowEnv });
  assert.equal(w2.status, 0, w2.stderr);
  const stp = run('sh', ['workflow/agent.sh', 'stop', 'coder-01'], { cwd: repoDir, env });
  assert.equal(stp.status, 0, stp.stderr);
  const afterStop = JSON.parse(fs.readFileSync(path.join(repoDir, 'workflow', '.run', 'sessions', 'coder-01.json'), 'utf8'));
  assert.equal(afterStop.sessionId, info.sessionId);
});

test('watch.sh --once đánh thức agent auto qua agent.js và dùng lại session cũ giữa các vòng', t => {
  const { repoDir, callLog, env } = createTempProject(t);
  const taskPath = path.join(repoDir, 'workflow', 'F-001-demo', 'tasks', 'T-01.md');
  fs.writeFileSync(taskPath, '---\nid: T-01\ntitle: Agy watch\nstatus: ready\nto: coder-02\nassignee: coder-02\ntester: tester-01\n---\n', 'utf8');

  const tick1 = run('sh', ['workflow/watch.sh', '--once'], { cwd: repoDir, env });
  assert.equal(tick1.status, 0, tick1.stderr);

  const wt1 = run('sh', ['workflow/agent.sh', 'wait', 'coder-02', '--json'], { cwd: repoDir, env });
  assert.equal(wt1.status, 0, wt1.stderr);
  const sid1 = JSON.parse(wt1.stdout)[0].sessionId;
  assert.ok(sid1);

  // Giả lập vòng 2: file việc đổi nội dung nhưng vẫn to: coder-02 → watch.sh đánh thức lại đúng session cũ.
  fs.writeFileSync(taskPath, '---\nid: T-01\ntitle: Agy watch round 2\nstatus: reopened\nto: coder-02\nassignee: coder-02\ntester: tester-01\n---\n', 'utf8');
  const tick2 = run('sh', ['workflow/watch.sh', '--once'], { cwd: repoDir, env });
  assert.equal(tick2.status, 0, tick2.stderr);

  const wt2 = run('sh', ['workflow/agent.sh', 'wait', 'coder-02', '--json'], { cwd: repoDir, env });
  assert.equal(wt2.status, 0, wt2.stderr);
  const sid2 = JSON.parse(wt2.stdout)[0].sessionId;
  assert.equal(sid2, sid1);

  const calls = readCalls(callLog);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].tool, 'agy');
  assert.equal(calls[0].resumed, false);
  assert.equal(calls[1].tool, 'agy');
  assert.equal(calls[1].resumed, true);
  assert.equal(calls[1].convId, sid1);
});

test('chạy từ bên trong worktree vẫn trỏ đúng về repo chính', t => {
  const { repoDir, env } = createTempProject(t);
  const wtDir = path.join(repoDir, '.worktrees', 'test-wt');
  assert.equal(run('git', ['-C', repoDir, 'worktree', 'add', wtDir, '-b', 'feat/wt-test']).status, 0);

  const st = run('node', [path.join(repoDir, 'workflow', 'agent.js'), 'status', '--json'], { cwd: wtDir, env });
  assert.equal(st.status, 0, st.stderr);
  const rows = JSON.parse(st.stdout);
  assert.ok(rows.some(r => r.id === 'coder-01'));
});

test('lưu lịch sử nhiều session và chuyển qua lại bằng `use <id> <sessionId>`', t => {
  const { repoDir, callLog, env } = createTempProject(t);

  const r1 = run('sh', ['workflow/agent.sh', 'run', 'coder-01', '--json'], { cwd: repoDir, env });
  assert.equal(r1.status, 0, r1.stderr);
  const sid1 = JSON.parse(r1.stdout).sessionId;

  const r2 = run('sh', ['workflow/agent.sh', 'run', 'coder-01', '--new', '--json'], { cwd: repoDir, env });
  assert.equal(r2.status, 0, r2.stderr);
  const sid2 = JSON.parse(r2.stdout).sessionId;
  assert.notEqual(sid2, sid1);

  const sw = run('sh', ['workflow/agent.sh', 'use', 'coder-01', sid1], { cwd: repoDir, env });
  assert.equal(sw.status, 0, sw.stderr);

  const r3 = run('sh', ['workflow/agent.sh', 'run', 'coder-01', '--json'], { cwd: repoDir, env });
  assert.equal(r3.status, 0, r3.stderr);
  const out3 = JSON.parse(r3.stdout);
  assert.equal(out3.mode, 'resumed');
  assert.equal(out3.sessionId, sid1);

  const st = JSON.parse(run('sh', ['workflow/agent.sh', 'status', 'coder-01', '--json'], { cwd: repoDir, env }).stdout);
  assert.equal(st[0].history.length, 2);
  assert.equal(readCalls(callLog)[2].sessionId, sid1);
});

test('update-kit.sh ghi đè core, merge settings.json và giữ nguyên cấu hình dự án', t => {
  const { repoDir, env } = createTempProject(t);

  // Sửa cấu hình riêng của dự án + làm hỏng 1 file core để kiểm tra update ghi đè core & bảo vệ config.
  const customConf = 'BASE_BRANCH=develop\nWORK_BRANCH=feat/keep\nDELIVERY=mr\nWORKFLOW_IN_GIT=yes\n';
  fs.writeFileSync(path.join(repoDir, 'workflow', 'project.conf'), customConf, 'utf8');
  fs.writeFileSync(path.join(repoDir, 'workflow', 'agents.txt'), 'coder-99 coder auto agy --mode accept-edits\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'workflow', 'stack', 'api.sh'), '# custom unit\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'workflow', 'agent.js'), '// outdated core\n', 'utf8');

  const settingsPath = path.join(repoDir, '.claude', 'settings.json');
  const oldSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  oldSettings.permissions.allow = oldSettings.permissions.allow.filter(x => !x.includes('agent.sh'));
  oldSettings.permissions.allow.push('Bash(custom-keep:*)');
  fs.writeFileSync(settingsPath, JSON.stringify(oldSettings, null, 2), 'utf8');

  const dry = run('sh', [path.join(KIT_DIR, 'update-kit.sh'), repoDir, '--dry-run'], { env });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /workflow\/agent\.js/);
  // Dry-run chưa ghi đè file thật.
  assert.equal(fs.readFileSync(path.join(repoDir, 'workflow', 'agent.js'), 'utf8'), '// outdated core\n');

  const upd = run('sh', [path.join(KIT_DIR, 'update-kit.sh'), repoDir], { env });
  assert.equal(upd.status, 0, upd.stderr);

  assert.equal(
    fs.readFileSync(path.join(repoDir, 'workflow', 'agent.js'), 'utf8'),
    fs.readFileSync(path.join(KIT_DIR, 'workflow', 'agent.js'), 'utf8')
  );
  assert.equal(fs.readFileSync(path.join(repoDir, 'workflow', 'project.conf'), 'utf8'), customConf);
  assert.equal(fs.readFileSync(path.join(repoDir, 'workflow', 'agents.txt'), 'utf8'), 'coder-99 coder auto agy --mode accept-edits\n');
  assert.equal(fs.readFileSync(path.join(repoDir, 'workflow', 'stack', 'api.sh'), 'utf8'), '# custom unit\n');

  const mergedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.ok(mergedSettings.permissions.allow.includes('Bash(custom-keep:*)'));
  assert.ok(mergedSettings.permissions.allow.includes('Bash(sh workflow/agent.sh:*)'));
});

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(err => (err ? reject(err) : resolve(p)));
    });
  });
}

function httpReq(port, method, reqPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', c => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('monitor.js UI API: thêm agent, đánh thức, tạo phiên mới, đổi phiên và xoá agent', async t => {
  const { repoDir, env } = createTempProject(t);
  const port = await freePort();
  const mon = cp.spawn('node', [path.join(repoDir, 'workflow', 'monitor.js'), '--port', String(port)], {
    cwd: repoDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => {
    try { mon.kill('SIGTERM'); } catch {}
  });

  // Đợi monitor mở cổng.
  let html = '';
  for (let i = 0; i < 30; i++) {
    try {
      const r = await httpReq(port, 'GET', '/');
      if (r.status === 200) { html = r.body; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(html.includes('Quản lý Agent'), 'Monitor HTML phải chứa khu Quản lý Agent');
  const tokMatch = html.match(/const UI_TOKEN='([0-9a-f]+)'/);
  assert.ok(tokMatch, 'Monitor HTML phải nhúng UI_TOKEN');
  const uiToken = tokMatch[1];

  // Thiếu token bị 403.
  const unauth = await httpReq(port, 'POST', '/api/agents', { id: 'coder-03', role: 'coder', mode: 'auto', tool: 'agy' });
  assert.equal(unauth.status, 403);

  // Thêm agent mới qua API.
  const add = await httpReq(port, 'POST', '/api/agents', { id: 'coder-03', role: 'coder', mode: 'auto', tool: 'agy' }, { 'X-UI-Token': uiToken });
  assert.equal(add.status, 200, add.body);
  assert.ok(JSON.parse(add.body).state.agents.some(a => a.id === 'coder-03' && a.cliTool === 'agy'));

  // Đánh thức agent qua API (tạo session đầu tiên).
  const w1 = await httpReq(port, 'POST', '/api/agent/wake', { id: 'coder-03', msg: 'Khảo sát T-01' }, { 'X-UI-Token': uiToken });
  assert.equal(w1.status, 200, w1.body);
  const sid1 = JSON.parse(w1.body).result.sessionId;
  assert.ok(sid1);

  const wait1 = run('sh', ['workflow/agent.sh', 'wait', 'coder-03'], { cwd: repoDir, env });
  assert.equal(wait1.status, 0, wait1.stderr);

  // Yêu cầu tạo phiên mới rồi đánh thức lại.
  const nw = await httpReq(port, 'POST', '/api/agent/new', { id: 'coder-03' }, { 'X-UI-Token': uiToken });
  assert.equal(nw.status, 200, nw.body);
  const w2 = await httpReq(port, 'POST', '/api/agent/wake', { id: 'coder-03', msg: 'Phiên mới' }, { 'X-UI-Token': uiToken });
  assert.equal(w2.status, 200, w2.body);
  const sid2 = JSON.parse(w2.body).result.sessionId;
  assert.notEqual(sid2, sid1);

  const wait2 = run('sh', ['workflow/agent.sh', 'wait', 'coder-03'], { cwd: repoDir, env });
  assert.equal(wait2.status, 0, wait2.stderr);

  // Chuyển về sid1 qua API.
  const sw = await httpReq(port, 'POST', '/api/agent/use', { id: 'coder-03', sessionId: sid1 }, { 'X-UI-Token': uiToken });
  assert.equal(sw.status, 200, sw.body);
  const stRes = JSON.parse((await httpReq(port, 'GET', '/api/state')).body);
  const c3 = stRes.agents.find(a => a.id === 'coder-03');
  assert.equal(c3.session.sessionId, sid1);

  // Xoá agent qua API.
  const del = await httpReq(port, 'POST', '/api/agents/delete', { id: 'coder-03' }, { 'X-UI-Token': uiToken });
  assert.equal(del.status, 200, del.body);
  assert.ok(!JSON.parse(del.body).state.agents.some(a => a.id === 'coder-03'));
});
