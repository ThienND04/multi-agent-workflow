#!/usr/bin/env node
// monitor.js: trang theo dõi local dạng văn phòng pixel (mỗi tính năng một dãy bàn). Chỉ đọc.
//
// Chạy:   node workflow/monitor.js              rồi mở http://localhost:4300
//         node workflow/monitor.js --port 5000
//         (thường không cần chạy riêng: sh workflow/watch.sh tự mở kèm monitor)
//         node workflow/monitor.js --demo --port 4321   xem thử giao diện với dữ liệu giả (không đụng dự án)
// Cần:    Node.js 18 trở lên. Không cần cài thư viện nào.
//
// Trang đọc đúng các file mà watch.sh đọc: workflow/agents.txt, workflow/F-*/SPEC.md,
// tasks/, questions/, bugs/, và log trong workflow/logs/. Không bao giờ đọc .env.
// Chỉ lắng nghe trên 127.0.0.1: máy khác trong mạng không truy cập được.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

let port = 4300, DEMO = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--port') port = Number(argv[++i]);
  else if (argv[i] === '--demo') DEMO = true;
  else { console.error('Tham số không hiểu: ' + argv[i]); process.exit(1); }
}

let ROOT;
try { ROOT = cp.execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
catch { ROOT = process.cwd(); }
let W = path.join(ROOT, 'workflow');
let RUNDIR = path.join(W, '.run');

// ---------- Đọc dữ liệu ----------
function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (!/^---/.test(lines[0] || '')) return {};
  const o = {};
  for (let i = 1; i < lines.length; i++) {
    if (/^---/.test(lines[i])) break;
    const m = lines[i].match(/^([A-Za-z_]+):(.*)$/);
    // "#" chỉ là chú thích khi có khoảng trắng ở cả hai bên ("review  # review | …"), nên "Sửa lỗi #123" giữ nguyên;
    // bỏ một cặp ngoặc bao quanh giá trị. Cùng quy tắc với fm() trong watch.sh.
    if (m) o[m[1]] = m[2].replace(/\s#(\s.*)?$/, '').trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return o;
}
// Lấy các mục có tiêu đề khớp re (ví dụ "Cách thử", "Báo cáo") trong phần thân Markdown
function sections(text, re) {
  const lines = text.split(/\r?\n/), out = [];
  let i = 0;
  if (/^---/.test(lines[0] || '')) { i = 1; while (i < lines.length && !/^---/.test(lines[i])) i++; i++; }
  for (; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (!h || !re.test(h[2])) continue;
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) { const n = lines[j].match(/^(#{1,6})\s/); if (n && n[1].length <= h[1].length) break; body.push(lines[j]); }
    out.push({ title: h[2].trim(), text: body.join('\n').trim().slice(0, 3000) });
    i = j - 1;
  }
  return out;
}
// Phần thân (bỏ frontmatter), dùng cho câu hỏi chờ chủ dự án
const bodyOf = text => text.replace(/^---[\s\S]*?\n---[^\n]*\n?/, '').trim().slice(0, 2000);
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const isDir = d => { try { return fs.statSync(d).isDirectory(); } catch { return false; } };

// ---------- Xem thử (--demo): dữ liệu giả trong một thư mục tạm, không đọc hay ghi gì của dự án ----------
// Đi qua đủ các trạng thái, mỗi 9 giây một cảnh: agent được gọi đi từ cây nước vào bàn, tính năng xong
// bắn pháo giấy, watch.sh chết thì tắt đèn, rồi quay lại từ đầu. Dữ liệu đi qua đúng các hàm đọc file thật.
function demoSetup() {
  const base = fs.mkdtempSync(path.join(require('os').tmpdir(), 'monitor-demo-'));
  const w = path.join(base, 'workflow');
  const put = (rel, text) => { const p = path.join(w, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  const doc = (o, body) => '---\n' + Object.entries(o).map(([k, v]) => k + ': ' + v).join('\n') + '\n---\n' + (body || '');
  const task = (f, id, title, status, to, assignee, tester) => put(f + '/tasks/' + id + '.md', doc({ id, title, status, to, assignee, tester }));
  const clear = () => { for (const n of fs.existsSync(w) ? fs.readdirSync(w) : []) if (/^F-|^\.run$|^logs$/.test(n)) fs.rmSync(path.join(w, n), { recursive: true, force: true }); };
  const scene = step => {
    clear();
    put('agents.txt', [
      'master-01 master manual phiên chat chính', 'master-02 master manual phiên chat song song',
      'coder-01 coder subagent coder', 'coder-02 coder subagent coder', 'coder-03 coder auto claude -p --model sonnet',
      'coder-04 coder subagent coder-pro', 'coder-05 coder subagent coder',
      'tester-01 tester subagent tester', 'tester-02 tester window agy -i', 'tester-03 tester manual Antigravity'].join('\n') + '\n');
    const t = Math.floor(Date.now() / 1000);
    put('.run/watch.beat', (step === 3 ? t - 900 : t) + ' 30 1\n');
    // F-100: đã xong (chỉ còn trên bảng trắng)
    put('F-100-dang-nhap/SPEC.md', doc({ id: 'F-100', title: 'Trang đăng nhập mới', lane: 'full', status: 'done', to: 'none', master: 'master-01' }));
    // F-101: đang làm; coder-01 Master gọi, coder-02 có việc chờ, coder-03 (auto) đang chạy, tester-01 có việc kiểm
    const f1 = 'F-101-otp';
    put(f1 + '/SPEC.md', doc({ id: 'F-101', title: 'Đăng nhập bằng mã OTP', lane: 'full', status: 'in_dev', to: 'none', master: 'master-01' }));
    task(f1, 'T-01', 'Gửi mã OTP', 'in_progress', 'coder-01', 'coder-01', 'tester-01');
    task(f1, 'T-02', 'Màn hình nhập mã', 'ready', 'coder-02', 'coder-02', 'tester-01');
    task(f1, 'T-03', 'Giới hạn số lần thử', 'ready', 'coder-03', 'coder-03', 'tester-01');
    task(f1, 'T-04', 'Hết hạn mã', 'in_test', 'tester-01', 'coder-01', 'tester-01');
    put('.run/coder-01.sub', 'F-101 T-01\n');
    put('logs/20261117-090000-coder-03.log', '[đang chạy]\n'); put('.run/coder-03.pid', '1\n'); put('.run/coder-03.job', 'F-101 T-03\n');
    // F-102: làn nhanh, chờ bạn nghiệm thu; cảnh 2: xong (pháo giấy)
    const f2 = 'F-102-vod';
    put(f2 + '/SPEC.md', doc({ id: 'F-102', title: 'Sửa lỗi bảng VOD #42', lane: 'quick', status: step === 2 ? 'done' : 'acceptance', to: step === 2 ? 'none' : 'owner', master: 'master-02' },
      '## Cách thử\n1. Mở trang VOD, lọc theo năm.\n2. Bảng phải hiện đúng 20 dòng mỗi trang.\n'));
    task(f2, 'T-01', 'Sửa phân trang', step === 2 ? 'done' : 'verified', 'none', 'coder-04', 'master-02');
    // F-103: master-01 đang làm rõ (draft, to: none)
    put('F-103-csv/SPEC.md', doc({ id: 'F-103', title: 'Xuất báo cáo CSV', lane: 'full', status: 'draft', to: 'none', master: 'master-01' }));
    put('.run/master-01.now', 'Đang làm rõ: F-103 xuất báo cáo CSV\n');
    // F-104: coder-02 đang hỏi Master, tester-01 đang kiểm (Master gọi), coder-04 có lỗi phải sửa, coder-09 chưa khai báo
    const f4 = 'F-104-push';
    put(f4 + '/SPEC.md', doc({ id: 'F-104', title: 'Thông báo đẩy', lane: 'full', status: 'in_dev', to: 'none', master: 'master-02' }));
    task(f4, 'T-01', 'Đăng ký thiết bị', 'ready', 'coder-09', 'coder-09', 'tester-02');
    task(f4, 'T-02', 'Gửi thông báo', 'in_test', 'tester-01', 'coder-02', 'tester-01');
    task(f4, 'T-03', 'Mẫu nội dung', 'reopened', 'coder-04', 'coder-04', 'tester-02');
    put(f4 + '/questions/D-01.md', doc({ id: 'D-01', title: 'Gửi lại khi thiết bị offline?', from: 'coder-02', to: 'master-02', status: 'open', task: 'T-02' }));
    put(f4 + '/bugs/B-01.md', doc({ id: 'B-01', title: 'Thiếu tiêu đề', task: 'T-03', from: 'tester-02', to: 'coder-04', status: 'open', kind: 'bug' }));
    put('.run/tester-01.sub', 'F-104 T-02\n');
    put('.run/master-02.now', step === 2 ? 'Đang trả lời câu hỏi D-01 (F-104)\n' : 'Chờ bạn: nghiệm thu F-102\n');
    // cảnh 1: coder-05 được giao việc ở F-101, đi từ cây nước vào bàn
    if (step === 1 || step === 2) { task(f1, 'T-05', 'Ghi log đăng nhập', 'in_progress', 'coder-05', 'coder-05', 'tester-01'); put('.run/coder-05.sub', 'F-101 T-05\n'); }
  };
  let step = 0;
  const next = () => { try { scene(step % 5); } catch (e) { console.error(e.message); } step++; };
  next(); setInterval(next, 9000);
  process.on('exit', () => { try { fs.rmSync(base, { recursive: true, force: true }); } catch {} });
  return w;
}
if (DEMO) { W = demoSetup(); RUNDIR = path.join(W, '.run'); }


function readAgents() {
  return read(path.join(W, 'agents.txt')).split(/\r?\n/).map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const p = l.split(/\s+/); return { id: p[0], role: p[1] || '', mode: p[2] || '', note: p.slice(3).join(' ') }; });
}

function lastLog(id) {
  const d = path.join(W, 'logs');
  if (!isDir(d)) return null;
  const names = fs.readdirSync(d).filter(n => n.endsWith('-' + id + '.log')).sort();
  if (!names.length) return null;
  const name = names[names.length - 1];
  const text = read(path.join(d, name));
  const finished = /\[kết thúc/.test(text);
  const lines = text.trimEnd().split(/\r?\n/);
  let mtime = null; try { mtime = fs.statSync(path.join(d, name)).mtime.toISOString(); } catch {}
  return { name, finished, mtime, tail: lines.slice(-15).join('\n') };
}

function readFeatures() {
  if (!isDir(W)) return [];
  return fs.readdirSync(W).filter(n => /^F-\d+/.test(n) && isDir(path.join(W, n))).sort().map(dir => {
    const fd = path.join(W, dir);
    const specText = read(path.join(fd, 'SPEC.md'));
    const s = frontmatter(specText);
    const items = [];
    const add = (rel, m, kind, text) => items.push({
      path: dir + '/' + rel, file: rel, kind, id: m.id || rel, title: m.title || '', status: m.status || '',
      to: m.to || 'none', assignee: m.assignee || '', tester: m.tester || '', from: m.from || '',
      // Chỉ kèm nội dung khi file đang chờ chủ dự án
      sections: m.to !== 'owner' ? [] : kind === 'spec' ? sections(text, /cách thử|báo cáo/i) : [{ title: 'Nội dung', text: bodyOf(text) }],
    });
    if (specText) add('SPEC.md', s, 'spec', specText);
    for (const sub of ['tasks', 'questions', 'bugs']) {
      const sd = path.join(fd, sub);
      if (!isDir(sd)) continue;
      for (const n of fs.readdirSync(sd).filter(n => n.endsWith('.md')).sort()) { const t = read(path.join(sd, n)); add(sub + '/' + n, frontmatter(t), sub, t); }
    }
    return { dir, id: s.id || dir.split('-').slice(0, 2).join('-'), title: s.title || dir, status: s.status || '', to: s.to || 'none', master: s.master || '', items };
  });
}

// Master ghi .run/<ID>.now một dòng: đang làm gì, hoặc "Chờ bạn: …". Rỗng là phiên rảnh hay đã xong.
function readMasters() {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(RUNDIR).filter(n => n.endsWith('.now')); } catch { return out; }
  for (const n of names) {
    const fp = path.join(RUNDIR, n), text = read(fp).trim().split(/\r?\n/)[0] || '';
    if (!text) continue;
    let at = 0; try { at = fs.statSync(fp).mtimeMs; } catch {}
    out.push({ id: n.slice(0, -4), text: text.slice(0, 300), at, waitOwner: /^chờ bạn/i.test(text) });
  }
  return out;
}

// watch.sh ghi .run/watch.beat "<giây> <chu kỳ> <pid>" mỗi vòng quét; dừng đàng hoàng thì ghi .run/watch.stopped
function readWatch() {
  const b = read(path.join(RUNDIR, 'watch.beat')).trim().split(/\s+/);
  if (b[0]) {
    const at = Number(b[0]) * 1000, iv = Number(b[1]) || 30;
    return { state: Date.now() - at < (iv * 3 + 30) * 1000 ? 'running' : 'dead', at };
  }
  const s = read(path.join(RUNDIR, 'watch.stopped')).trim();
  if (s) { const i = s.indexOf(' '); return { state: 'stopped', at: Number(i > 0 ? s.slice(0, i) : s) * 1000, reason: i > 0 ? s.slice(i + 1) : '' }; }
  return { state: 'never' };
}

function state() {
  const agents = readAgents();
  // Chỉ Master ghi .now. Coder, Tester (subagent cũng nạp CLAUDE.md) lỡ ghi thì bỏ qua, kẻo "Chờ bạn:" của họ
  // (thật ra là chờ Master) hiện thành việc chờ chủ dự án
  const isMaster = new Set(agents.filter(a => a.role === 'master').map(a => a.id));
  const masters = readMasters().filter(m => isMaster.has(m.id));
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));
  for (const a of agents) {
    const lg = lastLog(a.id);
    a.running = !!(lg && !lg.finished && fs.existsSync(path.join(W, '.run', a.id + '.pid')));
    a.lastLog = lg; a.pending = []; a.features = [];
    a.paused = fs.existsSync(path.join(W, '.run', a.id + '.paused'));
    // Subagent do Master gọi không có pid hay log của watch.sh: Master ghi .run/<id>.sub ("F-001 T-01") lúc gọi,
    // ghi rỗng khi xong. File cũ hơn 90 phút coi như Master quên xoá.
    a.sub = '';
    try {
      const sf = path.join(W, '.run', a.id + '.sub');
      if (Date.now() - fs.statSync(sf).mtimeMs < 90 * 60 * 1000) a.sub = read(sf).trim();
    } catch {}
    if (a.sub) a.running = true;
    // Agent auto/window đang chạy: watch.sh ghi .run/<id>.job các việc nó được đánh thức cho ("F-001 T-01, F-001 B-02")
    a.job = a.running && !a.sub ? read(path.join(W, '.run', a.id + '.job')).trim() : '';
    // Các tính năng agent đang chạy cho; rỗng là không biết (hiện "đang chạy" ở mọi dãy bàn như cũ)
    a.runIn = [...new Set(((a.sub || a.job).match(/F-\d+/g) || []))];
    const m = masters.find(x => x.id === a.id);
    a.now = m ? m.text : ''; a.nowWait = !!(m && m.waitOwner);
  }
  const features = readFeatures();
  const owner = [];
  const unknown = new Set();
  for (const f of features) {
    const members = new Set();
    if (f.master) members.add(f.master);
    for (const it of f.items) {
      for (const x of [it.assignee, it.tester]) if (x) members.add(x);
      if (it.to === 'owner') owner.push({ feature: f.id, featureTitle: f.title, ...it });
      else if (it.to && it.to !== 'none') {
        members.add(it.to);
        if (byId[it.to]) byId[it.to].pending.push(it.path); else unknown.add(it.to);
      }
    }
    f.members = [...members];
    for (const m of f.members) if (byId[m]) byId[m].features.push(f.id); else unknown.add(m);
  }
  return {
    project: DEMO ? 'XEM THỬ (dữ liệu giả)' : path.basename(ROOT), now: new Date().toISOString(),
    hasWorkflow: isDir(W), agents, features, owner, unknown: [...unknown], masters, watch: readWatch(),
    // Do watch.sh ghi mỗi lần quét (việc không ai cầm, status/to lệch, thiếu Nguồn:, chờ quá lâu)
    anomalies: read(path.join(W, '.run', 'lint.txt')).split(/\r?\n/).filter(Boolean).map(s => s.replace(/`/g, '')),
  };
}

// ---------- Máy chủ ----------
// Mã bí mật cho lệnh dừng (sh workflow/watch.sh --stop): ghi vào .run/, chỉ ai đọc được thư mục dự án mới dừng được
const TOKEN = crypto.randomBytes(16).toString('hex');
const runFile = n => path.join(RUNDIR, n);
function writeRun() {
  if (!isDir(W)) return;
  try {
    fs.mkdirSync(RUNDIR, { recursive: true });
    fs.writeFileSync(runFile('monitor.token'), TOKEN, { mode: 0o600 });
    fs.writeFileSync(runFile('monitor.port'), String(port));
    fs.writeFileSync(runFile('monitor.pid'), String(process.pid));
  } catch {}
}
function quit() {
  if (read(runFile('monitor.token')).trim() === TOKEN) for (const n of ['monitor.token', 'monitor.port', 'monitor.pid']) { try { fs.unlinkSync(runFile(n)); } catch {} }
  process.exit(0);
}
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, quit);

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'POST' && url === '/api/stop') {
    if (req.headers['x-token'] !== TOKEN) { res.writeHead(403); return res.end(); }
    res.writeHead(200); res.end('ok');
    return setTimeout(quit, 50);
  }
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (url === '/api/state') {
    let body;
    try { body = JSON.stringify(state()); } catch (e) { res.writeHead(500); return res.end(String(e.message)); }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(PAGE);
  }
  res.writeHead(404); res.end('Không có');
});
function fail(e) {
  console.error(e && e.code === 'EADDRINUSE'
    ? `Cổng ${port} đang bị chiếm, có thể bởi monitor bản cũ (chưa có lệnh dừng): đóng terminal đang chạy nó. Hoặc dùng cổng khác: --port ${port + 1}`
    : String(e && e.message || e));
  process.exit(1);
}
let retried = false;
server.on('error', e => {
  // Cổng bận vì monitor cũ của chính dự án này: dừng nó bằng mã bí mật nó để lại, rồi chạy bản mới
  const old = read(runFile('monitor.token')).trim(), oldPort = Number(read(runFile('monitor.port')).trim());
  if (e.code !== 'EADDRINUSE' || retried || !old || oldPort !== port) return fail(e);
  retried = true;
  const r = http.request({ host: '127.0.0.1', port, path: '/api/stop', method: 'POST', headers: { 'X-Token': old }, timeout: 3000 }, res => {
    res.resume();
    if (res.statusCode !== 200) return fail(e);
    console.log('Đã dừng monitor cũ trên cổng ' + port + ', chạy bản mới.');
    setTimeout(() => server.listen(port, '127.0.0.1'), 800);
  });
  r.on('error', () => fail(e)); r.on('timeout', () => { r.destroy(); fail(e); }); r.end();
});
server.listen(port, '127.0.0.1', () => {
  writeRun();
  console.log(`Monitor: http://localhost:${port}   (đọc ${W})`);
  console.log('Ctrl+C để dừng, hoặc: sh workflow/watch.sh --stop');
});

// ---------- Trang ----------
const PAGE = String.raw`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Văn phòng agent</title>
<style>
:root{--bg:#e9e1d0;--paper:#fbf4e4;--ink:#3b2a20;--fg:#2d241d;--fg2:#6b5c4e;--line:#cdbfa6;--accent:#2f63c4;
--run:#1f7a4d;--runbg:#dff3e6;--wait:#9a5a00;--waitbg:#fdf0d2;--bad:#b23030;--badbg:#fbe3e0}
@media (prefers-color-scheme:dark){:root{--bg:#1d1a17;--paper:#2a2520;--ink:#0e0c0a;--fg:#f2ebdf;--fg2:#bcae9c;--line:#4a4036;--accent:#8fb4ff;
--run:#6bd79f;--runbg:#1d3a2b;--wait:#f2b44f;--waitbg:#3d2f16;--bad:#ff8f8f;--badbg:#3f2020}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
main{max-width:1200px;margin:0 auto}
.pix{background:var(--paper);border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink);padding:12px 14px;margin-bottom:16px}
header.pix{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
h1{font:700 19px ui-monospace,Consolas,monospace;margin:0;letter-spacing:.02em}
h2{font:700 12.5px ui-monospace,Consolas,monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--fg2);margin:0 0 8px}
.sp{flex:1}
.badge{font:700 12px ui-monospace,Consolas,monospace;padding:3px 8px;border:2px solid var(--ink);background:var(--paper);white-space:nowrap}
.badge.warn{background:var(--waitbg);color:var(--wait)}.badge.off{background:var(--badbg);color:var(--bad)}
.banner{font:700 18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer}
.banner.owner{background:var(--badbg);color:var(--bad);border-color:var(--bad);box-shadow:4px 4px 0 var(--bad);font-size:20px}
.banner.flow{background:var(--runbg);color:var(--run);border-color:var(--run);box-shadow:4px 4px 0 var(--run)}
.banner p{margin:2px 0}.banner .small{font-size:14px;font-weight:600}.banner .alert{color:var(--bad);font-size:15px}
.need.on{background:var(--waitbg);border-color:var(--wait);box-shadow:4px 4px 0 var(--wait)}
.need.on h2{color:var(--wait)}
.ask{border-top:2px dashed var(--line);padding:10px 0 4px}.ask:first-of-type{border-top:0;padding-top:0}
.ask .act{font-weight:700;font-size:16px;margin:0 0 2px}
.ask p{margin:2px 0}.ask .say code{background:var(--paper);border:1px solid var(--line);padding:1px 6px;font-size:14px}
.ask details{margin-top:6px}.ask pre{white-space:pre-wrap;font:13px/1.5 ui-monospace,Consolas,monospace;background:var(--paper);border:1px solid var(--line);padding:8px 10px;margin:4px 0 0;max-height:360px;overflow:auto}
.muted{color:var(--fg2);font-size:13px;margin:0}
.scene{padding:6px;background:#2a211b}
#office{display:block;width:100%;height:auto;shape-rendering:crispEdges}
.scene{position:relative}
#walk{position:absolute;left:6px;top:6px;width:calc(100% - 12px);height:auto;pointer-events:none;shape-rendering:crispEdges}
#office text{shape-rendering:auto;font-family:ui-monospace,Consolas,monospace;font-weight:700}
#office .bub,#office .lbl,#office .sel{shape-rendering:auto}
#office .ag{cursor:pointer}
#office .ag:focus{outline:none}
#office .ag .sel{display:none}#office .ag.on .sel,#office .ag:focus-visible .sel,#office .ag:hover .sel{display:inline}
#office .sit .armR,#office .sit .armL,#office .conf rect,#office .eyes{transform-box:fill-box}
@media (prefers-reduced-motion:no-preference){
 .sit.type .armL{animation:tp .32s steps(2) infinite}.sit.type .armR{animation:tp .32s steps(2) infinite .16s}@keyframes tp{50%{transform:translateY(-2px)}}
 .sit.wait .armR{animation:tap 1.1s steps(2) infinite}@keyframes tap{50%{transform:translateY(-3px)}}
 .sit.idle .head{animation:nod 3.2s ease-in-out infinite}@keyframes nod{50%{transform:translateY(1.5px)}}
 .glow{animation:glow 1.4s ease-in-out infinite}@keyframes glow{50%{opacity:.35}}
 .sit.hand .armR{animation:hand .9s ease-in-out infinite;transform-origin:50% 100%}@keyframes hand{50%{transform:rotate(9deg)}}
 .code rect{animation:cd 1.2s steps(1) infinite}.code rect:nth-child(2){animation-delay:.3s}.code rect:nth-child(3){animation-delay:.6s}.code rect:nth-child(4){animation-delay:.9s}@keyframes cd{50%{opacity:.15}}
 .steam rect{animation:st 1.6s ease-out infinite}.steam rect:nth-child(2){animation-delay:.7s}@keyframes st{0%{transform:translateY(2px);opacity:0}40%{opacity:.9}100%{transform:translateY(-5px);opacity:0}}
 .bug{animation:crawl 2.6s steps(7) infinite alternate}@keyframes crawl{100%{transform:translateX(20px)}}
 .bub.bob{animation:bob 1.2s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-2px)}}
 .bub.zz{animation:zz 2.8s ease-in-out infinite}@keyframes zz{0%,100%{transform:translate(0,0);opacity:.7}50%{transform:translate(2px,-3px);opacity:1}}
 .sip{animation:sip 3.6s steps(1) infinite}@keyframes sip{0%,70%{transform:none}75%,95%{transform:translateY(-8px)}}
 .eyes{animation:blink 4.2s steps(1) infinite;transform-origin:center}@keyframes blink{0%,94%{transform:none}95%,100%{transform:scaleY(.2)}}
 .wave{animation:paper 1s ease-in-out infinite}@keyframes paper{50%{transform:translateY(-3px)}}
 .walker .legL{animation:wl .3s steps(2) infinite}.walker .legR{animation:wl .3s steps(2) infinite .15s}@keyframes wl{50%{transform:translateY(-2px)}}
 .ag.arrive{animation:arrive 1.45s steps(1) both}@keyframes arrive{0%{opacity:0}100%{opacity:1}}
 .mhand{animation:spin 12s linear infinite;transform-origin:255px 45px}.hhand{animation:spin 144s linear infinite;transform-origin:255px 45px}@keyframes spin{to{transform:rotate(360deg)}}
 .conf rect{animation:fall 2.8s linear infinite;transform-origin:center}@keyframes fall{0%{transform:translateY(-6px) rotate(0)}100%{transform:translateY(96px) rotate(540deg)}}
 .blink{animation:bl 1s steps(2) infinite}@keyframes bl{50%{opacity:.35}}}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:#e9dcc6;padding:6px 4px 2px}
details{margin:6px 0}details summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:4px}
td{padding:3px 6px;border-top:1px dashed var(--line);vertical-align:top}
td:last-child{white-space:nowrap}
.sq{display:inline-block;width:10px;height:10px;border:1px solid var(--ink);margin-right:6px;vertical-align:-1px}
#detail{position:fixed;right:16px;bottom:16px;width:min(460px,calc(100% - 32px));max-height:70vh;overflow:auto;display:none;z-index:5}
#detail pre{white-space:pre-wrap;font-size:12px;background:var(--bg);border:1px solid var(--line);padding:8px;max-height:280px;overflow:auto}
#detail button{float:right;font:inherit;font-size:13px;border:2px solid var(--ink);background:var(--paper);color:var(--fg);cursor:pointer;box-shadow:2px 2px 0 var(--ink)}
</style></head>
<body><main>
<header class="pix"><h1 id="proj">VĂN PHÒNG AGENT</h1><span class="sp"></span>
<span class="badge" id="bFeat"></span><span class="badge" id="bRun"></span><span class="badge warn" id="bNeed"></span><span class="badge" id="bWatch"></span><span class="badge" id="bConn">…</span></header>
<section class="pix banner" id="banner" hidden tabindex="0" role="button"></section>
<section class="pix need" id="needBox"><h2>Cần bạn</h2><div id="need"></div></section>
<section class="pix scene" aria-label="Văn phòng: mỗi tính năng một dãy bàn">
<svg id="office" role="img" aria-label="Văn phòng agent"></svg>
<svg id="walk" aria-hidden="true"></svg>
<div class="legend" id="legend"></div>
</section>
<section class="pix"><h2>File của từng tính năng</h2><div id="files"></div></section>
<p class="muted">Trang chỉ đọc, tự làm mới 3 giây một lần. Bấm vào nhân vật để xem chi tiết. Trả lời và duyệt: nói với Master.</p>
</main>
<section class="pix" id="detail" aria-live="polite"></section>
<script>
const COLORS=['#2f6fe0','#1f9a6e','#e07a1f','#8b4fd0','#d8457f','#0f8f9f','#a0782a'];
const HAIR=['#3b2a20','#7a4a22','#c9a24a','#2d2d3a','#a33a2a','#5a3a2a','#1f1a17','#6b3d1e'];
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let S=null,openId=null;const OPEN=new Map();
const MODE_NAME={auto:'chạy ngầm tự động',window:'tự mở cửa sổ',manual:'đánh thức tay',subagent:'subagent, Master tự gọi'};
const MODE_WAIT={auto:'Có việc, chờ watch.sh đánh thức',window:'Có việc, chờ watch.sh mở cửa sổ',manual:'Có việc, cần mở phiên tay',subagent:'Có việc, chờ Master gọi'};
const ST={draft:'chờ bạn duyệt',review:'đang khảo sát',reviewed:'đã khảo sát',in_dev:'đang làm',ready:'sẵn sàng làm',in_test:'đang kiểm tra',verified:'kiểm tra đạt',reopened:'phải sửa lại',acceptance:'chờ bạn nghiệm thu',done:'xong',open:'đang mở',answered:'đã trả lời',closed:'đã đóng',fixed:'đã sửa'};
const stVi=x=>ST[x]||x||'?';
// Nhãn trạng thái của tính năng / file: draft chỉ là "chờ bạn duyệt" khi to: owner; còn lại Master đang làm rõ
const stOf=o=>o.status==='draft'&&o.to!=='owner'?'đang làm rõ':stVi(o.status);
// Chủ dự án cần làm gì với một file to: owner
function ownerAction(o){
 if(o.kind==='spec'&&o.status==='acceptance')return{act:'Đã làm xong, chờ bạn nghiệm thu',how:'Thử theo hướng dẫn bên dưới. Ổn thì nói với Master câu này; chưa ổn thì nói rõ chỗ chưa đạt.',say:'đạt'};
 if(o.kind==='spec')return{act:'Tài liệu chờ bạn duyệt',how:'Đọc file workflow/'+o.path+'. Ổn thì nói với Master câu này; chưa ổn thì nói chỗ cần sửa.',say:'duyệt'};
 if(o.kind==='questions')return{act:'Câu hỏi chờ bạn trả lời',how:'Master sẽ hỏi bạn trong phiên chat. Nếu Master chưa hỏi, nói với Master câu này.',say:'Xử lý việc đang chờ'};
 return{act:'Cần bạn xem',how:'Mở file workflow/'+o.path+' rồi trao đổi với Master.',say:''};
}
const hashN=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h};

/* ---------- vẽ pixel ---------- */
const R=(x,y,w,h,c,ex)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"'+(ex||'')+'/>';
const T=(x,y,s,c,t,a)=>'<text x="'+x+'" y="'+y+'" font-size="'+s+'" fill="'+c+'" text-anchor="'+(a||'middle')+'">'+esc(t)+'</text>';
// X2: vẽ đồ vật ở lưới thô (kiểu cũ) với kích thước gấp đôi, gốc toạ độ tại (x,y) của lưới mịn
const X2=(x,y,inner)=>'<g transform="translate('+x+','+y+') scale(2)">'+inner+'</g>';
function defs(){return '<defs>'
 +'<pattern id="wd" width="2" height="2" patternUnits="userSpaceOnUse">'+R(0,0,2,2,'#a9b3c6')+R(0,0,1,1,'#8e99b0')+R(1,1,1,1,'#8e99b0')+'</pattern>'
 +'<pattern id="fl" width="32" height="12" patternUnits="userSpaceOnUse">'+R(0,0,32,12,'#e4a467')+R(0,5,32,1,'#c27b42')+R(0,11,32,1,'#c27b42')+R(0,0,1,5,'#c27b42')+R(16,0,1,5,'#c27b42')+R(8,6,1,5,'#c27b42')+R(24,6,1,5,'#c27b42')+R(3,1,4,1,'#eeb67f')+R(19,2,5,1,'#eeb67f')+R(11,7,5,1,'#eeb67f')+R(27,8,3,1,'#eeb67f')+'</pattern></defs>'}
function shelf(x){let s=R(x-1,13,24,43,'#6e3a20')+R(x,14,22,41,'#f1dcae')+R(x,14,22,3,'#e3c891');const b=['#3f8f4a','#c23b3b','#2f5fb3','#7a3fa0','#e0a12b'];
 [19,30].forEach((y,r)=>{s+=R(x+2,y,18,9,'#4a2a18');for(let i=0;i<6;i++)s+=R(x+3+i*3,y+1+(i%3===1?1:0),2,8-(i%3===1?1:0),b[(i+r*2)%b.length])});
 return s+R(x+2,41,18,12,'#dcb072')+R(x+10,41,1,12,'#b98a4f')}
function monitor(x,y,on,c){let s=R(x,y,16,11,'#3a3d4a')+R(x+1,y+1,14,8,on?'#251f3a':'#15171d')+R(x+7,y+11,2,2,'#3a3d4a')+R(x+5,y+13,6,1,'#3a3d4a');
 if(on)s+=R(x+2,y+2,6,1,c)+R(x+3,y+4,8,1,'#55d27a')+R(x+2,y+6,4,1,'#e05a5a')+R(x+7,y+6,5,1,c);return s}
function desk(x,y,w){return R(x,y,w,9,'#efd9a9')+R(x,y,w,1,'#fbecc8')+R(x,y+8,w,1,'#c9a46a')+R(x+1,y+9,2,6,'#b98a4f')+R(x+w-3,y+9,2,6,'#b98a4f')}
/* ---------- đồ trang trí ---------- */
function windowPane(x,y){return R(x,y,40,22,'#6e3a20')+R(x+2,y+2,36,18,'#8fd0f5')+R(x+2,y+13,36,7,'#b7e3fa')+R(x+8,y+5,8,2,'#ffffff')+R(x+6,y+6,12,2,'#ffffff')+R(x+25,y+9,6,2,'#ffffff')+R(x+19,y+2,2,18,'#6e3a20')+R(x+2,y+10,36,1,'#6e3a20')+R(x-1,y+21,42,2,'#a85a32')}
function picture(x,y){return R(x,y,12,12,'#c9a24a')+R(x+1,y+1,10,10,'#fdf3d8')+R(x+1,y+7,10,4,'#5fa55a')+R(x+3,y+4,4,4,'#7c8ea8')+R(x+5,y+3,2,2,'#7c8ea8')+R(x+8,y+2,2,2,'#f2c14e')}
function calendar(x,y){let s=R(x,y,16,16,'#fbfbf7')+R(x,y,16,4,'#d64545')+R(x+3,y-1,1,2,'#3b2a20')+R(x+12,y-1,1,2,'#3b2a20');
 for(let r=0;r<3;r++)for(let c=0;c<4;c++)s+=R(x+2+c*3,y+6+r*3,2,2,r===1&&c===2?'#d64545':'#c9c3b8');return s}
function plant(x,y){return R(x+1,y+12,8,8,'#b5652f')+R(x,y+12,10,2,'#c97a3f')+R(x+4,y+4,2,8,'#3f7a3a')+R(x,y+2,4,4,'#4f9a48')+R(x+6,y,4,5,'#4f9a48')+R(x+2,y+6,3,3,'#3f8a3a')+R(x+5,y+5,4,3,'#5fae55')+R(x+1,y+2,1,1,'#7cc46f')+R(x+7,y,1,1,'#7cc46f')}
function cooler(x){return R(x+2,22,12,15,'#7fc6ea')+R(x+4,24,2,10,'#c9ecff')+R(x,37,16,21,'#96a0b4')+R(x,37,16,2,'#b6bfd0')+R(x+4,44,2,2,'#d64545')+R(x+9,44,2,2,'#3f78d6')+R(x+3,49,10,1,'#7d879b')}
function bunting(w){let s='';const c=['#d64545','#f2c14e','#3f8f4a','#2f6fe0','#8b4fd0'];for(let x=4,i=0;x<w-6;x+=9,i++)s+=R(x,3,5,2,c[i%c.length])+R(x+1,5,3,1,c[i%c.length])+R(x+2,6,1,1,c[i%c.length]);return R(0,2,w,1,'#7a3d20')+s}
// Lối đi thảm đỏ từ bàn của bạn chạy thẳng xuống
function aisle(x,y,w,h){let s=R(x,y,w,h,'#9c2f2f')+R(x,y,2,h,'#d4a84a')+R(x+w-2,y,2,h,'#d4a84a');for(let yy=y+4;yy<y+h-2;yy+=8)s+=R(x+w/2-1,yy,2,2,'#c4544a');return s}
/* ---------- chú chó ---------- */
const PET={s:40,goal:40,pause:20,dir:1,frame:0,bark:0},PET_SPEED=1.2;
let PET_PATH=[[108,57],[328,57],[328,120]];
const segLen=(a,b)=>Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]);
const pathLen=()=>PET_PATH.slice(1).reduce((t,p,i)=>t+segLen(PET_PATH[i],p),0);
function petAt(s){for(let i=1;i<PET_PATH.length;i++){const a=PET_PATH[i-1],b=PET_PATH[i],l=segLen(a,b);if(s<=l||i===PET_PATH.length-1){const k=l?Math.min(1,s/l):0;return[Math.round(a[0]+(b[0]-a[0])*k),Math.round(a[1]+(b[1]-a[1])*k),a[1]===b[1]]}s-=l}return PET_PATH[0]}
function dogInner(){
 const sit=PET.pause>0,f=PET.frame%2,c='#b0743c',d='#7a4a22',l='#e2b07a';
 let s=R(2,3,7,3,c)+R(3,5,5,1,l)+R(8,1,4,4,c)+R(11,3,2,2,l)+R(12,3,1,1,'#2b2b2b')+R(10,2,1,1,'#2b2b2b')+R(8,0,2,2,d)+R(8,4,1,1,'#d64545');
 s+=sit?R(1,2-(PET.frame%4<2?1:0),2,1,c)+R(2,6,2,2,c)+R(7,6,2,2,c):R(0,2+f,2,1,c)+R(3+f,6,1,2,d)+R(8-f,6,1,2,d);
 if(PET.bark>0)s+='<g transform="'+(PET.dir<0?'matrix(-1 0 0 1 12 0)':'')+'">'+R(7,-8,14,7,'#ffffff')+R(7,-8,14,1,'#3b2a20')+R(7,-2,14,1,'#3b2a20')+R(7,-8,1,7,'#3b2a20')+R(20,-8,1,7,'#3b2a20')+T(14,-3,3.6,'#3b2a20','Gâu!')+'</g>';
 return '<g transform="'+(PET.dir<0?'matrix(-1 0 0 1 12 0)':'')+'">'+s+'</g>'}
function petSvg(){const[x,y]=petAt(PET.s);return '<g id="pet" transform="translate('+(x-6)+','+(y-8)+')" style="cursor:pointer" aria-hidden="true">'+dogInner()+'</g>'}
function petTick(){
 const g=document.getElementById('pet');if(!g||document.hidden)return;
 if(MOTION_OK){
  if(PET.pause>0)PET.pause--;
  else if(Math.abs(PET.goal-PET.s)<=PET_SPEED){PET.s=PET.goal;PET.pause=10+Math.floor(Math.random()*30);PET.goal=Math.floor(Math.random()*pathLen())}
  else{const before=petAt(PET.s);PET.s+=PET.goal>PET.s?PET_SPEED:-PET_SPEED;const after=petAt(PET.s);if(after[0]!==before[0])PET.dir=after[0]>before[0]?1:-1}
  PET.frame++;
 }
 if(PET.bark>0)PET.bark--;
 const[x,y]=petAt(PET.s);g.setAttribute('transform','translate('+(x-6)+','+(y-8)+')');g.innerHTML=dogInner();
}
const MOTION_OK=!window.matchMedia||!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
setInterval(petTick,120);
/* ---------- nhân vật: lưới mịn, gấp đôi lưới của đồ vật ---------- */
const OL='#2b1d16'; // viền nhân vật
const SKIN=['#f2c9a0','#e3b07f','#c98d5e','#9c6b45'];
const STYLE=['short','long','bun','spiky','curly','short'];
const PANTS=['#3a3f5c','#4a3b2a','#2f4a5a','#3b3b3b'];
// Ngoại hình cố định theo ID: tóc, da, kiểu tóc, quần
function look(id){const h=hashN(id);return{hair:HAIR[h%HAIR.length],skin:SKIN[(h>>>3)%SKIN.length],style:STYLE[(h>>>5)%STYLE.length],pants:PANTS[(h>>>8)%PANTS.length]}}
// Trang phục theo vai: Master sơ mi và tai nghe, Coder áo hoodie, Tester áo blouse trắng
function outfit(role,color){
 if(role==='tester')return{shirt:'#f4f1ea',shade:'#d6d0c4',inner:color};
 return{shirt:color,shade:'rgba(0,0,0,.22)',inner:role==='coder'?'rgba(0,0,0,.25)':'#ffffff'};
}
function hairTop(cx,y,L){
 if(L.style==='bun')return R(cx-3,y-5,6,5,OL)+R(cx-2,y-4,4,4,L.hair)+R(cx-1,y-4,1,1,'rgba(255,255,255,.3)');
 if(L.style==='spiky')return R(cx-6,y-2,2,2,L.hair)+R(cx-2,y-3,2,3,L.hair)+R(cx+2,y-2,2,2,L.hair)+R(cx+5,y-1,2,1,L.hair);
 if(L.style==='curly')return R(cx-7,y,2,3,L.hair)+R(cx+5,y,2,3,L.hair)+R(cx-4,y-2,3,2,L.hair)+R(cx+1,y-2,3,2,L.hair);
 return '';
}
function headset(cx,y,front){return R(cx-7,y+1,14,2,'#2d2d3a')+R(cx-8,y+3,2,5,'#2d2d3a')+R(cx+6,y+3,2,5,'#2d2d3a')+(front?R(cx+6,y+8,4,1,'#2d2d3a')+R(cx+9,y+8,1,1,'#d64545'):'')}
// Thân trên và mặt nhìn thẳng (dùng cho người ngồi sau bàn và người đứng)
function torsoFront(cx,y,L,role,o){
 let s='';
 if(L.style==='long')s+=R(cx-8,y+2,16,15,OL)+R(cx-7,y+3,14,13,L.hair);
 s+=R(cx-10,y+12,20,20,OL)+R(cx-9,y+13,18,19,o.shirt)+R(cx+4,y+13,5,19,o.shade);
 if(role==='tester')s+=R(cx-3,y+13,6,8,o.inner)+R(cx-1,y+13,2,19,o.shade)+R(cx-7,y+20,3,3,'#9aa3b5');
 else if(role==='master'||role==='boss')s+=R(cx-2,y+13,4,6,'#ffffff')+R(cx-1,y+14,2,7,'#d64545');
 else s+=R(cx-4,y+12,8,3,o.inner)+R(cx-3,y+15,1,5,'#f4efe6')+R(cx+2,y+15,1,5,'#f4efe6');
 s+=R(cx-2,y+11,4,2,L.skin);
 let h=R(cx-7,y-1,14,13,OL)+R(cx-6,y+1,12,10,L.skin)+R(cx-6,y,12,3,L.hair)+R(cx-6,y+3,2,3,L.hair)+R(cx+4,y+3,2,2,L.hair)+hairTop(cx,y,L);
 h+='<g class="eyes">'+R(cx-4,y+5,2,2,'#2b2b2b')+R(cx+2,y+5,2,2,'#2b2b2b')+'</g>'
  +R(cx-5,y+8,2,1,'#f3a3a3')+R(cx+3,y+8,2,1,'#f3a3a3')+R(cx-1,y+9,2,1,'rgba(120,60,40,.45)');
 if(role==='master')h+=headset(cx,y,true);
 return s+'<g class="head">'+h+'</g>';
}
// Người ngồi sau bàn, quay mặt ra. y: đỉnh đầu; bàn che từ y+34 trở xuống.
// pose: type (gõ phím), wait (gõ ngón tay chờ), idle (gật gù), hand (giơ tay hỏi)
function sitFront(cx,y,L,role,color,pose){
 const o=outfit(role,color);
 let s=torsoFront(cx,y,L,role,o);
 s+=R(cx-13,y+13,5,22,OL)+R(cx-12,y+14,3,20,o.shirt);
 if(pose==='hand')s+='<g class="armR">'+R(cx+8,y-9,5,24,OL)+R(cx+9,y-8,3,22,o.shirt)+R(cx+8,y-13,5,5,OL)+R(cx+9,y-12,3,3,L.skin)+'</g>';
 else s+=R(cx+8,y+13,5,22,OL)+R(cx+9,y+14,3,20,o.shirt);
 return '<g class="sit '+pose+'">'+s+'</g>';
}
// Cẳng tay đặt trên mặt bàn (vẽ sau bàn). Y: mép trên mặt bàn
function forearms(cx,Y,L,role,color,pose){
 const o=outfit(role,color);
 const l='<g class="armL">'+R(cx-15,Y-3,9,6,OL)+R(cx-14,Y-2,5,4,o.shirt)+R(cx-9,Y-2,3,4,L.skin)+'</g>';
 const r='<g class="armR">'+R(cx+6,Y-3,9,6,OL)+R(cx+9,Y-2,5,4,o.shirt)+R(cx+6,Y-2,3,4,L.skin)+'</g>';
 return '<g class="sit '+pose+'">'+l+(pose==='hand'?'':r)+'</g>';
}
// Laptop nhìn từ phía sau: logo sáng nhấp nháy khi đang làm
function laptopBack(cx,Y,run,c){return R(cx-10,Y-13,20,13,OL)+R(cx-9,Y-12,18,11,'#c9cdd6')+R(cx-9,Y-12,18,1,'#e3e6ec')+R(cx-11,Y-1,22,2,'#9aa0ac')
 +'<g class="'+(run?'glow':'')+'">'+R(cx-2,Y-8,4,4,run?c:'#9aa0ac')+'</g>'}
// Màn hình nhìn từ phía sau (bàn Master): đèn nguồn xanh khi đang làm
function monitorBack(x,Y,run){return R(x,Y-27,22,17,OL)+R(x+1,Y-26,20,15,'#4a4e5e')+R(x+1,Y-26,20,1,'#5d6273')+R(x+9,Y-10,4,9,'#3a3d4a')+R(x+5,Y-2,12,2,'#3a3d4a')
 +R(x+17,Y-13,2,1,run?'#55d27a':'#8a8f9c')}
// Người đứng nhìn thẳng. hold: cup (cốc nước), paper (giơ tờ giấy), lens (kính lúp) hoặc rỗng
function standFront(cx,y,L,role,color,hold){
 const o=outfit(role,color);let s='';
 if(L.style==='long')s+=R(cx-8,y+2,16,15,OL)+R(cx-7,y+3,14,13,L.hair);
 s+='<g class="legL">'+R(cx-6,y+25,6,12,OL)+R(cx-5,y+25,4,10,L.pants)+R(cx-6,y+35,6,3,'#2b2118')+'</g>'
   +'<g class="legR">'+R(cx,y+25,6,12,OL)+R(cx+1,y+25,4,10,L.pants)+R(cx,y+35,6,3,'#2b2118')+'</g>';
 s+=R(cx-9,y+12,18,15,OL)+R(cx-8,y+13,16,13,o.shirt)+R(cx+3,y+13,5,13,o.shade)+R(cx-8,y+25,16,1,'#2b2b38');
 if(role==='tester')s+=R(cx-3,y+13,6,8,o.inner)+R(cx-1,y+13,2,13,o.shade)+R(cx-6,y+20,3,3,'#9aa3b5');
 else if(role==='master'||role==='boss')s+=R(cx-2,y+13,4,6,'#ffffff')+R(cx-1,y+14,2,7,'#d64545');
 else s+=R(cx-3,y+13,6,3,o.inner)+R(cx-4,y+17,1,5,'#f4efe6')+R(cx+3,y+17,1,5,'#f4efe6');
 s+=R(cx-2,y+11,4,2,L.skin);
 s+=R(cx-7,y-1,14,13,OL)+R(cx-6,y+1,12,10,L.skin)+R(cx-6,y,12,3,L.hair)+R(cx-6,y+3,2,3,L.hair)+R(cx+4,y+3,2,2,L.hair)+hairTop(cx,y,L);
 s+='<g class="eyes">'+R(cx-4,y+5,2,2,'#2b2b2b')+R(cx+2,y+5,2,2,'#2b2b2b')+'</g>'
  +R(cx-5,y+8,2,1,'#f3a3a3')+R(cx+3,y+8,2,1,'#f3a3a3')+R(cx-1,y+9,2,1,'rgba(120,60,40,.45)');
 if(role==='master')s+=headset(cx,y,true);
 s+=R(cx-11,y+13,4,10,OL)+R(cx-10,y+14,2,8,o.shirt)+R(cx-10,y+22,2,2,L.skin);
 if(hold==='paper')s+='<g class="wave">'+R(cx+7,y+1,4,13,OL)+R(cx+8,y+2,2,11,o.shirt)
  +R(cx+6,y-10,13,12,OL)+R(cx+7,y-9,11,10,'#ffffff')+R(cx+9,y-7,7,1,'#9aa3b5')+R(cx+9,y-5,7,1,'#9aa3b5')+R(cx+9,y-3,5,1,'#9aa3b5')+R(cx+9,y-1,6,1,'#d64545')+'</g>';
 else s+='<g class="'+(hold==='cup'?'sip':'')+'">'+R(cx+7,y+13,4,10,OL)+R(cx+8,y+14,2,8,o.shirt)+R(cx+8,y+22,2,2,L.skin)
  +(hold==='cup'?R(cx+9,y+18,6,7,OL)+R(cx+10,y+19,4,5,'#ffffff')+R(cx+10,y+19,4,2,'#bfe3f5'):'')
  +(hold==='lens'?R(cx+9,y+15,8,8,OL)+R(cx+10,y+16,6,6,'#bfe3f5')+R(cx+11,y+17,2,2,'#ffffff')+R(cx+9,y+22,2,4,'#7a4a22'):'')+'</g>';
 return s;
}
/* ---------- đồ trên bàn ---------- */
function cup(x,y,hot){return R(x,y,7,8,OL)+R(x+1,y+1,5,6,'#ffffff')+R(x+1,y+1,5,2,'#7a4a22')+R(x+7,y+2,2,4,OL)
 +(hot?'<g class="steam">'+R(x+2,y-4,1,3,'rgba(255,255,255,.75)')+R(x+4,y-7,1,3,'rgba(255,255,255,.6)')+'</g>':'')}
function lensProp(x,y){return R(x,y,7,7,OL)+R(x+1,y+1,5,5,'#bfe3f5')+R(x+2,y+2,1,1,'#ffffff')+R(x+6,y+6,4,2,'#7a4a22')}
function papers(x,y){return R(x,y+2,12,8,'#d9d4c8')+R(x+1,y,12,8,OL)+R(x+2,y+1,10,6,'#ffffff')+R(x+4,y+3,6,1,'#9aa3b5')+R(x+4,y+5,4,1,'#9aa3b5')}
function bug(x,y){return '<g class="bug">'+R(x,y+1,9,6,OL)+R(x+1,y+2,7,4,'#d64545')+R(x+4,y+2,1,4,OL)+R(x+8,y+2,3,3,OL)
 +R(x-1,y+1,1,1,OL)+R(x-1,y+6,1,1,OL)+R(x+3,y,1,1,OL)+R(x+3,y+7,1,1,OL)+R(x+6,y,1,1,OL)+R(x+6,y+7,1,1,OL)+'</g>'}
function chair(cx,y){return R(cx-6,y,12,9,'#4f5669')+R(cx-5,y,10,1,'#6c7488')+R(cx-6,y+1,1,8,'#454b5c')+R(cx-1,y+9,2,2,'#363b48')+R(cx-4,y+11,8,1,'#363b48')+R(cx-5,y+12,1,1,'#2a2e38')+R(cx+4,y+12,1,1,'#2a2e38')}
/* ---------- bong bóng, biển tên ---------- */
function bubble(cx,y,txt,kind){
 const col={run:['#ffffff','#1f7a4d'],wait:['#fff6dc','#9a5a00'],idle:['#efe9df','#8a8278'],bad:['#ffe6e3','#b23030']}[kind];
 const w=Math.max(18,txt.length*6.4+10),x=cx-w/2;
 const cls=kind==='wait'||kind==='bad'?'bob':txt==='z'?'zz':'';
 return '<g class="bub '+cls+'">'
  +'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="15" rx="4" fill="'+col[0]+'" stroke="'+OL+'" stroke-width="1.5"/>'
  +'<path d="M'+(cx-3)+' '+(y+14.2)+' l3 4.5 l3 -4.5" fill="'+col[0]+'" stroke="'+OL+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +T(cx,y+11.3,10.5,col[1],txt)+'</g>'}
function label(cx,y,name,short,kind){
 const c={run:'#8ff0b8',wait:'#ffd27a',idle:'#ddd3c5',bad:'#ff9c9c'}[kind];
 const w=Math.max(name.length*5.6,short.length*4.9)+12;
 return '<g class="lbl"><rect x="'+(cx-w/2)+'" y="'+y+'" width="'+w+'" height="23" rx="4" fill="rgba(43,33,27,.84)"/>'+T(cx,y+10,9,'#fff6e6',name)+T(cx,y+19.5,8,c,short)+'</g>'}
function selBox(x,y,w,h){return '<rect class="sel" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6" fill="rgba(255,224,102,.12)" stroke="#ffe066" stroke-width="2"/>'}
// Trạng thái ngắn ghi dưới bàn
function shortOf(a,st,asking){
 if(st.kind==='bad')return 'chưa khai báo';
 if(asking)return 'đang hỏi Master';
 if(a&&a.now&&st.label===a.now)return cut(a.now,26);
 if(st.txt==='!')return 'chờ bạn';
 if(st.kind==='run')return st.label.indexOf('Master đang gọi')===0?'đang làm (Master gọi)':'đang làm';
 if(st.kind==='wait')return 'có '+st.txt+' việc chờ';
 if(/^Đang chạy ở/.test(st.label))return 'đang ở '+((st.label.match(/F-\d+/)||[''])[0]);
 return 'rảnh';
}
/* ---------- tường: đồng hồ, cửa sổ ban đêm, pháo giấy ---------- */
// Đồng hồ treo tường: kim chạy khi watch.sh đang chạy, đứng yên khi nó tắt
function clock(run){const cx=255,cy=45;
 return R(244,34,22,22,'#5b4a40')+R(246,36,18,18,'#ffffff')+R(cx-1,36,2,2,'#5b4a40')+R(cx-1,52,2,2,'#5b4a40')+R(246,cy-1,2,2,'#5b4a40')+R(262,cy-1,2,2,'#5b4a40')
  +'<g class="'+(run?'hhand':'')+'">'+R(cx-1,cy-1,6,2,'#3b2a20')+'</g><g class="'+(run?'mhand':'')+'">'+R(cx-1,cy-8,2,9,'#c23b3b')+'</g>'+R(cx-1,cy-1,2,2,OL)}
function nightWindow(){let s=R(128,16,72,36,'#1d2a4f')+R(128,40,72,12,'#25355f')+R(182,20,7,7,'#f4e9b8')+R(184,20,5,5,'#1d2a4f');
 [[136,22],[150,30],[170,24],[143,40],[192,38],[160,44]].forEach(([x,y])=>s+=R(x,y,1,1,'#ffffff'));
 return s+R(162,16,4,36,'#6e3a20')+R(128,32,72,2,'#6e3a20')}
function confetti(cx,y,elapsed){let s='<g class="conf">';const c=['#d64545','#f2c14e','#3f8f4a','#2f6fe0','#8b4fd0'];
 for(let i=0;i<26;i++){const x=cx-70+((i*37)%140),d=-((elapsed/1000)+(i%7)*.4);
  s+='<rect x="'+x+'" y="'+y+'" width="3" height="5" fill="'+c[i%c.length]+'" style="animation-delay:'+d.toFixed(2)+'s"/>'}
 return s+'</g>'}
/* ---------- trạng thái một agent trong một tính năng ---------- */
function stateOf(a,dir){
 if(!a)return{kind:'bad',txt:'?',label:'Chưa khai báo trong agents.txt',on:false};
 const here=a.pending.filter(p=>p.indexOf(dir+'/')===0).length;
 // dir thuộc một trong các tính năng ids ("F-005")? ids rỗng (không biết) hay dir rỗng (cây nước) thì coi là có
 const inF=ids=>!dir||!ids.length||ids.some(F=>dir.indexOf(F+'-')===0);
 // Agent đang chạy (subagent qua .sub, auto/window qua .job) chỉ hiện "…" ở dãy bàn của tính năng nó đang làm
 const runHere=a.running&&inF(a.runIn||[]),what=a.sub||a.job;
 if(runHere)return{kind:'run',txt:'…',label:a.sub?'Master đang gọi ('+a.sub+')':'Đang chạy'+(a.job?' ('+a.job+')':''),on:true};
 if(a.running&&!here)return{kind:'idle',txt:'z',label:'Đang chạy ở '+what,on:false};
 // Dòng .now của Master: có mã F-NNN thì chỉ hiện ở dãy bàn tính năng đó, không có mã thì hiện ở mọi dãy của Master
 if(a.now&&inF(a.now.match(/F-\d+/g)||[]))return a.nowWait?{kind:'wait',txt:'!',label:a.now,on:true}:{kind:'run',txt:'…',label:a.now,on:true};
 if(here)return{kind:'wait',txt:String(here),label:MODE_WAIT[a.mode]||'Có việc, cần mở phiên tay',on:true};
 return{kind:'idle',txt:'z',label:'Rảnh',on:false};
}

/* ---------- dựng cảnh ---------- */
const CW=0.6; // độ rộng một ký tự monospace so với cỡ chữ
const cut=(t,n)=>t.length>n?t.slice(0,Math.max(1,n-1))+'…':t;
// Lưới mịn: W rộng 700. Tường và đồ vật vẽ ở lưới thô (một nửa) rồi phóng gấp đôi.
// BR: mép phải các dãy bàn. Lối đi thảm đỏ từ AX, rộng AW, chính giữa là bàn của bạn. TOP: dãy bàn đầu tiên
const W=700, BR=624, AX=632, AW=48, OWNER_X=AX+AW/2, COL0=132, STEP=98, PER_ROW=5, ROW_H=130, HEAD=30, TOP=170;
const NIGHT=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
// Nhớ chỗ của từng agent ở lần vẽ trước: đổi chỗ (cây nước ↔ bàn) thì cho đi bộ; tính năng vừa xong thì bắn pháo giấy
const PREV_PLACE=new Map(),PREV_STATUS=new Map(),ARRIVE=new Map();let PARTY=[];
const WALK_MS=1400;
// Agent vừa đi bộ tới chỗ mới: ẩn ở chỗ mới cho tới khi người đi bộ tới nơi (kể cả qua các lần làm mới 3 giây)
const arriving=id=>{const t=ARRIVE.get(id);if(!t)return null;const e=Date.now()-t;return e<WALK_MS+50?e:null};
const agG=(id,label,inner)=>{const e=arriving(id);
 return '<g class="ag'+(openId===id?' on':'')+(e!=null?' arrive':'')+'"'+(e!=null?' style="animation-delay:-'+(e/1000).toFixed(2)+'s"':'')
  +' data-id="'+esc(id)+'" tabindex="0" role="button" aria-label="'+esc(id+': '+label)+'"><title>'+esc(id+': '+label)+'</title>'+inner+'</g>'};

// Một chỗ ngồi: lưng ghế, người quay mặt ra, bàn, laptop hay màn hình, đồ trên bàn, bong bóng, biển tên
// Y: mép trên mặt bàn; đầu người ngồi ở Y-34, người đứng ở Y-40
function station(f,id,a,x,w,top,isMaster,color,place){
 const Y=top+66,cx=x+w/2,role=a?a.role:(id.split('-')[0]||'coder');
 let st=stateOf(a,f.dir);
 // Master không còn file chờ nhưng tính năng đang chờ chủ dự án: hiện "!" thay vì "z" (như trước)
 if(isMaster&&st.kind==='idle'&&S.owner.some(o=>o.path.indexOf(f.dir+'/')===0))st={kind:'wait',txt:'!',label:'Chờ bạn (xem mục Cần bạn)',on:true};
 // Câu hỏi của agent này trong tính năng còn mở, chưa tới lượt nó: giơ tay
 const asking=!!a&&!isMaster&&st.kind!=='run'&&st.txt!=='!'&&f.items.some(it=>it.kind==='questions'&&it.from===id&&it.status==='open'&&it.to!==id);
 const bugs=f.items.some(it=>it.kind==='bugs'&&it.to===id&&it.status==='open');
 const L=look(id),run=st.kind==='run',standUp=isMaster&&st.txt==='!';
 const pose=run?'type':asking?'hand':st.kind==='wait'?'wait':'idle';
 const bubbleTxt=asking?'?':st.txt,bubbleKind=asking?'wait':st.kind;
 let s=selBox(x-4,top+2,w+8,ROW_H-6);
 if(!standUp)s+=R(cx-13,Y-31,26,28,OL)+R(cx-12,Y-30,24,26,'#4f5669')+R(cx-12,Y-30,24,2,'#6c7488');
 if(isMaster)s+=monitorBack(x+4,Y,run)+monitorBack(x+w-26,Y,run);
 if(standUp)s+=standFront(cx,Y-40,L,role,color,'paper');
 else if(a)s+=sitFront(cx,Y-34,L,role,color,pose);
 else s+='<g opacity=".45">'+sitFront(cx,Y-34,L,role,'#8f9bb0','idle')+'</g>';
 s+=X2(x,Y,desk(0,0,w/2));
 if(!isMaster&&!standUp)s+=laptopBack(cx,Y,run,color);
 if(a&&!standUp)s+=forearms(cx,Y,L,role,color,pose);
 s+=cup(x+w-12,Y-6,run);
 if(role==='tester')s+=lensProp(x+4,Y-5);
 if(isMaster)s+=papers(x+4,Y-8);
 if(bugs)s+=bug(x+8,Y+5);
 s+=bubble(cx,top+4,bubbleTxt,bubbleKind)+label(cx,Y+34,id,shortOf(a,st,asking),asking?'wait':st.kind);
 return agG(id,st.label+(asking?' · đang chờ Master trả lời câu hỏi':'')+(bugs?' · có lỗi Tester báo':''),s);
}

function build(){
 const byId=Object.fromEntries(S.agents.map(a=>[a.id,a]));
 const now=Date.now();
 // tính năng vừa chuyển sang "xong" ở lần làm mới này: pháo giấy 6 giây
 S.features.forEach(f=>{const p=PREV_STATUS.get(f.dir);if(p&&p!=='done'&&f.status==='done')PARTY.push({id:f.id,at:now});PREV_STATUS.set(f.dir,f.status)});
 PARTY=PARTY.filter(p=>now-p.at<6000);
 // tính năng đã xong rời văn phòng (chỉ còn trên bảng trắng); màu giữ theo thứ tự gốc
 const blocks=S.features.map((f,i)=>[f,i]).filter(([f])=>f.status!=='done').map(([f,i])=>{
  const ms=f.members.filter(m=>m===f.master);
  const others=f.members.filter(m=>m!==f.master).sort((a,b)=>{const ra=(byId[a]||{}).role||'',rb=(byId[b]||{}).role||'';return ra===rb?a.localeCompare(b):(ra==='coder'?-1:rb==='coder'?1:ra.localeCompare(rb))});
  const rows=Math.max(1,Math.ceil(others.length/PER_ROW));
  return{f,color:COLORS[i%COLORS.length],master:ms[0]||f.master||'',others,rows,h:HEAD+rows*ROW_H+6};
 });
 const busy=new Set(blocks.flatMap(b=>[b.master,...b.others]));
 const free=S.agents.filter(a=>!busy.has(a.id));
 const done=S.features.filter(f=>f.status==='done');
 // agent đổi khu (cây nước ↔ bàn) so với lần vẽ trước: ghi mốc để ẩn ở chỗ mới tới khi người đi bộ tới nơi
 if(MOTION_OK)S.agents.forEach(a=>{const q=PREV_PLACE.get(a.id),z=busy.has(a.id)?'desk':'cooler';if(q&&q.zone!==z)ARRIVE.set(a.id,now)});
 let H=TOP+blocks.reduce((s,b)=>s+b.h+8,0)+8;if(!blocks.length)H=TOP+90;
 const need=S.owner.length+(S.masters||[]).filter(m=>m.waitOwner).length;
 const watch=(S.watch||{state:'never'}).state;
 // chỗ của từng agent ở lần vẽ này: để so với lần trước và cho đi bộ
 const place=new Map();
 let s=defs();
 // ---- tường, sàn, đồ trang trí (lưới thô, phóng gấp đôi)
 let d=R(0,0,350,H/2,'url(#fl)')+R(0,0,350,56,'#c4cedd')+R(0,25,350,1,'#97a3b8')+R(0,26,350,28,'url(#wd)')+R(0,54,350,3,'#a85a32')+R(0,57,350,1,'#7a3d20');
 d+=aisle(AX/2,58,AW/2,H/2-58)+bunting(350)+windowPane(62,6)+picture(107,11)+calendar(278,9)+plant(262,37)+shelf(8)+cooler(36);
 // cửa: mở khi có việc chờ bạn
 d+=R(141,9,32,48,'#6e3a20')+(need?R(144,12,26,45,'#2c201a')+R(144,12,4,45,'#c06a3a'):R(144,12,26,45,'#c06a3a')+R(148,17,18,11,'#d98b55')+R(148,32,18,11,'#d98b55')+R(166,35,2,2,'#f0d07a'));
 d+=R(182,6,74,46,'#6e4a30')+R(184,8,70,42,'#f8f8f2');
 s+='<g transform="scale(2)">'+d+'</g>';
 if(NIGHT)s+=nightWindow()+R(0,0,W,H,'rgba(20,30,70,.16)');
 s+=clock(watch==='running');
 if(need)s+=bubble(314,58,'!'+need,'bad');
 // ---- bảng trắng: các tính năng đang làm, rồi các tính năng đã xong
 s+=T(438,26,8.5,'#3b2a20','CÁC TÍNH NĂNG');
 const board=blocks.map(b=>({f:b.f,color:b.color})).concat(done.slice().reverse().map(f=>({f,color:'#b9b0a3'})));
 board.slice(0,4).forEach((b,i)=>{const y=31+i*16.5;
  s+=R(373,y+1,6,6,b.color)+T(383,y+7.5,7.5,'#3b2a20',cut(b.f.id+' '+b.f.title,Math.floor(122/(CW*7.5))),'start')+T(383,y+15,6.6,b.f.to==='owner'?'#b23030':'#6b5c4e',stOf(b.f),'start')});
 if(board.length>4)s+=T(504,97,6.5,'#6b5c4e','+'+(board.length-4)+' nữa','end');
 if(!board.length)s+=T(438,60,7.5,'#6b5c4e','(chưa có)');
 PARTY.forEach(p=>{s+=confetti(438,14,now-p.at)+T(438,112,10,'#b23030','🎉 '+p.id+' xong!')});
 // ---- cây nước: agent rảnh đứng uống nước
 // biển tên so le hai hàng để không đè nhau
 free.slice(0,5).forEach((a,k)=>{const cx=124+k*32,y=76,st=stateOf(a,'');
  place.set(a.id,{x:cx,y,zone:'cooler'});
  s+=agG(a.id,st.label,selBox(cx-13,y-22,26,66)+standFront(cx,y,look(a.id),a.role,'#8f9bb0','cup').replace('class="sip"','class="sip" style="animation-delay:-'+(k*0.9)+'s"')
   +bubble(cx,y-20,st.txt,st.kind)+label(cx,y+40+(k%2)*24,a.id,shortOf(a,st,false),st.kind))});
 // ---- bàn của bạn, lối đi thảm đỏ chạy thẳng xuống
 {const cx=OWNER_X,L={hair:'#2d2d3a',skin:'#f2c9a0',style:'short',pants:'#3a3f5c'};
  let o=R(cx-15,52,30,30,OL)+R(cx-14,53,28,28,'#4a3b6b')+R(cx-14,53,28,2,'#5e4d85');
  o+=standFront(cx,58,L,'boss','#2f6fe0','')+X2(cx-36,86,desk(0,0,36))+R(cx-12,74,24,13,OL)+R(cx-11,75,22,11,'#c9cdd6')+R(cx-11,75,22,2,'#e3e6ec')+R(cx-1,79,2,2,'#ffffff')+cup(cx+20,79,true);
  o+=R(cx-15,104,30,12,'#3b2a20')+T(cx,113,8.5,'#f2c14e','BẠN')+bubble(cx,30,need?'!'+need:'z',need?'bad':'idle');
  s+='<g id="owner" tabindex="0" role="button" aria-label="'+esc(need?'Bàn của bạn: '+need+' việc chờ bạn':'Bàn của bạn: không có việc chờ')+'" style="cursor:pointer"><title>'+(need?need+' việc chờ bạn: bấm để xem':'Không có việc chờ bạn')+'</title>'+o+'</g>'}
 // ---- các dãy bàn
 let y=TOP;
 blocks.forEach(b=>{
  const f=b.f;
  s+=R(8,y,BR-8,b.h,'rgba(0,0,0,.07)')+R(8,y,BR-8,2,b.color)+R(8,y+b.h-2,BR-8,2,b.color)+R(8,y,2,b.h,b.color)+R(BR-2,y,2,b.h,b.color);
  const sv=stOf(f),svw=sv.length*CW*9+14,label=cut(f.id+' · '+f.title,Math.floor((BR-30-svw)/(CW*10.5))),lw=label.length*CW*10.5;
  s+=R(12,y+5,Math.min(lw+svw+24,BR-20),20,b.color)+T(18,y+19,10.5,'#ffffff',label,'start')
   +'<rect x="'+(24+lw)+'" y="'+(y+8)+'" width="'+svw+'" height="14" rx="3" fill="'+(f.to==='owner'?'#ffe066':'rgba(255,255,255,.88)')+'"/>'+T(24+lw+svw/2,y+18.5,9,f.to==='owner'?'#7a2a00':'#3b2a20',sv);
  const rowTop=r=>y+HEAD+r*ROW_H;
  const seat=(id,x,w,top,isM)=>{
   if(!place.has(id))place.set(id,{x:x+w/2,y:top+26,zone:'desk'});
   s+=station(f,id,byId[id],x,w,top,isM,b.color);
  };
  if(b.master)seat(b.master,16,100,rowTop(0),true);
  b.others.forEach((id,k)=>{const r=Math.floor(k/PER_ROW),c=k%PER_ROW;seat(id,COL0+c*STEP,72,rowTop(r),false)});
  y+=b.h+8;
 });
 if(!blocks.length)s+=T(BR/2+4,TOP+44,11,'#3b2a20',done.length?'Không có tính năng nào đang làm':'Chưa có tính năng nào (workflow/F-*)');
 // ---- người đi bộ: agent vừa đổi chỗ (cây nước → bàn, bàn → cây nước). Vẽ ở lớp riêng #walk,
 // lần làm mới 3 giây (thay toàn bộ #office) không cắt ngang người đang đi
 const walkers=[];
 if(MOTION_OK)place.forEach((p,id)=>{const q=PREV_PLACE.get(id);if(!q||q.zone===p.zone)return;
  const a=byId[id];if(!a)return;
  walkers.push({x0:q.x,y0:q.y,x1:p.x,y1:p.y,svg:standFront(0,0,look(id),a.role,'#8f9bb0','')})});
 PREV_PLACE.clear();place.forEach((p,id)=>PREV_PLACE.set(id,p));
 ARRIVE.forEach((t,id)=>{if(now-t>WALK_MS+100)ARRIVE.delete(id)});
 // ---- watch.sh chết: tắt đèn
 if(watch==='dead')s+=R(0,0,W,H,'rgba(10,10,30,.38)')+'<g class="bub bob">'+'<rect x="208" y="62" width="94" height="16" rx="4" fill="#ffe6e3" stroke="'+OL+'" stroke-width="1.5"/>'+T(255,74,8.5,'#b23030','watch.sh đã dừng')+'</g>';
 // chú chó đi dọc chân tường rồi xuống lối đi (lưới thô)
 PET_PATH=[[108,57],[OWNER_X/2,57],[OWNER_X/2,H/2-3]];PET.s=Math.min(PET.s,pathLen());PET.goal=Math.min(PET.goal,pathLen());
 s+='<g transform="scale(2)">'+petSvg()+'</g>';
 const svg=$('#office');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.innerHTML=s;
 const wk=$('#walk');wk.setAttribute('viewBox','0 0 '+W+' '+H);
 walkers.forEach(w=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','walker');g.innerHTML=w.svg;wk.appendChild(g);
  const an=g.animate([{transform:'translate('+w.x0+'px,'+w.y0+'px)'},{transform:'translate('+w.x1+'px,'+w.y1+'px)'}],{duration:WALK_MS,easing:'ease-in-out',fill:'forwards'});
  an.onfinish=()=>g.remove();setTimeout(()=>g.remove(),WALK_MS+800)}); // dự phòng: tab chạy nền thì hoạt hình có thể dừng
 svg.querySelectorAll('.ag').forEach(g=>{const go=()=>{openId=g.dataset.id;build();showDetail()};g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});
 const ow=svg.querySelector('#owner'),toNeed=()=>$('#needBox').scrollIntoView({behavior:MOTION_OK?'smooth':'auto',block:'start'});
 ow.addEventListener('click',toNeed);ow.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toNeed()}});
 svg.querySelector('#pet').addEventListener('click',()=>{PET.bark=12;PET.pause=Math.max(PET.pause,12);petTick()});
 const lg=$('#legend');lg.replaceChildren();
 lg.append(el('span',null,'Gõ phím = đang làm · gõ ngón tay = có việc chờ (số trên bong bóng) · giơ tay "?" = đang chờ Master trả lời · bọ đỏ trên bàn = có lỗi Tester báo · Master đứng giơ giấy "!" = chờ bạn · gật gù "z" = rảnh · bóng mờ "?" = ID chưa khai trong agents.txt'),
  el('span',null,'Cửa mở = có việc chờ bạn · đồng hồ đứng, đèn tắt = watch.sh không chạy · rê chuột vào ai để xem chi tiết, bấm để mở · bấm bàn "BẠN" để tới mục Cần bạn'));
 if(free.length>5)lg.append(el('span',null,'Rảnh, không hiện hết: '+free.slice(5).map(a=>a.id).join(', ')));
}

/* ---------- các khu HTML ---------- */
function render(){
 $('#proj').textContent='VĂN PHÒNG AGENT · '+S.project;
 {const d=S.features.filter(f=>f.status==='done').length;$('#bFeat').textContent=(S.features.length-d)+' ĐANG LÀM · '+d+' XONG'}
 $('#bRun').textContent=S.agents.filter(a=>a.running).length+'/'+S.agents.length+' ĐANG CHẠY';
 {const mw=(S.masters||[]).filter(m=>m.waitOwner).length;$('#bNeed').textContent=(S.owner.length+mw)+' CHỜ BẠN'}
 {const w=S.watch||{state:'never'},bw=$('#bWatch');
  bw.textContent=w.state==='running'?'WATCH ✓':w.state==='dead'?'WATCH ĐÃ CHẾT':'WATCH TẮT';
  bw.className='badge'+(w.state==='dead'?' off':w.state==='running'?'':' warn');
  bw.title=w.state==='running'?'watch.sh đang chạy, quét lần cuối '+hm(w.at):'Chạy: sh workflow/watch.sh'}
 {const n=S.owner.length+(S.masters||[]).filter(m=>m.waitOwner).length;document.title=(n?'('+n+') Chờ bạn · ':'')+'Văn phòng agent'}
 const anom=S.anomalies||[],paused=S.agents.filter(a=>a.paused);
 $('#needBox').classList.toggle('on',S.owner.length>0||anom.length>0||paused.length>0);
 banner();
 const need=$('#need');need.replaceChildren();
 if(anom.length||paused.length){const box=el('div','ask');
  box.append(el('p','act','Bất thường ('+(anom.length+paused.length)+')'),el('p','muted','watch.sh phát hiện. Nói với Master: "Xử lý việc đang chờ", hoặc tự xem file.'));
  paused.forEach(a=>{const p=el('p',null,a.id+' đang tạm dừng vì bị đánh thức quá nhiều lần. Xem log, rồi chạy: ');p.append(el('code',null,'sh workflow/watch.sh --resume '+a.id));box.append(p)});
  anom.forEach(t=>box.append(el('p',null,'• '+t)));need.append(box)}
 if(!S.hasWorkflow)need.append(el('p','muted','Không thấy thư mục workflow/. Hãy chạy monitor tại thư mục dự án.'));
 else if(!S.owner.length){if(!anom.length&&!paused.length)need.append(el('p','muted','Không có gì chờ bạn.'))}
 else S.owner.forEach(o=>{const a=ownerAction(o),box=el('div','ask');
  box.append(el('p','act',o.feature+' · '+a.act),el('p',null,o.title||o.file),el('p','muted',a.how));
  if(a.say){const p=el('p','say');p.append(document.createTextNode('Nói với Master: '),el('code',null,a.say));box.append(p)}
  (o.sections||[]).forEach((x,i)=>{const k=o.path+'#'+x.title,d=el('details');
   d.open=OPEN.has(k)?OPEN.get(k):/cách thử/i.test(x.title); // mặc định mở mục "Cách thử"; nhớ lựa chọn của bạn
   d.addEventListener('toggle',()=>OPEN.set(k,d.open));
   d.append(el('summary',null,x.title),el('pre',null,x.text||'(trống)'));box.append(d)});
  need.append(box)});
 build();
 const files=$('#files');files.replaceChildren();
 S.features.forEach((f,i)=>{const d=el('details');const k='feat:'+f.dir;
  d.open=OPEN.get(k)===true; // trang làm mới 3 giây một lần: giữ nguyên khung bạn đang mở
  d.addEventListener('toggle',()=>OPEN.set(k,d.open));
  const sm=el('summary');const sq=el('span','sq');sq.style.background=COLORS[i%COLORS.length];sm.append(sq,f.id+' · '+f.title+' · '+stOf(f)+' ('+f.items.length+' file)');d.append(sm);
  const t=el('table');f.items.forEach(it=>{const tr=el('tr');const td=el('td');td.append(el('code',null,it.file));tr.append(td,el('td',null,it.title),el('td',null,stOf(it)),el('td',null,'→ '+(it.to==='owner'?'bạn':it.to==='none'?'không ai':it.to)));t.append(tr)});d.append(t);files.append(d)});
 if(!S.features.length)files.append(el('p','muted','Chưa có.'));
 if(openId)showDetail();
}
// Một dòng to nói rõ ai đang cầm lượt: chủ dự án (đỏ) hay agent nào (xanh), Master nào đang mở, watch.sh còn chạy không
const hm=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
function watchLine(active){
 const w=S.watch||{state:'never'};
 if(w.state==='dead')return '⚠ watch.sh đã dừng bất thường (nhịp tim cuối '+hm(w.at)+'): không báo Telegram, không đánh thức agent auto/window. Chạy lại: sh workflow/watch.sh --restart';
 if(w.state!=='running'&&active)return '⚠ watch.sh không chạy'+(w.state==='stopped'?' (dừng lúc '+hm(w.at)+(w.reason?', '+w.reason:'')+')':'')+': không báo Telegram, không đánh thức agent auto/window. Chạy: sh workflow/watch.sh';
 return '';
}
function masterLine(m){const old=Date.now()-m.at>2*3600e3;
 return 'MASTER '+m.id+': '+m.text+(old?' (không đổi từ '+hm(m.at)+', phiên có thể đã đóng)':' ('+hm(m.at)+')')}
function banner(){
 const b=$('#banner');b.replaceChildren();b.className='pix banner';
 const ms=S.masters||[],mw=ms.filter(m=>m.waitOwner),act=S.features.filter(f=>f.status!=='done');
 const wl=watchLine(act.length>0||ms.length>0);
 const turns=[];act.forEach(f=>f.items.forEach(it=>{if(it.to&&it.to!=='none'&&it.to!=='owner')turns.push({f,it})}));
 const run=S.agents.filter(a=>a.running);
 const need=S.owner.length+mw.length;
 if(need){
  b.classList.add('owner');b.append(el('p',null,'ĐANG CHỜ BẠN ('+need+')'));
  S.owner.forEach(o=>{const a=ownerAction(o);b.append(el('p','small','▶ '+o.feature+' · '+a.act+(a.say?' → nói với Master: "'+a.say+'"':'')))});
  mw.forEach(m=>b.append(el('p','small','▶ '+m.id+': '+m.text+' (trả lời trong phiên chat của '+m.id+')')));
  ms.filter(m=>!m.waitOwner).forEach(m=>b.append(el('p','small',masterLine(m))));
  if(wl)b.append(el('p','small alert',wl));
  b.hidden=false;b.onclick=()=>$('#needBox').scrollIntoView({behavior:MOTION_OK?'smooth':'auto',block:'start'});return}
 if(!turns.length&&!run.length&&!ms.length&&!wl){b.hidden=true;return}
 b.classList.add('flow');
 b.append(el('p',null,run.length?'ĐANG CHẠY: '+run.map(a=>a.id+(a.sub?' ('+a.sub+', Master gọi)':'')).join(' · '):ms.length?'MASTER ĐANG LÀM':'KHÔNG AI ĐANG CHẠY'));
 ms.forEach(m=>b.append(el('p','small',masterLine(m))));
 const by={};turns.forEach(x=>{(by[x.it.to]=by[x.it.to]||[]).push(x.f.id+' '+x.it.file)});
 Object.keys(by).forEach(id=>{const a=S.agents.find(z=>z.id===id);
  const how=!a?'không có trong agents.txt, không ai đánh thức được':a.running?'đang làm':a.mode==='subagent'?'chờ Master gọi':(MODE_WAIT[a.mode]||'chờ đánh thức').toLowerCase();
  b.append(el('p','small','Lượt của '+id+' ('+how+'): '+by[id].join(', ')))});
 if(wl)b.append(el('p','small alert',wl));
 b.hidden=false;b.onclick=null;
}
function showDetail(){
 const d=$('#detail');const a=S.agents.find(x=>x.id===openId);d.replaceChildren();d.style.display='block';
 const close=el('button',null,'Đóng');close.onclick=()=>{openId=null;d.style.display='none';build()};d.append(close,el('h2',null,openId));
 if(!a){d.append(el('p',null,'Agent này được nhắc trong file nhưng chưa có trong workflow/agents.txt, nên watch.sh không đánh thức được.'));return}
 d.append(el('p',null,a.role+' · '+(MODE_NAME[a.mode]||'đánh thức tay')+(a.note?' · '+a.note:'')),el('p',null,a.paused?'Tạm dừng (đánh thức quá nhiều lần): sh workflow/watch.sh --resume '+a.id:a.running?(a.sub?'Đang chạy: Master gọi subagent ('+a.sub+')':'Đang chạy'):'Không chạy'));
 d.append(el('h2',null,'File đang chờ'));
 if(a.pending.length){const ul=el('ul');a.pending.forEach(p=>{const li=el('li');li.append(el('code',null,p));ul.append(li)});d.append(ul)}else d.append(el('p','muted','Không có.'));
 d.append(el('h2',null,'Log gần nhất'));
 if(a.lastLog)d.append(el('p','muted',a.lastLog.name+(a.lastLog.mtime?' · '+new Date(a.lastLog.mtime).toLocaleString():'')),el('pre',null,a.lastLog.tail||'(trống)'));
 else d.append(el('p','muted','Chưa có log (agent subagent hoặc đánh thức tay, hoặc chưa được đánh thức lần nào).'));
}
async function poll(){
 try{const r=await fetch('/api/state',{cache:'no-store'});S=await r.json();const c=$('#bConn');c.textContent='CẬP NHẬT '+new Date().toLocaleTimeString();c.className='badge';render()}
 catch(e){const c=$('#bConn');c.textContent='MẤT KẾT NỐI';c.className='badge off'}
}
poll();setInterval(poll,3000);
</script></body></html>`;
