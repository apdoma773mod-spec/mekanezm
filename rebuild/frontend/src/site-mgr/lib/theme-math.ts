// منقول من إدارة الموقع (rebuild/site/src/app/admin) عشان الإدارة كلها تبقى جوه السيستم وتحفظ في نفس المكان اللي الموقع بيقرا منه.
// Pure color math shared by the theme and the wood textures.
export const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const full = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h.toLowerCase());

export const rgb = (h: string) => full(h).slice(1).match(/../g)!.map(x => parseInt(x, 16));
export const lum = (h: string) => {
  const v = rgb(h).map(x => x / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
/** WCAG contrast ratio, 1 (none) .. 21 (black on white). */
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Readable text color for a given background: white or near-black, whichever contrasts more. */
export const onColor = (bg: string) => (contrast(bg, '#ffffff') >= contrast(bg, '#14201a') ? '#ffffff' : '#14201a');
/** Mix `a` with `b` (t = share of b, 0..1). */
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, '0')).join('');
};
