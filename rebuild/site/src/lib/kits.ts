// Ready-made kits («جهّز مطبخك», «جهّز دريسنج»): the customer gives a few counts, each slot picks the best
// matching product from the catalog and computes its quantity. Slots with no matching product are still
// listed, so the shop can quote them.
import { hingesFor } from './custom-draw';
import type { Product } from './schema';

export type KitInput = { k: string; label: string; kind: 'num' | 'yes'; def: number; min?: number; max?: number; unit?: string };
export type KitSlot = { k: string; label: string; match: RegExp; not?: RegExp; qty: (v: Record<string, number>) => number; why: (v: Record<string, number>) => string };
export type Kit = { slug: string; emoji: string; title: string; desc: string; inputs: KitInput[]; slots: KitSlot[] };

const hingeQty = (v: Record<string, number>) => v.doors * hingesFor(v.doorH);

export const KITS: Kit[] = [
  {
    slug: 'kitchen', emoji: '🍽️', title: 'جهّز مطبخك', desc: 'قولنا عدد الضلف والأدراج، ونجهزلك كل الإكسسوارات اللي محتاجها مرة واحدة.',
    inputs: [
      { k: 'doors', label: 'عدد الضلف', kind: 'num', def: 8, min: 0, max: 60 },
      { k: 'doorH', label: 'طول الضلفة', kind: 'num', def: 70, min: 30, max: 250, unit: 'سم' },
      { k: 'drawers', label: 'عدد الأدراج', kind: 'num', def: 3, min: 0, max: 40 },
      { k: 'corner', label: 'فيه ركنة (كورنر)؟', kind: 'yes', def: 1 },
      { k: 'pantry', label: 'فيه دولاب خزين طويل؟', kind: 'yes', def: 0 },
      { k: 'handles', label: 'عايز مقابض؟', kind: 'yes', def: 1 },
    ],
    slots: [
      { k: 'hinge', label: 'مفصلات الضلف', match: /مفصل/, not: /بلاند|كورنر/, qty: hingeQty, why: v => `${v.doors} ضلفة × ${hingesFor(v.doorH)} مفصلات (طول ${v.doorH} سم)` },
      { k: 'blind', label: 'مفصلات الركنة العمياء', match: /بلاند|كورنر.*مفصل|مفصل.*كورنر/, qty: v => (v.corner ? 2 : 0), why: () => 'لضلفة الركنة' },
      { k: 'magic', label: 'ماجيك كورنر للركنة', match: /ماجيك|magic/, qty: v => (v.corner ? 1 : 0), why: () => 'يستغل الركنة كلها' },
      { k: 'slides', label: 'مجر الأدراج (جوز لكل درج)', match: /مجر|مجري|مجرى/, qty: v => v.drawers, why: v => `${v.drawers} درج` },
      { k: 'pantry', label: 'دولاب خزين سحاب', match: /خزين/, qty: v => (v.pantry ? 1 : 0), why: () => 'للدولاب الطويل' },
      { k: 'handles', label: 'مقابض', match: /مقبض|مقابض/, qty: v => (v.handles ? v.doors + v.drawers : 0), why: v => `${v.doors} ضلفة + ${v.drawers} درج` },
    ],
  },
  {
    slug: 'dressing', emoji: '👔', title: 'جهّز الدريسنج أو الدولاب', desc: 'ضلف عادية ولا جرار؟ كام درج؟ ونطلعلك الطقم كامل.',
    inputs: [
      { k: 'sliding', label: 'الضلف جرار (سحاب)؟', kind: 'yes', def: 0 },
      { k: 'doors', label: 'عدد الضلف', kind: 'num', def: 4, min: 0, max: 30 },
      { k: 'doorH', label: 'طول الضلفة', kind: 'num', def: 220, min: 50, max: 300, unit: 'سم' },
      { k: 'drawers', label: 'عدد الأدراج', kind: 'num', def: 2, min: 0, max: 30 },
      { k: 'safe', label: 'عايز درج خزنة؟', kind: 'yes', def: 0 },
      { k: 'shoes', label: 'عايز جزامة؟', kind: 'yes', def: 0 },
    ],
    slots: [
      { k: 'track', label: 'طقم جرار للضلف', match: /جرار/, qty: v => (v.sliding ? 1 : 0), why: () => 'طقم واحد للدولاب' },
      { k: 'hinge', label: 'مفصلات الضلف', match: /مفصل/, not: /بلاند|كورنر/, qty: v => (v.sliding ? 0 : hingeQty(v)), why: v => `${v.doors} ضلفة × ${hingesFor(v.doorH)} مفصلات (طول ${v.doorH} سم)` },
      { k: 'slides', label: 'مجر الأدراج (جوز لكل درج)', match: /مجر|مجري|مجرى/, qty: v => v.drawers, why: v => `${v.drawers} درج` },
      { k: 'safe', label: 'درج خزنة', match: /خزن[هة]/, qty: v => (v.safe ? 1 : 0), why: () => 'للحاجات الغالية' },
      { k: 'shoes', label: 'ميكانيزم جزامة', match: /جزام/, qty: v => (v.shoes ? 1 : 0), why: () => 'لتنظيم الجزم' },
      { k: 'handles', label: 'مقابض', match: /مقبض|مقابض/, qty: v => (v.sliding ? v.drawers : v.doors + v.drawers), why: v => (v.sliding ? `${v.drawers} درج` : `${v.doors} ضلفة + ${v.drawers} درج`) },
    ],
  },
];

export const kitBySlug = (s: string) => KITS.find(k => k.slug === s);

/** Best product for each slot (available first), or null. Runs on the server. */
export function matchSlots(kit: Kit, all: Product[], ok: (p: Product) => boolean) {
  return Object.fromEntries(kit.slots.map(s => {
    const L = all.filter(p => s.match.test(p.name) && !(s.not && s.not.test(p.name)));
    return [s.k, L.find(ok) ?? L[0] ?? null];
  })) as Record<string, Product | null>;
}
