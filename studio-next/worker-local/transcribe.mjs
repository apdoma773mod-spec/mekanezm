// تفريغ كلام فيديو بـ Whisper على جهاز المحل (مجاني ومن غير مفاتيح)
// الاستخدام: node transcribe.mjs <فيديو> [موديل]
// بيطلع جنب الفيديو: <اسم>.cap.json (بنفس شكل جمل الستوديو {s,e,w[]}) و <اسم>.srt
import { pipeline, env } from '@huggingface/transformers';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const [, , input, model = 'onnx-community/whisper-small'] = process.argv;
if (!input) { console.error('اكتب مسار الفيديو: node transcribe.mjs video.mp4'); process.exit(1); }
env.cacheDir = fileURLToPath(new URL('./models/', import.meta.url));
// ملفات WebAssembly من الجهاز نفسه مش من النت
const ortDir = dirname(createRequire(import.meta.resolve('@huggingface/transformers')).resolve('onnxruntime-node'));
env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir).href + '/';
env.backends.onnx.wasm.numThreads = Math.max(1, (await import('node:os')).cpus().length - 1);

// الصوت: مونو 16 كيلو هرتز float32 (اللي Whisper عايزه)
function readAudio(file) {
  return new Promise((ok, bad) => {
    const p = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1']);
    const parts = []; let err = '';
    p.stdout.on('data', d => parts.push(d)); p.stderr.on('data', d => err += d);
    p.on('close', c => {
      if (c) return bad(new Error('ffmpeg: ' + err));
      const b = Buffer.concat(parts);
      ok(new Float32Array(b.buffer, b.byteOffset, b.length / 4));
    });
  });
}

const tc = t => { const ms = Math.round(Math.max(0, t) * 1000), p = (x, l) => String(x).padStart(l, '0'); return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`; };

const t0 = Date.now();
const audio = await readAudio(input);
console.log(`🎧 الصوت: ${(audio.length / 16000).toFixed(1)} ثانية`);
const asr = await pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: process.env.ASR_DEVICE || 'cpu' }); // onnxruntime-node متحول لنسخة WebAssembly (package.json overrides) عشان ويندوز فيه onnxruntime.dll قديمة
const out = await asr(audio, { language: process.env.LANG_ASR || 'arabic', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });

// كل مقطع بيتقسم لجمل قصيرة (٦ كلمات بالكتير) والوقت بيتوزع على الكلمات
const CAP = [];
for (const ch of out.chunks || []) {
  const [s, e0] = ch.timestamp; const e = e0 ?? s + 3;
  const w = ch.text.trim().split(/\s+/).filter(Boolean); if (!w.length) continue;
  const n = Math.ceil(w.length / 6), d = (e - s) / w.length;
  for (let i = 0; i < n; i++) { const a = i * Math.ceil(w.length / n), part = w.slice(a, a + Math.ceil(w.length / n)); if (!part.length) continue; CAP.push({ s: +(s + a * d).toFixed(2), e: +(s + (a + part.length) * d).toFixed(2), w: part }); }
}
const base = input.replace(/\.[^.\\/]+$/, '');
writeFileSync(base + '.cap.json', JSON.stringify({ model, text: out.text, cap: CAP }, null, 1));
writeFileSync(base + '.srt', CAP.map((c, i) => `${i + 1}\n${tc(c.s)} --> ${tc(c.e)}\n${c.w.join(' ')}\n`).join('\n'));
console.log(`✅ خلص في ${((Date.now() - t0) / 1000).toFixed(0)} ثانية — ${CAP.length} جملة`);
console.log(out.text);
