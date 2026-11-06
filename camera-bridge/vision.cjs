// Face detection + embedding on Node (no ffmpeg, no GPU): @vladmandic/human with the wasm backend.
// Gotchas (see docs/rebuild/CAMERAS.md): import the dist file directly, serve the models over http, wasmPath = folder + separator.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const jpeg = require('jpeg-js');

let human = null;
let server = null;

function serve(dir) {
  return new Promise((ok) => {
    const srv = http
      .createServer((q, r) => {
        const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
        fs.readFile(f, (e, b) => {
          if (e) {
            r.statusCode = 404;
            return r.end();
          }
          r.setHeader('content-type', f.endsWith('.json') ? 'application/json' : 'application/octet-stream');
          r.end(b);
        });
      })
      .listen(0, '127.0.0.1', () => ok(srv));
  });
}

async function init(root) {
  if (human) return human;
  server = await serve(path.join(root, 'node_modules', '@vladmandic', 'human-models', 'models'));
  const mod = await import(pathToFileURL(path.join(root, 'node_modules', '@vladmandic', 'human', 'dist', 'human.node-wasm.js')).href);
  const Human = mod.Human || mod.default?.Human || mod.default;
  human = new Human({
    backend: 'wasm',
    modelBasePath: `http://127.0.0.1:${server.address().port}/`,
    wasmPath: path.join(root, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist') + path.sep,
    face: { enabled: true, detector: { rotation: false, maxDetected: 8, minConfidence: 0.3 }, mesh: { enabled: true }, description: { enabled: true }, iris: { enabled: false }, emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false } },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    filter: { enabled: true },
  });
  await human.load();
  await human.warmup();
  return human;
}

/** A decoded RGB image: { w, h, data: Uint8Array(w*h*3) }. */
function decode(buf) {
  const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
  const data = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    data[j] = img.data[i];
    data[j + 1] = img.data[i + 1];
    data[j + 2] = img.data[i + 2];
  }
  return { w: img.width, h: img.height, data };
}

function crop(img, x, y, w, h) {
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  w = Math.min(img.w - x, Math.round(w));
  h = Math.min(img.h - y, Math.round(h));
  const out = new Uint8Array(w * h * 3);
  for (let r = 0; r < h; r++) out.set(img.data.subarray(((y + r) * img.w + x) * 3, ((y + r) * img.w + x + w) * 3), r * w * 3);
  return { w, h, data: out, x, y };
}

/** Nearest-neighbour resize (enough for thumbnails). */
function resize(img, nw, nh) {
  const out = new Uint8Array(nw * nh * 3);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(img.h - 1, Math.floor((y * img.h) / nh));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(img.w - 1, Math.floor((x * img.w) / nw));
      const s = (sy * img.w + sx) * 3;
      const d = (y * nw + x) * 3;
      out[d] = img.data[s];
      out[d + 1] = img.data[s + 1];
      out[d + 2] = img.data[s + 2];
    }
  }
  return { w: nw, h: nh, data: out };
}

function toDataUrl(img, quality = 70) {
  const rgba = Buffer.alloc(img.w * img.h * 4, 255);
  for (let i = 0, j = 0; i < img.data.length; i += 3, j += 4) {
    rgba[j] = img.data[i];
    rgba[j + 1] = img.data[i + 1];
    rgba[j + 2] = img.data[i + 2];
  }
  const enc = jpeg.encode({ data: rgba, width: img.w, height: img.h }, quality);
  return 'data:image/jpeg;base64,' + enc.data.toString('base64');
}

function thumb(img, width = 320) {
  const w = Math.min(width, img.w);
  return toDataUrl(resize(img, w, Math.round((img.h * w) / img.w)), 60);
}

/** The face with some surroundings, at most `max` px on its long side. */
function faceCrop(img, box, margin = 0.5, max = 240) {
  const [bx, by, bw, bh] = box;
  const c = crop(img, bx - bw * margin, by - bh * margin, bw * (1 + 2 * margin), bh * (1 + 2 * margin));
  const k = Math.min(1, max / Math.max(c.w, c.h));
  return toDataUrl(k < 1 ? resize(c, Math.max(1, Math.round(c.w * k)), Math.max(1, Math.round(c.h * k))) : c, 75);
}

async function detectOn(img) {
  const t = human.tf.tensor3d(img.data, [img.h, img.w, 3], 'int32');
  try {
    const r = await human.detect(t);
    return r.face.filter((f) => f.embedding && f.embedding.length).map((f) => ({ box: f.box.slice(), score: f.score, embedding: Array.from(f.embedding) }));
  } finally {
    t.dispose();
  }
}

/**
 * Faces in a frame. tiles=1 looks at the whole frame; tiles=N cuts an N×N grid with 25 % overlap and
 * looks at every piece (slower, but small faces far from the camera get found).
 */
async function detect(img, tiles = 1) {
  if (tiles <= 1) return detectOn(img);
  const out = [];
  const tw = Math.ceil(img.w / tiles);
  const th = Math.ceil(img.h / tiles);
  const ox = Math.round(tw * 0.25);
  const oy = Math.round(th * 0.25);
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const c = crop(img, tx * tw - (tx ? ox : 0), ty * th - (ty ? oy : 0), tw + (tx ? ox : 0) + (tx < tiles - 1 ? ox : 0), th + (ty ? oy : 0) + (ty < tiles - 1 ? oy : 0));
      for (const f of await detectOn(c)) out.push({ ...f, box: [f.box[0] + c.x, f.box[1] + c.y, f.box[2], f.box[3]] });
    }
  }
  // the same face seen in two overlapping tiles: keep the better one
  out.sort((a, b) => b.score - a.score);
  const keep = [];
  for (const f of out) {
    const cx = f.box[0] + f.box[2] / 2;
    const cy = f.box[1] + f.box[3] / 2;
    if (!keep.some((k) => Math.hypot(k.box[0] + k.box[2] / 2 - cx, k.box[1] + k.box[3] / 2 - cy) < Math.max(k.box[2], f.box[2]) * 0.6)) keep.push(f);
  }
  return keep;
}

const similarity = (a, b) => human.match.similarity(a, b);

/** Mean absolute difference of two frames on a sparse grid (0–255); big = something moved. */
function motion(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return 255;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 3 * 37) {
    sum += Math.abs(a.data[i] - b.data[i]);
    n++;
  }
  return n ? sum / n : 0;
}

module.exports = { init, decode, detect, similarity, faceCrop, thumb, motion, toDataUrl, resize };
