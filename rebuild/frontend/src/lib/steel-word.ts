/* 🔩 طلب واتساب فيه «استانلس» بأي كتابة (مع «ال» وغلطات إملائية) — نفس منطق القديم (index.html steelHit). */
const KW = ['استانلس', 'ستانلس', 'استنلس', 'استلس', 'ستنلس', 'استانليس', 'ستانليس', 'استيل', 'ستيل', 'ستينلس']; // «ستين» ٦٠ مش استانلس

const norm = (s: string) =>
  s
    .replace(/[ً-ٰ۟ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function lev(a: string, b: string) {
  if (a === b) return 0;
  let p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[b.length];
}

/** The word that made the text a stainless order, or '' when it is not one. */
export function steelWord(text: string): string {
  const ws = norm(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const kw = KW.map(norm);
  for (const w of ws) {
    const w2 = w.replace(/^(?:وال|بال|كال|فال|لل|ال)(?=.{4,})/, '');
    if (w2.length >= 4 && /^ل?ست?ن?لس$/.test(w2.replace(/[اويىءئؤ]/g, ''))) return w;
    for (const k of kw) {
      if (!k) continue;
      if (w === k || w2 === k) return w;
      if (k.length >= 6 && w2.length >= 6 && w2[0] === k[0] && Math.abs(w2.length - k.length) <= 2 && lev(w2, k) <= (k.length >= 7 ? 2 : 1)) return w;
    }
  }
  return '';
}
