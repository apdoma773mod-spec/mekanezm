'use client';

/** «تحويل إلى PDF» (buildInvoicePdf القديمة): الفاتورة كصورة داخل PDF بعرض A4، من نفس html2canvas + jsPDF. */
const H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

interface Win {
  html2canvas?: (el: HTMLElement, o: unknown) => Promise<HTMLCanvasElement>;
  jspdf?: { jsPDF: new (o: unknown) => { addImage: (...a: unknown[]) => void; output: (t: 'blob') => Blob } };
}

const load = (src: string, ready: () => boolean) =>
  new Promise<void>((ok, bad) => {
    if (ready()) return ok();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => (ready() ? ok() : bad(new Error('lib')));
    s.onerror = () => bad(new Error('lib'));
    document.head.appendChild(s);
  });

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | 'timeout'> => Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))]);

const IOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function htmlToPdf(fullHtml: string): Promise<{ blob: Blob; img: string }> {
  const w = window as unknown as Win;
  await load(H2C, () => !!w.html2canvas);
  await load(JSPDF, () => !!w.jspdf);
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(fullHtml)?.[1] ?? fullHtml;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1';
  host.innerHTML = body;
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await withTimeout(document.fonts.ready, 2500);
    const el = host.firstElementChild as HTMLElement;
    const cv = await withTimeout(w.html2canvas!(el, { scale: IOS() ? 1.5 : 2, backgroundColor: '#fff', useCORS: true, logging: false, imageTimeout: 8000 }), 40000);
    if (cv === 'timeout') throw new Error('timeout');
    const wmm = 210;
    const hmm = Math.max(297, (cv.height * wmm) / cv.width);
    const pdf = new w.jspdf!.jsPDF({ unit: 'mm', format: [wmm, hmm] });
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wmm, (cv.height * wmm) / cv.width);
    return { blob: pdf.output('blob'), img: cv.toDataURL('image/jpeg', 0.6) };
  } finally {
    host.remove();
  }
}

/** Phone share sheet when the browser has one, otherwise a normal download. */
export async function shareOrSave(blob: Blob, name: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const f = new File([blob], name, { type: 'application/pdf' });
  const data = { files: [f], title };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
  }
  const a = document.createElement('a');
  const u = URL.createObjectURL(blob);
  a.href = u;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(u);
  }, 60000);
  return 'saved';
}
