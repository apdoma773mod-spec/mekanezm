import sharp from 'sharp';
import { geminiJson } from '../web/catalog-ai.js';

/**
 * 📏 «صوّر المتر»: قراءة طول/عرض القطعة من صورة شريط القياس.
 * - السرعة: الصورة بتتصغّر لـ 1280، قراءتين بالتوازي بموديل flash بتفكير قليل، وحد أقصى ~7.5 ثانية — اللي مالحقش بيرجع ambiguous بدل ما يعلّق.
 * - الدقة: الموديل بيقرا الرقم المطبوع عند الحافة الأولى والحافة التانية (مش مسافة بالبكسل) والطول = الفرق،
 *   ولو القراءتين اختلفوا أكتر من نص سم أو الثقة واطية → ambiguous مع المرشحين والموقع يسأل الصنايعي.
 */
export type TapeResult = { len: number | null; wid: number | null; confidence: number; ambiguous: boolean; candidates: { len: number | null; wid: number | null }[] };

const PROMPT = `الصورة فيها قطعة (خشب/لوح/ألمنيوم/حديد) ومتر شريط قياس محطوط عليها أو جنبها. عايز مقاس القطعة نفسها بالسنتيمتر.
اعمل كده خطوة بخطوة لكل ضلع المتر محطوط عليه:
1) حدد الحافة الأولى للقطعة (غالبًا عند أول المتر/الصفر أو عند الكلابة المعدن) واقرا الرقم المطبوع على المتر عندها بالظبط → start.
2) حدد الحافة التانية للقطعة واقرا الرقم المطبوع على المتر عندها بالظبط → end.
3) ماتحسبش مسافات بالبكسل ولا تخمّن من حجم القطعة — اقرا الأرقام المطبوعة بس.
4) الأرقام الكبيرة = سنتيمتر، والخطوط الصغيرة بينهم = مليمتر (كل خط = 0.1 سم). الأرقام بتمشي بالترتيب (8 9 10 11): لو مش متأكد إن الرقم 10 مش 18 أو 16، بص على اللي قبله واللي بعده.
5) لو الرقم عند الحافة مش واضح، حط احتمالين في alt.
dims: ضلع واحد أو اتنين بس (اللي المتر عليه فعلًا). confidence من 0 لـ 1.
رجّع JSON بس: {"dims":[{"start":number,"end":number,"alt":[number]}],"confidence":number}`;

type Raw = { dims?: { start?: number; end?: number; alt?: number[] }[]; confidence?: number };

const ok = (n: unknown): n is number => typeof n === 'number' && isFinite(n) && n > 0 && n < 1000;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** كل قراءة → قائمة أطوال (الأطول الأول) + بدايل */
function lengths(r: Raw): { main: number[]; alts: number[][] } {
  const ds = (r.dims ?? [])
    .map((d) => {
      const s = typeof d.start === 'number' && isFinite(d.start) ? d.start : 0;
      const e = d.end;
      const v = ok(e) ? r1(Math.abs(e - s)) : NaN;
      const alts = (d.alt ?? []).filter(ok).map((a) => r1(Math.abs(a - s)));
      return { v, alts };
    })
    .filter((d) => ok(d.v))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2);
  return { main: ds.map((d) => d.v), alts: ds.map((d) => d.alts) };
}

export async function readTape(key: string, buf: Buffer, budgetMs = 7500): Promise<TapeResult> {
  const small = await sharp(buf).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const photo = { data: small.toString('base64'), mime: 'image/jpeg' };
  const one = () => geminiJson<Raw>(key, PROMPT, photo, { ms: budgetMs, thinking: 'low', kind: 'tape' }).catch(() => null);
  const deadline = new Promise<null>((res) => setTimeout(() => res(null), budgetMs));
  // ٣ قراءات بالتوازي (نفس الوقت) وبناخد الوسيط: قراءة شاذة واحدة مابتبوّظش النتيجة
  const reads = (await Promise.all([0, 1, 2].map(() => Promise.race([one(), deadline])))).filter((x): x is Raw => !!x);
  const empty: TapeResult = { len: null, wid: null, confidence: 0, ambiguous: true, candidates: [] };
  if (!reads.length) return empty;

  const ls = reads.map(lengths).filter((x) => x.main.length);
  if (!ls.length) return empty;
  const conf = Math.min(...reads.map((r) => (typeof r.confidence === 'number' ? r.confidence : 0.5)));
  const half = (n: number) => Math.round(n * 2) / 2; // المقاسات بالعين بتتقري لأقرب نص سم
  const pick = (i: 0 | 1) => {
    const main = ls.map((x) => x.main[i]).filter(ok).map(half).sort((a, b) => a - b);
    if (!main.length) return { val: null as number | null, all: [] as number[], agree: true };
    const med = main[Math.floor((main.length - 1) / 2)]!;
    const near = main.filter((v) => Math.abs(v - med) <= 0.5).length;
    const agree = near >= 2 && near >= main.length - 1;
    const alts = ls.flatMap((x) => x.alts[i] ?? []).map(half);
    const all = [med, ...[...new Set([...main, ...alts])].filter((v) => v !== med).sort((a, b) => Math.abs(a - med) - Math.abs(b - med))];
    return { val: med, all, agree };
  };
  const L = pick(0);
  const W = pick(1);
  const ambiguous = L.val == null || conf < 0.6 || !L.agree || (W.val != null && !W.agree);
  const lsC: (number | null)[] = L.all.length ? L.all.slice(0, 3) : [null];
  const wsC: (number | null)[] = W.all.length ? W.all.slice(0, 3) : [null];
  const candidates = lsC.flatMap((len) => wsC.map((wid) => ({ len, wid }))).slice(0, 6);
  return { len: L.val, wid: W.val, confidence: Math.round(conf * 100) / 100, ambiguous, candidates };
}
