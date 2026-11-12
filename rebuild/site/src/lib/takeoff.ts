// «ارفع رسمتك → حصر الإكسسوارات».
// The drawing is READ by AI (backend, /web/public/takeoff) into a plain description of the units: doors, drawers,
// shelves, partitions, rails… The COUNTING is done here with fixed trade rules, so the same drawing always gives the
// same list and every number shows where it came from. To change a rule, change RULES below — nothing else.
//
// Modern board work (ready-faced boards, no paint): nothing may be nailed through the face, so every panel-to-panel
// joint is held from inside with assembly angles (زاوية تجميع), and the base frame is fixed from underneath with
// 3×3 «بلدي» angles. Both are counted joint by joint from the real size of the unit — never a flat number.
import { hingesFor } from './custom-draw';

/* ------------------------------------------------------------------ rules (the shop's trade defaults) */
export const RULES = {
  /** Standard drawer-slide lengths (cm). The slide is the longest one that fits in (unit depth − clearance). */
  slideLengths: [25, 30, 35, 40, 45, 50, 55, 60],
  slideClearance: 5,
  /** When the drawing gives no depth. */
  slideDefault: { base: 50, drawer_unit: 50, island: 50, wardrobe: 45, tall: 50, other: 45 } as Record<string, number>,
  depthDefault: { base: 56, drawer_unit: 56, island: 56, wardrobe: 58, tall: 56, wall: 32, open: 40, other: 50 } as Record<string, number>,
  /** Shelf supports (تكاية رف) per movable shelf. */
  shelfPins: 4,
  /** A movable shelf with a clear span over this (cm) is fixed with assembly angles instead of pins, so it does not sag. */
  longShelf: 90,
  /** Assembly angles along ONE joint (a panel edge meeting another panel), by the depth of the joint. */
  joinPerJoint: (d: number) => (d <= 35 ? 2 : d <= 62 ? 3 : 4),
  /** Wall units: hanging brackets (تعليقة) per unit, rail = total width. */
  hangPerUnit: 2,
  /** Legs under floor units standing on legs. */
  legs: (w: number) => (w <= 90 ? 4 : w <= 150 ? 6 : 8),
  /**
   * Base (قاعدة) under a wardrobe: a frame with cross pieces, held with 3×3 «بلدي» angles — ONE kind per job
   * (wide or narrow, the craftsman's habit). Angles: 4 at the frame corners, 4 on every cross piece (2 each end),
   * and the frame is fixed to the cabinet bottom all round (one angle every `fixEvery` cm on the front and on the back, plus the two ends).
   */
  baseCorners: 4, basePerCross: 4, baseCrossEvery: 60, baseFixEvery: 60, baseFixEnds: 2,
  /** Hanging rail: 2 end supports, a middle support for long rails. */
  railMiddleOver: 100,
  /** Sliding doors overlap each other by this much (cm). */
  slideOverlap: 5,
  /** Leaves for a sliding wardrobe by its width, when the drawing does not say. */
  slidingLeaves: (w: number) => (!w || w <= 180 ? 2 : w <= 280 ? 3 : 4),
  /** Door height assumed when the drawing shows none (cm). */
  doorH: { base: 70, wall: 70, tall: 200, wardrobe: 220, drawer_unit: 70, open: 70, island: 70, other: 70 } as Record<string, number>,
  /** Below this the AI's «hinged or sliding?» answer is shown to the craftsman as a question. */
  doorSure: 0.75,
};

/* ------------------------------------------------------------------ the model the AI returns */
export type DoorKind = 'hinged' | 'sliding' | 'lift_up' | 'flap_down' | 'folding';
export type TDoor = { kind: DoorKind; material: 'wood' | 'glass' | 'alu_frame' | 'mirror'; count: number; h: number; w: number; /** how sure the AI is of `kind` (0–1) */ sure: number };
export type TUnit = {
  id: string; name: string; type: 'base' | 'wall' | 'tall' | 'wardrobe' | 'drawer_unit' | 'open' | 'island' | 'other';
  count: number; w: number; h: number; d: number; mount: 'floor' | 'wall'; plinth: boolean; legs: boolean; corner: boolean;
  doors: TDoor[]; drawers: { count: number; inner: boolean }[]; shelvesAdj: number; shelvesFixed: number;
  /** Upright partitions inside the unit. `dividersKnown` = the drawing shows the inside (or the craftsman set it). */
  dividers: number; dividersKnown: boolean;
  rails: number[]; pullouts: { kind: string; count: number }[]; handles: 'handle' | 'gola' | 'push' | 'unknown'; note: string; confidence: number;
};
/** One thing the AI pointed at on the drawing: page index, what it is, the unit it belongs to, and its box (fractions 0–1: x0,y0,x1,y1). */
export type TMark = { p: number; k: 'drawer' | 'door' | 'sliding' | 'flap'; u: number; box: [number, number, number, number] };
export type TModel = { kind: string; summary: string; quality: 'clear' | 'partial' | 'poor'; units: TUnit[]; marks: TMark[]; questions: string[]; assumptions: string[] };

const int = (v: unknown, max = 500) => { const n = Math.round(Number(v)); return isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const cm = (v: unknown) => { const n = Number(v); return isFinite(n) && n > 0 ? Math.min(Math.round(n * 10) / 10, 2000) : 0; };
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 12) : []);
type Raw = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as Raw[]).filter(x => x && typeof x === 'object') : []);
const unit01 = (v: unknown, def: number) => { const n = Number(v); return v != null && isFinite(n) ? Math.max(0, Math.min(1, n)) : def; };

/** Whatever the AI sent → a safe model (wrong types and silly numbers never reach the counting). */
export function normalize(raw: unknown): TModel {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  const units = arr(r.units).slice(0, 80).map((u, i): TUnit => {
    const type = oneOf(u.type, ['base', 'wall', 'tall', 'wardrobe', 'drawer_unit', 'open', 'island', 'other'] as const, 'other');
    const dv = Number(u.dividers);
    return {
      id: 'u' + i, name: String(u.name ?? '').trim().slice(0, 60) || `وحدة ${i + 1}`, type,
      count: Math.max(1, int(u.count, 60)), w: cm(u.w), h: cm(u.h), d: cm(u.d),
      mount: oneOf(u.mount, ['floor', 'wall'] as const, type === 'wall' ? 'wall' : 'floor'),
      plinth: !!u.plinth, legs: !!u.legs, corner: !!u.corner,
      doors: arr(u.doors).map(d => ({
        kind: oneOf(d.kind, ['hinged', 'sliding', 'lift_up', 'flap_down', 'folding'] as const, 'hinged'),
        material: oneOf(d.material, ['wood', 'glass', 'alu_frame', 'mirror'] as const, 'wood'),
        count: int(d.count, 40), h: cm(d.h), w: cm(d.w), sure: unit01(d.sure, 0.8),
      })).filter(d => d.count > 0),
      drawers: arr(u.drawers).map(d => ({ count: int(d.count, 60), inner: !!d.inner })).filter(d => d.count > 0),
      shelvesAdj: int(u.shelves_adjustable ?? u.shelvesAdj, 60), shelvesFixed: int(u.shelves_fixed ?? u.shelvesFixed, 60),
      // −1 (or nothing) = the drawing does not show the inside; 0 with dividers_seen = really none.
      dividers: isFinite(dv) && dv > 0 ? Math.min(Math.round(dv), 30) : 0,
      dividersKnown: u.dividersKnown === true || u.dividers_seen === true || (isFinite(dv) && dv > 0),
      rails: (Array.isArray(u.rails) ? u.rails : []).map(x => cm(typeof x === 'object' && x ? (x as Raw).len : x)).slice(0, 20),
      pullouts: arr(u.pullouts).map(p => ({ kind: String(p.kind ?? '').trim(), count: Math.max(1, int(p.count, 20)) })).filter(p => p.kind in PULLOUTS),
      handles: oneOf(u.handles, ['handle', 'gola', 'push', 'unknown'] as const, 'unknown'),
      note: String(u.note ?? '').trim().slice(0, 200),
      confidence: unit01(u.confidence, 0.5),
    };
  });
  const marks = arr(r.marks).slice(0, 400).map((m): TMark | null => {
    const b = Array.isArray(m.box) ? m.box.map(Number) : [];
    if (b.length !== 4 || b.some(x => !isFinite(x))) return null;
    // The AI answers [ymin, xmin, ymax, xmax] on a 0–1000 grid; a model saved in this browser already holds fractions [x0, y0, x1, y1].
    const frac = b.every(x => x >= 0 && x <= 1);
    const [x0, y0, x1, y1] = frac ? b : [b[1], b[0], b[3], b[2]].map(x => Math.max(0, Math.min(1, x / 1000)));
    if (x1 - x0 < 0.004 || y1 - y0 < 0.004) return null;
    return { p: int(m.p ?? m.page, 20), k: oneOf(m.k ?? m.kind, ['drawer', 'door', 'sliding', 'flap'] as const, 'door'), u: int(m.u ?? m.unit, 80), box: [x0, y0, x1, y1] };
  }).filter((m): m is TMark => !!m);
  return {
    kind: String(r.kind ?? 'other'), summary: String(r.summary ?? '').trim().slice(0, 300),
    quality: oneOf(r.quality, ['clear', 'partial', 'poor'] as const, 'partial'),
    units, marks, questions: strs(r.questions), assumptions: strs(r.assumptions),
  };
}

/* ------------------------------------------------------------------ ready-made accessories the AI may name */
export const PULLOUTS: Record<string, { label: string; match: RegExp }> = {
  magic_corner: { label: 'ماجيك كورنر', match: /ماجيك|magic/i },
  bean_corner: { label: 'كورنر فاصوليا', match: /فاصوليا|bean|كلوة/i },
  pantry: { label: 'وحدة خزين سحّاب', match: /خزين|pantry|لاردر/i },
  basket: { label: 'سلة سحّاب', match: /سل[ةه]|basket/i },
  dish_rack: { label: 'مطبقية / نشّافة أطباق', match: /مطبقي|نشاف|نشّاف|dish/i },
  bin: { label: 'باسكت زبالة', match: /زبال|قمام|bin|waste/i },
  spice: { label: 'توابلية / زجاجات سحّاب', match: /توابل|بهارات|زجاجات|spice|bottle/i },
  shoe_rack: { label: 'جزّامة', match: /جزام|جزّام|shoe/i },
  trouser: { label: 'علّاقة بناطيل سحّاب', match: /بنطلون|بناطيل|trouser/i },
  tie: { label: 'علّاقة كرافتات / أحزمة', match: /كرافت|حزام|أحزمة|tie|belt/i },
  safe: { label: 'درج خزنة', match: /خزن[هة]|safe/i },
  mirror_pull: { label: 'مراية سحّاب', match: /مراي|مرآة|mirror/i },
  ironing: { label: 'ترابيزة مكوى', match: /مكو[ىي]|iron/i },
  hanger_lift: { label: 'علّاقة هيدروليك (ليفت)', match: /ليفت|هيدروليك|lift.*hang|wardrobe lift/i },
  jewelry: { label: 'درج إكسسوارات / مجوهرات', match: /مجوهرات|اكسسوارات|jewel/i },
  led: { label: 'إضاءة LED', match: /led|ليد|إضاء|اضاء/i },
  lock: { label: 'كالون / قفل', match: /كالون|قفل|lock/i },
};

/* ------------------------------------------------------------------ the list */
export type Group = 'doors' | 'drawers' | 'inside' | 'build' | 'ready';
export const GROUPS: Record<Group, string> = { doors: '🚪 الضلف', drawers: '🗄️ الأدراج', inside: '👔 جوّه الدولاب', build: '🔩 التجميع والتثبيت', ready: '✨ إكسسوارات جاهزة' };
export type TLine = {
  k: string; group: Group; label: string; qty: number; unit: string;
  /** Where the number came from, one entry per unit. */
  why: string[];
  /** Extra guidance under the line (sizes, what to check). */
  tip?: string;
  /** The counts behind this line were unclear in the drawing. */
  doubt: boolean;
  match: RegExp; not?: RegExp;
  /** Units (ids) this line belongs to — used by the drawing. */
  units: string[];
};

export const slideLen = (u: Pick<TUnit, 'd' | 'type'>) => {
  if (!u.d) return { len: RULES.slideDefault[u.type] ?? 45, guessed: true };
  const fit = RULES.slideLengths.filter(l => l <= u.d - RULES.slideClearance);
  return { len: fit.length ? fit[fit.length - 1] : RULES.slideLengths[0], guessed: false };
};
export const doorHeight = (u: TUnit, d: TDoor) => {
  if (d.h) return { h: d.h, guessed: false };
  // No leaf height on the drawing: the unit's own height (less the base) is the closest truth.
  // (Only when the front has no drawers sharing the height with the doors.)
  if (u.h && !u.drawers.some(x => !x.inner)) return { h: Math.max(20, u.h - (u.plinth || u.legs ? 10 : 0)), guessed: false };
  const def = RULES.doorH[u.type] ?? 70;
  return { h: u.h ? Math.min(u.h, def) : def, guessed: true };
};
/** Width of each sliding leaf so they cover the opening with the usual overlap. */
export const slidingLeafW = (w: number, n: number) => (w && n ? Math.round(((w + RULES.slideOverlap * (n - 1)) / n) * 10) / 10 : 0);
/** Does this unit sit on a wooden base that takes the 3×3 angles? */
export const hasBase = (u: TUnit, kind: string) => u.mount === 'floor' && !u.legs && (u.plinth || u.type === 'wardrobe' || (kind !== 'kitchen' && u.type === 'tall'));
export const hasLegs = (u: TUnit, kind: string) => u.mount === 'floor' && !hasBase(u, kind) && (u.legs || (kind === 'kitchen' && (u.type === 'base' || u.type === 'tall' || u.type === 'drawer_unit' || u.type === 'island')));

const leaves = (u: TUnit, kinds: DoorKind[]) => u.doors.reduce((n, d) => n + (kinds.includes(d.kind) ? d.count : 0), 0);
/**
 * Upright partitions inside the unit. When the drawing shows only closed doors, they are worked out from the doors:
 * hinged leaves close in pairs on a partition, every sliding leaf covers one bay, and no bay is wider than ~1.2 m.
 */
export function partitions(u: TUnit): { n: number; guessed: boolean } {
  if (u.dividersKnown) return { n: u.dividers, guessed: false };
  if (!(u.type === 'wardrobe' || u.type === 'tall' || u.type === 'open' || u.type === 'other') || (u.w && u.w <= 100)) return { n: 0, guessed: false };
  const hinged = leaves(u, ['hinged', 'folding']), sliding = leaves(u, ['sliding']);
  const byDoors = sliding ? sliding - 1 : hinged ? Math.ceil(hinged / 2) - 1 : 0;
  const byWidth = u.w ? Math.ceil(u.w / 120) - 1 : 0;
  const n = Math.max(0, byDoors, byWidth);
  return { n, guessed: n > 0 };
}
/** Clear width of one bay between partitions (cm). */
export const baySpan = (u: TUnit) => (u.w ? Math.round((u.w / (partitions(u).n + 1)) * 10) / 10 : 0);
/** Movable shelves too long to sit on pins: they are fixed with assembly angles. */
export const longShelves = (u: TUnit) => (baySpan(u) > RULES.longShelf ? u.shelvesAdj : 0);
/** Cross pieces of the base frame: under every partition, and never further apart than `baseCrossEvery`. */
export const baseCross = (u: TUnit) => Math.max(partitions(u).n, u.w ? Math.ceil(u.w / RULES.baseCrossEvery) - 1 : 0);
export function baseAngles(u: TUnit) {
  const cross = baseCross(u), fix = (u.w ? Math.ceil(u.w / RULES.baseFixEvery) : 1) * 2 + RULES.baseFixEnds;
  return { cross, corners: RULES.baseCorners, onCross: cross * RULES.basePerCross, fix, total: RULES.baseCorners + cross * RULES.basePerCross + fix };
}
/** Assembly angles for one unit: every panel-to-panel joint × angles along that joint. */
export function joinAngles(u: TUnit) {
  const d = u.d || RULES.depthDefault[u.type] || 50, per = RULES.joinPerJoint(d), part = partitions(u), long = longShelves(u);
  const joints = { sides: 4, parts: part.n * 2, fixed: u.shelvesFixed * 2, long: long * 2 };
  return { d, per, part, long, joints, total: (joints.sides + joints.parts + joints.fixed + joints.long) * per, depthGuessed: !u.d };
}

/** Switch a unit's doors between hinged and sliding (one tap in the result), keeping what the drawing gave. */
export function switchDoors(u: TUnit, kind: 'hinged' | 'sliding'): TUnit {
  const others = u.doors.filter(d => d.kind !== 'hinged' && d.kind !== 'sliding' && d.kind !== 'folding');
  const cur = u.doors.filter(d => d.kind === 'hinged' || d.kind === 'sliding' || d.kind === 'folding');
  const h = cur.find(d => d.h)?.h ?? 0, material = cur[0]?.material ?? 'wood', n0 = cur.reduce((n, d) => n + d.count, 0);
  const count = kind === 'sliding'
    ? (n0 >= 2 && n0 <= 4 && (!u.w || u.w / n0 >= 55) ? n0 : RULES.slidingLeaves(u.w))
    : (u.w ? Math.max(1, Math.round(u.w / 50)) : Math.max(2, n0 * 2));
  return { ...u, doors: [{ kind, material, count: kind === 'hinged' && count > 1 && count % 2 ? count + 1 : count, h, w: 0, sure: 1 }, ...others] };
}
/** The unit's main doors, when they are plain hinged or sliding leaves (what the one-tap switch works on). */
export const mainDoorKind = (u: TUnit): 'hinged' | 'sliding' | null => {
  const d = u.doors.find(x => x.kind === 'hinged' || x.kind === 'sliding');
  return d ? (d.kind as 'hinged' | 'sliding') : null;
};

const m1 = (cmLen: number) => Math.round(cmLen) / 100; // cm → m, 2 decimals

/**
 * The hardware list for a model. `doubt` = totals the AI's own cross-check disagreed on (from the backend):
 * hinged, sliding, flaps, drawers, shelves, rails, units.
 */
export function takeoff(model: TModel, doubt: string[] = []): TLine[] {
  const L = new Map<string, TLine>();
  const D = new Set(doubt);
  const put = (k: string, group: Group, label: string, unit: string, match: RegExp, n: number, why: string, u: TUnit, o: { doubt?: boolean; tip?: string; not?: RegExp } = {}) => {
    if (!(n > 0)) return;
    let l = L.get(k);
    if (!l) L.set(k, (l = { k, group, label, qty: 0, unit, why: [], doubt: false, match, not: o.not, units: [], tip: o.tip }));
    l.qty += n;
    l.why.push(why);
    if (o.doubt || u.confidence < 0.6 || D.has('units')) l.doubt = true;
    if (!l.units.includes(u.id)) l.units.push(u.id);
  };
  const x = (u: TUnit) => (u.count > 1 ? ` × ${u.count} وحدة` : '');

  for (const u of model.units) {
    const c = u.count;
    let handleN = 0, pushN = 0;
    const span = baySpan(u);

    /* ---- doors */
    for (const d of u.doors) {
      const n = d.count * c;
      const unsure = d.sure < RULES.doorSure;
      if (d.kind === 'sliding') {
        const leaf = slidingLeafW(u.w, d.count), lh = d.h || (u.h ? Math.max(20, u.h - (hasBase(u, model.kind) ? 10 : 0)) : 0);
        put(`sliding-${d.count}`, 'doors', `طقم جرار دولاب ${d.count} ضلفة`, 'طقم', /جرار|سحاب|sliding/i, c,
          `${u.name}: ${d.count} ضلفة جرار${u.w ? ` — سكة ${u.w} سم` : ''}${x(u)}`, u,
          { doubt: D.has('sliding') || !u.w || unsure, not: /درج|مجر/, tip: leaf ? `مقاس كل ضلفة ≈ ${leaf}${lh ? ` × ${lh}` : ''} سم (ركوب ${RULES.slideOverlap} سم بين الضلف). الطقم بيتحدد بعدد الضلف (${d.count})، طول السكة (${u.w} سم)، ووزن الضلفة — راجع مقاسات الطقم قبل التقطيع.` : 'اكتب عرض الدولاب عشان نحسب مقاس كل ضلفة وطول السكة.' });
        put('sliding-handle', 'doors', 'مقبض دفن لضلف الجرار', 'قطعة', /دفن|مقبض.*جرار|جرار.*مقبض/i, n, `${u.name}: ${d.count} ضلفة جرار${x(u)}`, u, { doubt: D.has('sliding') || unsure });
        continue;
      }
      if (d.kind === 'lift_up') {
        put('lift', 'doors', 'دراع قلاب / باكم (طقم للضلفة)', 'طقم', /قلاب|أفنتوس|افنتوس|aventos|lift|بيستون|piston/i, n, `${u.name}: ${d.count} ضلفة قلاب${x(u)}`, u,
          { doubt: D.has('flaps'), tip: 'نوع الدراع بيتحدد بوزن ومقاس الضلفة — استخدم حاسبة الدراعات القلاب.' });
        put('hinge', 'doors', 'مفصلات ضلف', 'مفصلة', HINGE, 2 * n, `${u.name}: ${d.count} ضلفة قلاب × 2 مفصلة (لو الدراع باكم عادي)${x(u)}`, u, { doubt: D.has('flaps'), not: NOT_PLAIN_HINGE });
        if (u.handles === 'push') pushN += n; else handleN += n;
        continue;
      }
      if (d.kind === 'flap_down') {
        put('flap-stay', 'doors', 'دراع قلاب لتحت (ستاي)', 'قطعة', /قلاب.*تحت|ستاي|stay|flap/i, n, `${u.name}: ${d.count} ضلفة قلاب لتحت${x(u)}`, u, { doubt: D.has('flaps') });
        put('hinge', 'doors', 'مفصلات ضلف', 'مفصلة', HINGE, 2 * n, `${u.name}: ${d.count} ضلفة قلاب لتحت × 2 مفصلة${x(u)}`, u, { doubt: D.has('flaps'), not: NOT_PLAIN_HINGE });
        if (u.handles === 'push') pushN += n; else handleN += n;
        continue;
      }
      // hinged / folding
      const { h, guessed } = doorHeight(u, d);
      const per = hingesFor(h);
      const dd = D.has('hinged') || guessed || unsure;
      const why = `${u.name}: ${d.count} ضلفة × ${per} مفصلة (طول ${h} سم${guessed ? ' تقديري' : ''})${x(u)}`;
      if (d.material === 'glass') put('hinge-glass', 'doors', 'مفصلات زجاج', 'مفصلة', /مفصل.*(زجاج|قزاز)|(زجاج|قزاز).*مفصل/i, per * n, why, u, { doubt: dd });
      else if (d.material === 'alu_frame') put('hinge-alu', 'doors', 'مفصلات ضلف ألمنيوم', 'مفصلة', /مفصل.*(ألمنيوم|الومنيوم|المونيوم)|(ألمنيوم|الومنيوم|المونيوم).*مفصل/i, per * n, why, u, { doubt: dd });
      else if (u.corner) put('hinge-corner', 'doors', 'مفصلات ركنة (بلاند / 165°)', 'مفصلة', /بلاند|blind|165|ركن.*مفصل|مفصل.*(ركن|كورنر)/i, per * n, why, u, { doubt: true, tip: 'نوع مفصلة الركنة بيفرق حسب تصميم الركنة (عمياء ولا ضلفتين مكسورين) — أكّد مع المحل.' });
      else put('hinge', 'doors', 'مفصلات ضلف', 'مفصلة', HINGE, per * n, why, u, { doubt: dd, not: NOT_PLAIN_HINGE });
      if (d.kind === 'folding') put('fold-hinge', 'doors', 'مفصلات أكورديون بين الضلف', 'مفصلة', /أكورديون|اكورديون|bifold|fold/i, per * Math.floor(d.count / 2) * c, `${u.name}: ${Math.floor(d.count / 2)} وصلة × ${per}${x(u)}`, u, { doubt: true });
      if (u.handles === 'push') pushN += n; else handleN += n;
    }

    /* ---- drawers */
    for (const d of u.drawers) {
      const n = d.count * c;
      const s = slideLen(u);
      put(`slide-${s.len}`, 'drawers', `مجر أدراج ${s.len} سم`, 'جوز', /مجر|مجرى|مجري|slide/i, n,
        `${u.name}: ${d.count} درج${d.inner ? ' داخلي' : ''} (${u.d ? `عمق ${u.d} سم` : 'العمق مش مكتوب — مقاس شائع'})${x(u)}`, u, { doubt: D.has('drawers') || s.guessed });
      if (!d.inner) { if (u.handles === 'push') pushN += n; else handleN += n; }
    }

    /* ---- handles */
    const wSpan = u.w * c;
    if (u.handles === 'gola') {
      if (u.doors.length || u.drawers.length) put('gola', 'doors', 'بروفيل جولا', 'متر', /جولا|gola/i, m1(wSpan), `${u.name}: عرض ${u.w || '؟'} سم${x(u)}`, u, { doubt: !u.w });
    } else {
      put('handle', 'doors', 'مقابض', 'مقبض', /مقبض|مقابض|handle/i, handleN, `${u.name}: ${handleN} (ضلف + أدراج)`, u, { doubt: D.has('hinged') || D.has('drawers') || u.handles === 'unknown', not: /دفن|جرار/ });
      put('push', 'doors', 'طبّاشة (بوش) للفتح باللمس', 'قطعة', /طباش|طبّاش|بوش|push/i, pushN, `${u.name}: ${pushN} (ضلف + أدراج)`, u, { doubt: D.has('hinged') || D.has('drawers') });
    }

    /* ---- inside */
    const long = longShelves(u), pinned = u.shelvesAdj - long;
    if (pinned > 0) put('shelf-pin', 'inside', 'تكاية رف', 'قطعة', /تكاي|تكّاي|حامل رف|shelf.*(pin|support)/i, pinned * RULES.shelfPins * c, `${u.name}: ${pinned} رف متحرك × ${RULES.shelfPins}${x(u)}`, u, { doubt: D.has('shelves') });
    const rails = u.rails.filter(r => r >= 0);
    if (rails.length) {
      const total = rails.reduce((s, r) => s + r, 0) * c;
      const known = rails.every(r => r > 0);
      put('rail', 'inside', 'ماسورة تعليق', 'متر', /ماسور|rail|مواسير/i, known ? m1(total) : rails.length * c,
        `${u.name}: ${rails.map(r => (r ? r + ' سم' : 'طول؟')).join(' + ')}${x(u)}`, u, { doubt: D.has('rails') || !known, tip: known ? undefined : 'طول الماسورة مش مكتوب في الرسمة — العدد هنا بعدد المواسير.' });
      put('rail-end', 'inside', 'حامل ماسورة (جانبي)', 'قطعة', /حامل.*ماسور|ماسور.*حامل|فلانش|flange/i, rails.length * 2 * c, `${u.name}: ${rails.length} ماسورة × 2${x(u)}`, u, { doubt: D.has('rails') });
      const mid = rails.filter(r => r > RULES.railMiddleOver).length;
      put('rail-mid', 'inside', 'حامل ماسورة وسط', 'قطعة', /حامل.*وسط|وسط.*ماسور|center.*support/i, mid * c, `${u.name}: ${mid} ماسورة أطول من ${RULES.railMiddleOver} سم${x(u)}`, u, { doubt: D.has('rails') });
    }

    /* ---- build: every joint held from inside */
    const J = joinAngles(u);
    put('join', 'build', 'زاوية تجميع', 'قطعة', /زاوي.*تجميع|تجميع|minifix|مينيفكس/i, J.total * c,
      `${u.name}: ${[
        'الجنبين مع السقف والقاعدة 4 وصلات',
        J.joints.parts ? `${J.part.n} قاطوع${J.part.guessed ? ' (محسوب من الضلف)' : ''} × 2 وصلة` : '',
        J.joints.fixed ? `${u.shelvesFixed} رف ثابت × 2 وصلة` : '',
        J.joints.long ? `${J.long} رف طويل (${span} سم) × 2 وصلة` : '',
      ].filter(Boolean).join(' + ')} — كل وصلة ${J.per} زوايا (عمق ${J.d} سم${J.depthGuessed ? ' تقديري' : ''})${x(u)}`, u,
      { doubt: D.has('shelves') || J.part.guessed || J.depthGuessed, tip: 'الخشب الجاهز مابيتسمّرش من الوش: كل وصلة بين لوحين بتتمسك من جوّه بزوايا تجميع على طول العمق. لو عدد القواطيع أو الأرفف الثابتة مختلف عدّله في الوحدة والرقم يتحسب تاني.' });
    if (u.mount === 'wall') {
      put('hang', 'build', 'تعليقة دولاب', 'قطعة', /تعليق[ةه]|علاق[ةه] دولاب|hanger|suspension/i, RULES.hangPerUnit * c, `${u.name}: ${RULES.hangPerUnit} للوحدة${x(u)}`, u, { not: /ماسور|بنطلون|كرافت/ });
      if (u.w) put('hang-rail', 'build', 'شريحة تعليق على الحيطة', 'متر', /شريح[ةه].*تعليق|سكة تعليق|rail.*hang/i, m1(wSpan), `${u.name}: عرض ${u.w} سم${x(u)}`, u);
    }
    if (hasLegs(u, model.kind)) {
      const n = RULES.legs(u.w || 60);
      put('leg', 'build', 'رجل دولاب أرضي', 'قطعة', /رجل|رجول|أرجل|leg/i, n * c, `${u.name}: ${n} رجل (عرض ${u.w || '؟'} سم)${x(u)}`, u, { doubt: !u.w });
    }
    if (hasBase(u, model.kind)) {
      const B = baseAngles(u);
      put('base-angle', 'build', 'زاوية بلدي 3×3 للقاعدة (عريضة أو ضيقة)', 'قطعة', /زاوي.*بلدي|زاوي[ةه].*3\s*[×x*في]+\s*3|زاوي[ةه] (عريض|ضيق)/i, B.total * c,
        `${u.name}: ${B.corners} أركان البرواز + ${B.cross} قاطوع × ${RULES.basePerCross} + ${B.fix} تثبيت البرواز في قاعدة الدولاب${u.w ? ` (عرض ${u.w} سم)` : ''}${x(u)}`, u,
        { doubt: !u.w, not: /تجميع/, tip: 'نوع واحد للشغلانة: عريضة أو ضيقة حسب شغلك — اختار من «شوف الأنواع». العدد = أركان البرواز + 4 لكل قاطوع في القاعدة + تثبيت البرواز من تحت.' });
    }

    /* ---- ready-made accessories */
    for (const p of u.pullouts) {
      const P = PULLOUTS[p.kind];
      put('po-' + p.kind, 'ready', P.label, 'قطعة', P.match, p.count * c, `${u.name}${p.count > 1 ? `: ${p.count}` : ''}${x(u)}`, u);
    }
  }
  const order: Group[] = ['doors', 'drawers', 'inside', 'build', 'ready'];
  return [...L.values()].map(l => ({ ...l, qty: l.unit === 'متر' ? Math.round(l.qty * 100) / 100 : Math.round(l.qty) })).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}
/** Cabinet hinges as the shop names them: by the word, by brand (ساميت، اتاش), or by overlay (عدلة، نص ركبة، ركبة كاملة). */
const HINGE = /مفصل|ساميت|samet|اتاش|هيتش|hettich|نص ركب|ركب[هة] كامل|عدل[هة]/i;
/** A plain cabinet hinge is none of these special ones. */
const NOT_PLAIN_HINGE = /زجاج|قزاز|ألمنيوم|الومنيوم|المونيوم|بلاند|كورنر|ركن|أكورديون|اكورديون|باب|دلف/;

/**
 * Where the AI's own pointing disagrees with its numbers: it drew N boxes on the drawers / doors of a unit but wrote
 * a different count. Keyed by unit id: [written, pointed at].
 */
export function markMismatch(model: TModel): Record<string, { drawers?: [number, number]; doors?: [number, number] }> {
  const out: Record<string, { drawers?: [number, number]; doors?: [number, number] }> = {};
  model.units.forEach((u, i) => {
    const ms = model.marks.filter(m => m.u === i);
    if (!ms.length || u.count > 1) return;
    const dr = ms.filter(m => m.k === 'drawer').length, drN = u.drawers.reduce((n, d) => n + d.count, 0);
    const dm = ms.filter(m => m.k !== 'drawer').length, doN = u.doors.reduce((n, d) => n + d.count, 0);
    if (dr && dr !== drN) (out[u.id] ??= {}).drawers = [drN, dr];
    if (dm && dm !== doN) (out[u.id] ??= {}).doors = [doN, dm];
  });
  return out;
}

/* ------------------------------------------------------------------ matching to the shop's products */
const digits = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
/** Products that fit a line, best first: in stock, then the ones naming the same size (slide length, door count). */
export function candidates<P extends { name: string; tags: string[]; top?: boolean }>(line: Pick<TLine, 'k' | 'match' | 'not'>, all: P[], ok: (p: P) => boolean, max = 8): P[] {
  const size = line.k.match(/^(?:slide|sliding)-(\d+)$/)?.[1];
  const hit = all.filter(p => {
    const t = `${p.name} ${p.tags.join(' ')}`;
    return line.match.test(t) && !(line.not && line.not.test(p.name));
  });
  const score = (p: P) => (ok(p) ? 2 : 0) + (size && new RegExp(`(^|\\D)${size}(\\D|$)`).test(digits(p.name)) ? 1 : 0) + (p.top ? 0.5 : 0)
    // Plain doors sit over the cabinet side: the full-overlay hinge («عدلة») is the usual one.
    + (line.k === 'hinge' && /عدل[هة]/.test(p.name) ? 1 : 0);
  return hit.map(p => [p, score(p)] as const).sort((a, b) => b[1] - a[1]).slice(0, max).map(x => x[0]);
}

/** One line of text for WhatsApp / print. */
export const lineText = (l: Pick<TLine, 'label' | 'qty' | 'unit'>, picked?: string) => `• ${l.label}: ${l.qty} ${l.unit}${picked ? ` — ${picked}` : ''}`;
