// «يمين ولا شمال؟»: products that come in a right and a left version (magic corner, bean pull-out, handed doors…).
// A product is handed when its name says so (شمال / يمين) or when the owner sets `dir` in /admin. Its opposite version is
// found automatically (same name without the direction word) or chosen in /admin (`dir.pair`).
// The motion graphic is picked by TYPE (see HandKind): detected from the name, or chosen in /admin, so a new product
// gets its motion the moment it is added.
import type { Product } from './schema';
import { norm } from './shop';

export type Hand = 'R' | 'L';
/** bean = «ماجيك فاصوليا» (two bean trays) · magic = «ماجيك كورنر» classic (two baskets, the rear one swings forward)
 *  · generic = any pull-out unit · door = hinged door · other = no motion, text only. «corner» is the old name of «bean». */
export type HandKind = 'bean' | 'magic' | 'generic' | 'door' | 'other';
export type HandInfo = { hand: Hand; kind: HandKind; note: string; media?: string; pair?: { id: string; name: string } };

export const KIND_LABEL: Record<HandKind, string> = { bean: 'ماجيك فاصوليا', magic: 'ماجيك كورنر', generic: 'سحب عام', door: 'ضلفة / مفصلة', other: 'من غير موشن' };
export const normKind = (k?: string): HandKind => (k === 'corner' ? 'bean' : k === 'bean' || k === 'magic' || k === 'generic' || k === 'door' || k === 'other' ? k : 'other');

export const HAND_LABEL: Record<Hand, string> = { R: 'يمين', L: 'شمال' };
export const opposite = (h: Hand): Hand => (h === 'R' ? 'L' : 'R');

const L_WORDS = ['شمال', 'يسار', 'left'], R_WORDS = ['يمين', 'right'];
const words = (s: string) => norm(s).split(' ').filter(Boolean);

/** Direction written in a product name, e.g. «ماجيك فاصوليا هازرد تركي شمال» → L. */
export function handFromName(name: string): Hand | undefined {
  const w = words(name);
  const l = w.some(x => L_WORDS.includes(x)), r = w.some(x => R_WORDS.includes(x));
  return l && !r ? 'L' : r && !l ? 'R' : undefined;
}
/** Which motion fits a product, from its name. */
export function kindFromName(name: string): HandKind {
  const n = norm(name);
  if (/فاصوليا|bean|fasulye/.test(n)) return 'bean';
  if (/ماجيك|magic/.test(n)) return 'magic';
  if (/مفصل|ضلف|باب|hinge|door/.test(n)) return 'door';
  if (/كورنر|ركنه|corner|سحب|pull|سله|مخزن/.test(n)) return 'generic';
  return 'other';
}
const baseName = (name: string) => words(name).filter(x => ![...L_WORDS, ...R_WORDS].includes(x)).join(' ');
const handOf = (p: Product) => (p.dir?.off ? undefined : p.dir?.hand ?? handFromName(p.name));

/** Guidance for a product, or null when it has no left/right version. */
export function resolveHand(p: Product, all: Product[]): HandInfo | null {
  if (p.dir?.off) return null;
  const hand = handOf(p);
  if (!hand) return null;
  const kind = p.dir?.kind ? normKind(p.dir.kind) : kindFromName(p.name);
  let q = p.dir?.pair ? all.find(x => x.id === p.dir!.pair) : undefined;
  if (!q) { const b = baseName(p.name); q = all.find(x => x.id !== p.id && !x.hidden && baseName(x.name) === b && handOf(x) === opposite(hand)); }
  return { hand, kind, note: (p.dir?.note ?? '').trim(), media: p.dir?.media?.trim() || undefined, pair: q ? { id: q.id, name: q.name } : undefined };
}

/** The owner's rule for pull-out corner units: the part that stays fixed is on the opposite side of where the trays come out. */
export const CORNER = {
  rule: (h: Hand) => h === 'R'
    ? 'الجزء الثابت على الشمال، والصواني بتطلع ناحية اليمين'
    : 'الجزء الثابت على اليمين، والصواني بتطلع ناحية الشمال',
  ask: 'وانت واقف قدام وحدة الركنة، الجزء الثابت (الجنب اللي الضلفة متركبة عليه) على أنهي ناحية؟',
  need: (fixed: Hand): Hand => opposite(fixed),
};
export const DOOR = {
  rule: (h: Hand) => h === 'R' ? 'المفصلات على اليمين (الضلفة بتفتح ناحية الشمال)' : 'المفصلات على الشمال (الضلفة بتفتح ناحية اليمين)',
  ask: 'وانت واقف قدام الدولاب، المفصلات عندك على أنهي ناحية؟',
  need: (hinge: Hand): Hand => hinge,
};
export const rulesFor = (k: HandKind) => (k === 'door' ? DOOR : k === 'other' ? null : CORNER);
