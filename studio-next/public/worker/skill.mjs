/* عامل «سكيل من لينك» (GitHub Actions): ياخد لينك فيديو (فيسبوك/يوتيوب/…) من الطابور → yt-dlp ينزّله → الصوت يتسمع (Gemini عبر video-skill) → SKILL.md
   الدخول بنفس سر المونتاج (VR_SECRET). مفيش npm — Node 20 بس + ffmpeg + yt-dlp. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SB_URL = process.env.SB_URL || 'https://tkzfjeizvanfptnqvrmr.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_8QP_KfvoYOyF_bZC4-fw1w_qCkfEpvZ';
const SECRET = ((process.env.VR_SECRET || '').match(/[0-9a-f]{48}/i) || [''])[0].toLowerCase();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function post(fn, body, hdr = {}) {
  const r = await fetch(SB_URL + '/functions/v1/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, ...hdr }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(fn + ': ' + (j.error || r.status));
  return j;
}
const api = (action, body = {}) => post('skill-worker', { secret: SECRET, action, ...body });
const ai = body => post('video-skill', body, { 'x-vr-secret': SECRET });
const run = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { maxBuffer: 1 << 30, ...opt }); if (r.status !== 0) throw new Error(cmd + ' فشل: ' + String(r.stderr || '').slice(-500)); return r.stdout; };

function splitPoints(f32, len) { const R = 16000, out = [0]; let at = 0; while (at + len * R < f32.length) { let tgt = at + len * R, best = tgt, bv = 1e9; for (let i = tgt - 4 * R; i < tgt + 2 * R && i < f32.length; i += 800) { let e = 0; for (let j = i; j < i + 800 && j < f32.length; j++) e += Math.abs(f32[j]); if (e < bv) { bv = e; best = i; } } at = best; out.push(at); } out.push(f32.length); return out; }
function wav64(f32) {
  const n = f32.length, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(f32[i])); const g = peak > 0.001 ? Math.min(8, 0.9 / peak) : 1;
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i] * g)) * 32767), 44 + i * 2);
  return b.toString('base64');
}

async function once(job, tmp) {
  const prog = async note => { log(note); try { await api('progress', { id: job.id, note }); } catch (e) {} };
  await prog('بنزّل الفيديو من اللينك…');
  const dl = spawnSync('yt-dlp', ['--no-playlist', '--no-warnings', '--socket-timeout', '30', '-f', 'b[height<=720]/b/w', '--max-filesize', '600M', '-o', path.join(tmp, 'in.%(ext)s'), job.url], { maxBuffer: 1 << 26 });
  const file = fs.readdirSync(tmp).find(f => f.startsWith('in.'));
  if (dl.status !== 0 || !file) {
    const err = String(dl.stderr || '').slice(-400);
    const priv = /login|private|cookies|not available|unavailable|age/i.test(err);
    throw Object.assign(new Error(priv ? 'الفيديو خاص أو فيسبوك رفض التحميل (محتاج تسجيل دخول). جرّب لينك فيديو عام.' : 'ماقدرتش أنزّل الفيديو: ' + err.replace(/\s+/g, ' ').slice(-200)), { noRetry: priv });
  }
  const inFile = path.join(tmp, file);
  const dur = +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', inFile]).toString().trim() || 0;
  if (dur > 1500) throw Object.assign(new Error('الفيديو أطول من ٢٥ دقيقة'), { noRetry: true });
  await prog('بسحب الصوت…');
  const b = run('ffmpeg', ['-v', 'error', '-i', inFile, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1']);
  const f32 = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength - (b.byteLength % 4)));
  if (f32.length < 16000 * 3) throw Object.assign(new Error('الفيديو مفيهوش صوت'), { noRetry: true });
  const pts = splitPoints(f32, 40), n = pts.length - 1, tr = new Array(n); let done = 0;
  await prog('بسمع الكلام… 0 من ' + n);
  const part = async i => { for (let k = 0; ; k++) { try { tr[i] = (await ai({ mode: 'transcribe', audio: wav64(f32.subarray(pts[i], pts[i + 1])), mime: 'audio/wav' })).text || ''; break; } catch (e) { if (k >= 2) throw e; await new Promise(r => setTimeout(r, 3000 * (k + 1))); } } done++; await prog('بسمع الكلام… ' + done + ' من ' + n); };
  for (let i = 0; i < n; i += 3) await Promise.all([i, i + 1, i + 2].filter(x => x < n).map(part));
  const text = tr.join('\n').trim();
  if (text.length < 20) throw Object.assign(new Error('مالقيتش كلام في الفيديو'), { noRetry: true });
  await prog('بقرا اللي على الشاشة…');
  const frames = [];
  if (dur > 0) for (let i = 0; i < 6; i++) { try { const jb = run('ffmpeg', ['-v', 'error', '-ss', String(dur * (i + .5) / 6), '-i', inFile, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '6', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']); if (jb.length) frames.push(Buffer.from(jb).toString('base64')); } catch (e) {} }
  await prog('بكتب السكيل…');
  const r = await ai({ mode: 'skill', transcript: text, frames, name: job.url });
  await api('done', { id: job.id, skill: r.skill, transcript: text });
  log('✔ خلصت', job.url);
}

async function main() {
  if (!SECRET) throw new Error('VR_SECRET مش متسجل');
  let n = 0;
  for (;;) {
    const { job } = await api('claim'); if (!job) break; n++;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-'));
    try { log('مهمة', job.id, job.url); await once(job, tmp); }
    catch (e) { log('❌', e.message); try { await api('fail', { id: job.id, error: String(e.message || e), retry: !e.noRetry }); } catch (x) {} }
    finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  log('خلص — ' + n + ' لينك');
}
main().catch(e => { console.error(e); process.exit(1); });
