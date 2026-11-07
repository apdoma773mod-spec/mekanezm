// يقارن takes.ts (sanitizeCuts/retime/takeRange) بنسخ smart.js القديمة على نفس بيانات الذكاء: لازم نفس النتيجة.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
(async () => {
  const T = await import(pathToFileURL(path.join(__dirname, '../lib/montage/takes.ts')).href);
  const V = await import(pathToFileURL(path.join(__dirname, '../lib/montage/vad.ts')).href);
  const L = fs.readFileSync(path.join(__dirname, '../public/smart.js'), 'utf8').split('\n');
  const grab = (start, count) => { const i = L.findIndex(l => l.startsWith(start)); if (i < 0) throw new Error('missing ' + start); let j = i + 1; if (count) j = i + count; else while (j < L.length && !/^(function|async function|const|let|\/\*)/.test(L[j])) j++; return L.slice(i, j).join('\n'); };
  const code = [
    "const norm=w=>String(w).replace(/[ً-ْـ.,،؟!?:؛\"«»()]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');",
    grab('const TK=', 1), grab('const META=', 1), grab('const FILL=', 1), grab('function markRepeats'), grab('function sanitizeCuts'), grab('function takeRange'), grab('function retime'),
  ].join('\n');
  const old = new Function('D', code + ';return {markRepeats,sanitizeCuts,takeRange,retime,get D(){return D}}');
  const mk = () => ({
    dur: 120, ch: [[0, 40], [40, 80], [80, 120]],
    vad: [[0.5, 4], [5, 9], [10, 14], [15, 19], [41, 46], [47, 52], [53, 58], [81, 90], [91, 99]],
    seg: [
      { s: 0.5, e: 4, t: 'النهارده هنتكلم عن الدرج الصامت للدريسنج', cut: false }, { s: 5, e: 9, t: 'استنى نعيد تاني', cut: true },
      { s: 10, e: 14, t: 'النهارده هنتكلم عن الدرج الصامت للدريسنج روم', cut: false }, { s: 15, e: 19, t: 'امم يعني', cut: true },
      { s: 41, e: 46, t: 'المجرى بيتركب بمسمارين', cut: false }, { s: 47, e: 52, t: 'سعره ٣٥٠ جنيه', cut: false }, { s: 53, e: 58, t: 'المجرى بيتركب بمسمارين بس', cut: false },
      { s: 81, e: 90, t: 'شكرا ليكم', cut: false }, { s: 91, e: 99, t: 'مع السلامة', cut: false }],
    ev: [{ s: 6, e: 9, type: 'product', label: 'درج', value: '', unit: '', scene: '', action: '', on: true }, { s: 48, e: 51, type: 'point', label: 'سعر', value: '350', unit: '', scene: '', action: '', on: true }],
  });
  const a = mk(), o = old(mk());
  T.retime(a); T.sanitizeCuts(a); o.retime(o.D); o.sanitizeCuts(o.D);
  const same = JSON.stringify(a) === JSON.stringify(o.D);
  const tr = JSON.stringify(a.seg.filter(g => g.cut).map(g => T.takeRange(a, g))) === JSON.stringify(o.D.seg.filter(g => g.cut).map(g => o.takeRange(g)));
  console.log('cut sentences:', a.seg.filter(g => g.cut).map(g => g.t));
  console.log('analysis same as old:', same, '| takeRange same:', tr);
  console.log('gaps:', JSON.stringify(V.mergeGaps(T.allGaps(a, V.silenceGaps(a.vad, a.dur, 2, a.seg), true))));
  process.exit(same && tr && a.seg.some(g => g.cut) ? 0 : 1);
})();
