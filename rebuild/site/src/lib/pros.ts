// «فنيين نرشّحهم»: the shop does not install. When a customer needs someone to install, repair or build,
// we point them to independent craftsmen and engineers the shop has reviewed. Data: site_content.pros (edited in /admin).
import { norm as normalizeAr } from './shop';
import type { Pro } from './schema';

export const SKILLS = [
  ['kitchen', '🍳 مطابخ'],
  ['dressing', '👔 دريسنج روم'],
  ['wardrobe', '🚪 دواليب وغرف نوم'],
  ['slides', '🗃️ تركيب وتغيير مجر وأدراج'],
  ['hinges', '🔩 مفصلات وضلف'],
  ['repair', '🛠️ صيانة وإصلاح'],
  ['aluminum', '🪟 ألومنيوم'],
  ['shoes', '👟 جزامات وأرفف'],
  ['design', '📐 تصميم ومهندس ديكور'],
] as const;
export const SKILL_NAME = Object.fromEntries(SKILLS) as Record<string, string>;

export const KINDS: Record<string, string> = { carpenter: 'نجار', installer: 'فني تركيب', engineer: 'مهندس ديكور', workshop: 'ورشة' };

/** What the customer needs → the skill that serves it (used by /help to suggest people). */
export const NEEDS = [
  ['new', '🏗️ هعمل شغل جديد (مطبخ، دريسنج روم، جزامة، دولاب…)', 'kitchen'],
  ['fix', '🛠️ عندي حاجة محتاجة تتصلّح أو تتغيّر', 'repair'],
  ['install', '🔧 معايا الإكسسوارات ومحتاج حد يركّبها', 'slides'],
  ['design', '📐 محتاج مهندس يصمّم أو يدّيني فكرة', 'design'],
  ['other', '💬 حاجة تانية', 'repair'],
] as const;

export const proWa = (phone: string, text?: string) => {
  let ph = String(phone || '').replace(/\D/g, '');
  if (ph[0] === '0') ph = '20' + ph.slice(1);
  return ph ? `https://wa.me/${ph}${text ? '?text=' + encodeURIComponent(text) : ''}` : '#';
};

/** Pros who serve a skill and (optionally) an area typed by the customer (loose match on any word). */
export function matchPros(pros: Pro[], skill?: string, area?: string): Pro[] {
  const a = normalizeAr(area ?? '').split(/\s+/).filter(w => w.length > 2);
  return pros
    .filter(p => !skill || p.skills.includes(skill))
    .map(p => {
      const hay = normalizeAr(p.areas.join(' '));
      const near = a.length && a.some(w => hay.includes(w)) ? 1 : 0;
      return { p, score: near * 10 + Math.min(p.years, 20) / 20 + p.imgs.length / 100 };
    })
    .sort((x, y) => y.score - x.score)
    .map(x => x.p);
}

export const proPath = (id: string) => '/pros/' + encodeURIComponent(id);
