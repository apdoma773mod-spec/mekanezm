// «ارفع رسمتك → حصر الإكسسوارات».
// The drawing is READ by AI (backend, /web/public/takeoff) into a plain description of the units: doors, drawers,
// shelves, rails… The COUNTING is done here with fixed trade rules, so the same drawing always gives the same list
// and every number shows where it came from. To change a rule, change RULES below — nothing else.
import { hingesFor } from './custom-draw';

/* ------------------------------------------------------------------ rules (the shop's trade defaults) */
export const RULES = {
  /** Standard drawer-slide lengths (cm). The slide is the longest one that fits in (unit depth − clearance). */
  slideLengths: [25, 30, 35, 40, 45, 50, 55, 60],
  slideClearance: 5,
  /** When the drawing gives no depth. */
  slideDefault: { base: 50, drawer_unit: 50, island: 50, wardrobe: 45, tall: 50, other: 45 } as Record<string, number>,
  /** Shelf supports (تكاية رف) per movable shelf; wide shelves get a middle pair. */
  shelfPins: 4, shelfPinsWide: 6, wideShelf: 90,
  /** Assembly angles (زاوية تجميع): carcass corners, then per fixed shelf / upright divider. */
  joinCarcass: 8, joinPerFixed: 4, joinPerDivider: 4,
  /** Wall units: hanging brackets (تعليقة) per unit, rail = total width. */
  hangPerUnit: 2,
  /** Legs under floor units standing on legs. */
  legs: (w: number) => (w <= 90 ? 4 : w <= 150 ? 6 : 8),
  /** Base (قاعدة) reinforcement with 3×3 «بلدي» angles: wide ones at the 4 corners, narrow ones on every cross support. */
  baseWide: 4, baseNarrowPerSupport: 2, baseSupportEvery: 80,
  /** Hanging rail: 2 end supports, a middle support for long rails. */
  railMiddleOver: 100,
  /** Sliding doors overlap each other by this much (cm). */
  slideOverlap: 5,
  /** Door height assumed when the drawing shows none (cm). */
  doorH: { base: 70, wall: 70, tall: 200, wardrobe: 220, drawer_unit: 70, open: 70, island: 70, other: 70 } as Record<string, number>,
};

/* ------------------------------------------------------------------ the model the AI returns */
export type DoorKind = 'hinged' | 'sliding' | 'lift_up' | 'flap_down' | 'folding';
export type TDoor = { kind: DoorKind; material: 'wood' | 'glass' | 'alu_frame' | 'mirror'; count: number; h: number; w: number };
export type TUnit = {
  id: string; name: string; type: 'base' | 'wall' | 'tall' | 'wardrobe' | 'drawer_unit' | 'open' | 'island' | 'other';
  count: number; w: number; h: number; d: number; mount: 'floor' | 'wall'; plinth: boolean; legs: boolean; corner: boolean;
  doors: TDoor[]; drawers: { count: number; inner: boolean }[]; shelvesAdj: number; shelvesFixed: number; dividers: number;
  rails: number[]; pullouts: { kind: string; count: number }[]; handles: 'handle' | 'gola' | 'push' | 'unknown'; note: string; confidence: number;
};
export type TModel = { kind: string; summary: string; quality: 'clear' | 'partial' | 'poor'; units: TUnit[]; questions: string[]; assumptions: string[] };

const int = (v: unknown, max = 500) => { const n = Math.round(Number(v)); return isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const cm = (v: unknown) => { const n = Number(v); return isFinite(n) && n > 0 ? Math.min(Math.round(n * 10) / 10, 2000) : 0; };
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 12) : []);
type Raw = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as Raw[]).filter(x => x && typeof x === 'object') : []);

/** Whatever the AI sent → a safe model (wrong types and silly numbers never reach the counting). */
export function normalize(raw: unknown): TModel {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  const units = arr(r.units).slice(0, 80).map((u, i): TUnit => {
    const type = oneOf(u.type, ['base', 'wall', 'tall', 'wardrobe', 'drawer_unit', 'open', 'island', 'other'] as const, 'other');
    return {
      id: 'u' + i, name: String(u.name ?? '').trim().slice(0, 60) || `وحدة ${i + 1}`, type,
      count: Math.max(1, int(u.count, 60)), w: cm(u.w), h: cm(u.h), d: cm(u.d),
      mount: oneOf(u.mount, ['floor', 'wall'] as const, type === 'wall' ? 'wall' : 'floor'),
      plinth: !!u.plinth, legs: !!u.legs, corner: !!u.corner,
      doors: arr(u.doors).map(d => ({
        kind: oneOf(d.kind, ['hinged', 'sliding', 'lift_up', 'flap_down', 'folding'] as const, 'hinged'),
        material: oneOf(d.material, ['wood', 'glass', 'alu_frame', 'mirror'] as const, 'wood'),
        count: int(d.count, 40), h: cm(d.h), w: cm(d.w),
      })).filter(d => d.count > 0),
      drawers: arr(u.drawers).map(d => ({ count: int(d.count, 40), inner: !!d.inner })).filter(d => d.count > 0),
      shelvesAdj: int(u.shelves_adjustable ?? u.shelvesAdj, 60), shelvesFixed: int(u.shelves_fixed ?? u.shelvesFixed, 60), dividers: int(u.dividers, 30),
      rails: (Array.isArray(u.rails) ? u.rails : []).map(x => cm(typeof x === 'object' && x ? (x as Raw).len : x)).slice(0, 20),
      pullouts: arr(u.pullouts).map(p => ({ kind: String(p.kind ?? '').trim(), count: Math.max(1, int(p.count, 20)) })).filter(p => p.kind in PULLOUTS),
      handles: oneOf(u.handles, ['handle', 'gola', 'push', 'unknown'] as const, 'unknown'),
      note: String(u.note ?? '').trim().slice(0, 200),
      confidence: Math.max(0, Math.min(1, Number(u.confidence) || 0.5)),
    };
  });
  return {
    kind: String(r.kind ?? 'other'), summary: String(r.summary ?? '').trim().slice(0, 300),
    quality: oneOf(r.quality, ['clear', 'partial', 'poor'] as const, 'partial'),
    units, questions: strs(r.questions), assumptions: strs(r.assumptions),
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
export const baseSupports = (u: TUnit) => Math.max(u.dividers, u.w ? Math.floor((u.w - 1) / RULES.baseSupportEvery) : 0);
/** Does this unit sit on a wooden base that takes the 3×3 angles? */
export const hasBase = (u: TUnit, kind: string) => u.mount === 'floor' && !u.legs && (u.plinth || u.type === 'wardrobe' || (kind !== 'kitchen' && u.type === 'tall'));
export const hasLegs = (u: TUnit, kind: string) => u.mount === 'floor' && !hasBase(u, kind) && (u.legs || (kind === 'kitchen' && (u.type === 'base' || u.type === 'tall' || u.type === 'drawer_unit' || u.type === 'island')));

const m1 = (cmLen: number) => Math.round(cmLen) / 100; // cm → m, 2 decimals

/**
 * The hardware list for a model. `doubt` = totals the two AI reads disagreed on (from the backend):
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

    /* ---- doors */
    for (const d of u.doors) {
      const n = d.count * c;
      if (d.kind === 'sliding') {
        const leaf = slidingLeafW(u.w, d.count);
        put(`sliding-${d.count}`, 'doors', `طقم جرار دولاب ${d.count} ضلفة`, 'طقم', /جرار|سحاب|sliding/i, c,
          `${u.name}: ${d.count} ضلفة جرار${u.w ? ` — سكة ${u.w} سم` : ''}${x(u)}`, u,
          { doubt: D.has('sliding') || !u.w, not: /درج|مجر/, tip: leaf ? `عرض كل ضلفة ≈ ${leaf} سم (ركوب ${RULES.slideOverlap} سم بين الضلف) — راجع مقاسات الطقم قبل التقطيع.` : 'اكتب عرض الدولاب عشان نحسب عرض كل ضلفة.' });
        put('sliding-handle', 'doors', 'مقبض دفن لضلف الجرار', 'قطعة', /دفن|مقبض.*جرار|جرار.*مقبض/i, n, `${u.name}: ${d.count} ضلفة جرار${x(u)}`, u, { doubt: D.has('sliding') });
        continue;
      }
      if (d.kind === 'lift_up') {
        put('lift', 'doors', 'دراع قلاب / باكم (طقم للضلفة)', 'طقم', /قلاب|باكم|أفنتوس|افنتوس|aventos|lift|بيستون|piston/i, n, `${u.name}: ${d.count} ضلفة قلاب${x(u)}`, u,
          { doubt: D.has('flaps'), tip: 'نوع الدراع بيتحدد بوزن ومقاس الضلفة — استخدم حاسبة الدراعات القلاب.' });
        put('hinge', 'doors', 'مفصلات ضلف', 'مفصلة', /مفصل/i, 2 * n, `${u.name}: ${d.count} ضلفة قلاب × 2 مفصلة (لو الدراع باكم عادي)${x(u)}`, u, { doubt: D.has('flaps'), not: NOT_PLAIN_HINGE });
        if (u.handles === 'push') pushN += n; else handleN += n;
        continue;
      }
      if (d.kind === 'flap_down') {
        put('flap-stay', 'doors', 'دراع قلاب لتحت (ستاي)', 'قطعة', /قلاب.*تحت|ستاي|stay|flap/i, n, `${u.name}: ${d.count} ضلفة قلاب لتحت${x(u)}`, u, { doubt: D.has('flaps') });
        put('hinge', 'doors', 'مفصلات ضلف', 'مفصلة', /مفصل/i, 2 * n, `${u.name}: ${d.count} ضلفة قلاب لتحت × 2 مفصلة${x(u)}`, u, { doubt: D.has('flaps'), not: NOT_PLAIN_HINGE });
        if (u.handles === 'push') pushN += n; else handleN += n;
        continue;
      }
      // hinged / folding
      const { h, guessed } = doorHeight(u, d);
      const per = hingesFor(h);
      const dd = D.has('hinged') || guessed;
      const why = `${u.name}: ${d.count} ضلفة × ${per} مفصلة (طول ${h} سم${guessed ? ' تقديري' : ''})${x(u)}`;
      if (d.material === 'glass') put('hinge-glass', 'doors', 'مفصلات زجاج', 'مفصلة', /مفصل.*(زجاج|قزاز)|(زجاج|قزاز).*مفصل/i, per * n, why, u, { doubt: dd });
      else if (d.material === 'alu_frame') put('hinge-alu', 'doors', 'مفصلات ضلف ألمنيوم', 'مفصلة', /مفصل.*(ألمنيوم|الومنيوم|المونيوم)|(ألمنيوم|الومنيوم|المونيوم).*مفصل/i, per * n, why, u, { doubt: dd });
      else if (u.corner) put('hinge-corner', 'doors', 'مفصلات ركنة (بلاند / 165°)', 'مفصلة', /بلاند|blind|165|ركن.*مفصل|مفصل.*(ركن|كورنر)/i, per * n, why, u, { doubt: true, tip: 'نوع مفصلة الركنة بيفرق حسب تصميم الركنة (عمياء ولا ضلفتين مكسورين) — أكّد مع المحل.' });
      else put('hinge', 'doors', 'مفصلات ضلف', 'مفصلة', /مفصل/i, per * n, why, u, { doubt: dd, not: NOT_PLAIN_HINGE });
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
    if (u.shelvesAdj) {
      const per = u.w > RULES.wideShelf && !u.dividers ? RULES.shelfPinsWide : RULES.shelfPins;
      put('shelf-pin', 'inside', 'تكاية رف', 'قطعة', /تكاي|تكّاي|حامل رف|shelf.*(pin|support)/i, u.shelvesAdj * per * c, `${u.name}: ${u.shelvesAdj} رف متحرك × ${per}${x(u)}`, u, { doubt: D.has('shelves') });
    }
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

    /* ---- build */
    const joins = RULES.joinCarcass + u.shelvesFixed * RULES.joinPerFixed + u.dividers * RULES.joinPerDivider;
    put('join', 'build', 'زاوية تجميع', 'قطعة', /زاوي.*تجميع|تجميع|minifix|مينيفكس/i, joins * c,
      `${u.name}: ${RULES.joinCarcass} للصندوق${u.shelvesFixed ? ` + ${u.shelvesFixed} رف ثابت × ${RULES.joinPerFixed}` : ''}${u.dividers ? ` + ${u.dividers} قاطوع × ${RULES.joinPerDivider}` : ''}${x(u)}`, u, { doubt: D.has('shelves') });
    if (u.mount === 'wall') {
      put('hang', 'build', 'تعليقة دولاب', 'قطعة', /تعليق[ةه]|علاق[ةه] دولاب|hanger|suspension/i, RULES.hangPerUnit * c, `${u.name}: ${RULES.hangPerUnit} للوحدة${x(u)}`, u, { not: /ماسور|بنطلون|كرافت/ });
      if (u.w) put('hang-rail', 'build', 'شريحة تعليق على الحيطة', 'متر', /شريح[ةه].*تعليق|سكة تعليق|rail.*hang/i, m1(wSpan), `${u.name}: عرض ${u.w} سم${x(u)}`, u);
    }
    if (hasLegs(u, model.kind)) {
      const n = RULES.legs(u.w || 60);
      put('leg', 'build', 'رجل دولاب أرضي', 'قطعة', /رجل|رجول|أرجل|leg/i, n * c, `${u.name}: ${n} رجل (عرض ${u.w || '؟'} سم)${x(u)}`, u, { doubt: !u.w });
    }
    if (hasBase(u, model.kind)) {
      const sup = baseSupports(u);
      put('base-wide', 'build', 'زاوية بلدي 3×3 عريضة (تقوية القاعدة)', 'قطعة', /زاوي.*بلدي.*عريض|زاوي.*عريض|زاوي[ةه] 3/i, RULES.baseWide * c, `${u.name}: ${RULES.baseWide} في أركان القاعدة${x(u)}`, u, { not: /تجميع|ضيق/ });
      put('base-narrow', 'build', 'زاوية بلدي 3×3 ضيقة (عوارض القاعدة)', 'قطعة', /زاوي.*بلدي.*ضيق|زاوي.*ضيق/i, sup * RULES.baseNarrowPerSupport * c,
        `${u.name}: ${sup} عارضة × ${RULES.baseNarrowPerSupport}${u.w ? ` (عرض ${u.w} سم)` : ''}${x(u)}`, u, { doubt: !u.w && !u.dividers, not: /تجميع|عريض/ });
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
/** A plain cabinet hinge is none of these special ones. */
const NOT_PLAIN_HINGE = /زجاج|قزاز|ألمنيوم|الومنيوم|المونيوم|بلاند|كورنر|ركن|أكورديون|اكورديون|باب|دلف/;

/* ------------------------------------------------------------------ matching to the shop's products */
const digits = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
/** Products that fit a line, best first: in stock, then the ones naming the same size (slide length, door count). */
export function candidates<P extends { name: string; tags: string[]; top?: boolean }>(line: Pick<TLine, 'k' | 'match' | 'not'>, all: P[], ok: (p: P) => boolean, max = 8): P[] {
  const size = line.k.match(/^(?:slide|sliding)-(\d+)$/)?.[1];
  const hit = all.filter(p => {
    const t = `${p.name} ${p.tags.join(' ')}`;
    return line.match.test(t) && !(line.not && line.not.test(p.name));
  });
  const score = (p: P) => (ok(p) ? 2 : 0) + (size && new RegExp(`(^|\\D)${size}(\\D|$)`).test(digits(p.name)) ? 1 : 0) + (p.top ? 0.5 : 0);
  return hit.map(p => [p, score(p)] as const).sort((a, b) => b[1] - a[1]).slice(0, max).map(x => x[0]);
}

/** One line of text for WhatsApp / print. */
export const lineText = (l: Pick<TLine, 'label' | 'qty' | 'unit'>, picked?: string) => `• ${l.label}: ${l.qty} ${l.unit}${picked ? ` — ${picked}` : ''}`;
