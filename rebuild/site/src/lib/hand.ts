// «يمين ولا شمال؟»: products that come in a right and a left version (magic corner, bean pull-out, handed doors…).
// A product is handed when its name says so (شمال / يمين) or when the owner sets `dir` in /admin. Its opposite version is
// found automatically (same name without the direction word) or chosen in /admin (`dir.pair`).
import type { Product } from './schema';
import { norm } from './shop';

export type Hand = 'R' | 'L';
export type HandKind = 'corner' | 'door' | 'other';
export type HandInfo = { hand: Hand; kind: HandKind; note: string; pair?: { id: string; name: string } };

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
export function kindFromName(name: string): HandKind {
  const n = norm(name);
  if (/ماجيك|فاصوليا|كورنر|ركنه|corner|magic|bean/.test(n)) return 'corner';
  if (/مفصل|ضلف|باب|hinge|door/.test(n)) return 'door';
  return 'other';
}
const baseName = (name: string) => words(name).filter(x => ![...L_WORDS, ...R_WORDS].includes(x)).join(' ');
const handOf = (p: Product) => (p.dir?.off ? undefined : p.dir?.hand ?? handFromName(p.name));

/** Guidance for a product, or null when it has no left/right version. */
export function resolveHand(p: Product, all: Product[]): HandInfo | null {
  if (p.dir?.off) return null;
  const hand = handOf(p);
  if (!hand) return null;
  const kind = p.dir?.kind ?? kindFromName(p.name);
  let q = p.dir?.pair ? all.find(x => x.id === p.dir!.pair) : undefined;
  if (!q) { const b = baseName(p.name); q = all.find(x => x.id !== p.id && !x.hidden && baseName(x.name) === b && handOf(x) === opposite(hand)); }
  return { hand, kind, note: (p.dir?.note ?? '').trim(), pair: q ? { id: q.id, name: q.name } : undefined };
}

/** The owner's rule for the magic corner: the part that stays fixed is on the opposite side of where the trays come out. */
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
