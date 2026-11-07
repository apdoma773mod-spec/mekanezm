// يقارن vad الجديد (lib/montage/vad.ts) بنسخة smart.js القديمة على نفس الصوت: لازم نفس النتيجة بالظبط.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
(async () => {
  const M = await import(pathToFileURL(path.join(__dirname, '../lib/montage/vad.ts')).href);
  const lines = fs.readFileSync(path.join(__dirname, '../public/smart.js'), 'utf8').split('\n');
  const i = lines.findIndex(l => l.startsWith('function vad('));
  const oldVad = new Function(lines.slice(i, i + 4).join('\n') + ';return vad')();
  const wav = fs.readFileSync(path.join(__dirname, '../worker-local/_test.wav'));
  let off = 12, data = null;
  while (off < wav.length - 8) { const id = wav.toString('ascii', off, off + 4), sz = wav.readUInt32LE(off + 4); if (id === 'data') { data = wav.subarray(off + 8, off + 8 + sz); break; } off += 8 + sz; }
  const f = new Float32Array(data.length / 2); for (let k = 0; k < f.length; k++) f[k] = data.readInt16LE(k * 2) / 32768;
  const a = M.vad(f), b = oldVad(f), same = JSON.stringify(a) === JSON.stringify(b);
  console.log('secs', (f.length / 16000).toFixed(1), 'speech islands', a.length, '| same as old vad:', same);
  for (const lv of [1, 2, 3]) { const g = M.silenceGaps(a, f.length / 16000, lv); console.log('level', lv, 'gaps', g.length, 'removed', g.reduce((s, x) => s + x[1] - x[0], 0).toFixed(1) + 's'); }
  process.exit(same && a.length > 0 ? 0 : 1);
})();
