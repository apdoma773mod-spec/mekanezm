// Lift-up flap calculator (حاسبة الدراعات القلاب).
// Blum data: official Blum catalogue & technical manual 2026 (publications.blum.com/2026/catalogue/en, AVENTOS pages).
// Grass data: Kinvaro T-Slim power-factor bands as listed by several Grass dealers (no open official table) — keep only
// what two sources agree on. Gas struts: torque balance with the standard 90° mounting (GAS_MOUNT below).

/** Front materials: density in kg/m³ (typical values) for estimating the front weight. */
export const MATERIALS = [
  { k: 'mdf', name: 'MDF', rho: 750 },
  { k: 'gloss', name: 'MDF هاي جلوس / أكريليك', rho: 800 },
  { k: 'ply', name: 'كونتر (أبلكاش)', rho: 550 },
  { k: 'chip', name: 'حبيبي (كونتر حبيبي)', rho: 650 },
  { k: 'wood', name: 'خشب طبيعي (زان / أرو)', rho: 700 },
  { k: 'glass', name: 'ألومنيوم بزجاج', rho: 0 },
] as const;
export type MatKey = (typeof MATERIALS)[number]['k'];

/** Front weight (kg) from size (mm) and material. Aluminium + glass: glass 2500 kg/m³ × thickness + frame 0.6 kg per metre of edge. */
export function frontWeight(mat: MatKey, wMm: number, hMm: number, tMm: number) {
  const a = (wMm / 1000) * (hMm / 1000);
  if (mat === 'glass') return a * (tMm / 1000) * 2500 + ((2 * (wMm + hMm)) / 1000) * 0.6;
  const m = MATERIALS.find(x => x.k === mat)!;
  return a * (tMm / 1000) * m.rho;
}

export type Kind = 'flap' | 'fold' | 'parallel' | 'over';
export const KINDS: { k: Kind; t: string; s: string }[] = [
  { k: 'flap', t: 'ضلفة قلاب لفوق', s: 'ضلفة واحدة بتفتح لفوق على مفصلات (الأشهر)' },
  { k: 'fold', t: 'ضلفتين منطبقين', s: 'ضلفتين فوق بعض بيتطبقوا ويطلعوا مع بعض (أفنتوس HF)' },
  { k: 'parallel', t: 'ضلفة بتطلع لفوق مستقيمة', s: 'الضلفة بتترفع لفوق وهي واقفة (أفنتوس HL)' },
  { k: 'over', t: 'ضلفة بتطلع وتلف فوق الدولاب', s: 'الضلفة بتطلع لفوق وترجع فوق الدولاب (أفنتوس HS)' },
];

export type Input = {
  kind: Kind;
  kb: number;     // cabinet width (mm)
  kh: number;     // cabinet height (mm)
  fh: number;     // front height (mm) — Grass uses it instead of the cabinet height
  fg: number;     // total front weight incl. twice the handle weight (kg) — for «fold» both fronts
  fho?: number;   // fold: upper front height (mm) when the fronts are not equal (theoretical cabinet height = FHo × 2)
};
export type Pick = { brand: 'بلوم' | 'جراس' | 'باكم'; system: string; ok: boolean; part?: string; qty?: string; note: string; lf?: number; alt?: string };

const inRange = (v: number, [a, b]: [number, number]) => v >= a && v <= b;
const fmt = (n: number) => Math.round(n).toLocaleString('en');

/** Pick the first range that fits (the catalogue says: use the stronger one in overlapping areas). */
function byLf(lf: number, rows: [number, number, string][], third = false): { part: string; qty: string; alt?: string } | null {
  const fit = rows.filter(([a, b]) => lf >= a && lf <= b);
  if (fit.length) return { part: fit[fit.length - 1][2], qty: '2 (طقم)', alt: fit.length > 1 ? fit[fit.length - 2][2] : undefined };
  if (third) {
    const fit3 = rows.filter(([a, b]) => lf >= a * 1.5 && lf <= b * 1.5);
    if (fit3.length) return { part: fit3[fit3.length - 1][2], qty: '3 (طقم + واحد زيادة)' };
  }
  return null;
}

// ---- Blum (catalogue 2026) ----
const HKXS: [number, number, string][] = [[200, 1000, '20K1101'], [500, 1500, '20K1301'], [800, 1800, '20K1501']]; // per mechanism, doubled on two sides
const HKS: [number, number, string][] = [[220, 500, '20K2B00'], [400, 1000, '20K2C00'], [960, 2215, '20K2E00']];  // set of 2, +50 % with a third
const HKTOP: [number, number, string][] = [[420, 1610, '22K2300'], [930, 2800, '22K2500'], [1730, 5200, '22K2700'], [3200, 9000, '22K2900']]; // set of 2, max 18 kg
const HL_ARM: [number, number, number, number, string][] = [[300, 339, 1.5, 9, '22L3200'], [340, 389, 1.75, 10, '22L3500'], [390, 540, 2, 12.25, '22L3800'], [480, 580, 2.5, 14, '22L3900']];
const HS: [number, number, number, number, string][] = [[350, 450, 2, 11.5, '22S2200'], [450, 540, 2.5, 12.5, '22S2200'], [480, 660, 2.75, 15.25, '22S2500'], [650, 800, 3.5, 18.5, '22S2800']];
const HF_ARM: [number, number, string][] = [[480, 610, '22F3200'], [600, 910, '22F3500'], [840, 1200, '22F3900']];
// ---- Grass Kinvaro T-Slim: LF = front height (mm) × (front weight + 2 × handle) (kg) ----
const TSLIM: [number, number, string][] = [[250, 500, 'T-Slim (قوة 1)'], [500, 1100, 'T-Slim (قوة 2)'], [1000, 2250, 'T-Slim (قوة 3)'], [1500, 3375, 'T-Slim للضلف العريضة']];

/** Gas struts (باكم عادي — اندوكس وغيره): sizes the shop sells (N). */
export const GAS_SIZES = [80, 100, 120, 150];
/** Standard mounting (the usual 90° kit drawing): 90 mm from the hinge on the front, 255 mm under the top and 10 mm behind
 *  the front edge on the cabinet side. With the front open level, the strut's lever arm about the hinge is
 *  |C × D| / |D − C| for D = (−90, 0), C = (10, −255) ≈ 84 mm. */
export const GAS_MOUNT = { door: 90, side: 255, back: 10 };
const GAS_ARM = Math.abs(GAS_MOUNT.back * 0 - (-GAS_MOUNT.side) * (-GAS_MOUNT.door)) / Math.hypot(GAS_MOUNT.door + GAS_MOUNT.back, GAS_MOUNT.side);
/** Force each strut must give (N), two struts, +15 % for friction and the gas fading with time. */
export const gasNeed = (fgKg: number, fhMm: number) => ((fgKg * 9.81 * (fhMm / 2)) / 2 / GAS_ARM) * 1.15;

export function calculate(i: Input): Pick[] {
  const out: Pick[] = [];
  const { kb, kh, fg } = i;
  if (i.kind === 'flap') {
    const lf = kh * fg;
    // gas strut (باكم): smallest size that holds the front open
    const need = gasNeed(fg, i.fh);
    const g = GAS_SIZES.find(s => s >= need);
    out.push({ brand: 'باكم', system: 'دراع باكم عادي (اندوكس وغيره)', ok: !!g, part: g ? `${g} نيوتن` : undefined, qty: '2 (واحد كل جنب)',
      note: g ? `محتاج حوالي ${Math.round(need)} نيوتن لكل دراع${need < GAS_SIZES[0] * 0.6 ? ' (الضلفة خفيفة — 80 نيوتن هيبقى قوي شوية، ممكن دراع واحد بس)' : ''}. ركّبه على الضلفة ${GAS_MOUNT.door / 10} سم من المفصلة، وعلى جنب الدولاب ${GAS_MOUNT.side / 10} سم تحت السقف — اختيار اقتصادي من غير قفلة هادية`
        : `محتاج حوالي ${Math.round(need)} نيوتن لكل دراع — أكتر من ${GAS_SIZES[GAS_SIZES.length - 1]} نيوتن. خد دراع بلوم أو جراس` });
    // HK-XS
    const two = kb > 610;
    const xs = kh >= 240 && kh <= 600 ? HKXS.filter(([a, b]) => inRange(lf, two ? [a * 2, b * 2] : [a, b])) : [];
    out.push({ brand: 'بلوم', system: 'أفنتوس HK-XS (للضلف الصغيرة)', lf, ok: !!xs.length, part: xs.length ? xs[xs.length - 1][2] : undefined, alt: xs.length > 1 ? xs[xs.length - 2][2] : undefined, qty: two ? '2 (جنبين — العرض أكتر من 61 سم)' : '1 (جنب واحد)',
      note: kh < 240 || kh > 600 ? `ارتفاع الدولاب لازم من 24 لـ 60 سم` : xs.length ? 'خفيف وسعره أقل' : `معامل القوة ${fmt(lf)} خارج مداه`, });
    // HK-S
    const s = kh <= 600 ? byLf(lf, HKS, true) : null;
    out.push({ brand: 'بلوم', system: 'أفنتوس HK-S', lf, ok: !!s, part: s?.part, qty: s?.qty, alt: s?.alt, note: kh > 600 ? 'ارتفاع الدولاب لازم لحد 60 سم' : s ? 'بيقف في أي مكان' : `معامل القوة ${fmt(lf)} خارج مداه` });
    // HK top
    const t = kh >= 205 && kh <= 600 && kb <= 1800 && fg <= 18 ? byLf(lf, HKTOP) : null;
    out.push({ brand: 'بلوم', system: 'أفنتوس HK top', lf, ok: !!t, part: t?.part, qty: t?.qty, alt: t?.alt,
      note: kh < 205 || kh > 600 ? 'ارتفاع الدولاب لازم من 20.5 لـ 60 سم' : kb > 1800 ? 'عرض الدولاب لحد 180 سم' : fg > 18 ? 'أقصى وزن للضلفة 18 كجم' : t ? 'الأقوى والأشيك — قفلة هادية (بلوموشن)' : `معامل القوة ${fmt(lf)} خارج مداه` });
    // Grass T-Slim: power factor uses the front height
    const lfg = i.fh * fg;
    const g2 = TSLIM.filter(([a, b]) => inRange(lfg, [a, b]));
    out.push({ brand: 'جراس', system: 'كينفارو T-Slim', lf: lfg, ok: !!g2.length, part: g2.length ? g2[0][2] : undefined, qty: '2 (طقم)',
      note: g2.length ? 'رفيع جداً وشكله مخفي' : `معامل القوة ${fmt(lfg)} خارج مداه` });
  }
  if (i.kind === 'parallel') {
    const arms = HL_ARM.filter(([a, b, w1, w2]) => inRange(kh, [a, b]) && inRange(fg, [w1, w2]));
    const arm = arms[arms.length - 1];
    const mech = kh >= 300 && kh <= 389 ? '22L2200' : kh >= 390 && kh <= 580 ? '22L2500' : '';
    out.push({ brand: 'بلوم', system: 'أفنتوس HL top', ok: !!arm && !!mech, part: arm && mech ? `${mech} + دراع ${arm[4]}` : undefined, qty: '2 (طقم)',
      note: kh < 300 || kh > 580 ? 'ارتفاع الدولاب لازم من 30 لـ 58 سم' : kb > 1800 ? 'عرض الدولاب لحد 180 سم' : arm ? `وزن الضلفة ${fg.toFixed(1)} كجم مناسب` : `وزن الضلفة ${fg.toFixed(1)} كجم مش في مدى الدراع لارتفاع ${kh / 10} سم` });
  }
  if (i.kind === 'over') {
    const rows = HS.filter(([a, b, w1, w2]) => inRange(kh, [a, b]) && inRange(fg, [w1, w2]));
    const rows3 = rows.length ? [] : HS.filter(([a, b, w1, w2]) => inRange(kh, [a, b]) && inRange(fg, [w1 * 1.5, w2 * 1.5]));
    const r = rows[rows.length - 1] ?? rows3[rows3.length - 1];
    out.push({ brand: 'بلوم', system: 'أفنتوس HS top', ok: !!r, part: r ? `${r[4]} + دراع 22S3500` : undefined, qty: rows.length ? '2 (طقم)' : '3 (طقم + واحد زيادة)',
      note: kh < 350 || kh > 800 ? 'ارتفاع الدولاب لازم من 35 لـ 80 سم' : kb > 1800 ? 'عرض الدولاب لحد 180 سم' : r ? (rows3.length ? 'الوزن عالي — محتاج ميكانيزم تالت' : 'مناسب — ولو الدولاب عريض بلوم بتنصح بميكانيزم تالت عشان نص الضلفة ما يهبطش') : `وزن الضلفة ${fg.toFixed(1)} كجم خارج المدى لارتفاع ${kh / 10} سم` });
  }
  if (i.kind === 'fold') {
    const tkh = i.fho && i.fho > 0 ? i.fho * 2 : kh; // asymmetric: theoretical cabinet height ≈ upper front × 2 (+ gaps)
    const lf = tkh * fg;
    const arm = HF_ARM.filter(([a, b]) => inRange(tkh, [a, b])).pop();
    let part = '', qty = '';
    if (kb <= 600 && lf >= 1350 && lf <= 3000) { part = 'ميكانيزم واحد (من طقم 22F2500)'; qty = '1'; }
    else { const m = byLf(lf, [[2700, 13500, '22F2500'], [10000, 19300, '22F2800']], true); if (m) { part = m.part; qty = m.qty; } }
    const ok = !!part && !!arm && kh >= 480 && kh <= 1200 && kb <= 1800;
    out.push({ brand: 'بلوم', system: 'أفنتوس HF top (الضلفتين المنطبقين)', lf, ok, part: ok ? `${part} + دراع ${arm![2]}` : undefined, qty,
      note: kh < 480 || kh > 1200 ? 'ارتفاع الدولاب لازم من 48 لـ 120 سم' : kb > 1800 ? 'عرض الدولاب لحد 180 سم' : !part ? `معامل القوة ${fmt(lf)} خارج المدى` : i.fho ? 'ضلف مش متساوية: الكبيرة لازم تبقى فوق' : 'مناسب' });
  }
  return out;
}
