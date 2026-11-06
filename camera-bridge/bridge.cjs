// 📷 Camera bridge: polls DVR snapshots, finds faces, matches them with the workers' photos from the backend
// and posts «شوفته الساعة كذا». Runs on the shop PC next to camera.config.json (never committed: it holds the DVR password).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const vision = require('./vision.cjs');

const ROOT = __dirname;
const CFG_FILE = process.env.CAMERA_CONFIG || path.join(ROOT, 'camera.config.json');
const log = (...a) => console.log(new Date().toISOString().replace('T', ' ').slice(0, 19), ...a);

function loadConfig() {
  const c = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
  return {
    backend: 'http://127.0.0.1:4000',
    intervalSec: 5,
    tiles: 1,
    minFacePx: 40,
    cooldownSec: 120,
    motionMin: 1.5,
    ...c,
  };
}

// ---- DVR snapshots (curl.exe does the digest login; the password goes through stdin, not the command line)
function snapshot(cfg, n) {
  // test hook: "fakeSnapshots": "<folder with ch<N>.jpg>" reads frames from disk instead of the DVR
  if (cfg.fakeSnapshots) return fs.promises.readFile(path.join(cfg.fakeSnapshots, `ch${n}.jpg`));
  return new Promise((ok, fail) => {
    const url = `http://${cfg.dvr}/ISAPI/Streaming/channels/${n}01/picture`;
    const p = execFile('curl.exe', ['-s', '--digest', '--config', '-', '-m', '12', url], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }, (err, out) => {
      if (err) return fail(new Error('curl: ' + String(err.message).slice(0, 80)));
      if (!out || out.length < 1000 || out[0] !== 0xff || out[1] !== 0xd8) return fail(new Error('مفيش صورة (' + (out ? out.length : 0) + ' bytes)'));
      ok(out);
    });
    p.stdin.end(`user = "${cfg.user}:${cfg.password}"\n`);
  });
}

// ---- backend
async function api(cfg, method, route, body) {
  const r = await fetch(`${cfg.backend}/api/v1/bridge/camera${route}`, {
    method,
    headers: { 'x-bridge-secret': cfg.bridgeSecret, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`${method} ${route} → ${r.status}`);
  return r.json();
}

const queue = []; // posts that failed, retried first thing every round
async function post(cfg, route, body) {
  try {
    return await api(cfg, 'POST', route, body);
  } catch (e) {
    if (queue.length < 200) queue.push({ route, body });
    log('post failed, queued:', route, e.message);
    return null;
  }
}
async function flush(cfg) {
  while (queue.length) {
    const q = queue[0];
    try {
      await api(cfg, 'POST', q.route, q.body);
      queue.shift();
    } catch {
      return;
    }
  }
}

// ---- state
let remote = { on: false, threshold: 0.6, channels: [], faces: [], pending: [] };
let remoteAt = 0;
const prev = new Map(); // channel → last frame (for motion)
const lastThumb = new Map(); // channel → { data url, ok, note }
const lastPost = new Map(); // staffId|channel → ms
const maybe = new Map(); // staffId → ms of an earlier weak match
const unknownRecent = []; // { emb, ts }
let statusAt = 0;

async function refreshRemote(cfg, force) {
  const every = remote.pending.length ? 10_000 : 60_000;
  if (!force && Date.now() - remoteAt < every) return;
  remote = await api(cfg, 'GET', '/faces');
  remoteAt = Date.now();
}

async function processPending(cfg) {
  for (const p of remote.pending) {
    try {
      const img = vision.decode(Buffer.from(p.photo.split(',')[1], 'base64'));
      let faces = await vision.detect(img, 1);
      if (!faces.length) faces = await vision.detect(img, 2);
      faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
      await post(cfg, '/embedding', { photoId: p.photoId, embedding: faces[0] ? faces[0].embedding : null });
      log('photo', p.photoId.slice(-6), faces[0] ? 'ready' : 'no face');
    } catch (e) {
      log('photo failed', p.photoId.slice(-6), e.message);
      await post(cfg, '/embedding', { photoId: p.photoId, embedding: null });
    }
  }
  if (remote.pending.length) await refreshRemote(cfg, true);
}

function bestStaff(emb) {
  let best = { staffId: null, score: 0 };
  for (const f of remote.faces) {
    const s = vision.similarity(emb, f.embedding);
    if (s > best.score) best = { staffId: f.staffId, score: s };
  }
  return best;
}

async function onFace(cfg, channel, img, f) {
  if (f.box[2] < cfg.minFacePx) return;
  const now = Date.now();
  const m = bestStaff(f.embedding);
  const thr = remote.threshold;
  if (m.staffId && m.score >= thr) {
    // a clear match counts at once; a borderline one needs a second sighting within 2 minutes
    const strong = m.score >= thr + 0.1 || now - (maybe.get(m.staffId) || 0) < 120_000;
    if (!strong) {
      maybe.set(m.staffId, now);
      return;
    }
    const key = `${m.staffId}|${channel}`;
    if (now - (lastPost.get(key) || 0) < cfg.cooldownSec * 1000) return;
    lastPost.set(key, now);
    const r = await post(cfg, '/seen', { staffId: m.staffId, channel, score: m.score, snapshot: vision.faceCrop(img, f.box) });
    log(`✔ channel ${channel}: ${remote.faces.find((x) => x.staffId === m.staffId)?.name} score ${m.score.toFixed(2)}`, r && r.dup ? '(dup)' : '');
    return;
  }
  // somebody we do not know — keep one snapshot per face per 10 minutes so the owner can name it
  while (unknownRecent.length && now - unknownRecent[0].ts > 600_000) unknownRecent.shift();
  if (unknownRecent.some((u) => vision.similarity(u.emb, f.embedding) >= 0.7)) return;
  unknownRecent.push({ emb: f.embedding, ts: now });
  await post(cfg, '/seen', { staffId: null, channel, score: m.score, snapshot: vision.faceCrop(img, f.box), embedding: f.embedding });
  log(`? channel ${channel}: unknown face (best ${m.score.toFixed(2)}, ${Math.round(f.box[2])}px)`);
}

async function round(cfg) {
  await refreshRemote(cfg, false);
  await flush(cfg);
  if (!remote.on) return;
  await processPending(cfg);
  for (const ch of remote.channels) {
    try {
      const buf = await snapshot(cfg, ch);
      const img = vision.decode(buf);
      const moved = vision.motion(prev.get(ch), img);
      prev.set(ch, img);
      lastThumb.set(ch, { ok: true, snap: vision.thumb(img, 320) });
      if (moved < cfg.motionMin) continue;
      const faces = await vision.detect(img, cfg.tiles);
      for (const f of faces) await onFace(cfg, ch, img, f);
    } catch (e) {
      lastThumb.set(ch, { ok: false, note: e.message, snap: '' });
      log(`channel ${ch}:`, e.message);
    }
  }
  if (Date.now() - statusAt > 60_000) {
    statusAt = Date.now();
    await post(cfg, '/status', { channels: remote.channels.map((n) => ({ n, ok: !!lastThumb.get(n)?.ok, snapshot: lastThumb.get(n)?.snap || '', note: lastThumb.get(n)?.note || '' })) });
  }
}

async function main() {
  let cfg = loadConfig();
  log('loading face models…');
  await vision.init(ROOT);
  log('ready. backend', cfg.backend, 'dvr', cfg.dvr);
  for (;;) {
    const t0 = Date.now();
    try {
      cfg = loadConfig();
      await round(cfg);
    } catch (e) {
      log('round failed:', e.message);
    }
    await new Promise((r) => setTimeout(r, Math.max(500, cfg.intervalSec * 1000 - (Date.now() - t0))));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  });
}
module.exports = { snapshot, loadConfig };
