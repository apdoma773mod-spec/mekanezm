// اللوجو الرسمي لميكانيزم: الملف الأصلي بالظبط (مش متعاد رسمه)، وسطر «MEKANIZM STUDIO» متبدّل بالجملة العربي.
let P: Promise<HTMLCanvasElement | null> | null = null;
export const TAGLINE = 'ميكانيزم مطابخ ودريسنج روم ولوازم ورش';
export function officialLogo(): Promise<HTMLCanvasElement | null> {
  if (P) return P;
  P = (async () => {
    try {
      const im = new Image(); im.src = '/brand/mekanizm-logo.png'; await im.decode(); try { await (document as any).fonts.load('700 24px Cairo'); } catch { }
      const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d')!; x.drawImage(im, 0, 0, 512, 512);
      x.fillStyle = '#000'; x.fillRect(40, 296, 432, 44); x.fillStyle = '#F6EFDC'; x.textAlign = 'center'; x.textBaseline = 'middle'; try { (x as any).direction = 'rtl'; } catch { }
      let fs = 26; do { x.font = `700 ${fs}px Cairo, Tajawal, sans-serif`; fs--; } while (x.measureText(TAGLINE).width > 380 && fs > 12);
      x.fillText(TAGLINE, 256, 318); return c;
    } catch { P = null; return null; }
  })();
  return P;
}
