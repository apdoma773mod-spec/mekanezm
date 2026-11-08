// اختبارات أدوات المونتاج (الدفعة التانية) + جدول القوالب الزمني — node tests/pro2.test.cjs
const path = require('path'), { pathToFileURL } = require('url');
(async () => {
  const P = await import(pathToFileURL(path.join(__dirname, '../lib/montage/pro2.ts')).href);
  const T = await import(pathToFileURL(path.join(__dirname, '../lib/templates/styles.ts')).href);
  let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log('✖', n, x === undefined ? '' : JSON.stringify(x)); } };
  const seg = [
    { s: 0.5, e: 4, t: 'ليه الدرج الصامت أحسن من العادي؟' }, { s: 5, e: 9, t: 'يعني امم استنى نعيد', cut: true },
    { s: 10, e: 16, t: 'الدرج ده سعره ٣٥٠ جنيه بس وفيه ضمان سنتين' }, { s: 17, e: 30, t: 'يعني التركيب سهل' },
    { s: 31, e: 38, t: 'المفصلة سوفت كلوز بتقفل لوحدها من غير خبط' }, { s: 40, e: 46, t: 'اطلب دلوقتي من ميكانيزم' }];
  const kw = P.keywords(seg); t('keywords', kw.length > 0 && kw.includes('الدرج'), kw);
  const cl = P.bestClips(seg, 46); t('clips 15/30', cl.length === 2 && cl[0].len === 15 && cl[0].e - cl[0].s <= 17, cl);
  const r = P.retention(seg, 46); t('retention buckets', r.length === 10 && r[0].v <= 100 && r.every((b, i) => !i || b.v <= r[i - 1].v), r.map(b => b.v));
  const f = P.fillerReport(seg, 46 / 60); t('fillers', f.counts['يعني'] === 2 && f.cut === 1, f);
  const ti = P.titleIdeas(seg, '', 'ميكانيزم'); t('titles', ti.length >= 6 && ti.every(x => x.length <= 60), ti);
  const c = P.platformCaptions(seg, 'الدرج الصامت', { shop: 'ميكانيزم', phone: '0100' }); t('captions', /#ميكانيزم/.test(c.tt) && /0100/.test(c.ig) && c.yt.split('\n')[0].length <= 95, c);
  const sh = P.shotList(seg); t('shots', sh.some(x => /درج/.test(x.shot)) && sh.some(x => /مفصلة/.test(x.shot)), sh);
  const sc = P.cleanScript(seg, 'ليه الدرج الصامت أحسن من العادي؟'); t('script no fillers', !/يعني/.test(sc) && sc.startsWith('🎣') && !/نعيد/.test(sc), sc);
  const srt = P.toSrt([{ s: 1.5, e: 3.25, w: ['أهلا', 'بيكم'] }], x => x - 1); t('srt', srt.startsWith('1\n00:00:00,500 --> 00:00:02,250\nأهلا بيكم'), srt);
  const pw = P.punchWords([{ s: 0, e: 2, w: ['ده', 'سعر', 'مستحيل'] }, { s: 2.5, e: 4, w: ['خصم'] }, { s: 9, e: 10, w: ['ضمان'] }]); t('punch words spaced', pw.length === 2 && pw[1].w === 'ضمان', pw);
  const sr = 8000, ch = new Float32Array(sr * 4); for (let b = 0; b < 8; b++) { const s0 = Math.floor((b * .5 + .25) * sr); for (let i = 0; i < 400; i++) ch[s0 + i] = Math.sin(i / 3) * (1 - i / 400); }
  const bt = P.beatsOf(ch, sr); t('beats', bt.length === 8 && Math.abs(bt[0] - .25) < .03, bt);
  // القوالب
  t('templates count', T.STYLES.length >= 35 && T.TOTAL_TEMPLATES >= 400, T.TOTAL_TEMPLATES);
  t('unique ids', new Set(T.STYLES.map(s => s.id)).size === T.STYLES.length);
  for (const s of T.STYLES) { if (s.kind !== 'video') continue; const tl = T.timeline(s, { count: 7, speed: 1, bpm: 118, intro: true, outro: true });
    const slides = tl.segs.filter(x => x.k === 'slide'), items = slides.flatMap(x => x.items);
    t(s.id + ' covers all photos', s.special === 'carousel' ? slides.length === 1 && items.length === 7 : items.length === 7 && new Set(items).size === 7, items);
    t(s.id + ' monotonic', tl.segs.every((x, i) => x.e > x.s && (!i || x.s >= tl.segs[i - 1].s)), tl.segs);
    t(s.id + ' duration sane', tl.dur > 3 && tl.dur < 60, tl.dur); }
  const tl = T.timeline(T.styleById('beat'), { count: 6, speed: 1, bpm: 120, intro: false, outro: false }); t('beat snap', tl.segs.every(x => Math.abs(((x.e - x.s) / .5) - Math.round((x.e - x.s) / .5)) < 1e-6 || x.i > 0), tl.segs);
  console.log('pass', ok, 'fail', bad); process.exit(bad ? 1 : 0);
})();
