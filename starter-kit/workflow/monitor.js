#!/usr/bin/env node
// monitor.js: trang theo dõi local dạng văn phòng pixel (mỗi tính năng một dãy bàn). Chỉ đọc.
//
// Chạy:   node workflow/monitor.js              rồi mở http://localhost:4300
//         node workflow/monitor.js --port 5000
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

let port = 4300;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--port') port = Number(argv[++i]);
  else { console.error('Tham số không hiểu: ' + argv[i]); process.exit(1); }
}

let ROOT;
try { ROOT = cp.execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
catch { ROOT = process.cwd(); }
const W = path.join(ROOT, 'workflow');

// ---------- Đọc dữ liệu ----------
function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (!/^---/.test(lines[0] || '')) return {};
  const o = {};
  for (let i = 1; i < lines.length; i++) {
    if (/^---/.test(lines[i])) break;
    const m = lines[i].match(/^([A-Za-z_]+):(.*)$/);
    if (m) o[m[1]] = m[2].replace(/#.*/, '').trim();
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

function state() {
  const agents = readAgents();
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));
  for (const a of agents) {
    const lg = lastLog(a.id);
    a.running = !!(lg && !lg.finished && fs.existsSync(path.join(W, '.run', a.id + '.pid')));
    a.lastLog = lg; a.pending = []; a.features = [];
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
    project: path.basename(ROOT), now: new Date().toISOString(),
    hasWorkflow: isDir(W), agents, features, owner, unknown: [...unknown],
  };
}

// ---------- Máy chủ ----------
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
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
server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Cổng ${port} đang được dùng. Thử: node workflow/monitor.js --port ${port + 1}` : e.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Monitor: http://localhost:${port}   (đọc ${W})`);
  console.log('Ctrl+C để dừng.');
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
.need.on{background:var(--waitbg);border-color:var(--wait);box-shadow:4px 4px 0 var(--wait)}
.need.on h2{color:var(--wait)}
.ask{border-top:2px dashed var(--line);padding:10px 0 4px}.ask:first-of-type{border-top:0;padding-top:0}
.ask .act{font-weight:700;font-size:16px;margin:0 0 2px}
.ask p{margin:2px 0}.ask .say code{background:var(--paper);border:1px solid var(--line);padding:1px 6px;font-size:14px}
.ask details{margin-top:6px}.ask pre{white-space:pre-wrap;font:13px/1.5 ui-monospace,Consolas,monospace;background:var(--paper);border:1px solid var(--line);padding:8px 10px;margin:4px 0 0;max-height:360px;overflow:auto}
.muted{color:var(--fg2);font-size:13px;margin:0}
.scene{padding:6px;background:#2a211b}
#office{display:block;width:100%;height:auto;image-rendering:pixelated;shape-rendering:crispEdges}
#office text{shape-rendering:auto;font-family:ui-monospace,Consolas,monospace;font-weight:700}
#office .ag{cursor:pointer}
#office .ag:focus{outline:none}
#office .ag .sel{display:none}#office .ag.on .sel,#office .ag:focus-visible .sel{display:inline}
@media (prefers-reduced-motion:no-preference){
 .typing{animation:tp .5s steps(2) infinite}@keyframes tp{50%{transform:translateY(-1px)}}
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
<span class="badge" id="bFeat"></span><span class="badge" id="bRun"></span><span class="badge warn" id="bNeed"></span><span class="badge" id="bConn">…</span></header>
<section class="pix need" id="needBox"><h2>Cần bạn</h2><div id="need"></div></section>
<section class="pix scene" aria-label="Văn phòng: mỗi tính năng một dãy bàn">
<svg id="office" role="img" aria-label="Văn phòng agent"></svg>
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
const MODE_NAME={auto:'đánh thức tự động',manual:'đánh thức tay',subagent:'subagent, Master tự gọi'};
const MODE_WAIT={auto:'Có việc, chờ watch.sh đánh thức',manual:'Có việc, cần mở phiên tay',subagent:'Có việc, chờ Master gọi'};
const ST={draft:'chờ bạn duyệt',review:'đang khảo sát',reviewed:'đã khảo sát',in_dev:'đang làm',ready:'sẵn sàng làm',in_test:'đang kiểm tra',verified:'kiểm tra đạt',reopened:'phải sửa lại',acceptance:'chờ bạn nghiệm thu',done:'xong',open:'đang mở',answered:'đã trả lời',closed:'đã đóng',fixed:'đã sửa'};
const stVi=x=>ST[x]||x||'?';
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
function defs(){return '<defs>'
 +'<pattern id="wd" width="2" height="2" patternUnits="userSpaceOnUse">'+R(0,0,2,2,'#a9b3c6')+R(0,0,1,1,'#8e99b0')+R(1,1,1,1,'#8e99b0')+'</pattern>'
 +'<pattern id="fl" width="32" height="12" patternUnits="userSpaceOnUse">'+R(0,0,32,12,'#e4a467')+R(0,5,32,1,'#c27b42')+R(0,11,32,1,'#c27b42')+R(0,0,1,5,'#c27b42')+R(16,0,1,5,'#c27b42')+R(8,6,1,5,'#c27b42')+R(24,6,1,5,'#c27b42')+R(3,1,4,1,'#eeb67f')+R(19,2,5,1,'#eeb67f')+R(11,7,5,1,'#eeb67f')+R(27,8,3,1,'#eeb67f')+'</pattern></defs>'}
function shelf(x){let s=R(x-1,13,24,43,'#6e3a20')+R(x,14,22,41,'#f1dcae')+R(x,14,22,3,'#e3c891');const b=['#3f8f4a','#c23b3b','#2f5fb3','#7a3fa0','#e0a12b'];
 [19,30].forEach((y,r)=>{s+=R(x+2,y,18,9,'#4a2a18');for(let i=0;i<6;i++)s+=R(x+3+i*3,y+1+(i%3===1?1:0),2,8-(i%3===1?1:0),b[(i+r*2)%b.length])});
 return s+R(x+2,41,18,12,'#dcb072')+R(x+10,41,1,12,'#b98a4f')}
function monitor(x,y,on,c){let s=R(x,y,16,11,'#3a3d4a')+R(x+1,y+1,14,8,on?'#251f3a':'#15171d')+R(x+7,y+11,2,2,'#3a3d4a')+R(x+5,y+13,6,1,'#3a3d4a');
 if(on)s+=R(x+2,y+2,6,1,c)+R(x+3,y+4,8,1,'#55d27a')+R(x+2,y+6,4,1,'#e05a5a')+R(x+7,y+6,5,1,c);return s}
function desk(x,y,w){return R(x,y,w,9,'#efd9a9')+R(x,y,w,1,'#fbecc8')+R(x,y+8,w,1,'#c9a46a')+R(x+1,y+9,2,6,'#b98a4f')+R(x+w-3,y+9,2,6,'#b98a4f')}
function seated(cx,y,hair,shirt,typing){return '<g class="'+(typing?'typing':'')+'">'+R(cx-5,y+5,10,6,shirt)+R(cx-5,y+5,10,1,'rgba(255,255,255,.25)')+R(cx-6,y+7,1,3,shirt)+R(cx+5,y+7,1,3,shirt)+R(cx-3,y,6,6,hair)+R(cx-3,y,6,1,'rgba(255,255,255,.18)')+'</g>'}
function chair(cx,y){return R(cx-6,y,12,10,'#4f5669')+R(cx-6,y,12,1,'#6c7488')+R(cx-1,y+10,2,2,'#363b48')+R(cx-4,y+12,8,1,'#363b48')}
function standing(cx,y,hair,shirt){return R(cx-3,y,6,2,hair)+R(cx-3,y+2,6,4,'#f0c29a')+R(cx-2,y+3,1,1,'#2b2b2b')+R(cx+1,y+3,1,1,'#2b2b2b')+R(cx-4,y+6,8,6,shirt)+R(cx-5,y+7,1,4,'#f0c29a')+R(cx+4,y+7,1,4,'#f0c29a')+R(cx-3,y+12,2,4,'#3a3f5c')+R(cx+1,y+12,2,4,'#3a3f5c')}
function bubble(cx,y,txt,kind){
 const col={run:['#ffffff','#1f7a4d'],wait:['#fff6dc','#9a5a00'],idle:['#efe9df','#8a8278'],bad:['#ffe6e3','#b23030']}[kind];
 const w=Math.max(9,txt.length*2.7+5),x=Math.round(cx-w/2);
 return '<g class="'+(kind==='wait'||kind==='bad'?'blink':'')+'">'+R(x-1,y-1,w+2,9,'#3b2a20')+R(x,y,w,7,col[0])+R(cx-1,y+7,3,1,'#3b2a20')+T(cx,y+5.3,4.6,col[1],txt)+'</g>'}
function nameTag(cx,y,t){return R(cx-t.length*1.25-2,y-4,t.length*2.5+4,5.5,'rgba(43,33,27,.78)')+T(cx,y,4,'#fff6e6',t)}
function selBox(x,y,w,h){return '<g class="sel">'+R(x,y,w,1,'#ffe066')+R(x,y+h,w,1,'#ffe066')+R(x,y,1,h,'#ffe066')+R(x+w,y,1,h+1,'#ffe066')+'</g>'}

/* ---------- trạng thái một agent trong một tính năng ---------- */
function stateOf(a,dir){
 if(!a)return{kind:'bad',txt:'?',label:'Chưa khai báo trong agents.txt',on:false};
 const here=a.pending.filter(p=>p.indexOf(dir+'/')===0).length;
 if(a.running)return{kind:'run',txt:'…',label:'Đang chạy',on:true};
 if(here)return{kind:'wait',txt:String(here),label:MODE_WAIT[a.mode]||'Có việc, cần mở phiên tay',on:true};
 return{kind:'idle',txt:'z',label:'Rảnh',on:false};
}

/* ---------- dựng cảnh ---------- */
const CW=0.57; // độ rộng một ký tự monospace so với cỡ chữ (Consolas khoảng 0.55)
const cut=(t,n)=>t.length>n?t.slice(0,Math.max(1,n-1))+'…':t;
const W=320, COL0=66, STEP=50, PER_ROW=5, ROW_H=58, HEAD=13;
function build(){
 const byId=Object.fromEntries(S.agents.map(a=>[a.id,a]));
 // tính năng đã xong rời văn phòng (chỉ còn trên bảng trắng); màu giữ theo thứ tự gốc
 const blocks=S.features.map((f,i)=>[f,i]).filter(([f])=>f.status!=='done').map(([f,i])=>{
  const ms=f.members.filter(m=>m===f.master);
  const others=f.members.filter(m=>m!==f.master).sort((a,b)=>{const ra=(byId[a]||{}).role||'',rb=(byId[b]||{}).role||'';return ra===rb?a.localeCompare(b):(ra==='coder'?-1:rb==='coder'?1:ra.localeCompare(rb))});
  const rows=Math.max(1,Math.ceil(others.length/PER_ROW));
  return{f,color:COLORS[i%COLORS.length],master:ms[0]||f.master||'',others,rows,h:HEAD+rows*ROW_H+4};
 });
 const busy=new Set(blocks.flatMap(b=>[b.master,...b.others]));
 const free=S.agents.filter(a=>!busy.has(a.id));
 const done=S.features.filter(f=>f.status==='done');
 const top=60;let H=top+blocks.reduce((s,b)=>s+b.h+6,0)+4;if(!blocks.length)H=top+50;
 let s=defs();
 // tường
 s+=R(0,0,W,H,'url(#fl)')+R(0,0,W,56,'#c4cedd')+R(0,25,W,1,'#97a3b8')+R(0,26,W,28,'url(#wd)')+R(0,54,W,3,'#a85a32')+R(0,57,W,1,'#7a3d20');
 s+=shelf(8)+R(122,17,11,11,'#5b4a40')+R(123,18,9,9,'#ffffff')+R(127,19,1,4,'#c23b3b')+R(127,22,3,1,'#c23b3b');
 // cửa: mở và có dấu ! khi có việc chờ chủ dự án
 const need=S.owner.length;
 s+=R(141,9,32,48,'#6e3a20')+(need?R(144,12,26,45,'#2c201a')+R(144,12,4,45,'#c06a3a')+bubble(157,30,'!'+need,'bad'):R(144,12,26,45,'#c06a3a')+R(148,17,18,11,'#d98b55')+R(148,32,18,11,'#d98b55')+R(166,35,2,2,'#f0d07a'));
 // bảng trắng: các tính năng
 s+=R(182,6,74,46,'#6e4a30')+R(184,8,70,42,'#f8f8f2')+T(219,13.5,4,'#3b2a20','CÁC TÍNH NĂNG');
 // mỗi tính năng 2 dòng: tên, rồi trạng thái; tối đa 4 tính năng
 const board=blocks.map(b=>({f:b.f,color:b.color})).concat(done.slice().reverse().map(f=>({f,color:'#b9b0a3'})));
 board.slice(0,4).forEach((b,i)=>{const y=16+i*8.5;
  s+=R(187,y,3,3,b.color)+T(192,y+2.8,3.4,'#3b2a20',cut(b.f.id+' '+b.f.title,Math.floor(60/(CW*3.4))),'start')+T(192,y+6.6,3.1,b.f.to==='owner'?'#b23030':'#6b5c4e',stVi(b.f.status),'start')});
 if(board.length>4)s+=T(252,49,3,'#6b5c4e','+'+(board.length-4)+' nữa','end');
 if(!board.length)s+=T(219,30,3.6,'#6b5c4e','(chưa có)');
 // cây nước + agent rảnh đứng quanh
 s+=R(298,22,12,15,'#7fc6ea')+R(300,24,2,10,'#c9ecff')+R(296,37,16,21,'#96a0b4')+R(296,37,16,2,'#b6bfd0')+R(300,44,2,2,'#d64545')+R(305,44,2,2,'#3f78d6');
 free.slice(0,3).forEach((a,k)=>{const cx=286-k*13,y=40;const st=stateOf(a,'');
  s+='<g class="ag'+(openId===a.id?' on':'')+'" data-id="'+esc(a.id)+'" tabindex="0" role="button" aria-label="'+esc(a.id+': '+st.label)+'">'+selBox(cx-6,y-11,12,30)+standing(cx,y,HAIR[hashN(a.id)%HAIR.length],'#9a9a9a')+bubble(cx,y-10,st.txt,st.kind)+'</g>'});
 // các dãy bàn
 let y=top;
 blocks.forEach(b=>{
  const f=b.f;
  s+=R(4,y,W-8,b.h,'rgba(0,0,0,.06)')+R(4,y,W-8,1,b.color)+R(4,y+b.h-1,W-8,1,b.color)+R(4,y,1,b.h,b.color)+R(W-5,y,1,b.h,b.color);
  const sv='['+stVi(f.status)+']',svw=sv.length*CW*3.8,label=cut(f.id+' · '+f.title,Math.floor((W-12-11-svw)/(CW*4.4))),lw=label.length*CW*4.4;
  s+=R(6,y+2,Math.min(lw+svw+11,W-12),8,b.color)+T(8,y+7.6,4.4,'#ffffff',label,'start')+T(11+lw,y+7.6,3.8,f.to==='owner'?'#ffe066':'#ffffffcc',sv,'start');
  const rowTop=r=>y+HEAD+r*ROW_H;
  // bàn Master (rộng, 2 màn hình) ở đầu dãy
  if(b.master){const a=byId[b.master],Y=rowTop(0)+23,cx=33;let st=stateOf(a,f.dir);
   // Master không còn file chờ nhưng tính năng đang chờ chủ dự án: hiện "!" thay vì "z"
   if(st.kind==='idle'&&S.owner.some(o=>o.path.indexOf(f.dir+'/')===0))st={kind:'wait',txt:'!',label:'Chờ bạn (xem mục Cần bạn)',on:true};
   s+='<g class="ag'+(openId===b.master?' on':'')+'" data-id="'+esc(b.master)+'" tabindex="0" role="button" aria-label="'+esc(b.master+': '+st.label)+'">'+selBox(8,rowTop(0)-1,50,ROW_H-2)
    +monitor(14,Y-13,true,b.color)+monitor(34,Y-13,true,'#55d27a')+desk(9,Y,48)+seated(cx,Y+6,HAIR[hashN(b.master)%HAIR.length],b.color,st.kind==='run')+chair(cx,Y+13)
    +bubble(cx,rowTop(0)+1,st.txt,st.kind)+nameTag(cx,Y+31,b.master)+'</g>'}
  b.others.forEach((id,k)=>{const r=Math.floor(k/PER_ROW),c=k%PER_ROW,x=COL0+c*STEP,Y=rowTop(r)+23,cx=x+18,a=byId[id],st=stateOf(a,f.dir);
   s+='<g class="ag'+(openId===id?' on':'')+'" data-id="'+esc(id)+'" tabindex="0" role="button" aria-label="'+esc(id+': '+st.label)+'">'+selBox(x-2,rowTop(r)-1,46,ROW_H-2)
    +monitor(x+10,Y-13,st.on,b.color)+desk(x,Y,36)+R(x+12,Y+3,11,3,'#c9cdd6')+R(x+38,Y+1,5,11,'#d8dbe2')+R(x+40,Y+4,1,1,st.on?'#e04848':'#888')
    +seated(cx,Y+6,HAIR[hashN(id)%HAIR.length],b.color,st.kind==='run')+chair(cx,Y+13)
    +bubble(cx,rowTop(r)+1,st.txt,st.kind)+nameTag(cx,Y+31,id)+'</g>'});
  y+=b.h+6;
 });
 if(!blocks.length)s+=T(W/2,top+26,5,'#3b2a20',done.length?'Không có tính năng nào đang làm':'Chưa có tính năng nào (workflow/F-*)');
 const svg=$('#office');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.innerHTML=s;
 svg.querySelectorAll('.ag').forEach(g=>{const go=()=>{openId=g.dataset.id;build();showDetail()};g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});
 const lg=$('#legend');lg.replaceChildren();
 lg.append(el('span',null,'Bong bóng: … đang chạy · số = số việc đang chờ · ! = Master chờ bạn · z rảnh · ? chưa khai trong agents.txt · cửa mở = có việc chờ bạn'));
 if(free.length>3)lg.append(el('span',null,'Rảnh, không hiện hết: '+free.slice(3).map(a=>a.id).join(', ')));
}

/* ---------- các khu HTML ---------- */
function render(){
 $('#proj').textContent='VĂN PHÒNG AGENT · '+S.project;
 {const d=S.features.filter(f=>f.status==='done').length;$('#bFeat').textContent=(S.features.length-d)+' ĐANG LÀM · '+d+' XONG'}
 $('#bRun').textContent=S.agents.filter(a=>a.running).length+'/'+S.agents.length+' ĐANG CHẠY';
 $('#bNeed').textContent=S.owner.length+' CHỜ BẠN';
 document.title=(S.owner.length?'('+S.owner.length+') Chờ bạn · ':'')+'Văn phòng agent';
 $('#needBox').classList.toggle('on',S.owner.length>0);
 const need=$('#need');need.replaceChildren();
 if(!S.hasWorkflow)need.append(el('p','muted','Không thấy thư mục workflow/. Hãy chạy monitor tại thư mục dự án.'));
 else if(!S.owner.length)need.append(el('p','muted','Không có gì chờ bạn.'));
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
 S.features.forEach((f,i)=>{const d=el('details');const sm=el('summary');const sq=el('span','sq');sq.style.background=COLORS[i%COLORS.length];sm.append(sq,f.id+' · '+f.title+' · '+stVi(f.status)+' ('+f.items.length+' file)');d.append(sm);
  const t=el('table');f.items.forEach(it=>{const tr=el('tr');const td=el('td');td.append(el('code',null,it.file));tr.append(td,el('td',null,it.title),el('td',null,stVi(it.status)),el('td',null,'→ '+(it.to==='owner'?'bạn':it.to==='none'?'không ai':it.to)));t.append(tr)});d.append(t);files.append(d)});
 if(!S.features.length)files.append(el('p','muted','Chưa có.'));
 if(openId)showDetail();
}
function showDetail(){
 const d=$('#detail');const a=S.agents.find(x=>x.id===openId);d.replaceChildren();d.style.display='block';
 const close=el('button',null,'Đóng');close.onclick=()=>{openId=null;d.style.display='none';build()};d.append(close,el('h2',null,openId));
 if(!a){d.append(el('p',null,'Agent này được nhắc trong file nhưng chưa có trong workflow/agents.txt, nên watch.sh không đánh thức được.'));return}
 d.append(el('p',null,a.role+' · '+(MODE_NAME[a.mode]||'đánh thức tay')+(a.note?' · '+a.note:'')),el('p',null,a.running?'Đang chạy':'Không chạy'));
 d.append(el('h2',null,'File đang chờ'));
 if(a.pending.length){const ul=el('ul');a.pending.forEach(p=>{const li=el('li');li.append(el('code',null,p));ul.append(li)});d.append(ul)}else d.append(el('p','muted','Không có.'));
 d.append(el('h2',null,'Log gần nhất'));
 if(a.lastLog)d.append(el('p','muted',a.lastLog.name+(a.lastLog.mtime?' · '+new Date(a.lastLog.mtime).toLocaleString():'')),el('pre',null,a.lastLog.tail||'(trống)'));
 else d.append(el('p','muted','Chưa có log (agent đánh thức tay, hoặc chưa được đánh thức lần nào).'));
}
async function poll(){
 try{const r=await fetch('/api/state',{cache:'no-store'});S=await r.json();const c=$('#bConn');c.textContent='CẬP NHẬT '+new Date().toLocaleTimeString();c.className='badge';render()}
 catch(e){const c=$('#bConn');c.textContent='MẤT KẾT NỐI';c.className='badge off'}
}
poll();setInterval(poll,3000);
</script></body></html>`;
