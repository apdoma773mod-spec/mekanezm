import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { accessSync, chmodSync, constants, copyFileSync, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';

/**
 * 🎬 فيديو المنتج: أي فيديو (آيفون HEVC/.mov، أندرويد، أي صيغة) بيتحوّل لـ H.264 mp4 بيشتغل في كل متصفح.
 * الشاشة بترفع الأصل لمخزن Supabase على أجزاء (كل جزء < ٥٠ ميجا، حد المخزن المجاني) في tmp/،
 * والسيرفر بيقسم الفيديو لقطع زمنية بتتحوّل بالتوازي (كل قطعة في function لوحدها عشان فيديو 4K من الآيفون
 * تقيل على معالج واحد)، وبعدين بيلزقهم في ملف واحد ويرفعه ويرجّع لينكه.
 */
const SB = 'https://aglwhwrwhobxykizjytc.supabase.co';
// مفتاح الـ anon العلني (نفس اللي في الشاشة): المخزن مقفول على الفيديوهات بس
const ANON = 'sb_publishable_dcjzvoUOmi__7tFVpeTIDA_t6HNC-Ki';
const BUCKET = 'mk-videos';
const SEG = 4; // ثواني لكل قطعة
const MAX_SEGS = 24;

const require = createRequire(import.meta.url);
let ffPath = '';
/** مسار ffmpeg؛ على Vercel الملف ممكن يجي من غير صلاحية تشغيل والقرص للقراية بس → ننسخه لـ /tmp ونديله الصلاحية */
const ffmpegPath = (): string => {
  if (ffPath) return ffPath;
  const src = (require('@ffmpeg-installer/ffmpeg') as { path: string }).path;
  try {
    accessSync(src, constants.X_OK);
    ffPath = src;
  } catch {
    const dst = path.join(tmpdir(), 'mk-ffmpeg');
    if (!existsSync(dst)) copyFileSync(src, dst);
    chmodSync(dst, 0o755);
    ffPath = dst;
  }
  return ffPath;
};

/** بيشغّل ffmpeg ويرجّع الـ stderr كله (فيه المدة والأخطاء)؛ ok=false لو خرج بخطأ */
const exec = (args: string[], ms = 280_000) =>
  new Promise<{ ok: boolean; log: string }>((res) =>
    execFile(ffmpegPath(), ['-hide_banner', ...args], { timeout: ms, maxBuffer: 32 * 1024 * 1024 }, (err, _out, errOut) => res({ ok: !err, log: String(errOut) || String(err?.message ?? '') })),
  );
const run = async (args: string[], ms?: number) => {
  const r = await exec(args, ms);
  if (!r.ok) throw new Error('تحويل الفيديو فشل: ' + r.log.split(/\r?\n/).filter(Boolean).slice(-2).join(' | ').slice(0, 300));
  return r.log;
};

const name = z.string().regex(/^tmp\/[\w-]+\/[\w.-]+$/);
const pub = (n: string) => `${SB}/storage/v1/object/public/${BUCKET}/${n}`;

async function fetchParts(parts: string[], dir: string): Promise<string> {
  const bufs: Buffer[] = [];
  for (const p of parts) {
    const r = await fetch(pub(p));
    if (!r.ok) throw new Error(`جزء الفيديو مش موجود (${r.status})`);
    bufs.push(Buffer.from(await r.arrayBuffer()));
  }
  const f = path.join(dir, 'in.bin');
  await writeFile(f, Buffer.concat(bufs));
  return f;
}

async function put(n: string, buf: Buffer, type = 'video/mp4') {
  const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${n}`, { method: 'POST', headers: { authorization: `Bearer ${ANON}`, apikey: ANON, 'content-type': type }, body: new Uint8Array(buf) });
  if (!r.ok) throw new Error(`رفع الفيديو المتحوّل فشل (${r.status}) ${(await r.text()).slice(0, 120)}`);
}

async function removeTmp(names: string[]) {
  if (!names.length) return;
  await fetch(`${SB}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { authorization: `Bearer ${ANON}`, apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: names }) }).catch(() => undefined);
}

const ENC = [
  '-map', '0:v:0', '-map', '0:a:0?',
  '-vf', "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))':flags=fast_bilinear,format=yuv420p",
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-maxrate', '3M', '-bufsize', '6M', '-r', '30',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
];

/** مدة الفيديو بالثواني (من سطر Duration بتاع ffmpeg) */
async function duration(file: string): Promise<number> {
  const out = (await exec(['-i', file], 30_000)).log;
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** قطعة واحدة: من start لمدة len → mp4 H.264 (بيتنده من الـ coordinator) */
export async function encodeSegment(file: string, start: number, len: number, out: string) {
  await run(['-y', '-ss', String(start), '-i', file, '-t', String(len), ...ENC, '-avoid_negative_ts', 'make_zero', '-f', 'mp4', out]);
}

export async function concatSegments(files: string[], out: string, dir: string) {
  const list = path.join(dir, 'list.txt');
  await writeFile(list, files.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  await run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
}

export default async function videoRoutes(app: FastifyInstance) {
  const secret = () => process.env.CRON_SECRET || '';

  // قطعة واحدة — داخلي بس (الـ coordinator بيندهها بالسر)
  app.post('/video/segment', { bodyLimit: 4096 }, async (request) => {
    if (!secret() || request.headers['x-mk-secret'] !== secret()) throw badRequest('مش مسموح');
    const b = parse(z.object({ parts: z.array(name).min(1).max(8), start: z.number().min(0), len: z.number().positive().max(30), out: name }), request.body);
    const dir = await mkdtemp(path.join(tmpdir(), 'mkv-'));
    try {
      const f = await fetchParts(b.parts, dir);
      const o = path.join(dir, 'seg.mp4');
      await encodeSegment(f, b.start, b.len, o);
      await put(b.out, await readFile(o));
      return { ok: true };
    } catch (e) {
      throw badRequest('segment: ' + String((e as Error).message ?? e).slice(0, 400));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // التحويل كله: الشاشة بتنده ده بعد ما ترفع الأجزاء
  app.post('/video/convert', { preHandler: app.authenticate, bodyLimit: 4096, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const { parts } = parse(z.object({ parts: z.array(name).min(1).max(8) }), request.body);
    const dir = await mkdtemp(path.join(tmpdir(), 'mkv-'));
    const job = parts[0]!.split('/')[1]!;
    const segNames: string[] = [];
    try {
      const file = await fetchParts(parts, dir);
      const dur = await duration(file);
      if (!dur) throw badRequest('مقدرتش أقرا الفيديو ده — جرّب فيديو تاني');
      if (dur > SEG * MAX_SEGS) throw badRequest(`الفيديو ${Math.round(dur)} ثانية — الحد الأقصى ${SEG * MAX_SEGS} ثانية لفيديو المنتج`);
      const n = Math.ceil(dur / SEG);
      const base = `${request.protocol}://${request.hostname}${request.url.replace(/\/web\/video\/convert.*$/, '')}`;
      const segFiles: string[] = [];
      await Promise.all(
        Array.from({ length: n }, async (_, i) => {
          const out = `tmp/${job}/seg${String(i).padStart(3, '0')}.mp4`;
          segNames.push(out);
          const r = await fetch(`${base}/web/video/segment`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mk-secret': secret() }, body: JSON.stringify({ parts, start: i * SEG, len: SEG, out }) });
          if (!r.ok) throw new Error(`قطعة ${i + 1} من الفيديو ماتحوّلتش (${r.status}) ${(await r.text()).slice(0, 160)}`);
          const g = await fetch(pub(out));
          if (!g.ok) throw new Error(`قطعة ${i + 1} مش موجودة بعد التحويل`);
          const local = path.join(dir, `seg${String(i).padStart(3, '0')}.mp4`);
          await writeFile(local, Buffer.from(await g.arrayBuffer()));
          segFiles[i] = local;
        }),
      );
      const final = path.join(dir, 'final.mp4');
      await concatSegments(segFiles, final, dir);
      const buf = await readFile(final);
      const outName = `${Date.now().toString(36)}${randomBytes(5).toString('hex')}.mp4`;
      await put(outName, buf);
      return { url: pub(outName), seconds: Math.round(dur), mb: Math.round((buf.length / 1048576) * 10) / 10 };
    } catch (e) {
      const m = String((e as { message?: string }).message ?? e);
      if ((e as { statusCode?: number }).statusCode) throw e;
      throw badRequest('تحويل الفيديو فشل: ' + m.slice(0, 400));
    } finally {
      await rm(dir, { recursive: true, force: true });
      void removeTmp([...parts, ...segNames]);
    }
  });
}
