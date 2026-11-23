#!/usr/bin/env node
// monitor.js: trang theo dõi local dạng văn phòng hoạt hình (mỗi tính năng một dãy bàn). Chỉ đọc.
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
      'master-01 master manual phiên chat chính', 'master-02 master manual phiên chat song song', 'master-03 master manual phiên chat thứ ba',
      'coder-01 coder subagent coder', 'coder-02 coder subagent coder', 'coder-03 coder auto claude -p --model sonnet',
      'coder-04 coder subagent coder-pro', 'coder-05 coder subagent coder', 'coder-06 coder subagent coder',
      'tester-01 tester subagent tester', 'tester-02 tester window agy -i', 'tester-03 tester manual Antigravity'].join('\n') + '\n');
    const t = Math.floor(Date.now() / 1000);
    put('.run/watch.beat', (step === 3 ? t - 900 : t) + ' 30 1\n');
    // F-100: đã xong (chỉ còn trên bảng trắng)
    put('F-100-dang-nhap/SPEC.md', doc({ id: 'F-100', title: 'Trang đăng nhập mới', lane: 'full', status: 'done', to: 'none', master: 'master-01' }));
    put('F-099-slug/SPEC.md', doc({ id: 'F-099', title: 'Slug cho media', lane: 'quick', status: 'delivered', to: 'none', master: 'master-02' }, '## Việc treo\n- chờ feat/media-slug: cập nhật tài liệu API\n'));
    put('.run/coder-04.hist', '2026-11-21T08:10 2026-11-21T08:31 F-099 T-01 in_test\n2026-11-21T09:02 2026-11-21T09:15 F-102 T-01 in_test\n');
    put('.run/tester-03.hist', '2026-11-21T07:40 2026-11-21T08:05 F-100 T-02 verified\n');
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
    // master-03: làn trực tiếp, không có file nào trong workflow/, chỉ có dòng .now; cảnh 4: chờ bạn xem lại
    put('.run/master-03.now', step === 4 ? 'Chờ bạn: xem lại nút Lưu\n' : 'Sửa nút Lưu ở trang hồ sơ (làn trực tiếp)\n');
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
    return { dir, id: s.id || dir.split('-').slice(0, 2).join('-'), title: s.title || dir, status: s.status || '', to: s.to || 'none', master: s.master || '', lane: s.lane || '', items };
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
    a.now = m ? m.text : ''; a.nowWait = !!(m && m.waitOwner); a.nowAt = m ? m.at : 0;
    // Lịch sử các lần Master gọi subagent: .run/<id>.hist, mỗi dòng "<bắt đầu> <xong> <F-NNN> <T-xx> <kết quả>"
    a.hist = read(path.join(W, '.run', a.id + '.hist')).split(/\r?\n/).filter(l => l.trim()).slice(-6).reverse()
      .map(l => { const p = l.trim().split(/\s+/); return { start: p[0] || '', end: p[1] || '', what: p.slice(2).join(' ') }; });
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
<link rel="icon" href="data:,">
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
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}
.badge{font:700 12px ui-monospace,Consolas,monospace;padding:3px 8px;border:2px solid var(--ink);background:var(--paper);white-space:nowrap}
.badge.warn{background:var(--waitbg);color:var(--wait)}.badge.off{background:var(--badbg);color:var(--bad)}
.stale main>section,.stale #detail{filter:grayscale(.8);opacity:.6}
.banner{font:700 18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.banner.owner{background:var(--badbg);color:var(--bad);border-color:var(--bad);box-shadow:4px 4px 0 var(--bad);font-size:20px;cursor:pointer}
.banner details{margin:2px 0}.banner summary{font-size:14px}
.banner.flow{background:var(--runbg);color:var(--run);border-color:var(--run);box-shadow:4px 4px 0 var(--run)}
.banner p{margin:2px 0}.banner .small{font-size:14px;font-weight:600}.banner .alert{color:var(--bad);font-size:15px}
.need.on{background:var(--waitbg);border-color:var(--wait);box-shadow:4px 4px 0 var(--wait)}
.need.on h2{color:var(--wait)}
.ask{border-top:2px dashed var(--line);padding:10px 0 4px}.ask:first-of-type{border-top:0;padding-top:0}
.ask .act{font-weight:700;font-size:16px;margin:0 0 2px}
.ask p{margin:2px 0}.ask .say code{background:var(--paper);border:1px solid var(--line);padding:1px 6px;font-size:14px}
.ask details{margin-top:6px}.ask pre{white-space:pre-wrap;font:13px/1.5 ui-monospace,Consolas,monospace;background:var(--paper);border:1px solid var(--line);padding:8px 10px;margin:4px 0 0;max-height:360px;overflow:auto}
.muted{color:var(--fg2);font-size:13px;margin:0}
#needBox:focus{outline:none}
.scene{padding:6px;background:#2a211b}
/* Văn phòng không co nhỏ hơn 900px (chữ trong cảnh còn đọc được): màn hẹp thì vuốt ngang trong khung này.
   Bốn lớp cùng min-width nên người đi bộ, hoạt hình vui, chó mèo vẫn nằm đúng chỗ trên cảnh */
.sceneScroll{position:relative;overflow-x:auto;-webkit-overflow-scrolling:touch}
#office,#walk,#fun,#pets{min-width:900px}
#office{display:block;width:100%;height:auto}
#walk,#fun,#pets{position:absolute;left:0;top:0;width:100%;height:auto;pointer-events:none}
#fun{user-select:none}
.swipe{display:none;color:#e9dcc6;font-size:12px;padding:0 4px 4px;margin:0}
@media (max-width:949px){.swipe{display:block}}
#pets .crit{pointer-events:auto;cursor:pointer}#pets.dim,#walk.dim,#fun.dim{filter:brightness(.62)}#pets text,#fun text{font-family:ui-monospace,Consolas,monospace;font-weight:700}
/* Chó mèo đang ở ngoài lối của chúng (ghé người ở cây nước, trèo lên bàn): không nhận chuột, cú bấm rơi xuống nhân vật bên dưới */
#pets .crit.nohit{pointer-events:none}
/* Hoạt hình vui: nhân vật đang ở lớp #fun (đi chơi, vươn vai, reo mừng) ẩn hình ở chỗ cũ; khung bấm (.sel) và biển tên
   giữ nguyên nên vẫn bấm, Tab tới được đúng chỗ. Mắt chớp co theo chính nó, không theo tâm khung SVG */
#office .ag.away .fig,#office .ag.away .sit{visibility:hidden}
#fun .eyes{transform-box:fill-box}
/* Nút "Hoạt hình vui": nền khung văn phòng tối ở cả hai chế độ màu nên dùng màu cố định như chú giải */
.funbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:6px 4px 2px;font-size:12px;color:#e9dcc6}
.funbtn{font:700 12px ui-monospace,Consolas,monospace;min-height:36px;padding:4px 12px;border:2px solid #e9dcc6;background:transparent;color:#e9dcc6;cursor:pointer;box-shadow:2px 2px 0 #000}
.funbtn[aria-pressed="true"]{background:#e9dcc6;color:#2a211b}
.funbtn:focus-visible{outline:3px solid #ffe066;outline-offset:2px}
#office text{font-family:ui-monospace,Consolas,monospace;font-weight:700}
#office .ag{cursor:pointer}
#office .ag:focus{outline:none}
/* opacity thay cho display:none: khung chọn vẫn nhận chạm, nên cả khung là vùng bấm của nhân vật */
#office .ag .sel{opacity:0}#office .ag.on .sel,#office .ag:focus-visible .sel,#office .ag:hover .sel{opacity:1}
#office .sit .armR,#office .sit .armL,#office .conf rect,#office .eyes{transform-box:fill-box}
@media (prefers-reduced-motion:no-preference){
 .sit.type .armL{animation:tp .32s steps(2) infinite}.sit.type .armR{animation:tp .32s steps(2) infinite .16s}@keyframes tp{50%{transform:translateY(-2px)}}
 .sit.wait .armR{animation:tap 1.1s steps(2) infinite}@keyframes tap{50%{transform:translateY(-3px)}}
 .sit.idle{animation:nod 3.2s ease-in-out infinite}@keyframes nod{50%{transform:translateY(1px)}}
 .glow{animation:glow 1.4s ease-in-out infinite}@keyframes glow{50%{opacity:.35}}
 .sit.hand .armR{animation:hand .9s ease-in-out infinite;transform-origin:50% 100%}@keyframes hand{50%{transform:rotate(9deg)}}
 .code rect{animation:cd 1.2s steps(1) infinite}.code rect:nth-child(2){animation-delay:.3s}.code rect:nth-child(3){animation-delay:.6s}.code rect:nth-child(4){animation-delay:.9s}@keyframes cd{50%{opacity:.15}}
 .steam rect{animation:st 1.6s ease-out infinite}.steam rect:nth-child(2){animation-delay:.7s}@keyframes st{0%{transform:translateY(2px);opacity:0}40%{opacity:.9}100%{transform:translateY(-5px);opacity:0}}
 .bug{animation:crawl 2.6s steps(7) infinite alternate}@keyframes crawl{100%{transform:translateX(20px)}}
 .bub.bob{animation:bob 1.2s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-2px)}}
 .zzz{animation:zz 2.8s ease-in-out infinite}
 .bub.zz{animation:zz 2.8s ease-in-out infinite}@keyframes zz{0%,100%{transform:translate(0,0);opacity:.7}50%{transform:translate(2px,-3px);opacity:1}}
 .sip{animation:sip 3.6s steps(1) infinite}@keyframes sip{0%,70%{transform:none}75%,95%{transform:translateY(-8px)}}
 .eyes{animation:blink 4.2s steps(1) infinite;transform-origin:center}@keyframes blink{0%,94%{transform:none}95%,100%{transform:scaleY(.2)}}
 .wave{animation:paper 1s ease-in-out infinite}@keyframes paper{50%{transform:translateY(-3px)}}
 .walker .legL{animation:wl .3s steps(2) infinite}.walker .legR{animation:wl .3s steps(2) infinite .15s}@keyframes wl{50%{transform:translateY(-2px)}}
 .ag.arrive{animation:arrive 1.45s steps(1) both}@keyframes arrive{0%{opacity:0}100%{opacity:1}}
 .mhand{animation:spin 12s linear infinite}.hhand{animation:spin 144s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
 .conf rect{animation:fall 2.8s linear infinite;transform-origin:center}@keyframes fall{0%{transform:translateY(-6px) rotate(0)}100%{transform:translateY(96px) rotate(540deg)}}
 .blink{animation:bl 1s steps(2) infinite}@keyframes bl{50%{opacity:.35}}}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:#e9dcc6;padding:6px 4px 2px}
details{margin:6px 0}details summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:4px}
td{padding:3px 6px;border-top:1px dashed var(--line);vertical-align:top}
td:last-child{white-space:nowrap}
.sq{display:inline-block;width:10px;height:10px;border:1px solid var(--ink);margin-right:6px;vertical-align:-1px}
#detail{position:fixed;right:16px;bottom:16px;width:min(460px,calc(100% - 32px));max-height:min(70vh,calc(100vh - 32px));overflow:auto;display:none;z-index:5}
#detail pre{white-space:pre-wrap;font-size:12px;background:var(--bg);border:1px solid var(--line);padding:8px;max-height:280px;overflow:auto}
#detail button{float:right;font:inherit;font-size:13px;padding:6px 12px;min-height:36px;border:2px solid var(--ink);background:var(--paper);color:var(--fg);cursor:pointer;box-shadow:2px 2px 0 var(--ink)}
#detail h2:focus{outline:none}
@media (max-width:600px){
 #detail{left:8px;right:8px;bottom:8px;width:auto;max-height:45vh}
 .banner{font-size:16px}.banner.owner{font-size:17px}.banner .small{font-size:13px}
}
</style></head>
<body><main>
<header class="pix"><h1 id="proj">VĂN PHÒNG AGENT</h1>
<div class="badges"><span class="badge" id="bFeat"></span><span class="badge" id="bRun"></span><span class="badge" id="bNeed"></span><span class="badge" id="bWatch"></span><span class="badge" id="bConn">…</span></div></header>
<section class="pix banner" id="banner" hidden></section>
<section class="pix need" id="needBox"><h2>Cần bạn</h2><div id="need"></div></section>
<section class="pix scene" aria-label="Văn phòng: mỗi tính năng một dãy bàn">
<p class="swipe">Vuốt ngang để xem cả văn phòng →</p>
<div class="sceneScroll">
<svg id="office" role="group" aria-label="Văn phòng agent"></svg>
<svg id="walk" aria-hidden="true"></svg>
<svg id="fun" aria-hidden="true"><g id="funDeco"></g><g id="funActors"></g><g id="funSays"></g><g id="funFly"></g></svg>
<svg id="pets" aria-hidden="true"></svg>
</div>
<div class="legend" id="legend"></div>
<div class="funbar"><button type="button" class="funbtn" id="funBtn" aria-pressed="true">Hoạt hình vui<span id="funState" aria-hidden="true">: bật</span></button>
<span id="funNote" hidden>Máy bạn đặt giảm chuyển động: chỉ hiện bong bóng thoại, không ai đi lại hay nhảy.</span></div>
</section>
<section class="pix"><h2>File của từng tính năng</h2><div id="files"></div></section>
<p class="muted">Trang chỉ đọc, tự làm mới 3 giây một lần. Bấm vào nhân vật để xem chi tiết. Trả lời và duyệt: nói với Master.</p>
</main>
<section class="pix" id="detail" role="region" aria-labelledby="detailTitle"></section>
<script>
const COLORS=['#2f6fe0','#1f9a6e','#e07a1f','#8b4fd0','#d8457f','#0f8f9f','#a0782a'];
const HAIR=['#3b2a20','#7a4a22','#c9a24a','#2d2d3a','#a33a2a','#5a3a2a','#1f1a17','#6b3d1e'];
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// openKey: chỗ ngồi (data-k) của nhân vật vừa bấm; một agent có thể ngồi ở nhiều dãy bàn, đóng chi tiết thì trả tiêu điểm đúng chỗ đó
let S=null,openId=null,openKey=null;const OPEN=new Map();
// Màu theo thứ tự các tính năng còn trong văn phòng (không trùng màu khi ≤ 7 tính năng mở); đã giao chờ merge xanh nhạt,
// xong màu xám. Dùng chung cho dãy bàn, bảng trắng và danh sách file để ba chỗ cùng một màu
const DONE_COLOR='#b9b0a3',DELIVERED_COLOR='#7f9cc2';let FEAT_COLOR=new Map();
function paintFeatures(){FEAT_COLOR=new Map();let k=0;
 S.features.forEach(f=>FEAT_COLOR.set(f.dir,f.status==='done'?DONE_COLOR:f.status==='delivered'?DELIVERED_COLOR:COLORS[k++%COLORS.length]))}
// Việc chờ chủ dự án. Master ghi "Chờ bạn: … F-102" đúng lúc đặt file của F-102 sang to: owner,
// nên dòng .now nói về tính năng đã có file chờ bạn thì không đếm thêm lần nữa (dup), chỉ hiện để biết
function ownerWaits(){
 const fs=new Set(S.owner.map(o=>o.feature)),mw=(S.masters||[]).filter(m=>m.waitOwner);
 const covered=m=>{const ids=m.text.match(/F-\d+/g)||[];return ids.length>0&&ids.every(id=>fs.has(id))};
 const extra=mw.filter(m=>!covered(m));
 return{extra,dup:mw.filter(covered),total:S.owner.length+extra.length};
}
// Giờ kiểu Việt Nam 24 giờ, không phụ thuộc ngôn ngữ trình duyệt
const hm=t=>new Date(t).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false});
const hms=t=>new Date(t).toLocaleTimeString('vi-VN',{hour12:false});
// Giờ nếu là hôm nay, ngày/tháng nếu khác ngày: chỉ ghi giờ thì dòng cũ từ hôm trước trông như việc mới bắt đầu hôm nay
const whenOf=t=>{const d=new Date(t);return d.toDateString()===new Date().toDateString()?hm(t):String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')};
// Dòng .now không đổi lâu hơn ngần này: phiên Master có thể đã đóng mà chưa xoá dòng
const STALE_NOW_MS=2*3600e3;
// Tới mục Cần bạn: cuộn tới và đưa cả tiêu điểm vào đó, để Tab tiếp theo đi vào các mục cần bạn chứ không quay về văn phòng
const toNeed=()=>{const nb=$('#needBox');if(nb.hidden)return;nb.scrollIntoView({behavior:MOTION_OK?'smooth':'auto',block:'start'});nb.tabIndex=-1;nb.focus({preventScroll:true})};
const onActivate=fn=>e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}};
// Trang làm mới 3 giây một lần: chỉ dựng lại khu HTML khi dữ liệu của nó đổi, và không dựng lại khi bạn đang bôi đen
// chữ trong đó (để chép được lệnh, hướng dẫn); giữ vị trí cuộn của các khung có thanh cuộn.
// Chỉ giữ chỗ bôi đen trong SEL_HOLD_MS kể từ lần đổi cuối: quên bỏ bôi đen thì khu đó không đứng yên mãi, lệch với huy hiệu
const SEL_HOLD_MS=15000;
let KEY_NEED='',KEY_FILES='',KEY_DETAIL='',selAt=0;
document.addEventListener('selectionchange',()=>{selAt=Date.now()});
const selIn=n=>{const s=getSelection();return !!(s&&!s.isCollapsed&&s.rangeCount&&n.contains(s.getRangeAt(0).commonAncestorContainer))&&Date.now()-selAt<SEL_HOLD_MS};
const keepScroll=(box,fn)=>{const ps=[...box.querySelectorAll('pre')].map(p=>p.scrollTop),top=box.scrollTop;fn();box.querySelectorAll('pre').forEach((p,i)=>{if(ps[i])p.scrollTop=ps[i]});box.scrollTop=top};
const MODE_NAME={auto:'chạy ngầm tự động',window:'tự mở cửa sổ',manual:'đánh thức tay',subagent:'subagent, Master tự gọi'};
const MODE_WAIT={auto:'Có việc, chờ watch.sh đánh thức',window:'Có việc, chờ watch.sh mở cửa sổ',manual:'Có việc, cần mở phiên tay',subagent:'Có việc, chờ Master gọi'};
const ST={draft:'chờ bạn duyệt',review:'đang khảo sát',reviewed:'đã khảo sát',blocked:'đang chờ',in_dev:'đang làm',ready:'sẵn sàng làm',in_test:'đang kiểm tra',verified:'kiểm tra đạt',reopened:'phải sửa lại',acceptance:'chờ bạn nghiệm thu',delivered:'đã giao, chờ merge',done:'xong',open:'đang mở',answered:'đã trả lời',closed:'đã đóng',fixed:'đã sửa'};
// status/mode đọc từ file: chỉ tra khoá riêng của bảng, tránh trúng tên có sẵn của Object (constructor, toString…)
const stVi=x=>(Object.hasOwn(ST,x)&&ST[x])||x||'?';
// Vì sao dãy bàn không có Tester: ghi theo làn của tính năng. chip: nhãn ngắn trên tiêu đề khối (vừa cả khối gọn nửa hàng),
// full: câu đầy đủ ở <title> (rê chuột) và aria-label (trình đọc màn hình)
const LANE_NOTE={quick:{chip:'làn nhanh',full:'Làn nhanh: Master tự kiểm, không có Tester'}};
// Dòng .now ở khối phiên chat: tiêu đề khối "Làm trực tiếp" đã nói điều đó nên bỏ cụm "làn trực tiếp", đỡ tốn chỗ trên nhãn trạng thái
const directNow=t=>t.replace(/\(?\s*làn trực tiếp\s*\)?\s*[:,]?/ig,' ').replace(/\s+/g,' ').trim()||t;
// Nhãn trạng thái của tính năng / file: draft chỉ là "chờ bạn duyệt" khi to: owner; còn lại Master đang làm rõ
const stOf=o=>o.status==='draft'&&o.to!=='owner'?'đang làm rõ':stVi(o.status);
// Chủ dự án cần làm gì với một file to: owner
function ownerAction(o){
 if(o.kind==='spec'&&o.status==='acceptance')return{act:'Đã làm xong, chờ bạn nghiệm thu',how:'Thử theo hướng dẫn bên dưới. Ổn thì nói với Master câu này; chưa ổn thì nói rõ chỗ chưa đạt.',say:'đạt'};
 if(o.kind==='spec')return{act:'Tài liệu chờ bạn duyệt',how:'Đọc file workflow/'+o.path+'. Ổn thì nói với Master câu này; chưa ổn thì nói chỗ cần sửa.',say:'duyệt'};
 if(o.kind==='tasks'&&o.status==='verified')return{act:'Việc kiểm tra đạt, chờ bạn duyệt',how:'Thử theo hướng dẫn ở báo cáo của Master. Ổn thì nói với Master câu này; chưa ổn thì nói rõ chỗ chưa đạt.',say:'đạt'};
 if(o.kind==='questions')return{act:'Câu hỏi chờ bạn trả lời',how:'Master sẽ hỏi bạn trong phiên chat. Nếu Master chưa hỏi, nói với Master câu này.',say:'Xử lý việc đang chờ'};
 return{act:'Cần bạn xem',how:'Mở file workflow/'+o.path+' rồi trao đổi với Master.',say:''};
}
const hashN=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h};

/* ---------- vẽ: hình vector bo tròn, có viền và đổ bóng nhẹ ---------- */
const OL='#2b1d16'; // viền
const R=(x,y,w,h,c,ex)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"'+(ex||'')+'/>';
const RR=(x,y,w,h,r,c,ex)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+c+'"'+(ex||'')+'/>';
const E=(cx,cy,rx,ry,c,ex)=>'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="'+c+'"'+(ex||'')+'/>';
const C=(cx,cy,r,c,ex)=>'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+c+'"'+(ex||'')+'/>';
const P=(d,c,ex)=>'<path d="'+d+'" fill="'+c+'"'+(ex||'')+'/>';
const LN=(d,c,w)=>'<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+(w||1)+'" stroke-linecap="round" stroke-linejoin="round"/>';
const K=w=>' stroke="'+OL+'" stroke-width="'+(w||1)+'" stroke-linejoin="round"';
const T=(x,y,s,c,t,a)=>'<text x="'+x+'" y="'+y+'" font-size="'+s+'" fill="'+c+'" text-anchor="'+(a||'middle')+'">'+esc(t)+'</text>';
const ROT=(a,x,y)=>' transform="rotate('+a+' '+x+' '+y+')"';
// Làm tối (k<0) hay sáng (k>0) một màu #rrggbb
const tint=(h,k)=>{const n=parseInt(h.slice(1),16),f=v=>Math.round(k<0?v*(1+k):v+(255-v)*k);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>f(v).toString(16).padStart(2,'0')).join('')};
function defs(){return '<defs>'
 +'<linearGradient id="shd" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>'
 +'<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#302c5c"/><stop offset="1" stop-color="#15142a"/></linearGradient>'
 +'<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(NIGHT?'#0d1636':'#68b8ef')+'"/><stop offset="1" stop-color="'+(NIGHT?'#2b3d70':'#d6f1ff')+'"/></linearGradient>'
 +'<linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ebd9"/><stop offset="1" stop-color="#e7d9bf"/></linearGradient>'
 +'<radialGradient id="glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>'
 +'<pattern id="wp" width="22" height="22" patternUnits="userSpaceOnUse">'+P('M11 6 l2.4 5 l-2.4 5 l-2.4 -5z','#e6d7ba')+C(0,0,1.3,'#e6d7ba')+C(22,0,1.3,'#e6d7ba')+C(0,22,1.3,'#e6d7ba')+C(22,22,1.3,'#e6d7ba')+'</pattern>'
 +'<pattern id="fl" width="80" height="20" patternUnits="userSpaceOnUse">'+R(0,0,80,10,'#dcaa74')+R(0,10,80,10,'#d5a06a')+R(0,0,80,.8,'#b88250')+R(0,10,80,.8,'#b88250')+R(52,0,.8,10,'#b88250')+R(18,10,.8,10,'#b88250')
  +LN('M4 4 q12 -1.6 24 0 t22 0','#e8bb88',.6)+LN('M57 6 q9 1 18 0','#e8bb88',.6)+LN('M24 15 q14 -1.6 28 0','#c8915c',.6)+LN('M60 16 q6 -1 14 0','#c8915c',.6)+'</pattern>'
 +'</defs>'}
/* ---------- tường, sàn ---------- */
function wall(){
 let s=R(0,0,W,76,'url(#wallg)')+R(0,0,W,76,'url(#wp)')+R(0,0,W,8,'#7a4a2c')+R(0,8,W,2,'#5e3820')
  +R(0,76,W,36,'#a8bea6')+R(0,73,W,4,'#8aa58a')+R(0,73,W,1,'#c6d6c4');
 for(let x=4;x<W;x+=44)s+=RR(x,82,36,24,2,'none',' stroke="#91aa8f" stroke-width="1.2"');
 return s+R(0,111,W,7,'#8a5a3a')+R(0,111,W,1.5,'#a87250')+R(0,117,W,1,'#5e3820');
}
function bunting(x0,x1,y,sag){const c=['#e05555','#f2c14e','#4fa35a','#3f7ee0','#9a5fd6'];
 let s=LN('M'+x0+' '+y+' Q'+(x0+x1)/2+' '+(y+sag*2)+' '+x1+' '+y,'#7a3d20',.8);const n=Math.floor((x1-x0)/13);
 for(let i=1;i<n;i++){const t=i/n,x=x0+(x1-x0)*t,yy=y+4*sag*t*(1-t);s+=P('M'+(x-4)+' '+yy+' l8 0 l-4 8z',c[i%c.length],K(.5))}return s}
function plantSmall(x,b){return E(x-2.6,b-10,2,4.2,'#4f9a48',K(.5)+ROT(-28,x-2.6,b-10))+E(x+2.6,b-10,2,4.2,'#5fae55',K(.5)+ROT(28,x+2.6,b-10))+E(x,b-12,2,4.6,'#478f41',K(.5))
 +RR(x-4,b-7,8,7,1.5,'#d9774a',K(.7))+R(x-3.5,b-6.3,7,1.2,'#ee9a66')}
function plantBig(x,b){let s='';
 [[-8,-30,-32],[8,-30,32],[-5,-40,-12],[5,-40,12],[0,-46,0],[-11,-21,-55],[11,-21,55]].forEach(([dx,dy,a],i)=>s+=E(x+dx,b+dy,4.2,10.5,i%2?'#5fae55':'#478f41',K(.6)+ROT(a,x+dx,b+dy)));
 return s+P('M'+(x-9)+' '+(b-16)+' l18 0 l-3 16 l-12 0z','#c96a3a',K(.9))+RR(x-10.5,b-19,21,4.5,1.5,'#b2582c',K(.8))}
function bookshelf(x,y,w,h){const cols=['#d64545','#3f7ee0','#4fa35a','#f2c14e','#9a5fd6','#e07a1f','#2fa3a3'];
 let s=RR(x,y,w,h,2,'#8a5634',K(1))+R(x+3,y+3,w-6,h-6,'#5a3420');const n=3,sh=(h-6)/n;
 for(let r=0;r<n;r++){const base=y+3+(r+1)*sh-3;let bx=x+5,i=0;
  while(bx<x+w-10){const bw=3+((r*5+i*3)%3),bh=sh-6-((i*7+r*3)%4),c=cols[(i+r*2)%cols.length];
   if((i+r)%5===4){s+=P('M'+bx+' '+base+' l'+bw+' 0 l4 '+(1-bh)+' l'+(-bw)+' 0z',c,K(.4));bx+=bw+5}
   else{s+=RR(bx,base-bh,bw,bh,.6,c,K(.4))+R(bx+.6,base-bh+2,bw-1.2,1,'rgba(255,255,255,.4)');bx+=bw+.8}i++}
  s+=R(x+3,base,w-6,3,'#a06a42')}
 return s+plantSmall(x+w-11,y)+RR(x+6,y-6,12,6,1,'#3f7ee0',K(.5))+RR(x+7,y-10,10,4,1,'#e05555',K(.5))}
function cooler(x){return RR(x+4,38,18,24,7,'#8fd3f4',K(1))+RR(x+7,41,4,16,2,'rgba(255,255,255,.55)')+R(x+9,61,8,3,'#6fb6dc')
 +RR(x,62,26,50,3,'#e4e9f0',K(1))+R(x+2,64,22,3,'rgba(255,255,255,.7)')+RR(x+4,70,18,12,2,'#c9d1dd',K(.6))+C(x+9,76,1.7,'#e05555')+C(x+17,76,1.7,'#3f7ee0')+RR(x+5,86,16,3,1,'#9aa3b5')
 +P('M'+(x+28)+' '+80+' l6 0 l-1 8 l-4 0z','#ffffff',K(.5))+P('M'+(x+28)+' '+86+' l6 0 l-1 8 l-4 0z','#ffffff',K(.5))}
function pantry(x){return RR(x,84,38,28,2,'#c88f5a',K(1))+R(x+19,86,1,24,'#8a5a30')+C(x+16,97,1,'#5e3820')+C(x+22,97,1,'#5e3820')+RR(x-2,80,42,5,1.5,'#8a5a3a',K(.8))
 +RR(x+3,54,20,26,3,'#3a3d4a',K(1))+RR(x+6,57,14,6,1.5,'#7de0a0')+R(x+11,66,4,3,'#222')+RR(x+9,71,8,8,1.2,'#ffffff',K(.6))
 +RR(x+26,72,6,8,1.5,'#e05555',K(.6))+RR(x+32,74,5,6,1.5,'#3f7ee0',K(.6))}
function windowPane(x,y,w,h){let s=RR(x,y,w,h,2,'#f4efe6',K(1))+R(x+3,y+3,w-6,h-6,'url(#sky)');
 if(NIGHT){s+=C(x+w-18,y+13,5,'#f4e9b8')+C(x+w-16,y+12,4.4,'#1b2a52');[[8,9],[22,18],[35,8],[48,22],[15,30],[58,12]].forEach(([a,b])=>s+=C(x+a,y+b,.8,'#fff'))}
 else s+=C(x+w-18,y+12,5,'#ffe27a')+E(x+20,y+14,8,3.5,'#fff')+E(x+26,y+12,6,4,'#fff')+E(x+50,y+24,7,3,'#fff');
 s+=P('M'+(x+3)+' '+(y+h-3)+' q'+(w*.25)+' -14 '+(w*.5)+' -6 q'+(w*.25)+' -10 '+(w*.5-6)+' -2 l0 8z',NIGHT?'#1f3a3a':'#7cc47a');
 s+=R(x+w/2-1.5,y+2,3,h-4,'#f4efe6')+R(x+2,y+h/2-1.5,w-4,3,'#f4efe6');
 const cur=(cx,f)=>P('M'+cx+' '+(y-4)+' l'+(f*14)+' 0 q'+(f*-4)+' '+(h*.5)+' '+(f*-2)+' '+(h+4)+' l'+(f*-12)+' 0z','#e07a6a',K(.8))
  +LN('M'+(cx+f*5)+' '+y+' l'+(-f)+' '+h,'#c25a4a',.8)+LN('M'+(cx+f*9)+' '+y+' l'+(-f*2)+' '+(h-2),'#c25a4a',.8);
 return s+LN('M'+(x-8)+' '+(y-4)+' l'+(w+16)+' 0','#7a4a2c',2.2)+cur(x-6,1)+cur(x+w+6,-1)+RR(x-4,y+h,w+8,4,1.5,'#d9cbb2',K(.8))}
// Đồng hồ treo tường: kim chạy khi watch.sh đang chạy, đứng yên khi nó tắt
function clock(cx,cy,run){let s=C(cx,cy,12,'#7a4a2c',K(1))+C(cx,cy,10,'#ffffff');
 for(let i=0;i<12;i++){const a=i*Math.PI/6;s+=C(cx+Math.sin(a)*8,cy-Math.cos(a)*8,i%3?.6:1,'#5b4a40')}
 const o=' style="transform-origin:'+cx+'px '+cy+'px"';
 return s+'<g class="'+(run?'hhand':'')+'"'+o+'>'+LN('M'+cx+' '+cy+' l5 0','#3b2a20',1.6)+'</g><g class="'+(run?'mhand':'')+'"'+o+'>'+LN('M'+cx+' '+cy+' l0 -8','#c23b3b',1.1)+'</g>'+C(cx,cy,1.3,OL)}
// Cửa: mở khi có việc chờ bạn
function door(x,open){const y=24,w=50,h=88;let s=RR(x-4,y-4,w+8,h+4,2,'#7a4a2c',K(1));
 if(open)s+=R(x,y,w,h,'#2c201a')+P('M'+x+' '+(y+h)+' l0 '+(-h)+' l'+(w*.35)+' -6 l0 '+(h+10)+'z','#c88050',K(.8))+C(x+w*.3,y+h*.55,1.5,'#f0d07a');
 else s+=RR(x,y,w,h,1,'#c88050')+RR(x+6,y+8,w-12,30,2,'#d99a68',K(.6))+RR(x+6,y+46,w-12,34,2,'#d99a68',K(.6))+C(x+w-8,y+h*.55,2,'#f0d07a',K(.5));
 return s}
function whiteboard(){return RR(362,12,148,96,3,'#c9ced8',K(1))+RR(366,16,140,88,1.5,'#fbfbf8')+RR(380,107,112,4,1.5,'#9aa3b5',K(.6))+RR(390,104.5,10,3,1,'#e05555')+RR(402,104.5,10,3,1,'#3f7ee0')+RR(472,104,12,4,1,'#3b3b3b')}
function calendar(x,y){let s=RR(x,y,30,32,2,'#fbfbf7',K(.8))+RR(x,y,30,9,2,'#d64545')+R(x,y+5,30,4,'#d64545')+C(x+7,y,1.5,'#3b2a20')+C(x+23,y,1.5,'#3b2a20');
 for(let r=0;r<4;r++)for(let c=0;c<5;c++)s+=RR(x+3+c*5.2,y+12+r*5,3.6,3,.6,r===2&&c===3?'#d64545':'#d6d0c4');return s}
function poster(x,y){let s=RR(x,y,34,44,1.5,'#2f3d6b',K(1));
 [[5,6],[28,10],[8,30],[27,33],[18,5]].forEach(([a,b])=>s+=C(x+a,y+b,.7,'#fff'));
 return s+P('M'+(x+17)+' '+(y+7)+' q6 6 4 18 l-8 0 q-2 -12 4 -18z','#f4f1ea',K(.6))+C(x+17,y+17,2,'#8fd3f4',K(.4))
  +P('M'+(x+13)+' '+(y+21)+' l-4 6 l4 -1z','#e05555',K(.4))+P('M'+(x+21)+' '+(y+21)+' l4 6 l-4 -1z','#e05555',K(.4))+P('M'+(x+15)+' '+(y+26)+' l2 6 l2 -6z','#f2a03b')
  +T(x+17,y+40,6,'#ffe066','SHIP IT')}
function sconce(x,y){return RR(x-1.5,y,3,8,1,'#7a4a2c')+P('M'+(x-6)+' '+(y+1)+' l12 0 l-3 -9 l-6 0z','#ffe9b0',K(.8))}
// Lối đi thảm đỏ từ bàn của bạn chạy thẳng xuống
function aisle(x,y,w,h){let s=R(x,y,w,h,'#a3373a')+R(x+3,y,2,h,'#e0b65a')+R(x+w-5,y,2,h,'#e0b65a');for(let yy=y+10;yy<y+h-8;yy+=18)s+=P('M'+(x+w/2)+' '+yy+' l4 4 l-4 4 l-4 -4z','#c9585a');return s}
// Thảm dưới mỗi dãy bàn, viền màu của tính năng
function rugBlock(x,y,w,h,c){return RR(x,y,w,h,8,c,' fill-opacity=".13" stroke="'+c+'" stroke-width="2"')+RR(x+5,y+5,w-10,h-10,5,'none',' stroke="'+c+'" stroke-opacity=".45" stroke-width="1" stroke-dasharray="5 4"')}
// Đồ đặt giữa hai bàn: cây, tủ hồ sơ, thùng rác (b: chân đồ vật)
function gapDeco(kind,x,b){
 if(kind===0)return '<g transform="translate('+x+','+b+') scale(.72)">'+plantBig(0,0)+'</g>';
 if(kind===1)return RR(x-7,b-28,14,28,1.5,'#9aa3b5',K(.9))+R(x-6,b-19,12,1,'#7d879b')+R(x-6,b-10,12,1,'#7d879b')+RR(x-2.5,b-25,5,1.8,.9,'#e4e9f0')+RR(x-2.5,b-16,5,1.8,.9,'#e4e9f0')+RR(x-2.5,b-7,5,1.8,.9,'#e4e9f0')+plantSmall(x,b-28);
 if(kind===2)return P('M'+(x-5)+' '+(b-11)+' l10 0 l-1.5 11 l-7 0z','#6c7488',K(.8))+C(x-1,b-12,2,'#fbfbf7',K(.4))+C(x+2,b-11.5,1.6,'#fbfbf7',K(.4));
 return ''}
// Góc nghỉ dưới cùng: thảm, đèn cây, sofa, ổ chó, ghế lười, kệ sách, máy in, máy bán nước. b: chân đồ vật
function lounge(b){let s=E(112,b-2,72,9,'#7b9ac9',' fill-opacity=".55" stroke="#5a78a8" stroke-width="1.5"')+E(112,b-2,60,6,'none',' stroke="#e7eefc" stroke-opacity=".6" stroke-dasharray="4 3"');
 s+=LN('M22 '+b+' l0 -42','#3b3b3b',1.6)+E(22,b,6,1.6,'#3b3b3b')+P('M14 '+(b-40)+' l16 0 l-4 -10 l-8 0z','#ffe9b0',K(.8));
 const x=50;
 s+=RR(x,b-36,96,24,7,'#5b7fbf',K(1))+R(x+48,b-34,1,20,'#4f6fa8')+RR(x+4,b-17,88,12,3,'#6f93d3',K(1))+R(x+48,b-17,1,12,'#4f6fa8')
  +RR(x-5,b-25,13,22,5,'#5b7fbf',K(1))+RR(x+88,b-25,13,22,5,'#5b7fbf',K(1))+RR(x+12,b-31,18,13,4,'#f2c14e',K(.8)+ROT(-8,x+21,b-24))+RR(x+66,b-31,18,13,4,'#e07a6a',K(.8)+ROT(8,x+75,b-24))
  +RR(x+2,b-4,4,4,1,'#5e3820')+RR(x+90,b-4,4,4,1,'#5e3820');
 s+=RR(156,b-14,14,14,1.5,'#b9824e',K(.8))+E(163,b-15,7,1.5,'#d9a46c',K(.6))+RR(160,b-21,6,6,1.5,'#ffffff',K(.5));
 s+=E(BED_X,b+3,17,6,'#8a5a3a',K(.9))+E(BED_X,b+2,13,3.8,'#ecd8b6')+RR(BED_X+19,b+2,8,2,1,'#fbfbf7',K(.4))+C(BED_X+19,b+2,1.5,'#fbfbf7',K(.4))+C(BED_X+27,b+2,1.5,'#fbfbf7',K(.4));
 s+=plantBig(246,b);
 s+=E(290,b-8,14,9,'#e07a1f',K(1))+E(285,b-11,5,3,'rgba(255,255,255,.25)');
 s+=RR(322,b-30,70,30,2,'#8a5634',K(1))+R(325,b-27,64,24,'#5a3420')+R(325,b-16,64,2,'#a06a42');
 for(let i=0;i<12;i++){const c=['#d64545','#3f7ee0','#4fa35a','#f2c14e','#9a5fd6'][i%5];s+=RR(327+i*5,(i<6?b-25:b-13)+(i%3),4,(i<6?9:10)-(i%3),.6,c,K(.3))}
 s+=plantSmall(334,b-30)+RR(372,b-36,12,6,1,'#e05555',K(.5));
 s+=RR(444,b-22,44,22,2,'#9aa3b5',K(1))+R(447,b-14,38,1,'#7d879b')+RR(448,b-36,36,14,2,'#e4e9f0',K(.8))+RR(452,b-40,28,5,1,'#ffffff',K(.5))+C(478,b-30,1.3,'#55d27a')+R(452,b-27,20,2,'#3a3d4a');
 s+=P('M500 '+(b-12)+' l12 0 l-2 12 l-8 0z','#6c7488',K(.8))+C(504,b-13,2.2,'#fbfbf7',K(.4));
 s+=RR(538,b-52,40,52,3,'#c94040',K(1))+RR(543,b-47,22,34,1.5,'#1f2a45');
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)s+=RR(546+c*6.5,b-44+r*11,4.5,8,1.5,['#f2c14e','#4fa35a','#3f7ee0'][(r+c)%3]);
 s+=RR(568,b-44,6,14,1,'#e9e3d8',K(.4))+RR(545,b-10,18,5,1,'#2b1d16');
 s+=plantBig(610,b);
 return s}
/* ---------- nhân vật ---------- */
const SKIN=['#f5cfa6','#e8b585','#c98d5e','#9c6b45'];
const STYLE=['short','long','bun','spiky','curly','short'];
const PANTS=['#3a3f5c','#4a3b2a','#2f4a5a','#3b3b3b'];
// Ngoại hình cố định theo ID: tóc, da, kiểu tóc, quần
function look(id){const h=hashN(id);return{hair:HAIR[h%HAIR.length],skin:SKIN[(h>>>3)%SKIN.length],style:STYLE[(h>>>5)%STYLE.length],pants:PANTS[(h>>>8)%PANTS.length]}}
// Trang phục theo vai: Master sơ mi, cà vạt và tai nghe, Coder áo hoodie, Tester áo blouse trắng
function outfit(role,color){
 if(role==='tester')return{shirt:'#f6f3ec',shade:'#cfc8bb',inner:color,dark:'#ddd6c8'};
 return{shirt:color,shade:'rgba(0,0,0,.22)',inner:'#ffffff',dark:tint(color,-.28)};
}
// Tóc nhô ra ngoài đầu (búi, dựng, xoăn): vẽ trước đầu
function hairExtra(cx,y,L){
 if(L.style==='bun')return C(cx,y-1,3.6,L.hair,K(.9))+C(cx-1,y-2,1,'rgba(255,255,255,.3)');
 if(L.style==='spiky')return P('M'+(cx-7.2)+' '+(y+5)+' l.6 -7 l3 3.5 l1.5 -6 l3 4.5 l2.5 -5 l2 5.5 l2 -3 l0 7.5z',L.hair,K(.9));
 if(L.style==='curly')return [[-6.6,1],[-4,-2.6],[0,-3.8],[4,-2.6],[6.6,1]].map(([dx,dy])=>C(cx+dx,y+dy,3,L.hair,K(.8))).join('');
 return '';
}
function headset(cx,y,front){return LN('M'+(cx-7.6)+' '+(y+7)+' Q'+cx+' '+(y-7)+' '+(cx+7.6)+' '+(y+7),'#2d2d3a',1.8)
 +RR(cx-10,y+4.5,4,7,1.8,'#2d2d3a')+RR(cx+6,y+4.5,4,7,1.8,'#2d2d3a')+(front?LN('M'+(cx+8)+' '+(y+11)+' q-1 4 -6 3.6','#2d2d3a',1)+C(cx+2,y+14.6,1,'#d64545'):'')}
// Người ngồi quay lưng lại, nhìn vào màn hình. y: đỉnh đầu.
// pose: type (gõ phím), wait (gõ ngón tay chờ), idle (gật gù), hand (giơ tay hỏi)
function sitBack(cx,y,L,role,color,pose){
 const o=outfit(role,color);let s='';
 const arm=(x,cls,up)=>'<g class="'+cls+'">'+(up
  ?RR(x,y-12,5,20,2.5,o.shirt,K(.9))+C(x+2.5,y-12.5,2.7,L.skin,K(.8))
  :RR(x,y+2,5,15,2.5,o.shirt,K(.9))+C(x+2.5,y+2.5,2.3,L.skin,K(.8)))+'</g>';
 // tay vươn tới bàn phím vẽ trước thân, thân che phần trong
 // stretch: vươn vai (hoạt hình vui), hai tay giơ cao chếch ra ngoài, vẽ sau đầu như tay giơ hỏi
 const stretch=pose==='stretch';
 if(!stretch)s+=arm(cx-13,'armL',false);
 if(pose!=='hand'&&!stretch)s+=arm(cx+8,'armR',false);
 if(L.style==='long')s+=RR(cx-8,y+4,16,16,6,L.hair,K(.9));
 s+=RR(cx-10.5,y+12,21,20,7,o.shirt,K(1))+RR(cx-10.5,y+12,21,20,7,'url(#shd)');
 if(role==='coder')s+=E(cx,y+14.5,8.6,3.8,o.dark,K(.8))+E(cx,y+14,5.5,1.8,tint(o.dark,-.3));
 if(role==='tester')s+=LN('M'+cx+' '+(y+16)+' l0 15',o.shade,1)+LN('M'+(cx-9)+' '+(y+25)+' l18 0',o.shade,1);
 if(role==='master')s+=P('M'+(cx-4)+' '+(y+12.5)+' l4 3 l4 -3z','#ffffff',K(.5));
 if(L.style==='long')s+=RR(cx-7,y+10,14,9,4,L.hair);
 s+=hairExtra(cx,y,L)+E(cx-7.2,y+8,1.8,2.4,L.skin,K(.7))+E(cx+7.2,y+8,1.8,2.4,L.skin,K(.7));
 s+=C(cx,y+7,7.3,L.hair,K(1))+E(cx-2.6,y+3.4,3,1.6,'rgba(255,255,255,.22)');
 if(role==='master')s+=headset(cx,y+.5,false);
 if(pose==='hand')s+=arm(cx+8,'armR',true);
 if(stretch)s+='<g'+ROT(-14,cx-10.5,y+8)+'>'+arm(cx-13,'armL',true)+'</g><g'+ROT(14,cx+10.5,y+8)+'>'+arm(cx+8,'armR',true)+'</g>';
 return '<g class="sit '+pose+'">'+s+'</g>';
}
// Phần tóc phía trước (nhìn thẳng): chỏm tóc và mái
function hairCap(cx,y){return 'M'+(cx-7.7)+' '+(y+7.5)+' C'+(cx-8.6)+' '+(y-4.6)+' '+(cx+8.6)+' '+(y-4.6)+' '+(cx+7.7)+' '+(y+7.5)
 +' Q'+(cx+5)+' '+(y+2.4)+' '+(cx+1)+' '+(y+3.3)+' Q'+(cx-4)+' '+(y+2.6)+' '+(cx-7.7)+' '+(y+7.5)+'Z'}
// Người đứng nhìn thẳng. hold: cup (cốc nước), paper (giơ tờ giấy), lens (kính lúp) hoặc rỗng.
// Hoạt hình vui thêm: cheer (giơ hai tay reo mừng), book (cầm sách đọc), sit (ngồi nhìn thẳng: sofa, ghế lười)
function standFront(cx,y,L,role,color,hold){
 const o=outfit(role,color);let s='';
 if(L.style==='long')s+=RR(cx-8.6,y+1,17.2,17,6,L.hair,K(.9));
 const leg=(x,cls)=>'<g class="'+cls+'">'+RR(x,y+24,5.5,12,2,L.pants,K(.9))+E(x+2.75,y+36.4,3.7,1.9,'#2b2118')+'</g>';
 // tay giơ cao, xoay quanh vai chếch ra ngoài (side -1 trái, 1 phải)
 const armUp=(x,side)=>'<g'+ROT(side*18,x+2.5,y+15)+'>'+RR(x,y+1,5,15,2.5,o.shirt,K(.9))+C(x+2.5,y+.8,2.3,L.skin,K(.7))+'</g>';
 if(hold!=='sit')s+=leg(cx-6,'legL')+leg(cx+.5,'legR');
 s+=hold==='cheer'?armUp(cx-12.5,-1):RR(cx-12.5,y+14,5,12,2.5,o.shirt,K(.9))+C(cx-10,y+26,2.2,L.skin,K(.7));
 s+=RR(cx-9.5,y+12,19,15,6,o.shirt,K(1))+RR(cx-9.5,y+12,19,15,6,'url(#shd)');
 if(role==='tester')s+=P('M'+(cx-3.6)+' '+(y+12.5)+' l3.6 6 l3.6 -6z',o.inner,K(.6))+LN('M'+cx+' '+(y+18.5)+' l0 8',o.shade,.9)
  +RR(cx-7,y+19,4,4,.8,'none',' stroke="'+o.shade+'" stroke-width=".8"')+LN('M'+(cx-6)+' '+(y+19.5)+' l0 -2.5','#3f7ee0',.9);
 else if(role==='master'||role==='boss')s+=P('M'+(cx-3.8)+' '+(y+12.5)+' l3.8 4 l3.8 -4z','#ffffff',K(.6))+P('M'+cx+' '+(y+15.6)+' l-1.7 2 l1.7 7.4 l1.7 -7.4z','#d64545',K(.5));
 else s+=E(cx,y+13.6,6.2,2.3,o.dark,K(.6))+LN('M'+(cx-2.4)+' '+(y+15.2)+' l0 4','#f4efe6',.9)+LN('M'+(cx+2.4)+' '+(y+15.2)+' l0 4','#f4efe6',.9)+RR(cx-5,y+20,10,5,2,'rgba(0,0,0,.14)');
 s+=RR(cx-2.5,y+10,5,4,1.5,L.skin)+hairExtra(cx,y,L)+C(cx,y+6.5,7.4,L.skin,K(1))+P(hairCap(cx,y),L.hair,K(.9))+E(cx-3,y+1.5,2.6,1.2,'rgba(255,255,255,.25)');
 s+='<g class="eyes">'+E(cx-2.8,y+7.6,1.05,1.4,'#2b2b2b')+E(cx+2.8,y+7.6,1.05,1.4,'#2b2b2b')+C(cx-2.5,y+7.1,.4,'#fff')+C(cx+3.1,y+7.1,.4,'#fff')+'</g>'
  +E(cx-4.7,y+9.9,1.5,.8,'#f19a9a',' opacity=".75"')+E(cx+4.7,y+9.9,1.5,.8,'#f19a9a',' opacity=".75"')+LN('M'+(cx-1.4)+' '+(y+10.4)+' q1.4 1.3 2.8 0','#7a3b2a',.8);
 if(role==='master')s+=headset(cx,y,true);
 if(hold==='paper')s+='<g class="wave">'+RR(cx+7.5,y+3,5,13,2.5,o.shirt,K(.9))+RR(cx+6,y-10,14,12,1.2,'#ffffff',K(.8))
  +LN('M'+(cx+8.5)+' '+(y-7)+' l8 0 M'+(cx+8.5)+' '+(y-4.5)+' l8 0 M'+(cx+8.5)+' '+(y-2)+' l5 0','#9aa3b5',.8)+LN('M'+(cx+8.5)+' '+(y+.5)+' l6 0','#d64545',.8)+C(cx+10,y+3,2.3,L.skin,K(.7))+'</g>';
 else if(hold==='cheer')s+=armUp(cx+7.5,1);
 else s+='<g class="'+(hold==='cup'?'sip':'')+'">'+RR(cx+7.5,y+14,5,12,2.5,o.shirt,K(.9))
  +(hold==='cup'?RR(cx+9,y+20,6.5,7.5,1.3,'#ffffff',K(.7))+R(cx+9.8,y+20.8,4.9,2,'#bfe3f5'):'')
  +(hold==='lens'?LN('M'+(cx+10)+' '+(y+26)+' l4 -5','#7a4a22',1.8)+C(cx+15.5,y+18,4,'#bfe3f5',K(.8))+C(cx+14.4,y+16.9,1,'#fff'):'')
  +C(cx+10,y+26,2.2,L.skin,K(.7))+'</g>';
 // sách mở cầm trước bụng, hai tay đỡ hai mép
 if(hold==='book')s+=P('M'+(cx-9)+' '+(y+17)+' l9 2 l0 8 l-9 -2z','#ffffff',K(.7))+P('M'+(cx+9)+' '+(y+17)+' l-9 2 l0 8 l9 -2z','#f4efe6',K(.7))
  +LN('M'+(cx-7)+' '+(y+20)+' l5 1 M'+(cx-7)+' '+(y+22.5)+' l5 1 M'+(cx+7)+' '+(y+20)+' l-5 1','#9aa3b5',.6)+C(cx-9,y+24,2.2,L.skin,K(.7))+C(cx+9,y+24,2.2,L.skin,K(.7));
 // ngồi nhìn thẳng: cẳng chân thõng xuống, đùi chĩa ra trước nên ngắn lại và che phần dưới thân
 if(hold==='sit')s+=RR(cx-7.5,y+27,5.5,8,2,L.pants,K(.9))+RR(cx+2,y+27,5.5,8,2,L.pants,K(.9))+E(cx-4.75,y+35.3,3.6,1.8,'#2b2118')+E(cx+4.75,y+35.3,3.6,1.8,'#2b2118')
  +RR(cx-8.5,y+22,8,7,3,L.pants,K(.9))+RR(cx+.5,y+22,8,7,3,L.pants,K(.9));
 return s;
}
// Người đứng quay lưng (ngắm cửa sổ, pha cà phê, mua nước…): cùng khung với standFront (y: đỉnh đầu, chân ở y+38)
function standBack(cx,y,L,role,color){
 const o=outfit(role,color);
 const leg=(x,cls)=>'<g class="'+cls+'">'+RR(x,y+24,5.5,12,2,L.pants,K(.9))+E(x+2.75,y+36.4,3.7,1.9,'#2b2118')+'</g>';
 const arm=x=>RR(x,y+14,5,12,2.5,o.shirt,K(.9))+C(x+2.5,y+26,2.2,L.skin,K(.7));
 let s=leg(cx-6,'legL')+leg(cx+.5,'legR')+arm(cx-12.5)+arm(cx+7.5);
 if(L.style==='long')s+=RR(cx-8,y+4,16,16,6,L.hair,K(.9));
 s+=RR(cx-9.5,y+12,19,15,6,o.shirt,K(1))+RR(cx-9.5,y+12,19,15,6,'url(#shd)');
 if(role==='coder')s+=E(cx,y+14,7.6,3.4,o.dark,K(.8));
 if(role==='tester')s+=LN('M'+cx+' '+(y+16)+' l0 10',o.shade,1);
 if(L.style==='long')s+=RR(cx-7,y+10,14,9,4,L.hair);
 s+=hairExtra(cx,y,L)+E(cx-7.2,y+7.5,1.6,2.2,L.skin,K(.7))+E(cx+7.2,y+7.5,1.6,2.2,L.skin,K(.7));
 s+=C(cx,y+6.5,7.4,L.hair,K(1))+E(cx-2.6,y+3,3,1.6,'rgba(255,255,255,.22)');
 if(role==='master')s+=headset(cx,y,false);
 return s;
}
/* ---------- bàn ghế, đồ trên bàn ---------- */
function desk(x,y,w,front){let s='';
 if(front)s+=RR(x+3,y+8,w-6,24,2,'#b9824e',K(1))+R(x+7,y+12,w-14,1,'#a06a3c');
 else s+=RR(x+4,y+8,3.4,22,1,'#9a6a3e',K(.6))+RR(x+w-7.4,y+8,3.4,22,1,'#9a6a3e',K(.6));
 return s+RR(x,y,w,10,2.5,'#efd2a0',K(1))+R(x+2,y+1.6,w-4,1.5,'rgba(255,255,255,.55)')+R(x+1.5,y+7,w-3,2,'rgba(160,100,50,.25)')}
// Màn hình trước mặt; đang làm thì có dòng code chạy. notes: giấy nhớ dán ở góc
function screen(x,y,on,run,c,notes){
 let s=R(x+14,y+21,4,5,'#4a4e5c')+RR(x+8,y+25,16,3,1.5,'#4a4e5c',K(.6))+RR(x,y,32,23,3,'#3a3d4a',K(1))+RR(x+2.5,y+2.5,27,17,1.5,on?'url(#scr)':'#15171d');
 if(on&&!run)s+=RR(x+5,y+6,9,2,1,c,' opacity=".55"')+RR(x+5,y+10,14,2,1,'#55d27a',' opacity=".4"');
 if(run)s+='<g class="code">'+RR(x+5,y+5,10,2,1,c)+RR(x+5,y+9,17,2,1,'#55d27a')+RR(x+5,y+13,7,2,1,'#e05a5a')+RR(x+14,y+13,10,2,1,c)+'</g>';
 s+=P('M'+(x+20)+' '+(y+2.5)+' l7 0 l-10 17 l-7 0z','rgba(255,255,255,.07)');
 if(notes)s+=RR(x+25,y-2,6,6,.8,'#ffe066',K(.4)+ROT(8,x+28,y+1))+RR(x+26.5,y+4.5,5,5,.8,'#9fe0ff',K(.4)+ROT(-6,x+29,y+7));
 return s}
function keyboard(cx,y){let s=RR(cx-11,y,22,5.5,1.5,'#d5d9e1',K(.7));for(let i=0;i<6;i++)s+=R(cx-9+i*3.2,y+1.4,2,1,'#9aa3b5')+R(cx-8+i*3,y+3.2,2,1,'#9aa3b5');return s}
function laptopBack(cx,y){return RR(cx-12,y-1.5,24,3,1.2,'#9aa3b5',K(.6))+RR(cx-10.5,y-15,21,14,1.5,'#c9cdd6',K(.8))+C(cx,y-8,1.6,'#ffffff')}
function cup(x,y,hot){return LN('M'+(x+7)+' '+(y+2)+' q3.2 0 3.2 2.6 q0 2.6 -3.2 2.6',OL,1)+RR(x,y,7,8,1.5,'#ffffff',K(.8))+E(x+3.5,y+1.2,2.8,.9,'#7a4a22')
 +(hot?'<g class="steam">'+RR(x+2,y-5,1.1,4,.55,'rgba(255,255,255,.8)')+RR(x+4.5,y-8,1.1,4,.55,'rgba(255,255,255,.65)')+'</g>':'')}
function lensProp(x,y){return LN('M'+(x+5)+' '+(y+4)+' l3.5 2.5','#7a4a22',1.6)+C(x+3,y+2,3,'#bfe3f5',K(.8))+C(x+2,y+1,.8,'#fff')}
function papers(x,y){return RR(x+1,y+1,13,8,1,'#d9d4c8',K(.6)+ROT(-7,x+7,y+5))+RR(x,y,13,8,1,'#ffffff',K(.6))+LN('M'+(x+3)+' '+(y+3)+' l7 0 M'+(x+3)+' '+(y+5.5)+' l5 0','#9aa3b5',.8)}
function bug(x,y){return '<g class="bug">'+LN('M'+(x+2)+' '+(y+1)+' l-2 -2 M'+(x+5)+' '+(y+1)+' l0 -2.5 M'+(x+8)+' '+(y+1)+' l2 -2 M'+(x+2)+' '+(y+7)+' l-2 2 M'+(x+5)+' '+(y+7)+' l0 2.5 M'+(x+8)+' '+(y+7)+' l2 2',OL,.8)
 +E(x+5,y+4,5,3.6,'#d64545',K(.8))+LN('M'+(x+5)+' '+(y+.6)+' l0 6.8',OL,.7)+C(x+3,y+3,.9,OL)+C(x+7,y+5,.9,OL)+C(x+10.5,y+4,2,OL)+'</g>'}
// Đồ riêng trên bàn, cố định theo ID: chậu cây, vịt cao su, đèn bàn, chồng sách, khung ảnh
function deskDeco(id,x,b){switch(hashN(id+'#')%5){
 case 0:return plantSmall(x,b);
 case 1:return E(x,b-3,4.6,3,'#ffd23f',K(.7))+C(x+2.6,b-7,2.7,'#ffd23f',K(.7))+P('M'+(x+5)+' '+(b-7.2)+' l2.6 .6 l-2.6 1z','#f08a24',K(.4))+C(x+3.2,b-7.8,.5,OL);
 case 2:return E(x,b-.8,4,1.2,'#3b3b3b')+LN('M'+x+' '+(b-1)+' l2 -10 l5 -2','#3b3b3b',1.2)+P('M'+(x+4)+' '+(b-15)+' l7 2 l-2 5 l-7 -2z','#e05555',K(.6));
 case 3:return RR(x-6,b-3,12,3,.6,'#3f7ee0',K(.4))+RR(x-5,b-6,11,3,.6,'#e05555',K(.4))+RR(x-6,b-9,10,3,.6,'#4fa35a',K(.4));
 default:return RR(x-4,b-10,8,10,1,'#c9a24a',K(.6))+R(x-2.6,b-8.6,5.2,7.2,'#9fd0f0')+E(x,b-3.6,2,1.4,'#4f9a48')+C(x,b-6,1.2,'#f5cfa6');
}}
// Ghế văn phòng nhìn từ sau lưng; y: đỉnh lưng ghế
function chair(cx,y){return R(cx-1.5,y+18,3,6,'#2f333d')+RR(cx-11,y+23.5,22,2.5,1.2,'#2f333d')+C(cx-10,y+27,1.7,'#1f2229')+C(cx+10,y+27,1.7,'#1f2229')+C(cx,y+27,1.7,'#1f2229')
 +RR(cx-12,y+13,24,5.5,2.7,'#3d4250',K(.8))+RR(cx-10,y,20,16,5,'#4f5669',K(1))+RR(cx-8,y+2,16,3,1.5,'rgba(255,255,255,.18)')}
/* ---------- bong bóng, biển tên ---------- */
// Bề rộng bong bóng theo chữ (cỡ 8.5): dùng chung cho bong bóng trạng thái, bong bóng thoại và roi nhỏ đặt cạnh nó
const bubbleW=t=>Math.max(15,t.length*5.4+9);
function bubble(cx,y,txt,kind){
 const col={run:['#ffffff','#1f7a4d'],wait:['#fff6dc','#9a5a00'],idle:['#efe9df','#8a8278'],bad:['#ffe6e3','#b23030']}[kind];
 const w=bubbleW(txt),x=cx-w/2;
 const cls=kind==='wait'||kind==='bad'?'bob':txt==='z'?'zz':'';
 return '<g class="bub '+cls+'">'
  +'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="13" rx="3.5" fill="'+col[0]+'" stroke="'+OL+'" stroke-width="1.3"/>'
  +'<path d="M'+(cx-2.5)+' '+(y+12.3)+' l2.5 4 l2.5 -4" fill="'+col[0]+'" stroke="'+OL+'" stroke-width="1.3" stroke-linejoin="round"/>'
  +T(cx,y+9.6,8.5,col[1],txt)+'</g>'}
// Roi nhỏ (x, y: góc trên trái, rộng ~15, cao ~14): gợi ý tĩnh "có việc mà chưa ai làm" thay cho quản đốc khi không có
// chuyển động (tắt hoạt hình vui, máy giảm chuyển động). Cán chéo, dây cuộn lên, hai vạch "tách" ở đầu dây
function whipIcon(x,y){return '<g class="whip">'+LN('M'+x+' '+(y+13)+' l3.6 -4.8',OL,3.4)+LN('M'+x+' '+(y+13)+' l3.6 -4.8','#a0652e',1.8)
 +LN('M'+(x+3.6)+' '+(y+8.2)+' q.6 -7 6.4 -6.8 q3.4 .4 1.6 3.6',OL,1.2)+LN('M'+(x+12.4)+' '+(y+.6)+' l1.8 -1.8 M'+(x+13.4)+' '+(y+3.4)+' l2.4 0','#d64545',1)+'</g>'}
// Biển tên: tên và trạng thái ngắn, cắt chữ cho vừa maxW để không đè lên biển bên cạnh
const LBL_NAME=8,LBL_SHORT=7,LBL_H=20; // cỡ chữ dòng tên, dòng trạng thái; chiều cao biển
function label(cx,y,name,short,kind,maxW){
 const c={run:'#8ff0b8',wait:'#ffd27a',idle:'#ddd3c5',bad:'#ff9c9c'}[kind];maxW=maxW||90;
 const n=cut(name,Math.floor((maxW-8)/(LBL_NAME*CW))),sh=cut(short,Math.floor((maxW-8)/(LBL_SHORT*CW)));
 const w=Math.min(maxW,Math.max(n.length*LBL_NAME*CW,sh.length*LBL_SHORT*CW)+10);
 return '<g class="lbl"><rect x="'+(cx-w/2)+'" y="'+y+'" width="'+w+'" height="'+LBL_H+'" rx="3.5" fill="rgba(43,33,27,.84)"/>'+T(cx,y+8.5,LBL_NAME,'#fff6e6',n)+T(cx,y+17,LBL_SHORT,c,sh)+'</g>'}
function selBox(x,y,w,h){return '<rect class="sel" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6" fill="rgba(255,224,102,.12)" stroke="#ffe066" stroke-width="2"/>'}
// Trạng thái ngắn ghi dưới bàn
// fid: mã tính năng của dãy bàn; tiêu đề dãy đã ghi mã này nên bỏ khỏi dòng .now để còn chỗ cho chữ có ích.
// Bỏ cả chữ "Đang" đầu dòng: bong bóng "…" và tay gõ phím đã nói Master đang làm, biển Master chỉ chứa ~23 ký tự
function shortOf(a,st,asking,fid){
 if(st.kind==='bad')return 'chưa khai báo';
 if(asking)return 'đang hỏi Master';
 if(a&&a.now&&st.label===a.now)return cut(((fid?a.now.split(fid).join('').replace(/\(\s*\)/g,'').replace(/\s+/g,' ').trim():'')||a.now).replace(/^Đang\s+/i,''),30);
 if(st.txt==='!')return 'chờ bạn';
 if(st.kind==='run')return st.label.indexOf('Master đang gọi')===0?'Master gọi, đang làm':'đang làm';
 if(st.kind==='wait')return 'có '+st.txt+' việc chờ';
 if(/^(Đang chạy ở|Đang ở)/.test(st.label))return 'đang ở '+((st.label.match(/F-\d+/)||[''])[0]);
 if(/^Có việc ở/.test(st.label))return 'có việc ở '+((st.label.match(/F-\d+/)||[''])[0]);
 // Lần Master gọi gần nhất đã xong: rảnh từ giờ đó; khác ngày thì ghi ngày (biển tên hẹp, chữ ngắn mới đọc hết)
 if(a&&a.hist&&a.hist.length){const m=(a.hist[0].end||'').match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d:\d\d)/);
  if(m){const d=new Date(),today=+m[1]===d.getFullYear()&&+m[2]===d.getMonth()+1&&+m[3]===d.getDate();return 'rảnh từ '+(today?m[4]:m[3]+'/'+m[2])}}
 return 'rảnh';
}
function confetti(cx,y,elapsed){let s='<g class="conf">';const c=['#d64545','#f2c14e','#3f8f4a','#2f6fe0','#8b4fd0'];
 for(let i=0;i<26;i++){const x=cx-70+((i*37)%140),d=-((elapsed/1000)+(i%7)*.4);
  s+='<rect x="'+x+'" y="'+y+'" width="3" height="5" rx="1" fill="'+c[i%c.length]+'" style="animation-delay:'+d.toFixed(2)+'s"/>'}
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
 if(here)return{kind:'wait',txt:String(here),label:(Object.hasOwn(MODE_WAIT,a.mode)&&MODE_WAIT[a.mode])||'Có việc, cần mở phiên tay',on:true};
 // Bận ở tính năng khác (.now của Master, hay file chờ ở dãy khác): đừng ghi "Rảnh" kẻo bạn tưởng agent đang rảnh
 const nowIn=(a.now&&a.now.match(/F-\d+/g))||[];
 if(nowIn.length)return{kind:'idle',txt:'z',label:'Đang ở '+[...new Set(nowIn)].join(', ')+': '+a.now,on:false};
 const waitIn=[...new Set(a.pending.map(p=>(p.match(/F-\d+/)||[''])[0]).filter(Boolean))];
 if(waitIn.length)return{kind:'idle',txt:'z',label:'Có việc ở '+waitIn.join(', '),on:false};
 return{kind:'idle',txt:'z',label:'Rảnh',on:false};
}

/* ---------- dựng cảnh ---------- */
const CW=0.6; // độ rộng một ký tự monospace so với cỡ chữ
const cut=(t,n)=>t.length>n?t.slice(0,Math.max(1,n-1))+'…':t;
// Khung rộng W. Tường cao tới FLOOR_Y. Các dãy bàn từ LX tới BR, cách nhau GAP (lối đi cho thú cưng).
// Lối đi thảm đỏ từ AX, rộng AW, chính giữa là bàn của bạn. TOP: dãy bàn đầu tiên. Dưới cùng là góc nghỉ.
// TOP: dãy bàn đầu tiên; lối chó mèo phía trên nó, q4(TOP-12)=204, nằm dưới hàng biển tên thứ ba ở cây nước (y 162-182),
// để con vật (lớp #pets nằm trên cảnh) không che tên và không chặn cú bấm vào agent ở cây nước
const W=720, FLOOR_Y=118, LX=24, BR=640, AX=652, AW=48, OWNER_X=AX+AW/2, COL0=LX+124, STEP=98, PER_ROW=5, ROW_H=130, HEAD=30, TOP=216, GAP=24;
// HOLE_X: lỗ chuột ở chân tường, giữa cửa và bảng trắng, trên lối sát tường (lối này bắt đầu sau cây nước, xem BASE_X0).
// DOOR_X: mép trái cửa (quản đốc của hoạt hình vui ra vào ở đây)
const BED_X=200, HOLE_X=360, DOOR_X=298;
// Khối gọn: tính năng có tối đa COMPACT_SEATS chỗ (Master và 1-2 người: làn nhanh, đang làm rõ, làm trực tiếp) chỉ rộng
// nửa hàng, hai khối gọn chung một hàng, để vài việc nhỏ không mỗi việc chiếm cả một dãy bàn trống, đẩy dãy khác xuống dưới.
// HALF_W đủ chỗ cho bàn Master, hai bàn và biển tên của bàn cuối: SEAT_DX + STEP + 72/2 + DESK_LBL_W/2 = 306
const COMPACT_SEATS=3, MID_GAP=4, HALF_W=(BR-LX-MID_GAP)/2, SEAT_DX=COL0-LX;
// Khối phiên chat (Master không cầm tính năng nào đang mở) không phải tính năng nào: màu trung tính, không lấy màu của bảng màu tính năng
const DIRECT_COLOR='#6f7f94';
// Biển tên rộng tối đa bằng khoảng cách tâm hai bàn kề nhau trừ 2, để không đè biển bên cạnh.
// Bàn Master (rộng 100) cách bàn đầu tiên 102 đơn vị: biển Master rộng tới 2*102 - DESK_LBL_W
const DESK_LBL_W=STEP-2, MASTER_LBL_W=108;
// Cây nước: tối đa COOLER_MAX người đứng cách nhau COOLER_STEP, đỉnh đầu ở COOLER_Y; biển tên so le COOLER_ROWS hàng để mỗi biển rộng hơn
const COOLER_X=162, COOLER_Y=80, COOLER_STEP=28, COOLER_ROWS=3, COOLER_MAX=5;
// Sàn trống dưới bảng trắng, giữa lối chó mèo sát chân tường và lối trên dãy bàn đầu: nhãn pháo giấy, dưới nó là
// bong bóng "watch.sh ngừng bất thường" (hai cái hiện cùng lúc cũng không chồng nhau, không che người hay cửa)
const NOTE_X=436, PARTY_Y=127, DEAD_Y=147;
const NIGHT=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
const MOTION_OK=!window.matchMedia||!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Nhớ chỗ của từng agent ở lần vẽ trước: đổi chỗ (cây nước ↔ bàn) thì cho đi bộ; tính năng vừa xong thì bắn pháo giấy
const PREV_PLACE=new Map(),PREV_STATUS=new Map(),ARRIVE=new Map();let PARTY=[];
const WALK_MS=1400;
// Agent vừa đi bộ tới chỗ mới: ẩn ở chỗ mới cho tới khi người đi bộ tới nơi (kể cả qua các lần làm mới 3 giây)
const arriving=id=>{const t=ARRIVE.get(id);if(!t)return null;const e=Date.now()-t;return e<WALK_MS+50?e:null};
// key: chỗ ngồi ("<dãy>/<ID>", "cooler/<ID>"), riêng cho từng chỗ vì một agent có thể ngồi ở nhiều dãy bàn
const agG=(id,label,inner,key)=>{const e=arriving(id);
 return '<g class="ag'+(openId===id?' on':'')+(e!=null?' arrive':'')+(FUN.hide.has(key)?' away':'')+'"'+(e!=null?' style="animation-delay:-'+(e/1000).toFixed(2)+'s"':'')
  +' data-id="'+esc(id)+'" data-k="'+esc(key)+'" tabindex="0" role="button" aria-label="'+esc(id+': '+label)+'"><title>'+esc(id+': '+label)+'</title>'+inner+'</g>'};
// Tìm lại nhân vật sau khi vẽ lại: đúng chỗ ngồi nếu còn, không thì (vừa đổi chỗ) chỗ đầu tiên của agent đó
const findAg=(root,key,id)=>(key&&root.querySelector('.ag[data-k="'+CSS.escape(key)+'"]'))||(id?root.querySelector('.ag[data-id="'+CSS.escape(id)+'"]'):null);

// Một chỗ ngồi: màn hình, bàn, đồ trên bàn, người quay lưng, ghế, bong bóng, biển tên
// Y: mép trên mặt bàn; đầu người ngồi ở Y+6, người đứng ở Y-2
function station(f,id,a,x,w,top,isMaster,color){
 const Y=top+50,cx=x+w/2,role=a?a.role:(id.split('-')[0]||'coder');
 // Khối phiên chat chỉ có dòng .now (không file, có khi không mã F-NNN): đang làm, hay chờ bạn. Dòng không đổi quá
 // STALE_NOW_MS thì phiên có thể đã đóng: ngồi gật gù, không gõ phím, kẻo dòng từ mấy hôm trước trông như việc đang làm
 const since=f.direct?whenOf(a.nowAt):'',nowOld=f.direct&&!a.nowWait&&Date.now()-a.nowAt>STALE_NOW_MS;
 let st=!f.direct?stateOf(a,f.dir):a.nowWait?{kind:'wait',txt:'!',label:a.now,on:true}
  :nowOld?{kind:'idle',txt:'z',label:a.now+' (không đổi từ '+since+', phiên có thể đã đóng)',on:false}:{kind:'run',txt:'…',label:a.now,on:true};
 // Master không còn file chờ nhưng tính năng đang chờ chủ dự án: hiện "!" thay vì "z" (như trước)
 if(isMaster&&st.kind==='idle'&&S.owner.some(o=>o.path.indexOf(f.dir+'/')===0))st={kind:'wait',txt:'!',label:'Chờ bạn (xem mục Cần bạn)',on:true};
 // Câu hỏi của agent này trong tính năng còn mở, chưa tới lượt nó: giơ tay
 const asking=!!a&&!isMaster&&st.kind!=='run'&&st.txt!=='!'&&f.items.some(it=>it.kind==='questions'&&it.from===id&&it.status==='open'&&it.to!==id);
 const bugs=f.items.some(it=>it.kind==='bugs'&&it.to===id&&it.status==='open');
 const L=look(id),run=st.kind==='run',standUp=isMaster&&st.txt==='!',notes=hashN(id)%3===0;
 const pose=run?'type':asking?'hand':st.kind==='wait'?'wait':'idle';
 const bubbleTxt=asking?'?':st.txt,bubbleKind=asking?'wait':st.kind;
 let s=selBox(x-4,top+2,w+8,ROW_H-6);
 if(isMaster)s+=screen(x+12,Y-27,true,run,color,notes)+screen(x+w-44,Y-27,true,run,'#55d27a',false);
 else s+=screen(cx-16,Y-27,!!(a&&st.on),run,color,notes);
 s+=desk(x,Y,w)+keyboard(cx,Y+2.5)+cup(x+w-13,Y-3,run);
 if(isMaster)s+=papers(x+4,Y-2);else s+=deskDeco(id,x+10,Y+6);
 if(role==='tester')s+=lensProp(cx+13,Y);
 if(bugs)s+=bug(x+4,Y+12);
 // Master chờ bạn: đứng dậy quay lại, giơ tờ giấy; còn lại ngồi quay lưng nhìn màn hình
 if(standUp)s+=chair(cx+20,Y+27)+standFront(cx-8,Y-2,L,role,color,'paper');
 else s+=(a?sitBack(cx,Y+6,L,role,color,pose):'<g opacity=".45">'+sitBack(cx,Y+6,L,role,'#8f9bb0','idle')+'</g>')+chair(cx,Y+27);
 // khối phiên chat: tiêu đề khối đã ghi dòng .now, biển tên chỉ ghi từ lúc nào (biết việc nhỏ kéo dài bao lâu)
 const short=f.direct?(standUp?'chờ bạn':nowOld?'không đổi':'đang làm')+' từ '+since:shortOf(a,st,asking,f.id);
 s+=bubble(cx,top+4,bubbleTxt,bubbleKind)+label(cx,Y+56,id,short,asking?'wait':st.kind,isMaster?MASTER_LBL_W:DESK_LBL_W);
 // có việc mà chưa ai làm (bong bóng số, không giơ tay hỏi): quản đốc tới nhắc (hoạt hình vui); không có chuyển động
 // thì chỉ vẽ cái roi nhỏ cạnh bong bóng, cùng ý. Đang chạy ở tính năng khác (subagent, auto có việc xếp hàng ở dãy này)
 // thì không ai lười cả: không nhắc
 const running=!!(a&&a.running);
 if(pose==='wait'&&/^\d+$/.test(st.txt)&&!running&&!funMotion())s+=whipIcon(cx+bubbleW(bubbleTxt)/2+2,top+3);
 const key=(f.dir||'direct')+'/'+id;
 // chỗ ngồi cho hoạt hình vui (vươn vai, nói chuyện, reo mừng, quản đốc); y như người đứng ở bàn (Y-2), giống chỗ của người đi bộ
 FUN.spots.set(key,{id,key,zone:'desk',x:cx,y:Y-2,pose:standUp?'stand':a?pose:'ghost',kind:st.kind,txt:st.txt,run:running,dir:f.dir,role,color});
 return agG(id,st.label+(asking?' · đang chờ Master trả lời câu hỏi':'')+(bugs?' · có lỗi Tester báo':''),s,key);
}

// Tiêu đề khối: tên, nhãn trạng thái, nhãn làn. Mọi thứ cắt cho vừa bề rộng khối w (khối gọn chỉ nửa hàng).
// Tính năng: nhãn trạng thái ngắn và quan trọng ("chờ bạn nghiệm thu") nên cắt tên trước, tên chỉ giữ chắc HEAD_TITLE_KEEP
// ký tự (mã F-NNN). Khối phiên chat: giữ nguyên tên ("Làm trực tiếp · master-NN"), cắt dòng .now ở nhãn trạng thái
const HEAD_FS=8.5, CHIP_FS=7.5, LANE_FS=7, HEAD_TITLE_KEEP=10;
function blockHead(b,x,y,w){
 const lane=LANE_NOTE[b.f.lane],lnw=lane?lane.chip.length*CW*LANE_FS+10:0;
 // chỗ cho tên và nhãn trạng thái: khung tiêu đề từ x+4 tới x+w-4, đệm 6 hai bên và giữa các nhãn
 const room=w-26-(lane?lnw+6:0),keep=b.f.direct?b.title.length:Math.min(b.title.length,HEAD_TITLE_KEEP);
 const sv=cut(b.status,Math.max(6,Math.floor((room-keep*CW*HEAD_FS-12)/(CW*CHIP_FS)))),svw=sv.length*CW*CHIP_FS+12;
 const lbl=cut(b.title,Math.floor((room-svw)/(CW*HEAD_FS))),lw=lbl.length*CW*HEAD_FS,lx=x+22+lw+svw;
 let s=RR(x+4,y+6,lw+svw+18+(lane?lnw+6:0),18,4,b.color)+T(x+10,y+18.5,HEAD_FS,'#ffffff',lbl,'start')
  +'<rect x="'+(x+16+lw)+'" y="'+(y+9)+'" width="'+svw+'" height="12" rx="3" fill="'+(b.warn?'#ffe066':'rgba(255,255,255,.88)')+'"/>'+T(x+16+lw+svw/2,y+17.8,CHIP_FS,b.warn?'#7a2a00':'#3b2a20',sv);
 if(lane)s+='<g role="img" aria-label="'+esc(lane.full)+'"><title>'+esc(lane.full)+'</title>'
  +RR(lx,y+9,lnw,12,3,'rgba(255,255,255,.16)',' stroke="#ffffff" stroke-width="1"')+T(lx+lnw/2,y+17.6,LANE_FS,'#ffffff',lane.chip)+'</g>';
 return s;
}
// Xếp khối thành hàng: khối lớn chiếm cả hàng; khối gọn rộng nửa hàng, khối gọn kế tiếp lấp nửa còn trống của hàng
// trước (kể cả khi có khối lớn xen giữa), để vài việc nhỏ không mỗi việc một hàng
function layoutRows(blocks){
 const rows=[];let half=null;
 blocks.forEach(b=>{
  if(!b.compact){rows.push({h:b.h,cells:[{b,x:LX,w:BR-LX}]});return}
  if(half){half.cells.push({b,x:LX+HALF_W+MID_GAP,w:HALF_W});half.h=Math.max(half.h,b.h);half=null;return}
  half={h:b.h,cells:[{b,x:LX,w:HALF_W}]};rows.push(half);
 });
 return rows;
}

function build(){
 const byId=Object.fromEntries(S.agents.map(a=>[a.id,a]));
 const now=Date.now();
 FUN.spots.clear(); // station() và cây nước ghi lại chỗ của từng nhân vật ở lần vẽ này
 // tính năng vừa chuyển sang "xong" ở lần làm mới này: pháo giấy 6 giây, người trong nhóm reo mừng (hoạt hình vui)
 S.features.forEach(f=>{const p=PREV_STATUS.get(f.dir);if(p&&p!=='done'&&f.status==='done'){PARTY.push({id:f.id,at:now});funCheer(f.members)}PREV_STATUS.set(f.dir,f.status)});
 PARTY=PARTY.filter(p=>now-p.at<6000);
 // tính năng đã xong hay đã giao rời văn phòng (chỉ còn trên bảng trắng); màu lấy từ FEAT_COLOR
 const blocks=S.features.filter(f=>f.status!=='done'&&f.status!=='delivered').map(f=>{
  const ms=f.members.filter(m=>m===f.master);
  const others=f.members.filter(m=>m!==f.master).sort((a,b)=>{const ra=(byId[a]||{}).role||'',rb=(byId[b]||{}).role||'';return ra===rb?a.localeCompare(b):(ra==='coder'?-1:rb==='coder'?1:ra.localeCompare(rb))});
  const rows=Math.max(1,Math.ceil(others.length/PER_ROW)),master=ms[0]||f.master||'';
  return{f,color:FEAT_COLOR.get(f.dir)||COLORS[0],master,others,rows,h:HEAD+rows*ROW_H+6,
   // chỗ Master luôn để dành (bàn người khác bắt đầu sau nó), nên chỉ đếm người khác: tối đa COMPACT_SEATS - 1
   title:f.id+' · '+f.title,status:stOf(f),warn:f.to==='owner',compact:others.length<COMPACT_SEATS};
 });
 const featBlocks=blocks.slice(),members=new Set(blocks.flatMap(b=>[b.master,...b.others]));
 // Master có .now mà không cầm tính năng nào đang mở vẫn là đang làm việc: ngồi ở một khối gọn riêng, không đứng ở cây nước.
 // Chỉ ghi "Làm trực tiếp" khi dòng .now nói vậy (làn trực tiếp: Master tự sửa 1-3 file, không có file trong workflow/).
 // Còn lại là "Phiên chat": chờ xác nhận làn, watch.sh dừng, tính năng đã giao chờ MR… không phải đang sửa việc nhỏ
 S.agents.filter(a=>a.role==='master'&&a.now&&!members.has(a.id)).forEach(a=>blocks.push({
  f:{dir:'',id:'',title:'',items:[],direct:true},color:DIRECT_COLOR,master:a.id,others:[],rows:1,h:HEAD+ROW_H+6,
  title:(/làn trực tiếp/i.test(a.now)?'Làm trực tiếp':'Phiên chat')+' · '+a.id,status:directNow(a.now),warn:a.nowWait,compact:true}));
 const busy=new Set(blocks.flatMap(b=>[b.master,...b.others]));
 // Cây nước chỉ vẽ COOLER_MAX người: ai đang chạy hay đang chờ được ưu tiên chỗ (sort ổn định, giữ thứ tự agents.txt trong nhóm)
 const freeRank=a=>{const k=stateOf(a,'').kind;return k==='wait'||k==='bad'?0:k==='run'?1:2};
 const free=S.agents.filter(a=>!busy.has(a.id)).sort((a,b)=>freeRank(a)-freeRank(b));
 const done=S.features.filter(f=>f.status==='done'),delivered=S.features.filter(f=>f.status==='delivered');
 // agent đổi khu (cây nước ↔ bàn) so với lần vẽ trước: ghi mốc để ẩn ở chỗ mới tới khi người đi bộ tới nơi
 if(MOTION_OK)S.agents.forEach(a=>{const q=PREV_PLACE.get(a.id),z=busy.has(a.id)?'desk':'cooler';if(q&&q.zone!==z)ARRIVE.set(a.id,now)});
 // vị trí các dãy bàn, các lối đi ngang (cho thú cưng) và góc nghỉ dưới cùng
 const rowsL=layoutRows(blocks),lanes=[q4(TOP-12)];let y=TOP;
 rowsL.forEach(r=>{r.y=y;lanes.push(q4(y+r.h+GAP/2));y+=r.h+GAP});
 if(!rowsL.length)lanes.push(q4(TOP+80));
 const laneL=lanes[lanes.length-1],laneB=laneL+60,H=laneB+14;
 const need=ownerWaits().total;
 const watch=(S.watch||{state:'never'}).state;
 // chỗ của từng agent ở lần vẽ này: để so với lần trước và cho đi bộ
 const place=new Map();
 // ---- tường, sàn, đồ trang trí: chỉ để nhìn, trình đọc màn hình bỏ qua (số liệu đã có ở huy hiệu và băng rôn)
 let s=defs()+'<g aria-hidden="true">'+wall()+R(0,FLOOR_Y,W,H-FLOOR_Y,'url(#fl)')+R(0,FLOOR_Y,W,5,'rgba(60,30,10,.12)');
 if(need)s+=P('M298 118 l50 0 l16 28 l-82 0z','rgba(255,214,140,.25)');
 s+=aisle(AX,FLOOR_Y,AW,H-FLOOR_Y)+bunting(64,290,11,4)+bunting(514,646,11,3);
 s+=bookshelf(10,28,48,84)+cooler(66)+pantry(102)+sconce(134,30)+windowPane(152,18,80,46)+clock(266,40,watch==='running')+door(DOOR_X,need>0)
  +P('M'+(HOLE_X-5)+' 117.5 l0 -4 q5 -7 10 0 l0 4z','#2b1d16')+whiteboard()+calendar(520,20)+poster(560,16)+sconce(604,30)+plantBig(616,FLOOR_Y);
 s+=lounge(laneB-4);
 if(NIGHT)s+=R(0,0,W,H,'rgba(20,30,70,.18)')+E(134,34,26,20,'url(#glow)')+E(604,34,26,20,'url(#glow)')+E(22,laneB-52,30,26,'url(#glow)');
 s+='</g>';
 if(need)s+=bubble(323,6,'!'+need,'bad');
 // ---- bảng trắng: các tính năng đang làm, rồi các tính năng đã giao, đã xong
 s+=T(NOTE_X,26,8.5,'#3b2a20','CÁC TÍNH NĂNG');
 const board=featBlocks.map(b=>({f:b.f,color:b.color})).concat(delivered.map(f=>({f,color:DELIVERED_COLOR})),done.slice().reverse().map(f=>({f,color:DONE_COLOR})));
 board.slice(0,4).forEach((b,i)=>{const y=31+i*16.5;
  s+=RR(371,y+1,6,6,1.5,b.color)+T(381,y+7.5,7.5,'#3b2a20',cut(b.f.id+' '+b.f.title,Math.floor(122/(CW*7.5))),'start')+T(381,y+15,7.2,b.f.to==='owner'?'#b23030':'#6b5c4e',stOf(b.f),'start')});
 if(board.length>4)s+=T(502,99,7,'#6b5c4e','+'+(board.length-4)+' nữa','end');
 if(!board.length)s+=T(NOTE_X,60,7.5,'#6b5c4e','(chưa có)');
 // pháo giấy: một nhãn chung trên sàn dưới bảng trắng (nền trắng, đọc được), nhiều tính năng xong cùng lúc không chồng chữ
 if(PARTY.length){const last=PARTY[PARTY.length-1];s+=confetti(NOTE_X,14,now-last.at)+bubble(NOTE_X,PARTY_Y,cut('🎉 '+PARTY.map(p=>p.id).join(', ')+' xong!',26),'run')}
 // ---- cây nước: agent rảnh đứng uống nước; biển tên so le COOLER_ROWS hàng để không đè nhau
 // .fig: hình và bong bóng, ẩn khi người đó đang ở lớp #fun (đi chơi); khung chọn và biển tên luôn ở lại
 free.slice(0,COOLER_MAX).forEach((a,k)=>{const cx=COOLER_X+k*COOLER_STEP,y=COOLER_Y,st=stateOf(a,''),key='cooler/'+a.id;
  place.set(a.id,{x:cx,y,zone:'cooler'});
  FUN.spots.set(key,{id:a.id,key,zone:'cooler',x:cx,y,pose:'stand',kind:st.kind,txt:st.txt,dir:'',role:a.role,color:'#8f9bb0'});
  s+=agG(a.id,st.label,selBox(cx-13,y-22,26,66)+'<g class="fig">'+standFront(cx,y,look(a.id),a.role,'#8f9bb0','cup').replace('class="sip"','class="sip" style="animation-delay:-'+(k*0.9)+'s"')
   +bubble(cx,y-18,st.txt,st.kind)+'</g>'+label(cx,y+40+(k%COOLER_ROWS)*(LBL_H+1),a.id,shortOf(a,st,false),st.kind,COOLER_ROWS*COOLER_STEP-2),key)});
 // ---- bàn của bạn, lối đi thảm đỏ chạy thẳng xuống
 {const cx=OWNER_X,L={hair:'#2d2d3a',skin:'#f5cfa6',style:'short',pants:'#3a3f5c'};
  let o=RR(cx-17,46,34,38,4,'#4a3b6b',K(1))+RR(cx-15,48,30,3,1.5,'#6a5a95');
  o+=standFront(cx,58,L,'boss','#2f6fe0','')+desk(cx-36,86,72,true)+laptopBack(cx,89)+cup(cx+20,80,true)+plantSmall(cx-25,92);
  o+=RR(cx-15,100,30,11,2,'#3b2a20',K(.6))+T(cx,108.5,8,'#f2c14e','BẠN')+bubble(cx,28,need?'!'+need:'z',need?'bad':'idle');
  s+='<g id="owner" tabindex="0" role="button" aria-label="'+esc(need?'Bàn của bạn: '+need+' việc chờ bạn':'Bàn của bạn: không có việc chờ')+'" style="cursor:pointer"><title>'+(need?need+' việc chờ bạn: bấm để xem':'Không có việc chờ bạn')+'</title>'+o+'</g>'}
 // ---- các dãy bàn: mỗi ô (bx, bw) là một khối, khối gọn rộng nửa hàng
 rowsL.forEach(row=>row.cells.forEach(({b,x:bx,w:bw})=>{
  const f=b.f,y=row.y,right=bx+bw;
  // .bh: bấm vào tiêu đề khối không tính là bấm sàn (không ném bóng cho chó)
  s+=rugBlock(bx,y,bw,b.h,b.color)+'<g class="bh">'+blockHead(b,bx,y,bw)+'</g>';
  const rowTop=r=>y+HEAD+r*ROW_H;
  // đồ giữa các bàn (cây, tủ hồ sơ, thùng rác) và cây ở cuối dãy; khối chỉ có Master thì đặt cây ở góc phải
  for(let r=0;r<b.rows;r++){const n=Math.min(PER_ROW,b.others.length-r*PER_ROW);
   for(let c=0;c<n;c++){const gx=bx+SEAT_DX+c*STEP+72+13;if(c===n-1&&gx>right-14)break;
    s+=gapDeco(c===n-1?0:hashN(f.dir+r+'/'+c)%4,c===n-1?Math.min(gx+12,right-18):gx,rowTop(r)+80)}}
  if(!b.others.length)s+=gapDeco(0,right-18,rowTop(0)+80);
  const seat=(id,x,w,top,isM)=>{
   if(!place.has(id))place.set(id,{x:x+w/2,y:top+48,zone:'desk'});
   s+=station(f,id,byId[id],x,w,top,isM,b.color);
  };
  if(b.master)seat(b.master,bx+8,100,rowTop(0),true);
  b.others.forEach((id,k)=>{const r=Math.floor(k/PER_ROW),c=k%PER_ROW;seat(id,bx+SEAT_DX+c*STEP,72,rowTop(r),false)});
 }));
 if(!blocks.length)s+=T((LX+BR)/2,TOP+44,9,'#3b2a20',done.length?'Không có tính năng nào đang làm':'Chưa có tính năng nào (workflow/F-*)');
 // ---- người đi bộ: agent vừa đổi chỗ (cây nước → bàn, bàn → cây nước). Vẽ ở lớp riêng #walk,
 // lần làm mới 3 giây (thay toàn bộ #office) không cắt ngang người đang đi
 const walkers=[];
 if(MOTION_OK)place.forEach((p,id)=>{const q=PREV_PLACE.get(id);if(!q||q.zone===p.zone)return;
  const a=byId[id];if(!a)return;
  // đang đi chơi (lớp #fun) thì được gọi vào bàn: đi từ chỗ đang đứng, không từ cây nước
  const from=funTakeBack(id)||q;
  walkers.push({x0:from.x,y0:from.y,x1:p.x,y1:p.y,svg:standFront(0,0,look(id),a.role,'#8f9bb0','')})});
 PREV_PLACE.clear();place.forEach((p,id)=>PREV_PLACE.set(id,p));
 ARRIVE.forEach((t,id)=>{if(now-t>WALK_MS+100)ARRIVE.delete(id)});
 // ---- watch.sh ngừng bất thường: tắt đèn. Lớp tối không nhận chuột để vẫn bấm được nhân vật bên dưới;
 // bong bóng đặt trên sàn trống dưới bảng trắng, không che cửa hay người ở cây nước
 if(watch==='dead'){const t='watch.sh ngừng bất thường',bw=t.length*8.5*CW+10;
  s+='<g pointer-events="none">'+R(0,0,W,H,'rgba(10,10,30,.38)')+'<g class="bub bob">'+RR(NOTE_X-bw/2,DEAD_Y,bw,16,4,'#ffe6e3',K(1.5))+T(NOTE_X,DEAD_Y+11.5,8.5,'#b23030',t)+'</g></g>'}
 const svg=$('#office');
 // thay cả SVG mỗi lần vẽ: nhớ ai đang được chọn bằng bàn phím (đúng chỗ ngồi) để trả lại tiêu điểm, kẻo Tab phải đi lại từ đầu trang
 const fe=document.activeElement,refocus=fe&&svg.contains(fe)?{owner:fe.id==='owner',key:fe.dataset.k,id:fe.dataset.id}:null;
 svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.innerHTML=s;
 // lớp người đi bộ, chó mèo nằm trên lớp tối của #office: tự làm tối theo, kẻo đèn tắt mà chúng vẫn sáng
 const wk=$('#walk');wk.setAttribute('viewBox','0 0 '+W+' '+H);wk.classList.toggle('dim',watch==='dead');
 const pets=$('#pets');pets.setAttribute('viewBox','0 0 '+W+' '+H);pets.classList.toggle('dim',watch==='dead');
 const fun=$('#fun');fun.setAttribute('viewBox','0 0 '+W+' '+H);fun.classList.toggle('dim',watch==='dead');
 funAfterBuild(laneB);
 walkers.forEach(w=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','walker');g.innerHTML=w.svg;wk.appendChild(g);
  const an=g.animate([{transform:'translate('+w.x0+'px,'+w.y0+'px)'},{transform:'translate('+w.x1+'px,'+w.y1+'px)'}],{duration:WALK_MS,easing:'ease-in-out',fill:'forwards'});
  an.onfinish=()=>g.remove();setTimeout(()=>g.remove(),WALK_MS+800)}); // dự phòng: tab chạy nền thì hoạt hình có thể dừng
 // ---- lối đi cho chó, mèo, chuột: dải sàn sát chân tường, lối giữa các dãy bàn, hai lối dọc hai bên, lối trước góc nghỉ.
 // Lớp #pets nằm trên cảnh nên con vật không được đi hay ngồi đè lên chỗ bấm được (che chữ, chặn cú bấm): lối sát chân tường
 // chỉ chạy từ sau cây nước (BASE_X0) tới trước lối đi thảm đỏ (BASE_END), một lối dọc nối nó xuống lối trên dãy bàn đầu;
 // lối dọc bên phải bắt đầu dưới biển "BẠN"
 const segs=[[BASE_X0,BASE_Y,BASE_END,BASE_Y],[BASE_X0,BASE_Y,BASE_X0,lanes[0]],[XL,lanes[0],XL,laneB],[XR,SPOT_Y,XR,laneL],[XL,laneB,632,laneB]].concat(lanes.map(v=>[XL,v,XR,v]));
 const sig=JSON.stringify(segs);if(sig!==GSIG){GSIG=sig;setGraph(makeGraph(segs),laneB)}
 // bấm hay Enter vào nhân vật: mở bảng chi tiết và đưa tiêu điểm vào đó (trình đọc màn hình đọc tên agent)
 svg.querySelectorAll('.ag').forEach(g=>{const go=()=>{openId=g.dataset.id;openKey=g.dataset.k;KEY_DETAIL='';build();showDetail();$('#detailTitle').focus({preventScroll:true})};g.addEventListener('click',go);g.addEventListener('keydown',onActivate(go))});
 const ow=svg.querySelector('#owner');
 ow.addEventListener('click',toNeed);ow.addEventListener('keydown',onActivate(toNeed));
 if(refocus){const n=refocus.owner?ow:findAg(svg,refocus.key,refocus.id);if(n)n.focus({preventScroll:true})}
 const lg=$('#legend');lg.replaceChildren();
 lg.append(el('span',null,'Màn hình chạy code, tay gõ phím = đang làm · gõ ngón tay = có việc chờ (số trên bong bóng) · giơ tay "?" = đang chờ Master trả lời · bọ đỏ trên bàn = có lỗi Tester báo · Master đứng dậy quay lại giơ giấy "!" = chờ bạn · gật gù "z" = không có việc ở dãy này · bóng mờ "?" = ID chưa khai trong agents.txt'),
  el('span',null,'Dãy bàn nhỏ (Master và 1-2 người) chỉ rộng nửa hàng · khối xám = Master đang làm trong phiên chat, không cầm tính năng nào đang mở: "Làm trực tiếp" là tự sửa việc nhỏ, không có file trong workflow/; "Phiên chat" là việc khác (chọn làn, chờ MR…)'),
  el('span',null,'Cửa mở = có việc chờ bạn · đồng hồ đứng = watch.sh không chạy · đèn tắt = watch.sh ngừng bất thường · bấm (hoặc chạm) vào ai để mở chi tiết · bấm bàn "BẠN" để tới mục Cần bạn · bấm vào chó, mèo, chuột để vuốt ve (tắt hoạt hình vui thì chỉ nghe chúng kêu) · bấm sàn trống để ném bóng cho chó'),
  el('span',null,'Hoạt hình vui (nút bên dưới, chỉ để vui, không phải trạng thái): ai rảnh ở cây nước thỉnh thoảng đi pha cà phê (máy bốc khói), đọc sách, ngắm cửa sổ, ngồi sofa rồi quay về; ai rảnh ở bàn vươn vai; bong bóng tán gẫu, máy bay giấy; tính năng xong thì cả nhóm reo mừng; chó ghé cây nước xin xoa đầu, mèo nằm sofa hay trèo lên bàn người đang chờ. Người đi vắng vẫn bấm được ở chỗ cũ (biển tên còn đó), bấm hay Tab tới là về ngay; chó mèo đang ngồi cạnh ai, trên bàn ai thì bấm vào đó vẫn mở chi tiết người đó'),
  el('span',null,'Quản đốc cầm roi = có việc mà chưa ai làm (chưa được đánh thức): thỉnh thoảng quản đốc vào từ cửa, quất roi vào không khí cạnh người đó (với Master thì thổi còi) rồi đi tiếp. Tắt hoạt hình vui hay máy giảm chuyển động: chỉ có cái roi nhỏ cạnh bong bóng số'));
 if(free.length>COOLER_MAX)lg.append(el('span',null,'Ở cây nước, không hiện hết: '+free.slice(COOLER_MAX).map(a=>{const st=stateOf(a,'');return a.id+(st.kind==='idle'?'':' ('+st.label+')')}).join(', ')));
}

/* ---------- chó, mèo, chuột chạy khắp văn phòng ---------- */
// Lối đi là lưới điểm cách nhau 4 đơn vị dọc các đoạn thẳng; con vật đi theo đường ngắn nhất (BFS) giữa hai điểm.
// Chó đi dạo, thỉnh thoảng ra ngồi cạnh bàn bạn hay về ổ ngủ. Chuột chui ra từ lỗ chân tường chạy một vòng rồi về,
// mèo rượt theo; chuột về lỗ thì mèo ngồi canh. Chó đi sát mèo thì mèo giật mình nhảy lên rồi bỏ chạy.
// Lớp #pets riêng, không bị thay khi trang làm mới 3 giây.
const XL=16,XR=OWNER_X,BASE_Y=124,q4=v=>Math.round(v/4)*4;
// BASE_END: lối sát tường dừng ở đây (trước bàn của bạn); SPOT_Y: chó ngồi trên thảm đỏ ngay dưới bàn, không che biển "BẠN"
const BASE_END=q4(AX-32),SPOT_Y=q4(FLOOR_Y+42);
// BASE_X0: lối sát tường bắt đầu sau mép phải biển tên cuối ở cây nước (COOLER_RIGHT) thêm nửa bề ngang con vật,
// để con vật không đè lên chân người đứng uống nước và hàng biển tên đầu (y 120-140)
const PET_HALF_W=16,COOLER_RIGHT=COOLER_X+(COOLER_MAX-1)*COOLER_STEP+(COOLER_ROWS*COOLER_STEP-2)/2,BASE_X0=q4(COOLER_RIGHT+PET_HALF_W);
let G=null,GSIG='',HOLE='',GUARD='',BED='',SPOT='';const CRIT={};
function makeGraph(segs){const g=new Map();
 segs.forEach(([x0,y0,x1,y1])=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))/4,sx=Math.sign(x1-x0)*4,sy=Math.sign(y1-y0)*4;let prev=null;
  for(let i=0;i<=n;i++){const x=x0+sx*i,y=y0+sy*i,id=x+','+y;if(!g.has(id))g.set(id,{x,y,nb:[]});
   if(prev&&!g.get(id).nb.includes(prev)){g.get(id).nb.push(prev);g.get(prev).nb.push(id)}prev=id}});
 return g}
const nodeAt=(x,y)=>{let b=null,d=1e9;G.forEach((n,id)=>{const e=Math.abs(n.x-x)+Math.abs(n.y-y);if(e<d){d=e;b=id}});return b};
function route(from,to){if(from===to||!G.has(to))return[];const prev=new Map([[from,null]]),q=[from];
 for(let i=0;i<q.length;i++){const c=q[i];if(c===to)break;for(const n of G.get(c).nb)if(!prev.has(n)){prev.set(n,c);q.push(n)}}
 if(!prev.has(to))return[];const out=[];for(let c=to;c!==from;c=prev.get(c))out.push(c);return out.reverse()}
const randNode=()=>{const ks=[...G.keys()];return ks[Math.floor(Math.random()*ks.length)]};
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const goTo=(a,id)=>{a.path=route(nodeAt(a.x,a.y),id)};
// Chỗ xa con vật a nhất trong vài điểm bốc ngẫu nhiên (để mèo chạy trốn)
const farNode=a=>{let b=randNode();for(let i=0;i<6;i++){const k=randNode();if(dist(G.get(k),a)>dist(G.get(b),a))b=k}return b};
function setGraph(g,laneB){
 G=g;HOLE=HOLE_X+','+BASE_Y;GUARD=(HOLE_X+16)+','+BASE_Y;BED=BED_X+','+laneB;SPOT=XR+','+SPOT_Y;
 const at=id=>G.get(id);
 if(!CRIT.dog){
  const c=at(randNode());
  CRIT.dog={x:at(BED).x,y:at(BED).y,dir:1,path:[],mode:'sleep',pose:'sleep',wait:120,spd:1.5,odo:0,say:'',sayT:0,jump:0};
  CRIT.cat={x:c.x,y:c.y,dir:-1,path:[],mode:'roam',pose:'sit',wait:40,spd:1.3,odo:0,say:'',sayT:0,jump:0,re:0};
  CRIT.mouse={x:at(HOLE).x,y:at(HOLE).y,dir:-1,path:[],mode:'hide',pose:'walk',wait:90,spd:2.6,odo:0,say:'',sayT:0,jump:0,hidden:true,trips:0};
  Object.entries(CRIT).forEach(([n,a])=>petInit(n,a));
  return}
 // bố cục đổi (thêm, bớt dãy bàn): đặt từng con vào điểm gần nhất trên lối đi mới, đang ngủ thì ngủ tiếp. Con đang ngồi
 // cạnh người ở cây nước, trên bàn, trên sofa thì giữ chỗ: petRelayout() cho nó đi theo chỗ đó
 Object.values(CRIT).forEach(a=>{if(petKeepsPlace(a))return;const n=at(nodeAt(a.x,a.y));a.x=n.x;a.y=n.y;a.path=[];if(a.mode!=='sleep'&&a.mode!=='nap'&&a.mode!=='hide')a.mode='roam';a.wait=10});
 if(CRIT.dog.mode==='sleep'){const n=at(BED);CRIT.dog.x=n.x;CRIT.dog.y=n.y}
 if(CRIT.mouse.hidden){const n=at(HOLE);CRIT.mouse.x=n.x;CRIT.mouse.y=n.y}
 petRelayout();
}
// Đi theo đường đã tính; k: số nhịp 50ms đã trôi qua. Trả về true khi tới nơi
function move(a,k){let left=a.spd*k*(a.boost?1.6:1);const sx=a.x,sy=a.y;
 while(left>1e-6&&a.path.length){const n=G.get(a.path[0]);if(!n){a.path=[];break}
  const dx=n.x-a.x,dy=n.y-a.y;
  if(dx){a.dir=Math.sign(dx);if(Math.abs(dx)<=left){left-=Math.abs(dx);a.x=n.x}else{a.x+=a.dir*left;left=0}}
  else if(dy){if(Math.abs(dy)<=left){left-=Math.abs(dy);a.y=n.y}else{a.y+=Math.sign(dy)*left;left=0}}
  if(a.x===n.x&&a.y===n.y)a.path.shift()}
 a.odo+=Math.abs(a.x-sx)+Math.abs(a.y-sy);return !a.path.length}
const say=(a,t,n)=>{a.say=t;a.sayT=n||14};
function think(k){
 const d=CRIT.dog,c=CRIT.cat,m=CRIT.mouse;
 [d,c,m].forEach(a=>{if(a.sayT>0)a.sayT-=k;if(a.jump>0)a.jump-=k});
 // con đang được vuốt ve (a.pet) đứng yên, giữ nguyên đường đang đi: vuốt xong đi tiếp
 // chuột: trốn trong lỗ, chui ra chạy một hai vòng rồi về
 if(m.pet>0){}
 else if(m.mode==='hide'){if((m.wait-=k)<=0){m.hidden=false;m.mode='out';m.trips=1+Math.floor(Math.random()*2);goTo(m,randNode())}}
 else if(move(m,k)){
  if(m.mode==='home'){m.mode='hide';m.hidden=true;m.wait=160+Math.random()*260;if(c.mode==='chase'){c.mode='guard';c.wait=90+Math.random()*90;goTo(c,GUARD)}}
  else if(m.trips-->0)goTo(m,randNode());else{m.mode='home';goTo(m,HOLE)}}
 m.boost=!m.hidden&&c.mode==='chase'&&dist(m,c)<16;
 if(m.boost&&m.sayT<=0)say(m,'Chít!',12);
 // mèo: thấy chuột thì rượt (đang ngủ thì thỉnh thoảng mới tỉnh); đang được vuốt ve, đang trèo lên bàn hay sofa thì kệ chuột
 if(!m.hidden&&c.pet<=0&&c.mode!=='chase'&&c.mode!=='flee'&&c.mode!=='perch'&&(c.mode!=='nap'||Math.random()<.008*k)){c.mode='chase';c.re=0;say(c,'Meo!')}
 if(c.pet>0){}
 else if(c.mode==='perch')catPerch(c,k);
 // chuột đang được vuốt ve: mèo dừng lại cách một quãng, không đè lên nó
 else if(c.mode==='chase'){c.spd=2.1;if((c.re-=k)<=0){c.re=6;goTo(c,nodeAt(m.x,m.y))}if(m.pet<=0||dist(c,m)>PET_CHASE_HOLD)move(c,k)}
 else if(c.mode==='guard'){c.spd=1.5;if(move(c,k)){c.dir=HOLE_X<c.x?-1:1;if((c.wait-=k)<=0){c.mode='roam';c.wait=10}}}
 else if(c.mode==='flee'){c.spd=3;if(move(c,k)){c.mode='roam';c.wait=30}}
 else if(c.mode==='nap'){if((c.wait-=k)<=0){c.mode='roam';c.wait=0}}
 else{c.spd=1.3;if(c.path.length)move(c,k);else if((c.wait-=k)<=0){if(Math.random()<.3){c.mode='nap';c.wait=220+Math.random()*260}else{goTo(c,randNode());c.wait=25+Math.random()*90}}}
 c.pose=critPose(c);
 // chó: đi dạo, ra ngồi cạnh bàn bạn, hay về ổ ngủ; nhặt bóng, ghé cây nước thì dogPlay lo
 d.spd=d.mode==='fetch'||d.mode==='bring'?FETCH_DOG_SPD:DOG_SPD;
 if(d.pet>0){}
 else if(dogPlay(d,k)){}
 else if(d.mode==='sleep'){if((d.wait-=k)<=0){d.mode='roam';d.wait=0}}
 else if(d.mode==='bed'){if(move(d,k)){d.mode='sleep';d.wait=260+Math.random()*320}}
 else if(d.path.length)move(d,k);
 else if((d.wait-=k)<=0){const r=Math.random();
  if(r<.15){d.mode='bed';goTo(d,BED)}else if(r<.3){goTo(d,SPOT);d.wait=60+Math.random()*80}else{goTo(d,randNode());d.wait=20+Math.random()*70}}
 d.pose=critPose(d);
 // chó đi sát mèo: mèo giật mình nhảy lên rồi chạy đi; chó thấy chuột thì sủa (đang ngậm bóng thì không sủa được)
 if(d.pose==='walk'&&c.mode!=='flee'&&c.mode!=='perch'&&c.pet<=0&&c.jump<=0&&dist(d,c)<14){c.jump=12;say(c,'!',12);if(!d.carry)say(d,'Gâu!');c.mode='flee';goTo(c,farNode(c))}
 if(!m.hidden&&d.pose!=='sleep'&&!d.carry&&d.sayT<=0&&dist(d,m)<18)say(d,'Gâu!');
}
// Dáng: ngủ (cả lúc mèo cuộn tròn trên bàn, sofa), được vuốt (ngồi, chó vui quá thì lăn ngửa), đi hay ngồi
function critPose(a){
 if(a.mode==='nap'||a.mode==='sleep'||a.perch&&a.perch.phase==='sit'&&a.perch.nap&&a.perch.t>=CAT_NAP_AFTER)return 'sleep';
 if(a.pet>0)return a.roll?'roll':'sit';
 return a.path.length||a.free.length?'walk':'sit'}
// Nhấc lên khỏi chân: nhảy giật mình (jump) và nhảy lên sofa, ghế lười (hopLift)
const critLift=a=>(a.jump>0?-Math.sin(Math.max(0,Math.min(1,(12-a.jump)/12))*Math.PI)*9:0)-(a.hopLift||0);
/* hình con vật: gốc toạ độ ở giữa chân, mặt quay sang phải */
// carry: ngậm bóng (ném bóng cho chó); roll: lăn ra ngửa bụng, bốn chân chổng lên (được vuốt ve nhiều)
function dogArt(pose,fr,wag,carry){const c='#c98d52',d='#8a5a30',l='#f3dcb8';
 const head=(x,y)=>C(x,y,5,c,K(.9))+E(x+4,y+1.5,3.2,2.3,l,K(.6))+C(x+6.8,y+.7,1,OL)+C(x+1.2,y-1.4,.9,OL)+P('M'+(x-3)+' '+(y-4)+' q-3.5 2 -2 8 q2.5 -1 3 -6z',d,K(.6));
 const ball=(x,y)=>carry?'<g transform="translate('+x+','+y+')">'+ballArt()+'</g>':'';
 if(pose==='roll')return LN('M-9 -4 q-5 '+(wag?-5:0)+' -8 '+(wag?-7:-2),c,2.4)
  +[-7.5,-3.5,1,5].map((x,i)=>RR(x,-16+(i%3?-1:0),3,8,1.4,c,K(.6))+E(x+1.5,-15.6+(i%3?-1:0),1.9,1.3,l,K(.4))).join('')
  +E(0,-5,10,5,c,K(.9))+E(-.6,-7.4,6.6,2.4,l)+RR(5.4,-8.4,2.2,5.4,1,'#d64545')
  +C(10.4,-4.6,4.8,c,K(.9))+P('M7.4 -1.6 q-1.6 4 1.6 5.4 q1 -2.4 .8 -4.6z',d,K(.6))+E(13.4,-3.2,2.6,1.8,l,K(.6))+C(15.4,-3.6,.9,OL)
  +LN('M8.4 -6.8 q1 -1.2 2 0 M11.6 -7 q1 -1.2 2 0',OL,.7)+E(12.8,-.8,1.1,1.6,'#f08a9a',K(.4));
 if(pose==='sleep')return LN('M-10 -3 q-4 3 1 4',c,2.4)+E(0,-4.6,11,4.8,c,K(.9))+E(-2,-2.6,6,1.6,l)+C(8,-4.6,4.6,c,K(.9))+P('M5.5 -8 q-3 1 -2 6 q2 -1 3 -4z',d,K(.6))
  +E(11.4,-3.3,2.6,1.9,l,K(.6))+C(13.7,-3.7,.9,OL)+LN('M7.6 -5.4 q1 .9 2 0',OL,.7)+T(6,-13,7,'#8a7a6a','z','middle').replace('<text','<text class="zzz"');
 if(pose==='sit')return LN('M-6 -2 q-5 '+(wag?-3:1)+' -8 '+(wag?-6:-3),c,2.4)+E(-2,-3,6,3,c,K(.8))+E(0,-9,6,7,c,K(.9))+E(2,-8,3,4,l)
  +RR(2,-6,3,6,1.4,c,K(.6))+RR(5,-6,3,6,1.4,c,K(.6))+head(4,-17)+RR(1,-12.5,6,2,1,'#d64545')+C(4,-10.2,1,'#f2c14e')+ball(10,-10.4);
 const o=fr?1.6:-1.6;
 return LN('M-9 -9 q-5 '+(wag?-4:-2)+' -4 -9',c,2.4)+RR(-8-o,-6,3,6,1.4,d,K(.6))+RR(4+o,-6,3,6,1.4,d,K(.6))
  +E(0,-9,10,5,c,K(.9))+E(1,-6.6,7,1.8,l)+RR(-6+o,-6,3,6,1.4,c,K(.6))+RR(6-o,-6,3,6,1.4,c,K(.6))+head(10,-14)+RR(6,-10.6,5,2,1,'#d64545')+C(8.5,-8.4,1,'#f2c14e')+ball(16,-7.4)}
// happy: được vuốt ve, mắt nhắm tít
function catArt(pose,fr,jump,happy){const c='#8d96a8',d='#5d6576',w='#eef1f6';
 const eye=(x,y)=>happy?LN('M'+(x+.6)+' '+(y-.2)+' q1 -1.3 2 0',OL,.7):C(x+1.6,y-.6,jump?1.2:.9,jump?'#ffffff':'#2b2b2b',jump?K(.5):'');
 const head=(x,y)=>P('M'+(x-3)+' '+(y-2.5)+' l.6 -5 l3.2 3z',c,K(.6))+P('M'+(x+1.6)+' '+(y-3.6)+' l2.4 -3.8 l1 4.6z',c,K(.6))+C(x,y,4.3,c,K(.8))
  +E(x+2.8,y+1.2,1.9,1.3,w)+eye(x,y)+C(x+4.3,y+.6,.6,'#f3a3a3')+LN('M'+(x+3)+' '+(y+1.2)+' l3.2 -.6 M'+(x+3)+' '+(y+1.8)+' l3.2 .7',d,.4);
 if(pose==='sleep')return LN('M-7 -1.5 q2 3 10 2',d,1.8)+E(0,-3.6,7.5,3.6,c,K(.8))+LN('M-3 -6.6 l.8 2 M0 -7 l.4 2 M3 -6.8 l0 2',d,.7)+C(5,-4,3.3,c,K(.7))
  +P('M3 -6 l.6 -3 l2 2z',c,K(.5))+P('M6 -6.6 l1.8 -2.4 l.6 3z',c,K(.5))+LN('M5 -4 q.8 .7 1.6 0',OL,.6)+'<text class="zzz" x="2" y="-11" font-size="6" fill="#8a7a6a" text-anchor="middle">z</text>';
 if(pose==='sit')return LN('M-3 -1 q-7 0 -5 -7',c,2)+E(0,-6,5,6,c,K(.8))+E(2,-5,2.4,4,w)+RR(1,-4,2.2,4,1,c,K(.5))+RR(3.6,-4,2.2,4,1,c,K(.5))+head(2,-13.5);
 const o=fr?1.2:-1.2;
 return LN('M-7 -7 q-6 -1 -6 '+(fr?-9:-8),c,2)+RR(-6-o,-4,2,4,1,d)+RR(4+o,-4,2,4,1,d)+E(0,-6.5,8,3.6,c,K(.8))
  +LN('M-3 -9.6 l1 2.4 M0 -10 l.5 2.4 M3 -9.8 l0 2.3',d,.8)+RR(-5+o,-4,2,4,1,c,K(.5))+RR(5-o,-4,2,4,1,c,K(.5))+head(8,-10)}
// blush: được vuốt ve, má ửng hồng, mắt nhắm
function mouseArt(fr,blush){const c='#a5978a';
 return LN('M-4 -2 q-4 -2.4 -7 0',' #d8b4a8',.8)+C(-2+(fr?1:0),-.4,.8,c)+C(2-(fr?1:0),-.4,.8,c)+E(0,-2.6,4.2,2.6,c,K(.6))+C(2.4,-4.6,1.6,blush?'#ff8fa8':'#f3b3b3',K(.4))
  +E(4.2,-2.4,1.9,1.6,c)+C(6.1,-2.6,.55,'#f3a3a3')+(blush?E(4,-1.3,1.5,.8,'#ff5f86',' opacity=".85"')+LN('M3.7 -3.1 q.6 -.7 1.2 0',OL,.5):C(4.4,-3,.45,OL))}
const critSayW=t=>t.length*4.4+8;
function critSay(y,t){const w=critSayW(t);return RR(-w/2,y,w,11,3,'#ffffff',K(.9))+P('M-2 '+(y+10.4)+' l2 3 l2 -3z','#ffffff')+T(0,y+8,7,'#3b2a20',t)}
function drawCrit(){
 const svg=$('#pets');if(!svg||!CRIT.dog)return;
 const t=performance.now();
 ['dog','cat','mouse'].forEach(n=>{const a=CRIT[n];let g=svg.querySelector('[data-c="'+n+'"]');
  if(!g){g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('data-c',n);g.setAttribute('class','crit');svg.appendChild(g);g.addEventListener('pointerdown',()=>poke(n))}
  // đang được vuốt ve: chó vẫy đuôi nhanh hơn, mèo nhắm mắt, chuột đỏ má
  const hide=n==='mouse'&&a.hidden,fr=Math.floor(a.odo/5)%2,wag=(a.pose==='sit'||a.pose==='roll')&&n==='dog'?Math.floor(t/(a.pet>0?PET_WAG_MS:180))%2:0;
  const happy=a.pet>0,talk=a.sayT>0?a.say:'',key=[a.pose,fr,a.dir,talk,a.jump>0,hide,wag,happy,a.carry,!!a.hand].join('|');
  g.setAttribute('transform','translate('+a.x.toFixed(1)+','+(a.y+critLift(a)).toFixed(1)+')');
  g.classList.toggle('nohit',!!a.nohit);
  if(g._k===key)return;g._k=key;
  if(hide){g.innerHTML='';return}
  const art=n==='dog'?dogArt(a.pose,fr,wag,a.carry):n==='cat'?catArt(a.pose,fr,a.jump>0,happy):mouseArt(fr,happy);
  // đang có tay vuốt: bong bóng nằm trên tay (petSayTop). Bong bóng không nhận chuột: không che cú bấm vào biển tên, bàn BẠN
  const top=Math.min(n==='dog'?(a.pose==='sit'?-36:a.pose==='sleep'?-24:a.pose==='roll'?-28:-32):n==='cat'?(a.pose==='sit'?-32:-27):-20,petSayTop(a));
  g.innerHTML=R(-12,n==='mouse'?-8:-20,24,n==='mouse'?9:21,'transparent')+'<g transform="scale('+a.dir+',1)">'+art+'</g>'+(talk?'<g pointer-events="none">'+critSay(top,talk)+'</g>':'');
 })}
// Bấm vào con vật: đang ngủ thì tỉnh dậy; hoạt hình vui bật thì được vuốt ve (petStart: kêu, tay, tim), tắt thì chỉ kêu như cũ
function poke(n){const a=CRIT[n];if(!a||(n==='mouse'&&a.hidden))return;
 if(n==='dog'&&a.mode==='sleep'){a.mode='roam';a.wait=12}
 if(n==='cat'&&a.mode==='nap'){a.mode='roam';a.wait=12}
 if(FUN.on)petStart(n,a);else say(a,PET_PLAIN[n],16);
 drawCrit()}
let lastT=0;
function critLoop(t){requestAnimationFrame(critLoop);
 if(!G||!CRIT.dog){lastT=t;return}
 const k=lastT?Math.min(3,(t-lastT)/50):1;lastT=t;
 if(MOTION_OK)think(k);else[CRIT.dog,CRIT.cat,CRIT.mouse].forEach(a=>{if(a.sayT>0)a.sayT-=k});
 petFrame(k);
 drawCrit()}
requestAnimationFrame(critLoop);

/* ---------- Hoạt hình vui: lớp #fun, vòng lặp chung, điểm đến (POI). Chỉ để vui, không phải trạng thái ----------
 Chạy hoàn toàn trong trình duyệt, không đọc hay ghi gì thêm. Vẽ trên lớp #fun (aria-hidden, không nhận chuột) nằm giữa
 #walk và #pets: lần làm mới 3 giây (thay cả #office) không cắt ngang, chó mèo vẫn ở trên cùng và bấm được.
 Một vòng requestAnimationFrame với đồng hồ riêng FUN.clock: tab ẩn hay nút "Hoạt hình vui" tắt thì đồng hồ đứng, mọi thứ dừng.
 API cho các phần sau:
  funMotion()                 được chuyển động: đang bật và máy không đặt giảm chuyển động (không thì chỉ hiện bong bóng thoại)
  FUN.spots                   chỗ của từng nhân vật ở lần vẽ gần nhất, key giống data-k ("<dãy>/<ID>", "direct/<ID>", "cooler/<ID>"):
                              {id,key,zone:'desk'|'cooler',x,y (đỉnh đầu người đứng),pose (type|wait|idle|hand|stand|ghost),kind,
                              txt (chữ trên bong bóng trạng thái: số việc chờ, "…", "z", "!", "?"),run (chỉ ở bàn: agent đang
                              chạy, có khi ở tính năng khác),dir,role,color}
  FUN_POI, funSeatY(def)      điểm đến lấy theo đồ đã vẽ: {zone:'top'|'lounge',seats:[x…],pose:'front'|'back'|'sit',hold,say:[…],carry}
  funEvery(ms,fn)             việc định kỳ; funLater(ms,fn): hẹn một lần. Cả hai theo FUN.clock
  funSay(x,y,text,ms)         bong bóng thoại, (x,y): tâm và mép trên; trả về bong bóng (funUnsay(b) để gỡ sớm),
                              chồng lên bong bóng đang hiện thì bỏ qua và trả về false
  funDialog(whereA,whereB,[câu,đáp])  hai người nói lần lượt; where(): {x,y} của bong bóng lúc nói, null nếu người đó đã đi
  funBorrow(spot,kind)        mượn nhân vật ở chỗ spot (chưa ai mượn: !FUN.hide.has(spot.key); muốn có chuyển động thì kiểm
                              funMotion() trước): ẩn hình ở #office (khung bấm, biển tên giữ nguyên), trả về actor
                              {id,x,y,pose:'front'|'back'|'sit'|'seat',hold,carry,lift,t,tick(actor)}; tick chạy mỗi khung (nhảy, vươn vai)
  funWalk(actor,{x,y},done)   đi trên sàn trống: dải chân tường (y = FUN_TOP_Y), lối dọc mép trái, dải trước góc nghỉ
                              (y = FUN.loungeY); điểm ngoài ba dải đó thì đi thẳng như người đi bộ đổi chỗ. Đường dài thì đi
                              nhanh hơn FUN_SPEED cho tới nơi trong FUN_WALK_MAX_MS (đặt actor.speed). Tới nơi gọi done().
                              Giảm chuyển động thì tới thẳng nơi; nhảy, vươn vai (tick) thì phần gọi tự kiểm funMotion()
  funRelease(actor)           xoá actor khỏi #fun, hiện lại hình ở #office (kèm bong bóng a.bubble nếu có)
  funStep(obj,dt)             cho đối tượng tự quản (không mượn ai, như quản đốc) đi theo obj.path; obj.speed: tốc độ riêng
                              (mặc định FUN_SPEED); chỉ vẽ bằng funDraw khi obj nằm trong FUN.actors
  funAddon({frame,build,clear})  phần thêm tự lo vòng đời: frame(dt) mỗi khung khi đồng hồ chạy, build() sau mỗi lần vẽ
                              #office (FUN.spots đã đủ), clear() khi tắt nút (lớp #fun bị xoá sạch ngay sau đó) */
const SVGNS='http://www.w3.org/2000/svg';
const FUN_PREF_KEY='monitor.funAnim';
const FUN_DT_MAX_MS=100; // một khung tiến tối đa ngần này: tab vừa hiện lại thì không nhảy cóc
// Sàn trống cho người (cao 38): dải chân tường (đỉnh đầu như người ở cây nước, chân ngay trên hàng biển tên đầu), lối dọc
// bên trái thảm các dãy bàn (LX), dải trước đồ góc nghỉ. Lối giữa các dãy bàn chỉ đủ cho chó mèo: người đi ở đó che biển tên
const FUN_TOP_Y=COOLER_Y,FUN_AISLE_X=12,FUN_LOUNGE_DY=40;
const FUN_SPEED=.06; // đơn vị cảnh mỗi ms: đi dạo, chậm hơn người được gọi vào bàn
// Một chặng đi chơi tối đa ngần này: đi đủ tốc độ dạo xuống góc nghỉ của văn phòng nhiều dãy bàn mất gần nửa phút mỗi chiều,
// phần lớn ở lối dọc ngoài màn hình, cây nước vắng hẳn (hết người tán gẫu)
const FUN_WALK_MAX_MS=9000;
const FUN_MAX_AWAY=2; // tối đa ngần này người đi chơi cùng lúc, cây nước không vắng hẳn
const FUN_TRIP_EVERY_MS=4000,FUN_TRIP_CHANCE=.35,FUN_STAY_MS=6000,FUN_STAY_VAR_MS=7000;
const FUN_CHAT_EVERY_MS=6500,FUN_CHAT_CHANCE=.5,FUN_SAY_MS=2300,FUN_REPLY_GAP_MS=250,FUN_NEAR=50;
const FUN_STRETCH_EVERY_MS=5000,FUN_STRETCH_CHANCE=.3,FUN_STRETCH_MS=2600,FUN_STRETCH_RISE=4,FUN_YAWN_CHANCE=.3;
const FUN_CHEER_WAIT_MS=250,FUN_CHEER_MS=2600,FUN_CHEER_HOP_MS=420,FUN_CHEER_HOP=6;
// Chỗ bong bóng: ở dải chân tường cao hơn bong bóng "z" của người ở cây nước; ở bàn đè lên màn hình (dưới bong bóng
// trạng thái, trên đầu người ngồi); ở góc nghỉ ngay trên đầu
const FUN_TOP_TALK_DY=36,FUN_DESK_TALK_DY=24,FUN_HEAD_TALK_DY=18,FUN_BUBBLE_H=13,FUN_BUBBLE_TAIL=4;
// Người ngồi ở bàn: đỉnh đầu và ghế so với y của chỗ (người đứng), đúng như station() vẽ
const FUN_SEAT_DY=8,FUN_CHAIR_DY=21;
const FUN_WINDOW_R=232; // mép phải cửa sổ: người ở cây nước đứng trước cửa sổ thì quay lưng ngắm trời ngay tại chỗ
const FUN_SIT_POSES=['type','wait','idle','hand'];
// x là tâm người. cooler: người ở cây nước đã ở đây rồi, để dành cho phần sau (người từ bàn ra uống nước)
const FUN_POI={
 cooler:{zone:'top',seats:[79],pose:'front',hold:'cup',say:['💧'],noTrip:true},
 bookshelf:{zone:'top',seats:[34],pose:'front',hold:'book',say:['📖 Hay ghê','📖'],carry:'book'},
 coffee:{zone:'top',seats:[114],pose:'back',hold:'',say:['☕ Cà phê nào','☕'],carry:'cup'},
 window:{zone:'top',seats:[],here:true,pose:'back',hold:'',say:[NIGHT?'🌙 Khuya rồi':'☀️ Đẹp trời ghê','☁️']},
 whiteboard:{zone:'top',seats:[520],pose:'back',hold:'',say:['📋']},
 plant:{zone:'top',seats:[598],pose:'back',hold:'',say:['🌱','🌱 Lớn nhanh nhé']},
 sofa:{zone:'lounge',seats:[76,120],pose:'sit',hold:'',say:['😌 Nghỉ tí','🛋️']},
 beanbag:{zone:'lounge',seats:[290],pose:'sit',hold:'',say:['😴']},
 vending:{zone:'lounge',seats:[558],pose:'back',hold:'',say:['🥤','🥤 Hết nước ngọt?'],carry:'cup'},
};
const FUN_SMALL_TALK=[['Trưa nay ăn gì?','Bún chả nhé!'],['Cà phê không?','Đi luôn ☕'],['Bug này lạ ghê','Tắt bật lại chưa?'],
 ['Mai deploy à?','Thứ Sáu thì thôi 😅'],['Rảnh quá 😎','Sướng thế!'],['Ai lấy cốc tôi?','Con mèo đấy 🐱'],['Mưa to ghê','Ở lại code tiếp']];
const FUN_DESK_TALK=[['Test xanh chưa?','Đợi tí'],['Test xanh chưa?','Xanh rồi ✓'],['Có bug nào không?','Một con 🐞'],['Có bug nào không?','Sạch bong ✨'],['Xem giúp nhé?','Ok, để tôi']];
// Bong bóng reo mừng: ở cây nước chỉ một biểu tượng (người đứng cách nhau 28, chữ dài sẽ chồng lên nhau)
const FUN_CHEER_DESK=['🎉 Yeah!','Xong rồi! 🎉','Tuyệt! 🙌'],FUN_CHEER_COOLER=['🎉','🙌','🥳'];
const FUN={on:true,clock:0,loungeY:0,spots:new Map(),hide:new Set(),actors:new Set(),timers:[],jobs:[],says:[],addons:[]};
const funMotion=()=>FUN.on&&MOTION_OK;
const funPick=arr=>arr[Math.floor(Math.random()*arr.length)];
const funSeatY=def=>def.zone==='lounge'?FUN.loungeY:FUN_TOP_Y;
function funEvery(ms,fn){FUN.jobs.push({ms,fn,next:FUN.clock+ms})}
function funLater(ms,fn){FUN.timers.push({at:FUN.clock+ms,fn})}
function funAddon(o){FUN.addons.push(o)}
const funMarkAway=(key,on)=>{const n=findAg($('#office'),key,null);if(n)n.classList.toggle('away',on)};
const funFocusId=()=>{const fe=document.activeElement;return fe&&fe.classList&&fe.classList.contains('ag')?fe.getAttribute('data-id'):null};

function funSay(x,y,text,ms){
 if(!FUN.on)return false;
 const w=bubbleW(text),bx=Math.max(2,Math.min(W-2-w,x-w/2)),tx=Math.max(bx+5,Math.min(bx+w-5,x));
 const box={x:bx,y,w,h:FUN_BUBBLE_H+FUN_BUBBLE_TAIL};
 if(FUN.says.some(b=>b.x<box.x+box.w&&box.x<b.x+b.w&&b.y<box.y+box.h&&box.y<b.y+b.h))return false;
 const g=document.createElementNS(SVGNS,'g');
 g.innerHTML=RR(bx,y,w,FUN_BUBBLE_H,3.5,'#ffffff',' stroke="'+OL+'" stroke-width="1.3"')
  +'<path d="M'+(tx-2.5)+' '+(y+12.3)+' l2.5 4 l2.5 -4" fill="#ffffff" stroke="'+OL+'" stroke-width="1.3" stroke-linejoin="round"/>'
  +T(bx+w/2,y+9.6,8.5,'#3b2a20',text);
 $('#funSays').appendChild(g);box.g=g;FUN.says.push(box);
 funLater(ms,()=>funUnsay(box));
 return box}
// Gỡ một bong bóng sớm (người nói đã về chỗ hay bị gọi đi)
function funUnsay(box){if(!box)return;box.g.remove();FUN.says=FUN.says.filter(b=>b!==box)}
function funDialog(whereA,whereB,lines){
 const a=whereA();if(!a||!funSay(a.x,a.y,lines[0],FUN_SAY_MS))return;
 // người kia đáp khi bong bóng đầu đã tắt: hai bong bóng không bao giờ chồng nhau
 funLater(FUN_SAY_MS+FUN_REPLY_GAP_MS,()=>{const b=whereB();if(b)funSay(b.x,b.y,lines[1],FUN_SAY_MS)});
}
// Chỗ bong bóng của người ở chỗ key, lúc nói (người đó đã đi vắng hay đổi chỗ thì null)
const funSpotTalk=(key,dy)=>()=>{const s=FUN.spots.get(key);return s&&!FUN.hide.has(key)?{x:s.x,y:s.y-dy}:null};

function funBorrow(spot,kind){
 const g=document.createElementNS(SVGNS,'g');$('#funActors').appendChild(g);
 const a={id:spot.id,home:spot.key,kind,role:spot.role,color:spot.color,L:look(spot.id),x:spot.x,y:spot.y,hx:spot.x,hy:spot.y,
  pose:'front',hold:'',carry:'',lift:0,t:0,path:[],arrive:null,tick:null,seat:null,staying:false,homing:false,bubble:null,g,art:''};
 FUN.actors.add(a);FUN.hide.add(spot.key);funMarkAway(spot.key,true);
 return a}
function funRelease(a){
 if(!FUN.actors.delete(a))return;
 a.g.remove();funUnsay(a.bubble);FUN.hide.delete(a.home);funMarkAway(a.home,false)}
// Đang ở dải nào của sàn trống (top: chân tường, lounge: góc nghỉ, aisle: lối dọc trái), other: chỗ khác (bàn)
function funZoneOf(p){
 if(Math.abs(p.y-FUN_TOP_Y)<1)return 'top';
 if(FUN.loungeY&&Math.abs(p.y-FUN.loungeY)<1)return 'lounge';
 return Math.abs(p.x-FUN_AISLE_X)<1?'aisle':'other'}
// Cùng dải thì đi thẳng; khác dải thì vòng qua lối dọc bên trái (không băng qua các dãy bàn)
function funPath(from,to){
 const zf=funZoneOf(from),zt=funZoneOf(to);
 if(zf==='other'||zt==='other'||zf===zt)return[{x:to.x,y:to.y}];
 const pts=zf==='aisle'?[]:[{x:FUN_AISLE_X,y:from.y}];
 return pts.concat(zt==='aisle'?[{x:to.x,y:to.y}]:[{x:FUN_AISLE_X,y:to.y},{x:to.x,y:to.y}])}
// Máy đặt giảm chuyển động: không lướt trên sàn, tới thẳng nơi (khung sau gọi done).
// Đường dài (văn phòng nhiều dãy bàn: góc nghỉ ở rất xa) thì rảo bước cho kịp trong FUN_WALK_MAX_MS
function funWalk(a,to,done){
 if(!MOTION_OK){a.x=to.x;a.y=to.y}
 a.path=funPath(a,to);a.arrive=done||null;
 let len=0,at=a;
 a.path.forEach(p=>{len+=Math.hypot(p.x-at.x,p.y-at.y);at=p});
 a.speed=Math.max(FUN_SPEED,len/FUN_WALK_MAX_MS)}
function funStep(a,dt){
 a.t+=dt;
 let left=(a.speed||FUN_SPEED)*dt;
 while(left>0&&a.path.length){const p=a.path[0],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
  if(d<=left){a.x=p.x;a.y=p.y;left-=d;a.path.shift()}else{a.x+=dx/d*left;a.y+=dy/d*left;left=0}}
 if(!a.path.length&&a.arrive){const f=a.arrive;a.arrive=null;f()}
 if(a.tick)a.tick(a);
 if(FUN.actors.has(a))funDraw(a)}
// Chỉ vẽ lại hình khi đổi dáng; mỗi khung chỉ đổi transform
function funDraw(a){
 const walking=a.path.length>0,key=a.pose+'|'+(walking?a.carry:a.hold)+'|'+walking;
 if(key!==a.art){a.art=key;a.g.setAttribute('class',walking?'walker':'');
  const art=walking?standFront(0,0,a.L,a.role,a.color,a.carry):a.pose==='back'?standBack(0,0,a.L,a.role,a.color)
   :a.pose==='seat'?sitBack(0,0,a.L,a.role,a.color,'stretch'):standFront(0,0,a.L,a.role,a.color,a.pose==='sit'?'sit':a.hold);
  // ngồi ở bàn: ghế vẽ lại phía trước người (như ở #office), người nhổm lên thì ghế đứng yên
  a.g.innerHTML='<g>'+art+'</g>'+(a.pose==='seat'?chair(a.x,a.y+FUN_CHAIR_DY):'')}
 a.g.firstChild.setAttribute('transform','translate('+a.x.toFixed(1)+','+(a.y-a.lift).toFixed(1)+')')}

/* ----- người rảnh ở cây nước đi chơi rồi về ----- */
const funCount=kind=>[...FUN.actors].filter(a=>a.kind===kind).length;
// Chỉ người rảnh thật (không chạy, không có việc chờ), chưa đi, không vừa đi bộ tới, và không đang được bạn chọn hay Tab tới
const funCanLeave=s=>s.zone==='cooler'&&s.kind==='idle'&&!FUN.hide.has(s.key)&&s.id!==openId&&s.id!==funFocusId()&&arriving(s.id)==null;
function funFreeSeats(spot){
 const out=[];
 Object.entries(FUN_POI).forEach(([name,def])=>{
  if(def.noTrip||(def.zone==='lounge'&&!FUN.loungeY))return;
  if(def.here){if(spot.x<=FUN_WINDOW_R)out.push({name,def,x:spot.x});return}
  def.seats.forEach(x=>{if(![...FUN.actors].some(a=>a.seat&&a.seat.name===name&&a.seat.x===x))out.push({name,def,x})})});
 return out}
function funTrip(){
 if(!funMotion()||funCount('trip')>=FUN_MAX_AWAY||Math.random()>FUN_TRIP_CHANCE)return;
 const spot=funPick([...FUN.spots.values()].filter(funCanLeave));if(!spot)return;
 const seat=funPick(funFreeSeats(spot));if(!seat)return;
 const a=funBorrow(spot,'trip');a.seat=seat;
 funWalk(a,{x:seat.x,y:funSeatY(seat.def)},()=>funArrive(a));
}
const funTalkAt=a=>FUN.actors.has(a)&&a.staying?{x:a.x,y:a.y-(funZoneOf(a)==='top'?FUN_TOP_TALK_DY:FUN_HEAD_TALK_DY)}:null;
function funArrive(a){
 const d=a.seat.def;a.pose=d.pose;a.hold=d.hold;a.staying=true;
 // có người đi chơi khác ngồi, đứng gần (sofa hai chỗ…): nói chuyện với nhau thay vì nói một mình; đợi bong bóng
 // lúc tới nơi của người kia tắt đã, kẻo hai bong bóng chồng nhau và câu chuyện bị bỏ qua
 const mate=[...FUN.actors].find(b=>b!==a&&b.kind==='trip'&&b.staying&&Math.abs(b.y-a.y)<1&&Math.abs(b.x-a.x)<=FUN_NEAR);
 if(mate)funLater(FUN_SAY_MS+FUN_REPLY_GAP_MS,()=>funDialog(()=>funTalkAt(a),()=>funTalkAt(mate),funPick(FUN_SMALL_TALK)));
 else{const p=funTalkAt(a);a.bubble=funSay(p.x,p.y,funPick(d.say),FUN_SAY_MS)}
 funLater(FUN_STAY_MS+Math.random()*FUN_STAY_VAR_MS,()=>funGoHome(a));
}
// Về chỗ ở cây nước (chỗ có thể đã dời vì người khác tới, đi); mất chỗ thì biến mất luôn
function funGoHome(a){
 if(!FUN.actors.has(a)||a.homing)return;
 const s=FUN.spots.get(a.home);if(!s){funRelease(a);return}
 a.homing=true;a.staying=false;a.carry=a.seat?a.seat.def.carry||'':'';
 funWalk(a,{x:s.x,y:s.y},()=>funRelease(a));
}
// Bạn bấm hay Tab tới chỗ của người đang đi vắng: về ngay (không đi bộ), để khung chọn, bảng chi tiết khớp với hình
function funRecall(){const fid=funFocusId();FUN.actors.forEach(a=>{if(a.kind==='trip'&&(a.id===openId||a.id===fid))funRelease(a)})}
// build(): người đang đi chơi được gọi vào bàn. Trả về chỗ đang đứng (người đi bộ xuất phát từ đó) và xoá hình ở #fun
function funTakeBack(id){
 const a=[...FUN.actors].find(b=>b.id===id&&b.kind==='trip');if(!a)return null;
 const at={x:a.x,y:a.y};funRelease(a);return at}

/* ----- vươn vai ở bàn, nói chuyện, reo mừng ----- */
const funSeat=(a,spot)=>{a.pose='seat';a.y=spot.y+FUN_SEAT_DY};
function funStretch(){
 if(!funMotion()||Math.random()>FUN_STRETCH_CHANCE)return;
 const spot=funPick([...FUN.spots.values()].filter(s=>s.zone==='desk'&&s.pose==='idle'&&!FUN.hide.has(s.key)&&arriving(s.id)==null));if(!spot)return;
 const a=funBorrow(spot,'stretch');funSeat(a,spot);
 a.tick=b=>{b.lift=Math.sin(Math.min(1,b.t/FUN_STRETCH_MS)*Math.PI)*FUN_STRETCH_RISE;if(b.t>=FUN_STRETCH_MS)funRelease(b)};
 if(Math.random()<FUN_YAWN_CHANCE)funSay(spot.x,spot.y-FUN_DESK_TALK_DY,'🥱',FUN_SAY_MS);
}
// Tán gẫu: hai người rảnh đứng cạnh nhau ở cây nước, hoặc Coder hỏi Tester cùng dãy bàn
function funChat(){
 if(Math.random()>FUN_CHAT_CHANCE)return;
 const all=[...FUN.spots.values()].filter(s=>s.pose!=='ghost'&&!FUN.hide.has(s.key));
 const cool=all.filter(s=>s.zone==='cooler'&&s.kind==='idle').sort((p,q)=>p.x-q.x);
 const near=cool.slice(1).map((s,i)=>[cool[i],s]).filter(([p,q])=>q.x-p.x<=COOLER_STEP+1);
 const desk=all.filter(s=>s.zone==='desk'),pairs=[];
 desk.filter(s=>s.role==='coder').forEach(c=>desk.forEach(t=>{if(t.role==='tester'&&t.dir===c.dir)pairs.push([c,t])}));
 if(pairs.length&&(!near.length||Math.random()<.5)){const [c,t]=funPick(pairs);
  funDialog(funSpotTalk(c.key,FUN_DESK_TALK_DY),funSpotTalk(t.key,FUN_DESK_TALK_DY),funPick(FUN_DESK_TALK));return}
 if(!near.length)return;
 const pr=funPick(near);if(Math.random()<.5)pr.reverse();
 funDialog(funSpotTalk(pr[0].key,FUN_TOP_TALK_DY),funSpotTalk(pr[1].key,FUN_TOP_TALK_DY),funPick(FUN_SMALL_TALK));
}
// build(): tính năng vừa xong. Chờ người đi bộ (bàn → cây nước) tới nơi rồi mới reo
function funCheer(ids){if(FUN.on)funLater(WALK_MS+FUN_CHEER_WAIT_MS,()=>ids.forEach((id,i)=>funCheerOne(id,i)))}
function funCheerOne(id,i){
 const trip=[...FUN.actors].find(a=>a.id===id&&a.kind==='trip');
 if(trip){const p=funTalkAt(trip);if(p)funSay(p.x,p.y,FUN_CHEER_COOLER[i%3],FUN_CHEER_MS);return}
 const spot=[...FUN.spots.values()].find(s=>s.id===id&&s.pose!=='ghost'&&!FUN.hide.has(s.key));if(!spot)return;
 const atCooler=spot.zone==='cooler';
 funSay(spot.x,spot.y-(atCooler?FUN_TOP_TALK_DY:FUN_DESK_TALK_DY),(atCooler?FUN_CHEER_COOLER:FUN_CHEER_DESK)[i%3],FUN_CHEER_MS);
 // giảm chuyển động hay Master đang đứng chờ bạn: chỉ bong bóng
 if(!funMotion()||!(atCooler||FUN_SIT_POSES.includes(spot.pose)))return;
 const a=funBorrow(spot,'cheer'),hop=atCooler?FUN_CHEER_HOP:FUN_CHEER_HOP/2;
 if(atCooler)a.hold='cheer';else funSeat(a,spot);
 a.tick=b=>{b.lift=Math.abs(Math.sin(b.t/FUN_CHEER_HOP_MS*Math.PI))*hop;if(b.t>=FUN_CHEER_MS)funRelease(b)};
}

/* ----- giữ lớp #fun khớp với #office sau mỗi lần vẽ ----- */
// Bố cục đổi (thêm, bớt dãy bàn) thì góc nghỉ dời: người đang ở đó, đường đi tới đó dời theo
function funShiftLounge(old,nw){
 const fix=p=>{if(Math.abs(p.y-old)<1)p.y=nw;else if(p.y>FUN_TOP_Y+1&&p.y>nw)p.y=nw};
 FUN.actors.forEach(a=>{if(a.kind==='trip'){fix(a);a.path.forEach(fix)}});
}
function funAfterBuild(laneB){
 const ly=laneB-FUN_LOUNGE_DY;
 if(FUN.loungeY&&ly!==FUN.loungeY)funShiftLounge(FUN.loungeY,ly);
 FUN.loungeY=ly;
 FUN.actors.forEach(a=>{const s=FUN.spots.get(a.home);
  if(!s){funRelease(a);return}
  // vươn vai, reo mừng ở chỗ đã dời hay người đó bắt đầu làm việc: thôi luôn
  if(a.kind!=='trip'){if(s.x!==a.hx||s.y!==a.hy||(a.kind==='stretch'&&s.pose!=='idle'))funRelease(a);return}
  // có việc (chạy, chờ): về ngay, không đi bộ (như funRecall), kẻo bong bóng trạng thái ở cây nước (trong hình đang ẩn)
  // bị giấu suốt quãng đường về
  if(s.kind!=='idle'){funRelease(a);return}
  if(a.homing){const p=a.path[a.path.length-1];if(p){p.x=s.x;p.y=s.y}return}
  // Chỗ ở cây nước dời (người khác tới, đi): chỉ người ngắm cửa sổ tại chỗ cũ phải dời theo,
  // người đang ở chỗ khác cứ chơi tiếp, lúc về funGoHome đọc chỗ mới
  if(s.x!==a.hx&&a.seat&&a.seat.def.here)funGoHome(a);
  a.hx=s.x;
 });
 FUN.addons.forEach(o=>{if(o.build)o.build()});
}
function funClear(){
 FUN.addons.forEach(o=>{if(o.clear)o.clear()});
 [...FUN.actors].forEach(funRelease);FUN.timers=[];FUN.says=[];
 $('#funActors').replaceChildren();$('#funSays').replaceChildren();
}

/* ----- vòng lặp chung ----- */
let funLast=0;
function funLoop(t){requestAnimationFrame(funLoop);
 const dt=funLast?Math.min(FUN_DT_MAX_MS,t-funLast):0;funLast=t;
 if(!FUN.on||!S||document.hidden)return;
 FUN.clock+=dt;
 // tách việc tới hạn ra trước khi chạy: việc vừa chạy có thể hẹn thêm việc mới
 const due=FUN.timers.filter(x=>x.at<=FUN.clock);FUN.timers=FUN.timers.filter(x=>x.at>FUN.clock);due.forEach(x=>x.fn());
 FUN.jobs.forEach(j=>{if(FUN.clock>=j.next){j.next=FUN.clock+j.ms;j.fn()}});
 funRecall();
 FUN.actors.forEach(a=>funStep(a,dt));
 FUN.addons.forEach(o=>{if(o.frame)o.frame(dt)});
}
funEvery(FUN_TRIP_EVERY_MS,funTrip);
funEvery(FUN_CHAT_EVERY_MS,funChat);
funEvery(FUN_STRETCH_EVERY_MS,funStretch);
requestAnimationFrame(funLoop);

/* ----- nút "Hoạt hình vui": nhớ lựa chọn trong trình duyệt này ----- */
// Trình duyệt chặn localStorage (chế độ riêng tư, chặn dữ liệu trang): bỏ qua, mặc định bật; chỉ là tuỳ chọn hiển thị
function funPrefGet(){try{return localStorage.getItem(FUN_PREF_KEY)!=='off'}catch(e){return true}}
function funPrefSet(on){try{localStorage.setItem(FUN_PREF_KEY,on?'on':'off')}catch(e){}}
function funSetOn(on){
 FUN.on=on;$('#funBtn').setAttribute('aria-pressed',String(on));$('#funState').textContent=on?': bật':': tắt';
 if(!on)funClear();
 // roi nhỏ tĩnh ở #office (thay cho quản đốc khi tắt) đổi theo nút ngay, không đợi lần làm mới 3 giây
 if(S)build();
}
$('#funBtn').addEventListener('click',()=>{funSetOn(!FUN.on);funPrefSet(FUN.on)});
$('#funNote').hidden=MOTION_OK;
funSetOn(funPrefGet());

/* ---------- Quản đốc cầm roi (hoạt hình vui): có việc mà chưa ai làm ----------
 Người cần nhắc: ở dãy bàn, có việc chờ (bong bóng số: chờ Master gọi, chờ watch.sh đánh thức, cần mở phiên tay) mà không
 chạy; không tính người đang giơ tay hỏi Master hay ID chưa khai báo. Coder hỏi Master thì câu hỏi là việc chờ của Master,
 nên quản đốc tới nhắc Master (thổi còi, không quất roi sếp).
 Quản đốc vào từ cửa, đi trên sàn trống (dải sàn dưới tường, lối dọc trái, thảm đỏ bên phải, kênh giữa hai hàng khối;
 không đi dọc dãy bàn) tới cạnh bàn từng người một,
 ai lâu chưa bị nhắc nhất trước; quát một câu, quất roi vào không khí ("TÁCH!", không trúng ai), người đó giật mình "Ối!"
 rồi đáp; xong thì sang người kế (tối đa FM_ROUND_MAX người một lượt) hoặc ra cửa, nghỉ FM_PAUSE_MS rồi mới vào lại.
 Lần làm mới 3 giây: người đang được tới không còn chờ thì quản đốc biến mất ngay; chỗ ngồi dời thì đi tới chỗ mới.
 Chỉ khi funMotion(): tắt nút hay máy giảm chuyển động thì không có quản đốc, station() vẽ cái roi nhỏ cạnh bong bóng số.
 Không mượn nhân vật nào trừ lúc giật mình (funBorrow 'jolt', dưới một giây); lớp #fun không nhận chuột nên không chặn cú bấm.
 Cho phần sau: FM.a (quản đốc đang trong phòng, null nếu không), fmIsTarget(spot), FM.last (ID → FUN.clock lần bị nhắc) */
const FM_SPEED=.11; // nhanh hơn người đi chơi (FUN_SPEED): quản đốc đi tuần, lối vòng qua hai bên phòng khá dài
const FM_CHECK_MS=2000,FM_FIRST_MS=6000,FM_PAUSE_MS=25000,FM_GONE_PAUSE_MS=8000,FM_REVISIT_MS=90000,FM_ROUND_MAX=3;
const FM_FADE_MS=300,FM_ENTER_MS=500,FM_SHOUT_MS=1100,FM_RAISE_MS=380,FM_BURST_MS=480,FM_OUCH_MS=1200,FM_LINGER_MS=2000;
const FM_POP_MS=160,FM_POOF_MS=450,FM_POOF_DY=20;
const FM_JOLT_MS=650,FM_JOLT_RISE=6,FM_SHAKE=1.5,FM_SHAKE_MS=70;
// Chỗ đứng cạnh người ngồi: lệch ngang FM_SIDE_DX, đỉnh đầu thấp hơn y của chỗ FM_DESK_DY (ngang đầu người ngồi, chân còn
// trên biển tên); bong bóng của quản đốc ngay trên mũ
const FM_SIDE_DX=30,FM_DESK_DY=10,FM_TALK_DY=21;
// Đầu roi lúc quất (so với đỉnh đầu, mặt quay phải): ngay trên đầu người ngồi, cách một khoảng, không chạm ai.
// Còi: tiếng còi phía trước, cao hơn mũ
const FM_TIP_DX=30,FM_TIP_DY=-16,FM_WHISTLE_DX=14,FM_WHISTLE_DY=-18;
const FM_BURST_RX=17,FM_BURST_RY=11,FM_BURST_SPIKES=12,FM_BURST_INNER=.62,FM_BURST_PAD=7,FM_BURST_FS=7.5;
// Đường đi: giữa cửa (door() rộng 50), dải sàn dưới tường (đỉnh đầu ngay dưới hàng biển tên thứ ba ở cây nước, đáy 182;
// chân ở 221, trên tiêu đề khối đầu TOP+6), lối dọc trái (như người đi chơi) và thảm đỏ bên phải
const FM_DOOR_CX=DOOR_X+25,FM_FLOOR_Y=183,FM_AISLE_L=FUN_AISLE_X,FM_AISLE_R=OWNER_X;
// Kênh: dải sàn trống giữa hai hàng khối, đi ngang ở đây chứ không dọc theo dãy bàn (đè lên người ngồi, ghế, bàn). Đỉnh đầu
// cách chỗ ở hàng bàn cuối của khối FM_CHANNEL_DY (đáy biển tên ở +78), chân ngay trên tiêu đề khối kế (+118). Kênh trên một
// khối là kênh dưới của hàng khối phía trên: hai hàng bàn kề nhau ở hai khối cách nhau ROW_H+6+GAP+HEAD (h của khối trong build)
const FM_CHANNEL_DY=80,FM_CHANNEL_UP_DY=ROW_H+6+GAP+HEAD-FM_CHANNEL_DY;
const FM_SHOUT=['Việc chờ kìa!','Ngồi chơi à?','Làm đi nào!'],FM_SHOUT_BOSS=['Sếp ơi! 🙏'];
// Câu đáp theo cách agent được đánh thức: subagent phải đợi Master gọi, auto/window đợi watch.sh
const FM_REPLY={subagent:['Dạ em làm ngay!','Chờ Master gọi ạ 😅'],auto:['Dạ em làm ngay!','Chờ watch.sh gọi ạ 😅'],
 window:['Dạ em làm ngay!','Chờ watch.sh gọi ạ 😅'],manual:['Dạ em làm ngay!','Dạ, làm liền!']};
const FM_REPLY_BOSS=['Ừ, xem ngay!','Rồi, trả lời đây!'];
// ch: kênh của chỗ đứng đang tới hay vừa tới (lùi ra kênh đó trước khi đi tiếp)
const FM={a:null,door:null,phase:'off',phaseT:0,target:null,ch:null,visits:0,nextAt:FM_FIRST_MS,last:new Map(),
 shout:null,burst:null,jolt:null,after:null,replied:false,doorOpen:false};

// Quản đốc: mũ kê-pi, ria mép, lông mày nghiêm, áo khoác sẫm, còi đeo cổ, tay phải cầm roi ngắn. Gốc toạ độ như standFront
// (giữa người, y: đỉnh đầu, chân ở y+38), mặt quay sang phải; quay trái thì lật cả hình.
// pose: stand (roi cuộn thõng), raise (giơ roi lấy đà), crack (quất ra trước, đầu roi ở FM_TIP), whistle (thổi còi)
function foremanArt(pose){
 const skin='#e8b585',coat='#3a4256',lash='#4a2e1c',grip='#8a5a2e';
 const leg=(x,cls)=>'<g class="'+cls+'">'+RR(x,24,5.5,12,2,'#2b2b33',K(.9))+E(x+3.4,36.4,4.2,1.9,'#1d1612')+'</g>';
 const coil=(x,y)=>LN('M'+x+' '+y+' c4 1.6 4.4 7 .6 7.6 c-3.6 .6 -4 -4 -.6 -4.8 c2.6 -.6 3.8 1.8 3.4 4.6',lash,1.1);
 let s=leg(-6,'legL')+leg(.5,'legR')+RR(-12.5,14,5,12,2.5,coat,K(.9))+C(-10,26,2.2,skin,K(.7));
 s+=RR(-9.5,12,19,15,6,coat,K(1))+RR(-9.5,12,19,15,6,'url(#shd)')+P('M-3.6 12.4 l3.6 4 l3.6 -4z','#e9e3d8',K(.5))
  +R(-9.2,23.2,18.4,2.4,'#1d1612')+RR(-1.7,22.8,3.4,3.2,.6,'#f2c14e',K(.4));
 if(pose!=='whistle')s+=LN('M-3.4 13 q2.6 6.4 5.4 6.4','#d64545',.8)+RR(1.8,18.2,4.6,2.6,1,'#dfe3ea',K(.5))+C(6.4,19.5,1.3,'#dfe3ea',K(.5));
 s+=RR(-2.5,10,5,4,1.5,skin)+E(-6.8,7.6,1.6,2.2,skin,K(.7))+C(0,6.5,7.4,skin,K(1))
  +E(-.6,7.8,1,1.3,'#2b2b2b')+E(3.8,7.8,1,1.3,'#2b2b2b')+LN('M-2.8 4.9 l3.2 1.4 M6.2 4.9 l-3.2 1.4',OL,1.1)
  +E(2.4,9.3,1.4,1.1,'#d99a6a')+P('M1.6 10.1 q-2.4 -1 -4.6 1.4 q2.8 .7 4.6 -.4 q1.8 1.1 4.6 .4 q-2.2 -2.4 -4.6 -1.4z','#4a2e1c',K(.4));
 // mũ: chóp, vành sẫm, huy hiệu vàng, lưỡi trai chĩa về phía trước. Chóp thấp (đỉnh y-1, vừa trùm đầu): cả người cao
 // chưa tới 40, lọt dải sàn dưới tường (biển tên cây nước đáy 182, tiêu đề khối đầu 222) và kênh giữa hai hàng khối
 s+=P('M-7.8 4.8 Q-8.6 -1 0 -1 Q8.6 -1 7.8 4.8Z','#2a3040',K(.9))+R(-7.6,2.6,15.2,2.2,'#1a1d26')+C(.6,.6,1.5,'#f2c14e',K(.4))
  +P('M6.6 3.8 q5.4 -.4 8.4 1.6 q-4 1.4 -8.4 .6z','#1a1d26',K(.7));
 // tay phải và roi: vẽ sau đầu để tay giơ cao, tay đưa lên miệng vẫn thấy
 if(pose==='raise')s+=RR(7.5,3,5,12,2.5,coat,K(.9))+C(10,3,2.3,skin,K(.7))+LN('M10 2.6 l-2 -6',grip,2.4)+LN('M8 -3.4 q-6 -8 -14 -4 q-6 3 -4 10',lash,1.1);
 else if(pose==='crack')s+='<g'+ROT(-115,10,15)+'>'+RR(7.5,14,5,12,2.5,coat,K(.9))+'</g>'+C(20,10.4,2.3,skin,K(.7))+LN('M20 10.4 l5.4 -2.5',grip,2.4)
  +LN('M25.4 7.9 C33 5 25 -4 31 -8 S'+(FM_TIP_DX-1)+' '+(FM_TIP_DY+2)+' '+FM_TIP_DX+' '+FM_TIP_DY,lash,1.1);
 else if(pose==='whistle')s+=coil(9,24)+'<g'+ROT(125,10,15)+'>'+RR(7.5,14,5,9,2.5,coat,K(.9))+'</g>'+C(3.4,10.4,2.3,skin,K(.7))
  +RR(4.4,9.2,5,2.6,1,'#dfe3ea',K(.5))+C(9.6,10.5,1.4,'#dfe3ea',K(.5))+LN('M12.4 6.8 q1.8 2 0 4 M14.6 5.2 q3 3.4 0 6.8','#ffffff',.9);
 else s+=RR(7.5,14,5,12,2.5,coat,K(.9))+C(10,26,2.3,skin,K(.7))+LN('M10.6 24.6 l5.4 4.4',grip,2.4)+coil(16,29);
 return s;
}
const fmIsTarget=s=>!!s&&s.zone==='desk'&&s.pose==='wait'&&s.kind==='wait'&&!s.run&&/^\d+$/.test(s.txt||'');
const fmAisleNear=x=>x<(FM_AISLE_L+FM_AISLE_R)/2?FM_AISLE_L:FM_AISLE_R;
const fmSetPhase=p=>{FM.phase=p;FM.phaseT=0};
// Người kế tiếp: ai lâu chưa bị nhắc nhất (chưa lần nào: trước hết, theo thứ tự trên cảnh); một agent ngồi nhiều dãy chỉ
// tính một chỗ; vừa bị nhắc trong FM_REVISIT_MS thì thôi
function fmPick(){
 const seen=new Set(),lastOf=s=>FM.last.has(s.id)?FM.last.get(s.id):-Infinity;
 return [...FUN.spots.values()].filter(s=>{if(!fmIsTarget(s)||seen.has(s.id))return false;seen.add(s.id);return FUN.clock-lastOf(s)>=FM_REVISIT_MS})
  .sort((p,q)=>lastOf(p)-lastOf(q))[0]||null}
// Kênh để vào chỗ s: hàng bàn cuối của khối vào từ kênh dưới khối (chỉ lướt qua biển tên của chính người đó); hàng trên của
// khối nhiều hàng vào từ kênh trên khối, kẻo leo qua người ngồi ở hàng dưới. Kênh trên hàng khối đầu là dải sàn dưới tường.
// Khối phiên chat (dir rỗng, nhiều khối chung một dir) chỉ có một hàng
function fmChannel(s){
 const ys=s.dir?[...FUN.spots.values()].filter(o=>o.zone==='desk'&&o.dir===s.dir).map(o=>o.y):[s.y];
 if(s.y>=Math.max(...ys)-1)return s.y+FM_CHANNEL_DY;
 const up=Math.min(...ys)-FM_CHANNEL_UP_DY;
 return up<=FM_FLOOR_Y+1?FM_FLOOR_Y:up}
// Chỗ đứng cạnh người ngồi: đang ở cùng hàng thì đứng phía mình đi tới; không thì phía có ít bàn hơn. ch: kênh để vào
function fmStand(s,from){
 const y=s.y+FM_DESK_DY;let side;
 if(from&&Math.abs(from.y-y)<1)side=from.x<s.x?-1:1;
 else{const row=[...FUN.spots.values()].filter(o=>o.zone==='desk'&&o.key!==s.key&&Math.abs(o.y-s.y)<1),l=row.filter(o=>o.x<s.x).length,r=row.length-l;
  side=l!==r?(l<r?-1:1):fmAisleNear(s.x)===FM_AISLE_L?-1:1}
 return{x:s.x+side*FM_SIDE_DX,y,side,ch:fmChannel(s)}}
const fmOnAisle=x=>Math.abs(x-FM_AISLE_L)<1||Math.abs(x-FM_AISLE_R)<1;
// Kênh đang đi hay vừa rời, để đổi đường giữa chừng (chỗ ngồi dời) không băng qua bàn: đang đi ngang thì chính hàng đó;
// đang lùi ra kênh thì kênh sắp tới; đứng cạnh bàn hay đang vào chỗ đứng thì kênh của chỗ đó
function fmFromChannel(a){
 const p=a.path[0];
 if(p&&Math.abs(p.y-a.y)<1)return a.y;
 if(p&&a.path.length>1)return p.y;
 return FM.ch!=null?FM.ch:a.y}
// Chỉ đi trên sàn trống: lùi ra kênh của hàng đang đứng, đổi hàng ở lối dọc (bên nào gần đường đi hơn), theo kênh của chỗ
// tới, rồi đi thẳng lên (xuống) chỗ đứng. Cùng kênh thì không ra lối dọc. to.door: về cửa (theo dải sàn dưới tường)
function fmRoute(from,to){
 const pts=[],go=(x,y)=>pts.push({x,y});
 if(to.door&&from.y<FM_FLOOR_Y-1)return[{x:FM_DOOR_CX,y:FUN_TOP_Y}];
 const tx=to.door?FM_DOOR_CX:to.x,ty=to.door?FM_FLOOR_Y:to.ch,onAisle=fmOnAisle(from.x);
 const ax=onAisle?from.x:fmAisleNear((from.x+tx)/2);
 let y=from.y;
 if(from.y<FM_FLOOR_Y-1){y=FM_FLOOR_Y;go(from.x,y)}
 else if(!onAisle){y=fmFromChannel(from);go(from.x,y)}
 if(Math.abs(y-ty)>=1){go(ax,y);go(ax,ty)}
 go(tx,ty);go(tx,to.door?FUN_TOP_Y:to.y);
 return pts}
// Tiếng roi (hay còi): ngôi sao vàng có chữ, vài vạch toả ra phía trên, bật lên rất nhanh. Tính như một bong bóng
// (FUN.says) để bong bóng khác né; bong bóng đang ở đúng chỗ đó thì tắt luôn (tiếng roi cắt ngang câu chuyện)
function fmBurst(x,y,text){
 const pad=FM_BURST_PAD,box={x:x-FM_BURST_RX-pad,y:y-FM_BURST_RY-pad,w:2*(FM_BURST_RX+pad),h:2*(FM_BURST_RY+pad)};
 FUN.says.filter(b=>b.x<box.x+box.w&&box.x<b.x+b.w&&b.y<box.y+box.h&&box.y<b.y+b.h).forEach(funUnsay);
 let pts='';
 for(let i=0;i<2*FM_BURST_SPIKES;i++){const t=i*Math.PI/FM_BURST_SPIKES-Math.PI/2,k=i%2?FM_BURST_INNER:i%4?1:1.12;
  pts+=(x+Math.cos(t)*FM_BURST_RX*k).toFixed(1)+','+(y+Math.sin(t)*FM_BURST_RY*k).toFixed(1)+' '}
 const rays=[-160,-120,-90,-60,-20,20,160].map(d=>{const t=d*Math.PI/180,c=Math.cos(t),n=Math.sin(t);
  return 'M'+(x+c*(FM_BURST_RX+3)).toFixed(1)+' '+(y+n*(FM_BURST_RY+3)).toFixed(1)+' L'+(x+c*(FM_BURST_RX+8)).toFixed(1)+' '+(y+n*(FM_BURST_RY+8)).toFixed(1)}).join(' ');
 const g=document.createElementNS(SVGNS,'g');
 g.innerHTML=LN(rays,'#d9480f',1.2)+'<polygon points="'+pts+'" fill="#ffe066" stroke="#d9480f" stroke-width="1.2" stroke-linejoin="round"/>'
  +T(x,y+FM_BURST_FS*.35,FM_BURST_FS,'#b23030',text);
 g.style.transformOrigin=x+'px '+y+'px';
 $('#funSays').appendChild(g);box.g=g;FUN.says.push(box);
 g.animate([{transform:'scale(.4)'},{transform:'scale(1.15)',offset:.6},{transform:'scale(1)'}],{duration:FM_POP_MS,easing:'ease-out'});
 return box}
// Biến mất giữa chừng (người được tới không còn chờ): một làn khói nhỏ tan đi
function fmPoof(x,y){
 const g=document.createElementNS(SVGNS,'g');
 g.innerHTML=C(x-6,y+2,6,'#e9e3d8',K(.8))+C(x+6,y+1,7,'#f4efe6',K(.8))+C(x,y-5,7,'#fbfbf7',K(.8))+C(x+1,y+5,5,'#fbfbf7');
 g.style.transformOrigin=x+'px '+y+'px';
 $('#funSays').appendChild(g);
 g.animate([{opacity:1,transform:'scale(.6)'},{opacity:0,transform:'scale(1.4)'}],{duration:FM_POOF_MS,fill:'forwards'});
 funLater(FM_POOF_MS,()=>g.remove())}
// Người bị nhắc giật mình: nhổm lên, giơ hai tay (dáng vươn vai), rung nhẹ rồi ngồi lại
const fmJoltTick=b=>{const k=Math.min(1,b.t/FM_JOLT_MS);b.lift=Math.sin(k*Math.PI)*FM_JOLT_RISE;
 b.x=b.hx+(1-k)*FM_SHAKE*Math.sin(b.t/FM_SHAKE_MS*2*Math.PI);if(b.t>=FM_JOLT_MS)funRelease(b)};
// Bong bóng của người bị nhắc (ở bàn, như tán gẫu), nhớ trong FM.after: lần làm mới sau người đó hết chờ thì tắt luôn
function fmSayAt(key,text,ms){
 const s=FUN.spots.get(key);if(!fmIsTarget(s))return;
 const b=funSay(s.x,s.y-FUN_DESK_TALK_DY,text,ms);if(b&&FM.after&&FM.after.key===key)FM.after.boxes.push(b)}

/* ----- vòng đời: vào cửa, đi tới, quát, quất roi, sang người kế hay ra cửa ----- */
function fmEnter(){
 const acts=$('#funActors'),dg=document.createElementNS(SVGNS,'g'),g=document.createElementNS(SVGNS,'g');
 // cửa mở lúc quản đốc ra vào (cửa ở #office chỉ mở khi có việc chờ bạn); ban đêm phủ màu đêm như #office (khung door())
 dg.innerHTML=door(DOOR_X,true)+(NIGHT?R(DOOR_X-4,20,58,92,'rgba(20,30,70,.18)'):'');
 acts.prepend(dg);acts.appendChild(g);
 FM.a={x:FM_DOOR_CX,y:FUN_TOP_Y,path:[],arrive:null,tick:null,t:0,speed:FM_SPEED,dir:1,g,art:''};
 FM.door=dg;FM.visits=0;FM.target=null;FM.ch=null;fmSetPhase('enter');
}
function fmDropEffects(){
 funUnsay(FM.shout);funUnsay(FM.burst);FM.shout=FM.burst=null;
 if(FM.jolt){funRelease(FM.jolt);FM.jolt=null}}
function fmRemove(pause){
 fmDropEffects();
 if(FM.a){FM.a.g.remove();FM.door.remove()}
 FM.a=FM.door=FM.target=null;FM.phase='off';FM.nextAt=FUN.clock+pause}
function fmVanish(){fmPoof(FM.a.x,FM.a.y+FM_POOF_DY);fmRemove(FM_GONE_PAUSE_MS)}
function fmGo(s){
 const a=FM.a,st=fmStand(s,a);fmDropEffects();
 FM.target={key:s.key,id:s.id,role:s.role,sx:s.x,sy:s.y,side:st.side};FM.replied=false;
 // đường đi tính từ kênh cũ (FM.ch) rồi mới đổi sang kênh của chỗ mới
 a.path=fmRoute(a,st);FM.ch=st.ch;a.arrive=fmArrive;fmSetPhase('walk')}
function fmArrive(){
 const a=FM.a,tg=FM.target;a.dir=-tg.side;fmSetPhase('shout');
 FM.shout=funSay(a.x,a.y-FM_TALK_DY,funPick(tg.role==='master'?FM_SHOUT_BOSS:FM_SHOUT),FM_SHOUT_MS)}
function fmCrack(){
 const a=FM.a,tg=FM.target,boss=tg.role==='master';
 FM.last.set(tg.id,FUN.clock);
 FM.burst=boss?fmBurst(a.x+a.dir*FM_WHISTLE_DX,a.y+FM_WHISTLE_DY,'TUÝT!'):fmBurst(a.x+a.dir*FM_TIP_DX,a.y+FM_TIP_DY,'TÁCH!');
 const s=FUN.spots.get(tg.key);
 if(fmIsTarget(s)&&!FUN.hide.has(s.key)){const j=funBorrow(s,'jolt');funSeat(j,s);j.tick=fmJoltTick;FM.jolt=j}}
function fmReply(){
 const tg=FM.target,ag=S.agents.find(x=>x.id===tg.id);
 // mode là chữ thứ ba trong agents.txt, ai gõ gì cũng được: chỉ lấy khoá của chính FM_REPLY ("constructor", "__proto__"
 // sẽ trả về hàm, nguyên mẫu của Object chứ không phải danh sách câu)
 const rep=ag&&Object.hasOwn(FM_REPLY,ag.mode)?FM_REPLY[ag.mode]:FM_REPLY.manual;
 fmSayAt(tg.key,funPick(tg.role==='master'?FM_REPLY_BOSS:rep),FUN_SAY_MS)}
function fmNext(){FM.visits++;const s=FM.visits<FM_ROUND_MAX?fmPick():null;if(s)fmGo(s);else fmLeave()}
function fmLeave(){
 const a=FM.a;fmDropEffects();FM.target=null;
 a.path=fmRoute(a,{door:true});a.arrive=()=>fmSetPhase('out');fmSetPhase('leave')}
function fmAdvance(){
 const t=FM.phaseT;
 switch(FM.phase){
  case 'enter':if(t>=FM_ENTER_MS){const s=fmPick();if(s)fmGo(s);else fmLeave()}break;
  case 'shout':if(t>=FM_SHOUT_MS){funUnsay(FM.shout);FM.shout=null;fmSetPhase('raise')}break;
  case 'raise':if(t>=FM_RAISE_MS){fmCrack();fmSetPhase('crack')}break;
  case 'crack':if(t>=FM_BURST_MS){funUnsay(FM.burst);FM.burst=null;FM.after={key:FM.target.key,boxes:[]};fmSayAt(FM.target.key,'Ối!',FM_OUCH_MS);fmSetPhase('linger')}break;
  case 'linger':if(!FM.replied&&t>=FM_OUCH_MS+FUN_REPLY_GAP_MS){FM.replied=true;fmReply()}if(t>=FM_LINGER_MS)fmNext();break;
  case 'out':if(t>=FM_FADE_MS)fmRemove(FM_PAUSE_MS);break;
 }}
// Chỉ vẽ lại hình khi đổi dáng; mỗi khung đổi transform, độ mờ (hiện dần ở cửa, mờ dần lúc ra) và cửa mở
function fmDraw(){
 const a=FM.a,walking=a.path.length>0,boss=FM.target&&FM.target.role==='master';
 const pose=walking?'walk':FM.phase==='raise'||FM.phase==='crack'?(boss?'whistle':FM.phase):'stand';
 if(pose!==a.art){a.art=pose;a.g.setAttribute('class',walking?'walker':'');a.g.innerHTML='<g>'+foremanArt(pose==='walk'?'stand':pose)+'</g>'}
 a.g.firstChild.setAttribute('transform','translate('+a.x.toFixed(1)+','+a.y.toFixed(1)+') scale('+a.dir+',1)');
 const op=FM.phase==='out'?1-FM.phaseT/FM_FADE_MS:a.t/FM_FADE_MS;
 a.g.setAttribute('opacity',Math.max(0,Math.min(1,op)).toFixed(2));
 FM.door.setAttribute('visibility',!FM.doorOpen&&a.y<FM_FLOOR_Y-1?'visible':'hidden')}
function fmFrame(dt){
 const a=FM.a;if(!a)return;
 if(a.path.length){const dx=a.path[0].x-a.x;if(Math.abs(dx)>.5)a.dir=Math.sign(dx)}
 funStep(a,dt);
 FM.phaseT+=dt;fmAdvance();
 if(FM.a)fmDraw()}
// Sau mỗi lần vẽ #office: người đang được tới hết chờ (bắt đầu chạy, giơ tay hỏi, hết việc, rời dãy) thì biến mất;
// chỗ ngồi dời (thêm, bớt dãy bàn) lúc đang đi tới hay sắp quất thì đi tới chỗ mới
function fmBuild(){
 FM.doorOpen=ownerWaits().total>0;
 if(FM.after&&!fmIsTarget(FUN.spots.get(FM.after.key))){FM.after.boxes.forEach(funUnsay);FM.after=null}
 if(!FM.a||!FM.target)return;
 const s=FUN.spots.get(FM.target.key);
 if(!fmIsTarget(s)){fmVanish();return}
 const moved=s.x!==FM.target.sx||s.y!==FM.target.sy;
 if(moved&&(FM.phase==='walk'||FM.phase==='shout'||FM.phase==='raise'))fmGo(s)}
function fmClear(){if(FM.a)fmRemove(FM_FIRST_MS);FM.after=null}
function fmPatrol(){if(funMotion()&&!FM.a&&FUN.clock>=FM.nextAt&&fmPick())fmEnter()}
funEvery(FM_CHECK_MS,fmPatrol);
funAddon({frame:fmFrame,build:fmBuild,clear:fmClear});

/* ---------- Vuốt ve chó mèo chuột, ném bóng cho chó, chó mèo với người, máy bay giấy, máy cà phê bốc khói ----------
 Chỉ để vui, chạy hoàn toàn trong trình duyệt, không đọc ghi gì thêm. Chó mèo chuột vẫn ở lớp #pets và đi trong vòng
 critLoop (nhịp PET_TICK_MS, chạy cả khi tắt nút: chúng có từ trước hoạt hình vui); phần này thêm vào đó:
  - Bấm con vật (poke): nút "Hoạt hình vui" bật thì vuốt ve: bàn tay của bạn vuốt qua lại, tim bay lên, con vật đứng yên;
    bấm liền tay (dưới PET_COMBO_MS) thì vui thêm một bậc, thêm tim, chó lăn ra ngửa bụng. Tắt nút thì chỉ kêu như cũ.
    Giảm chuyển động: tay, tim đứng yên, chó không đổi dáng; mèo vẫn nhắm mắt, chuột vẫn đỏ má (chỉ là hình tĩnh).
  - Bấm sàn trống ở #office (không phải nhân vật, bàn BẠN, tiêu đề khối, tường; không phải kéo chuột hay bôi đen chữ): bạn
    ném bóng từ bàn BẠN tới đó, bóng nảy rồi lăn tới điểm gần nhất trên lối chó mèo, chó chạy tới ngậm về thảm đỏ dưới bàn
    bạn, nhả ra rồi ngồi vẫy đuôi. Giảm chuyển động: bóng hiện ở chỗ bấm, chó sủa "Gâu! 🎾" tại chỗ, không chạy.
  - Mỗi PET_SOCIAL_EVERY_MS (chỉ khi funMotion()): chó ghé một người rảnh ở cây nước, được xoa đầu (tim, một câu); hoặc mèo
    trèo lên bàn người đang chờ (đi dọc mép bàn từ lối dọc gần hơn, không băng qua biển tên) hay nhảy lên sofa, ghế lười.
    Lúc ra khỏi lối của chúng, con vật mang class nohit (không nhận chuột): bấm vào đó vẫn mở chi tiết nhân vật bên dưới.
    Quản đốc quất roi cạnh bàn có mèo thì mèo giật mình bỏ chạy.
  - Máy bay giấy giữa hai người không bận cùng dãy bàn (lớp #funFly); máy cà phê bốc khói khi có người đứng pha (#funDeco).
 Tắt nút: bỏ ngay tay, tim, bóng, máy bay, khói; chó mèo đang ở cây nước, trên bàn thì về lối của chúng theo đường cũ.
 Cho phần sau:
  petLayer('under'|'over')      nhóm trong #pets dưới / trên các con vật, không nhận chuột (bóng nằm ở 'under')
  petStart(n,a)                 vuốt ve con n ('dog'|'cat'|'mouse'), a = CRIT[n]
  petHandOn(a,skin,sleeve,flip), petHandOff(a), petHearts(a,n)   bàn tay úp trên con a (sleeve rỗng: không tay áo; flip
                                null: từ phía đuôi, true/false: từ bên trái/phải), n trái tim hai bên tay
  petKeepsPlace(a), petRelayout()  setGraph() dùng khi bố cục đổi: con đang ở ngoài lối giữ chỗ, chuyến chơi đi tiếp
  moveFree(a,k)                 con vật đi theo a.free [{x,y,hop?}] ngoài lối (hop: nhảy vòng cung); true khi tới nơi
  throwBall(x,y)                ném bóng tới (x,y) toạ độ cảnh; FETCH.st: idle|fly|roll|wait|carry|rest|hint
  dogVisitStart(), catPerchStart(), planeLaunch()   ép ngay một lần chó ghé cây nước, mèo trèo bàn/sofa, máy bay giấy
                                (true nếu làm được: có người hợp, con vật đang rảnh)
  CRIT.<con>: pet (nhịp còn lại), joy (bậc vui), carry, nohit, free; CRIT.dog.visit, CRIT.cat.perch: chuyến đang đi */
const PET_TICK_MS=50; // một nhịp của vòng chó mèo: critLoop, think() đếm thời gian theo nhịp này
// Vuốt ve kéo dài PET_TICKS nhịp; bấm lại trong PET_COMBO_MS thì vui thêm một bậc (tối đa PET_JOY_MAX tim), tới PET_ROLL_JOY
// thì chó lăn ngửa bụng; chó được vuốt vẫy đuôi đổi nhịp mỗi PET_WAG_MS
const PET_TICKS=44,PET_COMBO_MS=4000,PET_JOY_MAX=5,PET_ROLL_JOY=3,PET_WAG_MS=90;
const PET_CHASE_HOLD=20; // mèo đang rượt dừng cách chuột đang được vuốt ngần này, không đè lên nó
const PET_STROKE_MS=320,PET_STROKE_DX=2.5; // tay vuốt qua lại: thời gian một chiều, biên độ
// Tim bay lên PET_HEART_RISE trong PET_HEART_MS, tim sau ra trễ PET_HEART_GAP_MS; xuất phát hai bên tay (cách PET_HEART_DX,
// lệch thêm tới PET_HEART_JITTER; con vật đang nói thì ra ngoài mép bong bóng), cao hơn chỗ tay chạm PET_HEART_DY. Mỗi con tối đa
// PET_HEART_ALIVE tim cùng lúc (bấm liền tay không thành một đống). Giảm chuyển động: xếp hàng hai bên, đứng yên tới hết lần vuốt.
// PET_HEART_HALF_W: nửa bề ngang trái tim (HEART_D rộng 8.4) kể cả viền, chừa một chút
const PET_HEART_MS=1200,PET_HEART_GAP_MS=140,PET_HEART_RISE=18,PET_HEART_SWAY=4,PET_HEART_DX=13,PET_HEART_JITTER=4,PET_HEART_DY=4,PET_HEART_STEP=7,PET_HEART_ALIVE=6,PET_HEART_SPARE_MS=300;
const PET_HEART_HALF_W=5;
const HEART_D='M0 0 C-1 -1.4 -4.2 -2.4 -4.2 -4.8 C-4.2 -6.8 -1.4 -7.4 0 -5.2 C1.4 -7.4 4.2 -6.8 4.2 -4.8 C4.2 -2.4 1 -1.4 0 0Z';
const PET_SKIN='#f5cfa6',PET_SLEEVE='#2f6fe0'; // tay của bạn: màu da, màu áo của người đứng ở bàn "BẠN"
// Bàn tay đặt nằm trên lưng (vuốt dọc lưng): cao PET_HAND_H so với chỗ chạm; bong bóng của con vật nằm trên tay (cao
// PET_SAY_H kể cả đuôi), để tay không che chữ
const PET_HAND_H=6,PET_SAY_H=14;
// Chỗ tay chạm so với chân con vật (mặt quay phải): lưng phía đuôi (ngón tay duỗi về phía đầu, không che mặt), bụng khi chó
// lăn ngửa; head: đầu chó (người ở cây nước xoa đầu). Tay to nhỏ theo con vật (PET_HAND_SCALE)
const PET_TOUCH={dog:{sit:[-4,-13],walk:[-3,-13.5],sleep:[-3,-9],roll:[-2,-10],head:[4,-21]},cat:{sit:[-3.5,-10],walk:[-2,-9.5],sleep:[-2.5,-6.5]},mouse:{walk:[-1.5,-4.5]}};
const PET_HAND_SCALE={dog:.85,cat:.7,mouse:.5};
const PET_LINES={dog:['Gâu!','Gâu gâu! 💕','🥰'],cat:['Rừ rừ…','Rừ rừ… 💕','Rừ rừ… 😻'],mouse:['Chít chít!','Chít chít! 💕','Chít chít! 😊']};
const PET_PLAIN={dog:'Gâu!',cat:'Meo!',mouse:'Chít!'}; // tắt hoạt hình vui: chỉ kêu như trước
// DOG_SPD: tốc độ đi dạo của chó (như lúc tạo CRIT.dog), trả lại sau khi chạy nhặt bóng. Đi có việc (tới cây nước, tới chỗ
// trèo) thì rảo bước: văn phòng nhiều dãy bàn rất dài, đi chậm thì người được ghé đã đi chỗ khác
const DOG_SPD=1.5,DOG_TROT_SPD=3.2,CAT_TROT_SPD=3;
// Ném bóng: bay từ tay bạn (đứng ở bàn BẠN) theo vòng cung, lâu và cao theo quãng xa (có chặn trên dưới); chạm sàn nảy
// FETCH_HOPS lần rồi lăn tới điểm gần nhất trên lối chó mèo (bóng xoay FETCH_SPIN_DEG độ mỗi đơn vị lăn)
const FETCH_FROM_X=OWNER_X-10,FETCH_FROM_Y=84,FETCH_GROUND_Y=FLOOR_Y+4;
const FETCH_FLY_MS_PER=1.1,FETCH_FLY_MIN_MS=350,FETCH_FLY_MAX_MS=900,FETCH_ARC_K=.3,FETCH_ARC_MIN=18,FETCH_ARC_MAX=70;
const FETCH_HOPS=2,FETCH_HOP_MS=180,FETCH_HOP_H=5,FETCH_ROLL_SPEED=.12,FETCH_SPIN_DEG=22;
// Bóng nằm dưới bàn bạn FETCH_REST_MS rồi mờ dần FETCH_FADE_MS; giảm chuyển động: bóng hiện FETCH_HINT_MS ở chỗ bấm.
// Chuột lệch quá FETCH_DRAG_PX giữa lúc nhấn và lúc thả là kéo (vuốt ngang, bôi đen), không phải bấm
const FETCH_REST_MS=4000,FETCH_FADE_MS=400,FETCH_HINT_MS=2500,FETCH_DRAG_PX=6;
const FETCH_DOG_SPD=5,FETCH_DROP_DX=11,FETCH_BARK_TICKS=14,DOG_PRESENT_TICKS=50,DOG_AFTER_PLAY=30;
const FETCH={st:'idle',g:null,x:0,y:0,h:0,t:0,fx:0,fy:0,tx:0,ty:0,shx:0,shy:0,dur:0,arc:0,node:'',nx:0,ny:0,spin:0,down:null};
// Chó mèo với người: thử mỗi PET_SOCIAL_EVERY_MS với xác suất PET_SOCIAL_CHANCE; có cả bàn người chờ lẫn ghế trống thì mèo
// chọn bàn với xác suất CAT_DESK_CHANCE
const PET_SOCIAL_EVERY_MS=8000,PET_SOCIAL_CHANCE=.45,CAT_DESK_CHANCE=.6;
// Chó ghé cây nước: rời lối sát tường ở BASE_X0, đi trên sàn ngay trên hàng biển tên đầu (chân ở VISIT_Y), ngồi bên phải
// người đó VISIT_DX, quay mặt vào người
const VISIT_Y=FLOOR_Y+1,VISIT_DX=13,VISIT_SIT_TICKS=56,VISIT_HEARTS=2;
const VISIT_LINES=['Ngoan quá! 🐶','Cún ơi 🐶','Ai ngoan đây?'];
// Mèo trèo bàn: ngồi trên mặt bàn bên trái màn hình (CAT_DESK_DX bên trái tâm bàn, chân thấp hơn y của chỗ CAT_DESK_DY);
// CAT_HALF_W, CAT_H: khung mèo ngồi, để biết tiếng roi có trúng chỗ mèo không
const CAT_DESK_DX=28,CAT_DESK_DY=7,CAT_DESK_SPD=2.2,CAT_FLEE_SPD=3.2,CAT_HALF_W=10,CAT_H=24;
// Sofa, ghế lười ở góc nghỉ: chân mèo cao hơn lối dưới cùng ngần này (mặt đệm sofa, đỉnh ghế lười); nhảy lên theo vòng cung
const CAT_SOFA_DY=19,CAT_BEANBAG_DY=18,CAT_HOP_SPD=2.4,CAT_HOP_LIFT=8;
const CAT_PERCH_TICKS=160,CAT_PERCH_VAR=120,CAT_NAP_CHANCE=.5,CAT_NAP_AFTER=60,CAT_TALK_TICKS=32,CAT_MEOW_TICKS=24,CAT_AFTER_PERCH=40;
const PERCH_TALK_DX=24; // người có mèo trên bàn nói lệch sang phải: bong bóng không đè lên mèo
const PERCH_LINES=['Ơ, mèo! 😅','Mèo ơi 🐱','Xuống đi! 😅'];
// Máy bay giấy: thử mỗi PLANE_EVERY_MS; hai người cách nhau ít nhất PLANE_MIN_DX (bong bóng của hai người không chồng nhau);
// bay vòng cung, điểm điều khiển cao hơn đầu PLANE_ARC, lâu theo quãng xa; xuất phát, hạ cánh ngang đầu người ngồi
const PLANE_EVERY_MS=11000,PLANE_CHANCE=.4,PLANE_MIN_DX=60,PLANE_MS_PER=4,PLANE_MIN_MS=900,PLANE_MAX_MS=2000,PLANE_ARC=70,PLANE_HEAD_DY=12;
const PLANE_LINES=['Bắt được! ✈️','Gì đây? 📄','Ha ha 😄'];
// Khói bốc lên từ cốc dưới vòi máy cà phê (pantry() vẽ ở x 102): chỉ khi có người đang đứng pha
const COFFEE_STEAM_X=115,COFFEE_STEAM_Y=64;
const PLAY={planes:[],steam:null};

function petInit(n,a){Object.assign(a,{n,free:[],pet:0,joy:0,petAt:-Infinity,roll:false,carry:false,nohit:false,hopLift:0,hand:null,handFlip:null,touch:'',hearts:0,visit:null,perch:null})}
// Nhóm trong #pets: 'under' dưới mọi con vật (bóng trên sàn), 'over' trên cùng (tay, tim). Không có class crit nên không
// nhận chuột (cả lớp #pets là pointer-events:none, chỉ con vật nhận)
function petLayer(which){
 const svg=$('#pets'),id=which==='under'?'petUnder':'petOver';
 let g=svg.querySelector('#'+id);
 if(!g){g=document.createElementNS(SVGNS,'g');g.id=id}
 if(which==='under'){if(svg.firstChild!==g)svg.insertBefore(g,svg.firstChild)}
 else if(svg.lastChild!==g)svg.appendChild(g);
 return g}

/* ----- vuốt ve ----- */
function petStart(n,a){
 const now=performance.now();
 a.joy=now-a.petAt<PET_COMBO_MS?Math.min(PET_JOY_MAX,a.joy+1):1;a.petAt=now;a.pet=PET_TICKS;
 // giảm chuyển động: không đổi dáng (chó không lăn), chỉ hình tĩnh
 if(n==='dog'&&MOTION_OK&&a.joy>=PET_ROLL_JOY)a.roll=true;
 const lines=PET_LINES[n];say(a,lines[Math.min(a.joy,lines.length)-1],PET_TICKS);
 if(!a.hand)petHandOn(a,PET_SKIN,PET_SLEEVE,null);
 petHearts(a,a.joy)}
const petTouch=a=>{const t=PET_TOUCH[a.n];return t[a.touch||a.pose]||t.walk};
function petPoint(a){const o=petTouch(a);return{x:a.x+a.dir*o[0],y:a.y+critLift(a)+o[1]}}
// Đỉnh bong bóng (so với chân) khi có tay: ngay trên tay; không có tay thì không đổi (drawCrit lấy chỗ cao hơn)
const petSayTop=a=>a.hand?petTouch(a)[1]-PET_HAND_H-PET_SAY_H:0;
// Bàn tay úp trên lưng con vật, nhìn từ trên xuống: (0,0) giữa mép dưới lòng bàn tay, bốn ngón duỗi sang trái, cổ tay áo
// bên phải (sleeve rỗng: không vẽ tay áo). Cao 7.4 trước khi thu nhỏ (≤ PET_HAND_H), vuốt qua lại theo chiều ngang (dọc lưng)
function petHandArt(skin,sleeve){
 return [[5,-7],[7,-5.4],[6.6,-3.8],[5,-2.2]].map(([l,y])=>RR(-1-l,y,l+1,1.75,.85,skin,K(.45))).join('')
  +E(2,-6.9,2.8,1.3,skin,K(.5))+RR(-3,-7,10,7,3,skin,K(.8))+(sleeve?RR(6,-7.4,5,7.4,2,sleeve,K(.7)):'')}
// flip: true tay chìa ra từ bên trái (người đứng bên trái con vật), false từ bên phải; null: từ phía đuôi, ngón tay
// duỗi về phía đầu, đổi theo hướng con vật quay mặt
function petHandOn(a,skin,sleeve,flip){
 petHandOff(a);
 const g=document.createElementNS(SVGNS,'g'),stroke=document.createElementNS(SVGNS,'g'),art=document.createElementNS(SVGNS,'g');
 art.innerHTML=petHandArt(skin,sleeve);
 stroke.appendChild(art);g.appendChild(stroke);petLayer('over').appendChild(g);
 if(MOTION_OK)stroke.animate([{transform:'translateX(-'+PET_STROKE_DX+'px)'},{transform:'translateX('+PET_STROKE_DX+'px)'}],
  {duration:PET_STROKE_MS,direction:'alternate',iterations:Infinity,easing:'ease-in-out'});
 a.hand=g;a.handFlip=flip;petHandPlace(a)}
function petHandOff(a){if(a.hand){a.hand.remove();a.hand=null}}
function petHandPlace(a){
 const p=petPoint(a),s=PET_HAND_SCALE[a.n],f=a.handFlip==null?(a.dir>0?-1:1):a.handFlip?-1:1;
 a.hand.setAttribute('transform','translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')');
 a.hand.firstChild.firstChild.setAttribute('transform','scale('+(f*s)+','+s+')')}
// Chỗ xuất phát của tim h (bên h.side của tay h.p, con vật ở h.cx): không gần tay hơn PET_HEART_DX, và ngoài mép bong bóng
// (h.clear: nửa bề rộng bong bóng và nửa trái tim, 0 khi con vật không nói). Bong bóng nằm ngay trên tay, ở lớp dưới tim:
// tim bay lên cạnh bong bóng chứ không đè chữ
function petHeartPlace(h){
 const xOf=()=>h.cx+h.side*(Math.max(h.side*(h.p.x-h.cx)+PET_HEART_DX,h.clear)+h.out);
 let x=xOf();
 // sát mép cảnh (chó mèo hay đi lối dọc trái, XL): sang bên kia tay, kẻo tim ra ngoài khung
 if(x<PET_HEART_HALF_W||x>W-PET_HEART_HALF_W){h.side=-h.side;x=xOf()}
 h.g.firstChild.setAttribute('transform','translate('+x.toFixed(1)+','+(h.p.y-PET_HEART_DY).toFixed(1)+')')}
// Tim lần lượt bên trái, bên phải tay; tim thứ i ở hàng thứ i/2 ra ngoài (giảm chuyển động) hay lệch ngẫu nhiên (bay lên)
function petHearts(a,n){
 const p=petPoint(a),over=petLayer('over');
 const clear=a.sayT>0&&a.say?critSayW(a.say)/2+PET_HEART_HALF_W:0;
 // bấm liền tay, câu mới dài hơn: tim còn bay từ lần trước dời ra ngoài mép bong bóng mới (chỉ ra ngoài, không vào trong)
 over.querySelectorAll('[data-pet="'+a.n+'"]').forEach(g=>{if(g._h&&clear>g._h.clear){g._h.clear=clear;petHeartPlace(g._h)}});
 n=Math.min(n,PET_HEART_ALIVE-a.hearts);
 for(let i=0;i<n;i++){
  const side=i%2?1:-1,out=MOTION_OK?Math.random()*PET_HEART_JITTER:Math.floor(i/2)*PET_HEART_STEP;
  const g=document.createElementNS(SVGNS,'g');
  g.setAttribute('data-pet',a.n);g.innerHTML='<g>'+P(HEART_D,'#e8457a',K(.5))+'</g>';
  g._h={g,p,cx:a.x,side,out,clear};petHeartPlace(g._h);
  over.appendChild(g);a.hearts++;
  let life=PET_TICKS*PET_TICK_MS;
  if(MOTION_OK){life=PET_HEART_MS+i*PET_HEART_GAP_MS;
   g.animate([{transform:'translate(0,0)',opacity:0},{transform:'translate(0,-4px)',opacity:1,offset:.2},{transform:'translate('+g._h.side*PET_HEART_SWAY+'px,-'+PET_HEART_RISE+'px)',opacity:0}],
    {duration:PET_HEART_MS,delay:i*PET_HEART_GAP_MS,easing:'ease-out',fill:'both'})}
  setTimeout(()=>{g.remove();a.hearts=Math.max(0,a.hearts-1)},life+PET_HEART_SPARE_MS)}}
// Mỗi khung của vòng chó mèo (cả khi giảm chuyển động): hết giờ vuốt ve, tay đi theo con vật, nohit, bóng
function petFrame(k){
 Object.values(CRIT).forEach(a=>{
  if(a.pet>0&&(a.pet-=k)<=0){a.pet=0;a.roll=false;petHandOff(a)}
  if(a.hand)petHandPlace(a);
  // ra khỏi lối của chúng (ghé cây nước, trèo bàn), con vật đè lên nhân vật: không được giữ cú bấm của nhân vật
  a.nohit=!!(a.visit&&a.visit.phase!=='path'||a.perch&&a.perch.desk&&a.perch.phase!=='path')});
 fetchFrame(k*PET_TICK_MS)}
// Đi ngoài lưới lối chó mèo theo a.free [{x,y,hop?}] (k: số nhịp). hop: nhảy theo vòng cung (lên sofa, ghế lười)
function moveFree(a,k){
 const sx=a.x,sy=a.y;let left=a.spd*k;
 while(left>1e-6&&a.free.length){const p=a.free[0],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
  if(Math.abs(dx)>.01)a.dir=Math.sign(dx);
  if(p.hop&&!p.len)p.len=d||1;
  if(d<=left){a.x=p.x;a.y=p.y;left-=d;a.free.shift()}else{a.x+=dx/d*left;a.y+=dy/d*left;left=0}
  a.hopLift=p.hop&&a.free[0]===p?Math.sin((1-Math.hypot(p.x-a.x,p.y-a.y)/p.len)*Math.PI)*CAT_HOP_LIFT:0}
 if(!a.free.length)a.hopLift=0;
 a.odo+=Math.abs(a.x-sx)+Math.abs(a.y-sy);
 return !a.free.length}

/* ----- ném bóng cho chó ----- */
const ballArt=()=>C(0,-2.6,2.6,'#cfe04a',K(.6))+LN('M-1.7 -4.6 q1.6 2 0 4 M1.7 -4.6 q-1.6 2 0 4','#f7fbe0',.6);
function fetchG(){
 if(FETCH.g&&FETCH.g.isConnected)return FETCH.g;
 const g=document.createElementNS(SVGNS,'g');g.innerHTML=E(0,0,2.6,.9,'rgba(0,0,0,.28)')+'<g>'+ballArt()+'</g>';
 petLayer('under').appendChild(g);FETCH.g=g;return g}
function fetchAim(x,y){FETCH.node=nodeAt(x,y);const n=G.get(FETCH.node);FETCH.nx=n.x;FETCH.ny=n.y}
// Ném bóng tới (x,y) toạ độ cảnh. Ném lúc chó đang tha quả cũ thì nó nhả ra, chạy theo quả mới
function throwBall(x,y){
 const d=CRIT.dog;if(!d||!G)return;
 if(!MOTION_OK){Object.assign(FETCH,{st:'hint',t:0,x,y,h:0,spin:0});say(d,'Gâu! 🎾',FETCH_HINT_MS/PET_TICK_MS);fetchDraw();drawCrit();return}
 if(d.carry||d.mode==='fetch'||d.mode==='bring'||d.mode==='present'){d.carry=false;d.mode='roam';d.path=[];d.wait=DOG_AFTER_PLAY}
 const dd=Math.hypot(x-FETCH_FROM_X,y-FETCH_FROM_Y);
 Object.assign(FETCH,{st:'fly',t:0,fx:FETCH_FROM_X,fy:FETCH_FROM_Y,tx:x,ty:y,x:FETCH_FROM_X,y:FETCH_FROM_Y,h:0,spin:0,
  dur:Math.max(FETCH_FLY_MIN_MS,Math.min(FETCH_FLY_MAX_MS,dd*FETCH_FLY_MS_PER)),arc:Math.max(FETCH_ARC_MIN,Math.min(FETCH_ARC_MAX,dd*FETCH_ARC_K))});
 fetchAim(x,y);fetchFrame(0)}
function fetchFrame(dt){
 const f=FETCH;if(f.st==='idle'||f.st==='carry'||f.st==='wait')return;
 f.t+=dt;
 if(f.st==='fly'){const u=Math.min(1,f.t/f.dur);
  f.x=f.fx+(f.tx-f.fx)*u;f.y=f.fy+(f.ty-f.fy)*u;f.h=f.arc*4*u*(1-u);f.shx=f.x;f.shy=FETCH_GROUND_Y+(f.ty-FETCH_GROUND_Y)*u;
  if(u>=1){f.st='roll';f.t=0;f.h=0;dogFetchGo()}}
 else if(f.st==='roll'){const dx=f.nx-f.x,dy=f.ny-f.y,dd=Math.hypot(dx,dy),step=FETCH_ROLL_SPEED*dt,hops=FETCH_HOPS*FETCH_HOP_MS;
  if(dd<=step){f.x=f.nx;f.y=f.ny}else{f.x+=dx/dd*step;f.y+=dy/dd*step}
  f.spin+=Math.min(dd,step)*FETCH_SPIN_DEG*(dx<0?-1:1);
  f.h=f.t<hops?FETCH_HOP_H*Math.abs(Math.sin(Math.PI*f.t/FETCH_HOP_MS))*(1-f.t/hops):0;
  if(f.t>=hops&&dd<=step)f.st='wait'}
 else if(f.st==='rest'&&f.t>=FETCH_REST_MS+FETCH_FADE_MS||f.st==='hint'&&f.t>=FETCH_HINT_MS){fetchReset();return}
 fetchDraw()}
// Bóng: bóng đổ trên sàn (lúc bay thì ở dưới đường bay), quả bóng nhấc lên h; lúc chó ngậm thì ẩn (dogArt vẽ trong miệng)
function fetchDraw(){
 const f=FETCH,show=f.st!=='idle'&&f.st!=='carry';
 if(!show&&!f.g)return;
 const g=fetchG();g.setAttribute('visibility',show?'visible':'hidden');if(!show)return;
 const sx=f.st==='fly'?f.shx:f.x,sy=f.st==='fly'?f.shy:f.y;
 g.firstChild.setAttribute('transform','translate('+sx.toFixed(1)+','+sy.toFixed(1)+')');
 g.lastChild.setAttribute('transform','translate('+f.x.toFixed(1)+','+(f.y-f.h).toFixed(1)+') rotate('+f.spin.toFixed(0)+' 0 -2.6)');
 g.setAttribute('opacity',f.st==='rest'?Math.max(0,Math.min(1,1-(f.t-FETCH_REST_MS)/FETCH_FADE_MS)).toFixed(2):'1')}
// Thôi chơi bóng: bóng biến mất, chó đang chạy, tha hay ngồi khoe thì đi dạo tiếp
function fetchReset(){
 FETCH.st='idle';fetchDraw();
 const d=CRIT.dog;if(!d)return;
 d.carry=false;
 if(d.mode==='fetch'||d.mode==='bring'||d.mode==='present'){d.mode='roam';d.path=[];d.wait=DOG_AFTER_PLAY}}
// Bóng chạm sàn: chó (cả đang ngủ) chạy tới điểm bóng sẽ lăn tới. Đang ngồi cạnh người ở cây nước thì ra lối trước,
// dogVisitEnd cho chạy tiếp
function dogFetchGo(){
 const d=CRIT.dog;
 if(d.visit&&d.visit.phase!=='path'){if(d.visit.phase!=='out')dogVisitOut(d);return}
 d.visit=null;d.mode='fetch';goTo(d,FETCH.node);
 if(d.pet<=0)say(d,'Gâu!',FETCH_BARK_TICKS)}
// Các trò của chó; true nếu chó đang chơi (think() bỏ qua đi dạo, ngủ)
function dogPlay(d,k){
 if(d.mode==='fetch'){
  if(d.path.length&&!move(d,k))return true;
  // tới nơi: bóng nằm yên thì ngậm lấy mang về bàn bạn; bóng còn lăn thì ngồi chờ; bóng đã mất thì thôi
  if(FETCH.st==='wait'){FETCH.st='carry';fetchDraw();d.carry=true;d.mode='bring';goTo(d,SPOT)}
  else if(FETCH.st!=='roll'){d.mode='roam';d.wait=DOG_AFTER_PLAY}
  return true}
 if(d.mode==='bring'){if(!d.path.length||move(d,k))fetchDrop(d);return true}
 if(d.mode==='present'){if((d.wait-=k)<=0){d.mode='roam';d.wait=DOG_AFTER_PLAY}return true}
 if(d.mode==='visit'){dogVisit(d,k);return true}
 return false}
// Về tới thảm đỏ dưới bàn bạn: nhả bóng trước mặt, ngồi vẫy đuôi đòi ném tiếp
function fetchDrop(d){
 Object.assign(FETCH,{st:'rest',t:0,x:d.x+d.dir*FETCH_DROP_DX,y:d.y,h:0});fetchDraw();
 d.carry=false;d.mode='present';d.wait=DOG_PRESENT_TICKS;say(d,'Gâu! 🎾',DOG_PRESENT_TICKS)}
// Bấm sàn trống ở #office: ném bóng. Nhân vật, bàn BẠN, tiêu đề khối, tường không tính; kéo chuột (vuốt ngang, bôi đen chữ),
// bấm đúp, có phím bổ trợ cũng không: các cú bấm đó giữ nguyên tác dụng cũ
function officeFloorClick(e){
 const down=FETCH.down;FETCH.down=null;
 if(!FUN.on||e.button!==0||e.detail>1||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;
 if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>FETCH_DRAG_PX)return;
 if(!(e.target instanceof Element)||e.target.closest('.ag,#owner,.bh'))return;
 const sel=getSelection();if(sel&&!sel.isCollapsed)return;
 const m=$('#office').getScreenCTM();if(!m)return;
 const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());
 if(p.y<FLOOR_Y||p.x<0||p.x>W)return;
 throwBall(p.x,p.y)}
$('#office').addEventListener('pointerdown',e=>{FETCH.down={x:e.clientX,y:e.clientY}});
$('#office').addEventListener('click',officeFloorClick);

/* ----- chó ghé người rảnh ở cây nước, mèo trèo lên bàn người đang chờ hay lên sofa ----- */
function petSocial(){
 if(!funMotion()||!G||!CRIT.dog||Math.random()>PET_SOCIAL_CHANCE)return;
 if(Math.random()<.5){if(!dogVisitStart())catPerchStart()}
 else if(!catPerchStart())dogVisitStart()}
const visitOk=s=>!!s&&s.zone==='cooler'&&s.kind==='idle'&&!FUN.hide.has(s.key)&&arriving(s.id)==null;
// Người rảnh ở cây nước để chó ghé; ưu tiên người không có ai đứng ngay bên phải (chó ngồi ở đó, đỡ đè lên người bên cạnh)
function dogVisitPick(){
 const spots=[...FUN.spots.values()],all=spots.filter(visitOk);
 const roomy=all.filter(s=>!spots.some(o=>o.zone==='cooler'&&Math.abs(o.x-s.x-COOLER_STEP)<1));
 return funPick(roomy.length?roomy:all)||null}
function dogVisitStart(){
 const d=CRIT.dog;
 if(!d||d.mode!=='roam'||d.pet>0||FETCH.st!=='idle')return false;
 const s=dogVisitPick();if(!s)return false;
 d.mode='visit';d.visit={key:s.key,sx:s.x,phase:'path',t:0};d.free=[];goTo(d,BASE_X0+','+BASE_Y);
 return true}
// path: rảo bước theo lối tới đầu lối sát tường; in: ra sàn trên hàng biển tên tới cạnh người; sit: được xoa đầu; out: về lối.
// Lúc đang tới mà người đó đi chơi, có việc thì đổi sang người rảnh khác (hết người thì thôi); người dịch chỗ thì đi theo
function dogVisit(d,k){
 const v=d.visit;let s=FUN.spots.get(v.key);
 d.spd=v.phase==='path'?DOG_TROT_SPD:DOG_SPD;
 if(v.phase==='path'||v.phase==='in'){
  if(!visitOk(s)){s=dogVisitPick();if(s)v.key=s.key}
  if(!s){if(v.phase==='path')dogVisitEnd(d);else dogVisitOut(d);return}
  v.sx=s.x;if(v.phase==='in')d.free[d.free.length-1].x=s.x+VISIT_DX}
 if(v.phase==='path'){if(move(d,k)){v.phase='in';d.free=[{x:BASE_X0,y:VISIT_Y},{x:v.sx+VISIT_DX,y:VISIT_Y}]}return}
 if(v.phase==='in'){if(moveFree(d,k)){v.phase='sit';v.t=VISIT_SIT_TICKS;d.dir=-1;dogPat(d,s)}return}
 if(v.phase==='sit'){if(!visitOk(s)||s.x!==v.sx||(v.t-=k)<=0)dogVisitOut(d);return}
 if(moveFree(d,k))dogVisitEnd(d)}
// Người ở cây nước xoa đầu chó: tay người đó (không tay áo: tay cầm cốc của người đứng thõng ngay cạnh), tim, một câu
function dogPat(d,s){
 d.pose='sit';d.touch='head';petHandOn(d,look(s.id).skin,'',true);petHearts(d,VISIT_HEARTS);
 funSay(s.x,s.y-FUN_TOP_TALK_DY,funPick(VISIT_LINES),FUN_SAY_MS)}
function dogVisitOut(d){petHandOff(d);d.touch='';d.visit.phase='out';d.free=[{x:BASE_X0,y:VISIT_Y},{x:BASE_X0,y:BASE_Y}]}
// Về tới lối: đi dạo tiếp, hay chạy nhặt quả bóng bạn vừa ném lúc nó còn ở cây nước
function dogVisitEnd(d){
 d.visit=null;d.free=[];d.mode='roam';d.wait=DOG_AFTER_PLAY;
 if(FETCH.st==='roll'||FETCH.st==='wait'){d.mode='fetch';goTo(d,FETCH.node)}}
const perchSeats=()=>FUN_POI.sofa.seats.map(x=>({name:'sofa',x,dy:CAT_SOFA_DY})).concat(FUN_POI.beanbag.seats.map(x=>({name:'beanbag',x,dy:CAT_BEANBAG_DY})));
// Mèo chọn bàn người đang chờ (không phải Master: bàn Master rộng, hai màn hình) hay chỗ trống trên sofa, ghế lười
// (chỗ người đi chơi đang ngồi thì thôi; người tới ngồi sau thì mèo nằm trong lòng)
// Đường lên mặt bàn của người ở chỗ s: mặt bàn bên trái màn hình; vào từ lối dọc gần hơn (XL bên trái, XR trên thảm đỏ),
// đi dọc mép bàn (không băng qua biển tên); ra theo đường cũ
function catDeskPlan(s){
 const px=s.x-CAT_DESK_DX,py=s.y+CAT_DESK_DY,side=px-XL<=XR-px?XL:XR,entry=nodeAt(side,py),e=G.get(entry);
 return{desk:true,key:s.key,sx:s.x,sy:s.y,entry,inPath:[{x:side,y:py},{x:px,y:py}],outPath:[{x:side,y:py},{x:e.x,y:e.y}]}}
// Đường lên sofa, ghế lười st ({name,x,dy}): theo lối dưới cùng tới ngay dưới ghế rồi nhảy lên; xuống thì nhảy ngược lại
function catSeatPlan(st){
 const laneB=FUN.loungeY+FUN_LOUNGE_DY,entry=nodeAt(st.x,laneB),e=G.get(entry);
 return{desk:false,seat:st,entry,inPath:[{x:st.x,y:laneB-st.dy,hop:true}],outPath:[{x:e.x,y:e.y,hop:true}]}}
// Chỉ cần còn chờ: người được quản đốc nhắc (mượn hình một chút) hay vươn vai vẫn ngồi đó
const perchDeskOk=s=>!!s&&s.zone==='desk'&&s.pose==='wait';
function catPerchStart(){
 const c=CRIT.cat;
 if(!c||c.mode!=='roam'||c.pet>0)return false;
 const desks=[...FUN.spots.values()].filter(s=>perchDeskOk(s)&&s.role!=='master'&&!FUN.hide.has(s.key));
 const taken=p=>[...FUN.actors].some(a=>a.seat&&a.seat.name===p.name&&a.seat.x===p.x);
 const seats=FUN.loungeY?perchSeats().filter(p=>!taken(p)):[];
 let p=null;
 if(desks.length&&(!seats.length||Math.random()<CAT_DESK_CHANCE))p=catDeskPlan(funPick(desks));
 else if(seats.length)p=catSeatPlan(funPick(seats));
 if(!p)return false;
 Object.assign(p,{phase:'path',t:0,stay:0,nap:false,talked:false,fast:false});
 c.mode='perch';c.perch=p;c.free=[];goTo(c,p.entry);
 return true}
// path: rảo bước theo lối tới lối dọc / dưới ghế; in: đi dọc mép bàn hay nhảy lên; sit: ngồi (có khi cuộn tròn ngủ); out: về
// lối. Người trên bàn hết chờ thì mèo thôi; chỗ ngồi dời (thêm, bớt người cùng dãy) lúc đang tới thì đi tới chỗ mới
function catPerch(c,k){
 const p=c.perch,s=p.desk?FUN.spots.get(p.key):null,ok=!p.desk||perchDeskOk(s);
 const moved=p.desk&&ok&&(s.x!==p.sx||s.y!==p.sy);
 c.spd=p.fast?CAT_FLEE_SPD:p.phase==='path'?CAT_TROT_SPD:p.desk?CAT_DESK_SPD:CAT_HOP_SPD;
 if(p.phase==='path'){
  if(!ok){catPerchEnd(c);return}
  if(moved){const q=catDeskPlan(s);Object.assign(p,q);goTo(c,p.entry)}
  if(move(c,k)){p.phase='in';c.free=p.inPath.map(q=>({...q}))}
  return}
 if(p.phase==='in'){
  // dời trong cùng hàng: chỉ đổi điểm đến; dời sang hàng khác thì quay ra
  if(!ok||moved&&s.y!==p.sy){catPerchOut(c,false);return}
  if(moved){p.sx=s.x;c.free[c.free.length-1].x=s.x-CAT_DESK_DX}
  if(moveFree(c,k)){p.phase='sit';p.t=0;p.stay=CAT_PERCH_TICKS+Math.random()*CAT_PERCH_VAR;p.nap=Math.random()<CAT_NAP_CHANCE;
   c.dir=p.desk?1:Math.random()<.5?-1:1;say(c,'Meo~',CAT_MEOW_TICKS)}
  return}
 if(p.phase==='sit'){
  p.t+=k;
  if(!ok||moved||p.t>=p.stay){catPerchOut(c,false);return}
  if(p.desk&&catStartled(c)){catPerchOut(c,true);return}
  if(p.desk&&!p.talked&&p.t>=CAT_TALK_TICKS){p.talked=true;funSay(s.x+PERCH_TALK_DX,s.y-FUN_DESK_TALK_DY,funPick(PERCH_LINES),FUN_SAY_MS)}
  return}
 if(moveFree(c,k))catPerchEnd(c)}
function catPerchOut(c,fast){const p=c.perch;p.phase='out';p.fast=fast;c.free=p.outPath.map(q=>({...q}))}
function catPerchEnd(c){c.perch=null;c.free=[];c.mode='roam';c.wait=CAT_AFTER_PERCH}
// Quản đốc quất roi ("TÁCH!" của FM.burst) trúng chỗ mèo ngồi: mèo giật mình nhảy lên rồi chạy khỏi bàn
function catStartled(c){
 const b=FM.burst;if(!b)return false;
 const hit=b.x<c.x+CAT_HALF_W&&c.x-CAT_HALF_W<b.x+b.w&&b.y<c.y&&c.y-CAT_H<b.y+b.h;
 if(hit){c.jump=12;say(c,'!',12)}
 return hit}
// Giữ chỗ lúc bố cục đổi: chó ở ngoài lối gần cây nước (dải trên cùng không bao giờ dời), mèo đang ngồi trên bàn, sofa
const petKeepsPlace=a=>!!(a.visit&&a.visit.phase!=='path'||a.perch&&a.perch.phase==='sit');
// Kế hoạch mới cho chỗ mèo trèo sau khi bố cục đổi (bàn, góc nghỉ dời); null nếu người trên bàn đã hết chờ
function catPerchReplan(p){
 if(!p.desk)return Object.assign(p,catSeatPlan(p.seat));
 const s=FUN.spots.get(p.key);return perchDeskOk(s)?Object.assign(p,catDeskPlan(s)):null}
// setGraph() khi bố cục đổi: các con khác đã về điểm gần nhất trên lối mới và chuyển sang đi dạo. Chó đang trên đường tới
// cây nước thì tìm đường lại; mèo đang ngồi thì ngồi theo bàn, ghế tới chỗ mới (bàn hết chờ thì xuống lối), đang trên đường
// tới thì đi lại từ chỗ mới, đang về thì thôi. Bóng đang lăn, nằm chờ thì lăn tới điểm gần nhất của lối mới; chó đang tha
// bóng thì mang tiếp về bàn bạn
function petRelayout(){
 const d=CRIT.dog,c=CRIT.cat;
 if(d.visit&&d.visit.phase==='path'){d.mode='visit';goTo(d,BASE_X0+','+BASE_Y)}
 const p=c.perch;
 if(p){
  const q=p.phase==='out'?null:catPerchReplan(p);
  c.free=[];c.hopLift=0;
  if(!q){c.perch=null;if(p.phase==='sit'){const n=G.get(nodeAt(c.x,c.y));c.x=n.x;c.y=n.y;c.path=[];c.mode='roam';c.wait=10}}
  else if(q.phase==='sit'){const at=q.inPath[q.inPath.length-1];c.x=at.x;c.y=at.y}
  else{q.phase='path';c.mode='perch';goTo(c,q.entry)}}
 if(FETCH.st==='fly')fetchAim(FETCH.tx,FETCH.ty);
 // chó còn ở cây nước: dogVisitEnd cho chạy nhặt khi về tới lối
 else if(FETCH.st==='roll'||FETCH.st==='wait'){fetchAim(FETCH.x,FETCH.y);FETCH.st='roll';if(!d.visit){d.mode='fetch';goTo(d,FETCH.node)}}
 else if(FETCH.st==='carry'){d.mode='bring';goTo(d,SPOT)}}

/* ----- máy bay giấy, máy cà phê bốc khói (lớp #fun) ----- */
const planeArt=()=>P('M7 0 L-6 -4.6 L-2.4 0 Z','#ffffff',K(.6))+P('M7 0 L-2.4 0 L-5 3.4 Z','#d5dbe6',K(.6));
function playPlane(){if(funMotion()&&!PLAY.planes.length&&Math.random()<PLANE_CHANCE)planeLaunch()}
// Hai người cùng dãy bàn, không đang chạy việc (đang gõ thì không rảnh phóng máy bay), không đi vắng
function planeLaunch(){
 const ok=s=>s.zone==='desk'&&s.pose!=='ghost'&&s.kind!=='run'&&!FUN.hide.has(s.key)&&arriving(s.id)==null;
 const desk=[...FUN.spots.values()].filter(ok),pairs=[];
 desk.forEach(a=>desk.forEach(b=>{if(a.id!==b.id&&a.dir===b.dir&&Math.abs(a.x-b.x)>=PLANE_MIN_DX)pairs.push([a,b])}));
 const pr=funPick(pairs);if(!pr)return false;
 const [a,b]=pr,ay=a.y+PLANE_HEAD_DY,by=b.y+PLANE_HEAD_DY;
 const g=document.createElementNS(SVGNS,'g');g.innerHTML=planeArt();$('#funFly').appendChild(g);
 const p={g,ax:a.x,ay,bx:b.x,by,cx:(a.x+b.x)/2,cy:Math.min(ay,by)-PLANE_ARC,t:0,to:b.key,
  dur:Math.max(PLANE_MIN_MS,Math.min(PLANE_MAX_MS,Math.hypot(b.x-a.x,by-ay)*PLANE_MS_PER))};
 PLAY.planes.push(p);planeMove(p,0);
 funSay(a.x,a.y-FUN_DESK_TALK_DY,'Ê! ✈️',FUN_SAY_MS);
 return true}
function planeMove(p,dt){
 p.t+=dt;const u=Math.min(1,p.t/p.dur),v=1-u;
 const x=v*v*p.ax+2*v*u*p.cx+u*u*p.bx,y=v*v*p.ay+2*v*u*p.cy+u*u*p.by,tx=2*v*(p.cx-p.ax)+2*u*(p.bx-p.cx),ty=2*v*(p.cy-p.ay)+2*u*(p.by-p.cy);
 // bay sang trái thì lật dọc để cánh trắng vẫn ở trên
 p.g.setAttribute('transform','translate('+x.toFixed(1)+','+y.toFixed(1)+') rotate('+(Math.atan2(ty,tx)*180/Math.PI).toFixed(0)+')'+(tx<0?' scale(1,-1)':''));
 if(u<1)return;
 p.g.remove();PLAY.planes=PLAY.planes.filter(q=>q!==p);
 const w=funSpotTalk(p.to,FUN_DESK_TALK_DY)();if(w)funSay(w.x,w.y,funPick(PLANE_LINES),FUN_SAY_MS)}
function steamFrame(){
 const busy=[...FUN.actors].some(a=>a.kind==='trip'&&a.staying&&a.seat&&a.seat.name==='coffee');
 if(busy===!!PLAY.steam)return;
 if(!busy){PLAY.steam.remove();PLAY.steam=null;return}
 // dùng lại hoạt hình .steam của cốc trên bàn (CSS chỉ chạy khi máy không đặt giảm chuyển động)
 const g=document.createElementNS(SVGNS,'g');g.setAttribute('class','steam');
 g.innerHTML=RR(COFFEE_STEAM_X-2.5,COFFEE_STEAM_Y,1.4,6,.7,'rgba(255,255,255,.85)')+RR(COFFEE_STEAM_X+1,COFFEE_STEAM_Y-3,1.4,6,.7,'rgba(255,255,255,.7)');
 $('#funDeco').appendChild(g);PLAY.steam=g}
function playFrame(dt){PLAY.planes.slice().forEach(p=>planeMove(p,dt));steamFrame()}
// Tắt nút "Hoạt hình vui": bỏ ngay máy bay, khói, tay, tim, bóng; chó mèo đang ở ngoài lối thì về lối theo đường cũ
// (không biến mất giữa chừng: chúng vẫn ở đó khi tắt nút)
function playClear(){
 PLAY.planes.forEach(p=>p.g.remove());PLAY.planes=[];
 if(PLAY.steam){PLAY.steam.remove();PLAY.steam=null}
 if(!CRIT.dog)return;
 Object.values(CRIT).forEach(a=>{a.pet=0;a.roll=false;a.hearts=0;petHandOff(a)});
 petLayer('over').replaceChildren();
 fetchReset();
 const d=CRIT.dog,c=CRIT.cat;
 if(d.visit&&d.visit.phase==='path')dogVisitEnd(d);
 else if(d.visit&&d.visit.phase!=='out')dogVisitOut(d);
 if(c.perch&&c.perch.phase==='path')catPerchEnd(c);
 else if(c.perch&&c.perch.phase!=='out')catPerchOut(c,false)}
funAddon({frame:playFrame,clear:playClear});
funEvery(PET_SOCIAL_EVERY_MS,petSocial);
funEvery(PLANE_EVERY_MS,playPlane);

/* ---------- các khu HTML ---------- */
function renderBadges(){
 const d=S.features.filter(f=>f.status==='done').length,g=S.features.filter(f=>f.status==='delivered').length,bf=$('#bFeat');
 bf.textContent=(S.features.length-d-g)+' TÍNH NĂNG ĐANG MỞ · '+(g?g+' CHỜ MERGE · ':'')+d+' XONG';
 bf.title='Số tính năng trong workflow/F-*. Đang mở gồm cả đang làm rõ và chờ bạn nghiệm thu; chờ merge là đã giao, chờ gộp vào nhánh chính';
 // Master chạy trong phiên chat, không bao giờ "đang chạy" theo watch.sh: không tính vào đây
 const wk=S.agents.filter(a=>a.role!=='master'),br=$('#bRun');
 br.textContent=wk.filter(a=>a.running).length+'/'+wk.length+' CODER·TESTER CHẠY';
 br.title='Coder, Tester đang chạy (watch.sh đánh thức hoặc Master gọi) trên tổng số khai trong agents.txt. Master không tính vào đây';
 const n=ownerWaits().total,bn=$('#bNeed');
 bn.textContent=n+' CHỜ BẠN';bn.className='badge'+(n?' warn':'');
 document.title=(n?'('+n+') Chờ bạn · ':'')+'Văn phòng agent';
 const w=S.watch||{state:'never'},bw=$('#bWatch');
 bw.textContent=w.state==='running'?'WATCH ✓':w.state==='dead'?'WATCH LỖI':'WATCH TẮT';
 bw.className='badge'+(w.state==='dead'?' off':w.state==='running'?'':' warn');
 bw.title=w.state==='running'?'watch.sh đang chạy, quét lần cuối '+hm(w.at)
  :w.state==='dead'?'watch.sh ngừng bất thường, nhịp cuối '+hm(w.at)+'. Chạy lại: sh workflow/watch.sh --restart'
  :'Chạy: sh workflow/watch.sh';
}
// Một mục trong "Cần bạn" cho file to: owner
function ownerItem(o){
 const a=ownerAction(o),box=el('div','ask');
 box.append(el('p','act',o.feature+' · '+a.act),el('p',null,o.title||o.file),el('p','muted',a.how));
 if(a.say){const p=el('p','say');p.append(document.createTextNode('Nói với Master: '),el('code',null,a.say));box.append(p)}
 (o.sections||[]).forEach(x=>{const k=o.path+'#'+x.title,d=el('details');
  d.open=OPEN.has(k)?OPEN.get(k):/cách thử/i.test(x.title); // mặc định mở mục "Cách thử"; nhớ lựa chọn của bạn
  d.addEventListener('toggle',()=>OPEN.set(k,d.open));
  d.append(el('summary',null,x.title),el('pre',null,x.text||'(trống)'));box.append(d)});
 return box;
}
// Khu "Cần bạn": khớp với số trên huy hiệu và băng rôn (file to: owner + Master chờ bạn chưa có file), cộng bất thường
function renderNeed(){
 const anom=S.anomalies||[],paused=S.agents.filter(a=>a.paused),ow=ownerWaits();
 const has=S.owner.length>0||ow.extra.length>0||anom.length>0||paused.length>0;
 const nb=$('#needBox');nb.classList.toggle('on',has);
 nb.hidden=S.hasWorkflow&&!has; // không có gì thì ẩn hẳn, huy hiệu "0 CHỜ BẠN" đã nói đủ
 const need=$('#need'),k=JSON.stringify([S.hasWorkflow,S.owner,ow.extra,anom,paused.map(a=>a.id)]);
 if(k===KEY_NEED||selIn(need))return;
 KEY_NEED=k;
 keepScroll(need,()=>{
  need.replaceChildren();
  if(anom.length||paused.length){const box=el('div','ask');
   box.append(el('p','act','Bất thường ('+(anom.length+paused.length)+')'),el('p','muted','watch.sh phát hiện. Nói với Master: "Xử lý việc đang chờ", hoặc tự xem file.'));
   paused.forEach(a=>{const p=el('p',null,a.id+' đang tạm dừng vì bị đánh thức quá nhiều lần. Xem log, rồi chạy: ');p.append(el('code',null,'sh workflow/watch.sh --resume '+a.id));box.append(p)});
   anom.forEach(t=>box.append(el('p',null,'• '+t)));need.append(box)}
  if(!S.hasWorkflow){need.append(el('p','muted','Không thấy thư mục workflow/. Hãy chạy monitor tại thư mục dự án.'));return}
  S.owner.forEach(o=>need.append(ownerItem(o)));
  ow.extra.forEach(m=>{const box=el('div','ask');
   box.append(el('p','act',m.id+' · Master đang chờ bạn'),el('p',null,m.text),el('p','muted','Trả lời trong phiên chat của '+m.id+' ('+hm(m.at)+')'));
   need.append(box)});
 });
}
function renderFiles(){
 const files=$('#files'),k=JSON.stringify(S.features);
 if(k===KEY_FILES||selIn(files))return;
 KEY_FILES=k;
 files.replaceChildren();
 S.features.forEach(f=>{const d=el('details');const k='feat:'+f.dir;
  d.open=OPEN.get(k)===true; // giữ nguyên khung bạn đang mở
  d.addEventListener('toggle',()=>OPEN.set(k,d.open));
  const sm=el('summary');const sq=el('span','sq');sq.style.background=FEAT_COLOR.get(f.dir);sm.append(sq,f.id+' · '+f.title+' · '+stOf(f)+' ('+f.items.length+' file)');d.append(sm);
  const t=el('table');f.items.forEach(it=>{const tr=el('tr');const td=el('td');td.append(el('code',null,it.file));tr.append(td,el('td',null,it.title),el('td',null,stOf(it)),el('td',null,'→ '+(it.to==='owner'?'bạn':it.to==='none'?'không ai':it.to)));t.append(tr)});d.append(t);files.append(d)});
 if(!S.features.length)files.append(el('p','muted','Chưa có.'));
}
function render(){
 $('#proj').textContent='VĂN PHÒNG AGENT · '+S.project;
 paintFeatures();
 renderBadges();
 banner();
 renderNeed();
 build();
 renderFiles();
 if(openId)showDetail();
}
// Một dòng to nói rõ ai đang cầm lượt: chủ dự án (đỏ) hay agent nào (xanh), Master nào đang mở, watch.sh còn chạy không
function watchLine(active){
 const w=S.watch||{state:'never'};
 if(w.state==='dead')return '⚠ watch.sh ngừng bất thường (nhịp tim cuối '+hm(w.at)+'): không báo Telegram, không đánh thức agent auto/window. Chạy lại: sh workflow/watch.sh --restart';
 if(w.state!=='running'&&active)return '⚠ watch.sh không chạy'+(w.state==='stopped'?' (dừng lúc '+hm(w.at)+(w.reason?', '+w.reason:'')+')':'')+': không báo Telegram, không đánh thức agent auto/window. Chạy: sh workflow/watch.sh';
 return '';
}
function masterLine(m){const old=Date.now()-m.at>STALE_NOW_MS;
 return 'MASTER '+m.id+': '+m.text+(old?' (không đổi từ '+whenOf(m.at)+', phiên có thể đã đóng)':' ('+hm(m.at)+')')}
const MAX_TURN_LINES=3; // băng rôn xanh chỉ liệt kê vài lượt, còn lại gập lại (bàn trong văn phòng đã hiện đủ)
function banner(){
 const b=$('#banner');
 // đang bôi đen lệnh trong băng rôn (để chép): giữ nguyên, lần làm mới sau sẽ vẽ lại
 if(selIn(b))return;
 // dựng lại băng rôn làm mất tiêu điểm trên "+N lượt khác": nhớ để trả lại
 const ae=document.activeElement,refocusSum=!!ae&&b.contains(ae)&&ae.tagName==='SUMMARY';
 b.replaceChildren();b.className='pix banner';
 const ms=S.masters||[],ow=ownerWaits(),act=S.features.filter(f=>f.status!=='done'&&f.status!=='delivered');
 const wl=watchLine(act.length>0||ms.length>0);
 const paused=S.agents.filter(a=>a.paused);
 const pausedLines=()=>paused.forEach(a=>b.append(el('p','small alert','⏸ '+a.id+' tạm dừng: sh workflow/watch.sh --resume '+a.id)));
 const turns=[];act.forEach(f=>f.items.forEach(it=>{if(it.to&&it.to!=='none'&&it.to!=='owner')turns.push({f,it})}));
 const run=S.agents.filter(a=>a.running);
 if(ow.total){
  b.classList.add('owner');b.append(el('p',null,'ĐANG CHỜ BẠN ('+ow.total+')'));
  S.owner.forEach(o=>{const a=ownerAction(o);b.append(el('p','small','▶ '+o.feature+' · '+a.act+(a.say?' → nói với Master: "'+a.say+'"':'')))});
  ow.extra.forEach(m=>b.append(el('p','small','▶ '+m.id+': '+m.text+' (trả lời trong phiên chat của '+m.id+')')));
  // Master chờ bạn về tính năng đã có file ở trên: hiện một dòng để biết, không đếm thêm
  ms.filter(m=>!m.waitOwner||ow.dup.includes(m)).forEach(m=>b.append(el('p','small',masterLine(m))));
  pausedLines();
  if(wl)b.append(el('p','small alert',wl));
  // bôi đen để chép lệnh thì không tính là bấm (không cuộn đi mất)
  b.setAttribute('role','button');b.tabIndex=0;b.onclick=()=>{if(!selIn(b))toNeed()};b.onkeydown=onActivate(toNeed);
  b.hidden=false;return}
 // băng rôn chỉ là nút khi bấm được (đỏ: tới mục Cần bạn); băng xanh chỉ để đọc. Chỉ gỡ ở đây, không gỡ rồi gắn lại mỗi
 // lần làm mới: gỡ tabindex thì trình duyệt bỏ tiêu điểm khỏi băng rôn, người dùng bàn phím bị đẩy về đầu trang
 b.removeAttribute('role');b.removeAttribute('tabindex');b.onclick=null;b.onkeydown=null;
 if(!turns.length&&!run.length&&!ms.length&&!wl&&!paused.length){b.hidden=true;return}
 b.classList.add('flow');
 b.append(el('p',null,run.length?'ĐANG CHẠY: '+run.map(a=>a.id+(a.sub?' ('+a.sub+', Master gọi)':'')).join(' · '):ms.length?'MASTER ĐANG LÀM':'KHÔNG AI ĐANG CHẠY'));
 ms.forEach(m=>b.append(el('p','small',masterLine(m))));
 const by={};turns.forEach(x=>{(by[x.it.to]=by[x.it.to]||[]).push(x.f.id+' '+x.it.file)});
 // Chỗ có vấn đề trước (không ai đánh thức được, rồi chờ đánh thức), agent đang chạy sau cùng
 const rank=a=>!a?0:a.running?2:1;
 const lines=Object.keys(by).map(id=>{const a=S.agents.find(z=>z.id===id);
  const how=!a?'không có trong agents.txt, không ai đánh thức được':a.running?'đang làm':a.mode==='subagent'?'chờ Master gọi':((Object.hasOwn(MODE_WAIT,a.mode)&&MODE_WAIT[a.mode])||'chờ đánh thức').toLowerCase();
  return{r:rank(a),t:'Lượt của '+id+' ('+how+'): '+by[id].join(', ')}}).sort((p,q)=>p.r-q.r);
 lines.slice(0,MAX_TURN_LINES).forEach(x=>b.append(el('p','small',x.t)));
 if(lines.length>MAX_TURN_LINES){const d=el('details','small');d.open=OPEN.get('banner:turns')===true;
  d.addEventListener('toggle',()=>OPEN.set('banner:turns',d.open));
  d.append(el('summary',null,'+'+(lines.length-MAX_TURN_LINES)+' lượt khác'));
  lines.slice(MAX_TURN_LINES).forEach(x=>d.append(el('p',null,x.t)));b.append(d)}
 pausedLines();
 if(wl)b.append(el('p','small alert',wl));
 b.hidden=false;
 if(refocusSum){const sm=b.querySelector('summary');if(sm)sm.focus({preventScroll:true})}
}
function closeDetail(){
 const id=openId,key=openKey;openId=null;openKey=null;KEY_DETAIL='';$('#detail').style.display='none';build();
 const g=findAg($('#office'),key,id);if(g)g.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openId)closeDetail()});
// Trạng thái chạy của agent trong bảng chi tiết. Master chạy trong phiên chat: lấy dòng .now
function runLine(a){
 if(a.paused)return 'Tạm dừng (đánh thức quá nhiều lần): sh workflow/watch.sh --resume '+a.id;
 if(a.running)return a.sub?'Đang chạy: Master gọi subagent ('+a.sub+')':'Đang chạy';
 if(a.now)return masterLine({id:a.id,text:a.now,at:a.nowAt}).replace(/^MASTER \S+: /,'');
 return 'Không chạy';
}
function showDetail(){
 const d=$('#detail');const a=S.agents.find(x=>x.id===openId);d.style.display='block';
 // làm mới 3 giây: dữ liệu không đổi hay bạn đang bôi đen chữ thì giữ nguyên bảng (giữ tiêu điểm, vị trí cuộn)
 const k=JSON.stringify([openId,a||null]);
 if(k===KEY_DETAIL||selIn(d))return;
 KEY_DETAIL=k;
 // dựng lại bảng xoá nút Đóng hay tiêu đề đang giữ tiêu điểm: nhớ để trả lại, kẻo Tab phải đi lại từ đầu trang
 const ae=document.activeElement,refocus=d.contains(ae)?(ae.tagName==='BUTTON'?'button':'#detailTitle'):null;
 keepScroll(d,()=>{
  d.replaceChildren();
  const close=el('button',null,'Đóng');close.setAttribute('aria-label','Đóng chi tiết');close.onclick=closeDetail;
  const h=el('h2',null,openId);h.id='detailTitle';h.tabIndex=-1;d.append(close,h);
  if(!a){d.append(el('p',null,'Agent này được nhắc trong file nhưng chưa có trong workflow/agents.txt, nên watch.sh không đánh thức được.'));return}
  d.append(el('p',null,a.role+' · '+((Object.hasOwn(MODE_NAME,a.mode)&&MODE_NAME[a.mode])||'đánh thức tay')+(a.note?' · '+a.note:'')),el('p',a.nowWait?'act':null,runLine(a)));
  d.append(el('h2',null,'File đang chờ'));
  if(a.pending.length){const ul=el('ul');a.pending.forEach(p=>{const li=el('li');li.append(el('code',null,p));ul.append(li)});d.append(ul)}else d.append(el('p','muted','Không có.'));
  if(a.hist&&a.hist.length){d.append(el('h2',null,'Các lần chạy gần đây'));const ul=el('ul');
   a.hist.forEach(h=>{const li=el('li');li.append(el('code',null,(h.start||'').replace('T',' ')+' → '+((h.end||'').split('T')[1]||h.end)),document.createTextNode(' '+h.what));ul.append(li)});d.append(ul)}
  d.append(el('h2',null,'Log gần nhất'));
  if(a.lastLog)d.append(el('p','muted',a.lastLog.name+(a.lastLog.mtime?' · '+new Date(a.lastLog.mtime).toLocaleString('vi-VN',{hour12:false}):'')),el('pre',null,a.lastLog.tail||'(trống)'));
  else d.append(el('p','muted',a.role==='master'?'Master chạy trong phiên chat, không có log của watch.sh.':'Chưa có log (agent subagent hoặc đánh thức tay, hoặc chưa được đánh thức lần nào).'));
 });
 if(refocus){const n=d.querySelector(refocus);if(n)n.focus({preventScroll:true})}
}
// Mất kết nối hay máy chủ lỗi: làm xám cả trang (trừ dòng trên cùng) và đổi tiêu đề tab, để không tưởng số liệu cũ là mới.
// Máy chủ treo (monitor bị Ctrl+Z, máy ngủ) không trả lời cũng không báo lỗi: quá POLL_TIMEOUT_MS thì coi là mất kết nối,
// và không gửi yêu cầu mới khi yêu cầu trước chưa xong (kẻo chồng chất)
const POLL_TIMEOUT_MS=5000;
let lastOk=null,polling=false;
async function poll(){
 if(polling)return;
 polling=true;
 const c=$('#bConn');
 try{
  const r=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout&&AbortSignal.timeout(POLL_TIMEOUT_MS)});
  if(!r.ok)throw new Error('LỖI MÁY CHỦ '+r.status+': '+(await r.text()).slice(0,120));
  S=await r.json();lastOk=Date.now();
 }catch(e){
  const server=/^LỖI MÁY CHỦ/.test(e.message);
  c.textContent=(server?'LỖI MÁY CHỦ':'MẤT KẾT NỐI')+(lastOk?' · số liệu lúc '+hms(lastOk):'');
  c.className='badge off';c.title=e.message;
  document.body.classList.add('stale');
  document.title='⚠ '+(server?'Lỗi máy chủ':'Mất kết nối')+' · Văn phòng agent';
  return;
 }finally{polling=false}
 c.textContent='CẬP NHẬT '+hms(lastOk);c.className='badge';c.title='';
 document.body.classList.remove('stale');
 // vẽ ngoài try: lỗi của trang hiện ra console với đủ vết, không bị báo nhầm thành "MẤT KẾT NỐI"
 render();
}
poll();setInterval(poll,3000);
</script></body></html>`;
