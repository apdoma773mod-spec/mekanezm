// عامل المونتاج (سحابة): بياخد المهام من طابور سوبابيز (دالة vr-worker) ويعمل المونتاج بنفس كود «مونتاج ذكي» على Chromium بدون واجهة + ffmpeg
//   node worker/render.mjs                       ← بيشتغل على الطابور لحد ما يفضى (بيتشغّل من GitHub Actions)
//   node worker/render.mjs --local in.mp4 job.json out.mp4   ← تجربة محلية من غير شبكة (job.json = {spec, D?})
// الأسرار: VR_SECRET من GitHub Secrets. مفيش أي مفتاح service_role هنا.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..');
const SB_URL = process.env.SB_URL || 'https://tkzfjeizvanfptnqvrmr.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_8QP_KfvoYOyF_bZC4-fw1w_qCkfEpvZ';
const SECRET = ((process.env.VR_SECRET || '').match(/[0-9a-f]{48}/i) || [''])[0].toLowerCase(); // بيتجاهل أي مسافات أو سطر زيادة اتلصق مع السر
const FPS = 30;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function api(action, body = {}) {
  const r = await fetch(SB_URL + '/functions/v1/vr-worker', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ secret: SECRET, action, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('vr-worker ' + action + ': ' + (j.error || r.status));
  return j;
}
const run = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { maxBuffer: 1 << 30, ...opt }); if (r.status !== 0) throw new Error(cmd + ' فشل: ' + String(r.stderr || '').slice(-400)); return r.stdout; };

/* ---------- تحميل الأجزاء وتجميعها ---------- */
async function fetchTo(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('تحميل جزء الفيديو فشل: HTTP ' + r.status);
  const ws = fs.createWriteStream(file, { flags: 'a' });
  for await (const ch of r.body) if (!ws.write(ch)) await new Promise(res => ws.once('drain', res));
  await new Promise(res => ws.end(res));
}
function probe(file) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]).toString());
  const v = (j.streams || []).find(s => s.codec_type === 'video'), a = (j.streams || []).find(s => s.codec_type === 'audio');
  if (!v) throw new Error('الملف مفيهوش فيديو');
  let w = v.width, h = v.height;
  const rot = Math.abs(+(((v.side_data_list || []).find(x => x.rotation !== undefined) || {}).rotation || (v.tags && v.tags.rotate) || 0));
  if (rot === 90 || rot === 270) [w, h] = [h, w];
  return { dur: +(j.format.duration || v.duration || 0), w, h, hasAudio: !!a };
}

/* ---------- الصوت والذكاء ---------- */
function pcm16k(file) { const b = run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1']); return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4)); }
function splitPoints(f32, len) { const R = 16000, out = [0]; let at = 0; while (at + len * R < f32.length) { let tgt = at + len * R, best = tgt, bv = 1e9; for (let i = tgt - 4 * R; i < tgt + 2 * R && i < f32.length; i += 800) { let e = 0; for (let j = i; j < i + 800 && j < f32.length; j++) e += Math.abs(f32[j]); if (e < bv) { bv = e; best = i; } } at = best; out.push(at); } out.push(f32.length); return out; }
function wav64(f32) {
  const n = f32.length, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(f32[i])); const g = peak > 0.001 ? Math.min(8, 0.9 / peak) : 1;
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i] * g)) * 32767), 44 + i * 2);
  return b.toString('base64');
}
const en = t => String(t == null ? '' : t).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
async function callAI(b64, offset, first, products) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(SB_URL + '/functions/v1/video-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, 'x-vr-secret': SECRET }, body: JSON.stringify({ audio: b64, mime: 'audio/wav', offset, first, products }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      return j;
    } catch (e) { if (k >= 2) throw e; await new Promise(r => setTimeout(r, 3000 * (k + 1))); }
  }
}
async function analyze(file, spec, prog) {
  const f32 = pcm16k(file), pts = splitPoints(f32, 40), jobs = [];
  for (let i = 0; i < pts.length - 1; i++) jobs.push({ i, a: pts[i], b: pts[i + 1] });
  const res = new Array(jobs.length), prods = (spec.products || []).map(p => p.nm).filter(Boolean); let done = 0;
  for (let i = 0; i < jobs.length; i += 3) await Promise.all(jobs.slice(i, i + 3).map(async j => { res[j.i] = await callAI(wav64(f32.subarray(j.a, j.b)), j.a / 16000, j.i === 0, prods); done++; await prog(10 + Math.round(done / jobs.length * 25), 'بفهم الكلام… ' + done + ' من ' + jobs.length); }));
  const seg = [], ev = []; let title = '';
  res.forEach((r, i) => {
    const off = jobs[i].a / 16000; if (i === 0) title = r.title || '';
    (r.segments || []).forEach(x => { if (String(x.t || '').trim()) seg.push({ s: off + (+x.s || 0), e: off + (+x.e || +x.s + 1), t: String(x.t).trim() }); });
    (r.events || []).forEach(x => { if (String(x.label || '').trim()) ev.push({ s: off + (+x.s || 0), e: off + (+x.e || 0), type: String(x.type || 'point'), label: String(x.label).trim(), value: en(x.value || ''), unit: String(x.unit || ''), on: true }); });
  });
  seg.sort((a, b) => a.s - b.s); ev.sort((a, b) => a.s - b.s);
  return { title, seg, ev, dur: f32.length / 16000 };
}

/* ---------- الرسم والتجميع ---------- */
function serve(dir, framesDir) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const f = u.startsWith('/frames/') ? path.join(framesDir, path.basename(u)) : path.join(dir, path.basename(u === '/' ? '/render.html' : u));
      fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); } });
    }).listen(0, '127.0.0.1', () => res({ s, port: s.address().port }));
  });
}
async function render(inFile, job, D, info, outFile, prog) {
  const spec = job.spec || {}, tmp = path.dirname(outFile), framesDir = path.join(tmp, 'frames'); fs.mkdirSync(framesDir, { recursive: true });
  /* فريمات الفيديو بحجم مناسب (القصير ≤ ١٠٨٠). القائمة الأوتوماتيك بتلف حسب الدوران */
  await prog(36, 'بجهّز فريمات الفيديو…');
  run('ffmpeg', ['-v', 'error', '-y', '-i', inFile, '-vf', `fps=${FPS},scale='if(gt(iw,ih),-2,min(1080,iw))':'if(gt(iw,ih),min(1080,ih),-2)'`, '-q:v', '3', path.join(framesDir, 'f%06d.jpg')]);
  const total = fs.readdirSync(framesDir).filter(x => x.endsWith('.jpg')).length;
  if (!total) throw new Error('ماقدرتش أفك فريمات الفيديو');
  const { s: srv, port } = await serve(STUDIO, framesDir);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    page.on('pageerror', e => log('page error:', e.message));
    await page.goto(`http://127.0.0.1:${port}/render.html`, { waitUntil: 'load' });
    await page.evaluate(async ({ spec, D, fontNames }) => {
      window.__KVD.prods = spec.products || []; window.__KVD.brand = spec.brand || {};
      for (const f of fontNames) { try { await document.fonts.load('900 40px "' + f + '"', 'اختبار abc'); } catch (e) {} }
      await document.fonts.ready;
      const T = mkzSmart._test; T.setS(spec.S || {}); T.setD(D);
      const im = new Image(); window.__im = im; Object.defineProperties(im, { videoWidth: { get() { return im.naturalWidth; } }, videoHeight: { get() { return im.naturalHeight; } } });
      im.src = '/frames/f000001.jpg'; await im.decode(); im.duration = D.dur; T.setV(im); T.build(); T.setup();
      /* صور الأصناف لازم تتحمّل قبل أول فريم */
      await new Promise(r => setTimeout(r, 400));
    }, { spec, D, fontNames: [spec.S && spec.S.font, 'Cairo'].filter(Boolean) });
    const st = await page.evaluate(() => { const s = mkzSmart.state(); return { gaps: s.GAPS, dur: window.__im.duration }; });
    const inGap = t => st.gaps.find(g => t >= g[0] && t < g[1]);
    const keep = []; for (let i = 0; i < total; i++) { const t = i / FPS; if (!inGap(t)) keep.push(i); }
    const outDur = keep.length / FPS;
    /* حجم الملف تحت ٤٥ ميجا (حد التخزين): البت ريت بالدقيقة */
    const kbps = Math.max(1500, Math.min(8000, Math.floor(42 * 8 * 1024 / Math.max(outDur, 1))));
    const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
    const gapExpr = st.gaps.slice(0, 120).map(g => `between(t,${g[0].toFixed(3)},${g[1].toFixed(3)})`).join('+');
    if (info.hasAudio) args.push('-i', inFile, '-filter_complex', st.gaps.length ? `[1:a]aselect='not(${gapExpr})',asetpts=N/SR/TB[a]` : '[1:a]anull[a]', '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k');
    else args.push('-an');
    /* تصحيح لون خفيف: بيشيل الصفار ويظبط التشبع (الفيديوهات المصفرة بتطلع رخيصة) */
    args.push('-vf', 'colortemperature=temperature=6500,eq=saturation=1.05:contrast=1.04', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', kbps + 'k', '-bufsize', 2 * kbps + 'k', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', outFile);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] }); let ferr = ''; ff.stderr.on('data', d => { ferr += d; });
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg فشل: ' + ferr.slice(-400)))));
    let last = Date.now();
    for (let n = 0; n < keep.length; n++) {
      const i = keep[n], t = i / FPS;
      const b64 = await page.evaluate(async ({ i, t }) => {
        const im = window.__im; im.src = '/frames/f' + String(i + 1).padStart(6, '0') + '.jpg'; await im.decode();
        mkzSmart.draw(t); return document.getElementById('sm_cv').toDataURL('image/jpeg', 0.92).split(',')[1];
      }, { i, t });
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (Date.now() - last > 4000) { last = Date.now(); await prog(40 + Math.round(n / keep.length * 50), 'برسم الفيديو… ' + Math.round(n / keep.length * 100) + '%'); }
    }
    ff.stdin.end(); await done;
    return { frames: keep.length, dur: outDur, kbps };
  } finally { await browser.close(); srv.close(); fs.rmSync(framesDir, { recursive: true, force: true }); }
}

async function runJob(inFile, job, outFile, prog) {
  const info = probe(inFile);
  log('فيديو', info.w + 'x' + info.h, info.dur.toFixed(1) + 's', info.hasAudio ? 'بصوت' : 'من غير صوت');
  if (info.dur > 300) throw new Error('الفيديو أطول من ٥ دقايق — قصّره');
  let D = job.D || (job.spec && job.spec.D);
  if (!D) { if (!info.hasAudio) D = { title: '', seg: [], ev: [], dur: info.dur }; else { await prog(8, 'بسحب الصوت…'); D = await analyze(inFile, job.spec || {}, prog); } }
  D.dur = D.dur || info.dur;
  return render(inFile, job, D, info, outFile, prog);
}

/* ---------- الطابور ---------- */
async function main() {
  if (!SECRET) throw new Error('VR_SECRET مش متسجل');
  let n = 0;
  for (;;) {
    const { job } = await api('claim'); if (!job) break; n++;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-')); const inFile = path.join(tmp, 'in.mp4'), outFile = path.join(tmp, 'out.mp4');
    const prog = async (p, note) => { log(p + '%', note); try { await api('progress', { id: job.id, progress: p, note }); } catch (e) {} };
    try {
      log('مهمة', job.id, job.name);
      for (const u of job.urls) await fetchTo(u, inFile);
      const r = await runJob(inFile, job, outFile, prog);
      await prog(92, 'برفع الفيديو الجاهز…');
      const up = await api('uploadurl', { id: job.id });
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
      const buf = fs.readFileSync(outFile);
      const { error } = await sb.storage.from('video-jobs').uploadToSignedUrl(up.path, up.token, new Blob([buf], { type: 'video/mp4' }), { contentType: 'video/mp4', upsert: true });
      if (error) throw new Error('رفع الفيديو الجاهز فشل: ' + error.message);
      await api('done', { id: job.id, out_path: up.path });
      log('✔ خلصت', (buf.length / 1048576).toFixed(1) + ' ميجا', r.frames + ' فريم');
    } catch (e) {
      log('❌', e.message);
      try { await api('fail', { id: job.id, error: String(e.message || e), retry: !/أطول من|مفيهوش فيديو/.test(String(e.message)) }); } catch (x) {}
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  log('خلص — ' + n + ' مهمة');
}

if (process.argv[2] === '--local') {
  const [, , , inFile, jobFile, outFile] = process.argv;
  const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  runJob(inFile, job, outFile, async (p, n) => log(p + '%', n)).then(r => log('✔', JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); });
} else main().catch(e => { console.error(e); process.exit(1); });
