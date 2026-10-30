// تجهيز المنتجات بمقاسك: drawings, checks and order summary (same rules as the old custom.html).
export type Kind = 'steel' | 'bamboo' | 'delf';
export type Vals = Record<string, string>;

export const KIND: Record<Kind, string> = { steel: '🔩 استانلس حماية الباب', bamboo: '🎍 درج بامبو', delf: '🚪 دلف الدريسنج روم' };
export const isKind = (k: unknown): k is Kind => k === 'steel' || k === 'bamboo' || k === 'delf';

/** Number from what the customer typed (Arabic digits and comma allowed). */
export const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
  return isFinite(n) ? n : 0;
};
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const F = 'font-family="Segoe UI,Tahoma,Arial,sans-serif"';
const dimH = (x1: number, x2: number, y: number, t: string) => `<g stroke="#a8741a" stroke-width="1.4" fill="#a8741a"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><path d="M${x1} ${y}l7 -3.5v7zM${x2} ${y}l-7 -3.5v7z"/><line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}"/></g><text x="${(x1 + x2) / 2}" y="${y + 16}" text-anchor="middle" font-size="13" font-weight="700" fill="#12202b" ${F}>${esc(t)}</text>`;
const dimV = (x: number, y1: number, y2: number, t: string, side = -1) => `<g stroke="#a8741a" stroke-width="1.4" fill="#a8741a"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><path d="M${x} ${y1}l-3.5 7h7zM${x} ${y2}l-3.5 -7h7z"/><line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}"/><line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}"/></g><text x="${x + side * 8}" y="${(y1 + y2) / 2 + 4}" text-anchor="${side > 0 ? 'start' : 'end'}" font-size="13" font-weight="700" fill="#12202b" ${F}>${esc(t)}</text>`;
const svgWrap = (b: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600" direction="ltr" style="direction:ltr"><rect width="400" height="300" fill="#fff"/><rect x="2" y="2" width="396" height="296" rx="10" fill="none" stroke="#d9a73a" stroke-width="2"/><text x="200" y="22" text-anchor="middle" font-size="13" font-weight="800" fill="#a8741a" ${F}>MEKANEZM — رسم توضيحي للطلب</text>${b}</svg>`;

function drawSteel(v: Vals) {
  const t = num(v.t), W = num(v.w), hf = num(v.hf), hb = num(v.hb);
  if (!(t > 0 && W > 0 && hf > 0 && hb > 0)) return '';
  const m = Math.max(hf, hb), k = Math.min(165 / (m * 1.35), 95 / t), dh = 185, x0 = 105 - (t * k) / 2, yb = 250, yt = yb - dh, tw = t * k;
  const side = `<rect x="${x0}" y="${yt}" width="${tw}" height="${dh}" fill="#c9a77a" stroke="#6b4a1f" stroke-width="1.5"/><text x="${x0 + tw / 2}" y="${yt + 60}" text-anchor="middle" font-size="11" fill="#6b4a1f" ${F} transform="rotate(-90 ${x0 + tw / 2} ${yt + 60})">الباب</text>
  <path d="M${x0 - 4} ${yb - hf * k}V${yb + 4}H${x0 + tw + 4}V${yb - hb * k}" fill="none" stroke="#6aa5c9" stroke-width="5" stroke-linejoin="round"/><path d="M${x0 - 4} ${yb - hf * k}V${yb + 4}H${x0 + tw + 4}V${yb - hb * k}" fill="none" stroke="#e6f3fb" stroke-width="1.4"/>
  ${dimV(x0 - 16, yb - hf * k, yb, hf + ' سم', -1)}${dimV(x0 + tw + 16, yb - hb * k, yb, hb + ' سم', 1)}${dimH(x0, x0 + tw, yb + 22, t + ' سم')}<text x="${x0 - 12}" y="${yt - 8}" font-size="12" font-weight="800" fill="#12202b" ${F}>الوش</text><text x="${x0 + tw + 12}" y="${yt - 8}" font-size="12" font-weight="800" fill="#12202b" ${F}>الضهر</text>`;
  const fw = 130, fx = 250, fh = dh, bh = Math.max(16, Math.min(130, hf * 2.2));
  const front = `<rect x="${fx}" y="${yt}" width="${fw}" height="${fh}" fill="#c9a77a" stroke="#6b4a1f" stroke-width="1.5"/><rect x="${fx}" y="${yb - bh}" width="${fw}" height="${bh}" fill="#6aa5c9" stroke="#3a6f93"/><rect x="${fx}" y="${yb - bh}" width="${fw}" height="${bh * 0.35}" fill="#e6f3fb" opacity=".55"/>${dimH(fx, fx + fw, yb + 22, 'عرض الباب ' + W + ' سم')}<text x="${fx + fw / 2}" y="${yt + fh / 2 - bh / 2}" text-anchor="middle" font-size="12" fill="#6b4a1f" ${F}>منظر أمامي</text>`;
  return svgWrap(side + front + `<text x="105" y="${yt - 26}" text-anchor="middle" font-size="12" fill="#667" ${F}>قطاع جانبي</text>`);
}

function drawBamboo(v: Vals) {
  const w = num(v.w), l = num(v.l), h = num(v.h);
  if (!(w > 0 && l > 0 && h > 0)) return '';
  const k = Math.min(200 / (w + 0.28 * l), 165 / (h + 0.5 * l)), fw = w * k, fh = h * k, dx = l * k * 0.28, dy = -l * k * 0.5, x0 = 118 + (200 - (fw + dx)) / 2, yb = 240, yt = yb - fh;
  const B = v.kind === 'طبيعي' ? ['#d9b98a', '#eed5a8', '#a47c48'] : ['#c8a05e', '#e0bf83', '#8c6a30'];
  const dv = v.split === 'yes' ? Math.max(1, Math.min(10, Math.round(num(v.dv) || 0))) : 0;
  type P = [number, number];
  const Fl: P = [x0, yt], Fr: P = [x0 + fw, yt], Bl: P = [x0 + dx, yt + dy], Br: P = [x0 + fw + dx, yt + dy];
  const Pt = (a: P, d = 0) => `${a[0]},${a[1] + d}`;
  const poly = (pts: string, fill: string, sh: number) => `<polygon points="${pts}" fill="${fill}" stroke="#5e4220" stroke-width="1.2" stroke-linejoin="round"/>` + (sh ? `<polygon points="${pts}" fill="#2b1a05" opacity="${sh}"/>` : '');
  const W = 'url(#wv)';
  let s = `<defs><pattern id="wv" width="14" height="9" patternUnits="userSpaceOnUse"><rect width="14" height="9" fill="${B[0]}"/><path d="M0 2.2h14M0 6.7h14" stroke="${B[1]}" stroke-width="2.6"/><path d="M0 3.9h14M0 8.4h14" stroke="${B[2]}" stroke-width=".8" opacity=".7"/><path d="M3.5 0v4.2M10.5 4.5v4.5" stroke="${B[2]}" stroke-width="2.4"/><path d="M5 0v4M12 4.5v4.5" stroke="${B[1]}" stroke-width=".8"/></pattern></defs>`;
  s += poly(`${Pt(Fl)} ${Pt(Bl)} ${Pt(Bl, fh)} ${Pt(Fl, fh)}`, W, 0.3);
  s += poly(`${Pt(Bl)} ${Pt(Br)} ${Pt(Br, fh)} ${Pt(Bl, fh)}`, W, 0.2);
  s += poly(`${Pt(Bl, fh)} ${Pt(Br, fh)} ${Pt(Fr, fh)} ${Pt(Fl, fh)}`, W, 0.1);
  for (let i = 1; i <= dv; i++) {
    const ax = x0 + (fw * i) / (dv + 1), bx = ax + dx;
    s += `<polygon points="${ax},${yt} ${bx},${yt + dy} ${bx},${yt + dy + fh} ${ax},${yt + fh}" fill="#e7d3aa" stroke="#5e4220" stroke-width="1.2"/><line x1="${ax}" y1="${yt}" x2="${bx}" y2="${yt + dy}" stroke="#a47c48" stroke-width="3"/>`;
  }
  s += poly(`${Pt(Fr)} ${Pt(Br)} ${Pt(Br, fh)} ${Pt(Fr, fh)}`, W, 0.12);
  s += poly(`${Pt(Fl)} ${Pt(Fr)} ${Pt(Fr, fh)} ${Pt(Fl, fh)}`, W, 0);
  const rim = (a: P, b: P) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7a5a2a" stroke-width="7.5" stroke-linecap="round"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${B[1]}" stroke-width="5.8" stroke-linecap="round"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#8d6a38" stroke-width="5.8" stroke-dasharray="2.2 4.6"/>`;
  s += rim(Bl, Fl) + rim(Bl, Br) + rim(Fr, Br) + rim(Fl, Fr);
  s += dimH(x0, x0 + fw, yb + 22, 'العرض ' + w + ' سم') + dimV(x0 - 14, yt, yb, 'الارتفاع ' + h + ' سم', -1);
  s += `<g stroke="#a8741a" stroke-width="1.4" fill="#a8741a"><line x1="${x0 + fw + 14}" y1="${yt + 6}" x2="${x0 + fw + dx + 14}" y2="${yt + dy + 6}"/><path d="M${x0 + fw + 14} ${yt + 6}l-2 -7 8 3zM${x0 + fw + dx + 14} ${yt + dy + 6}l2 7 -8 -3z"/></g><text x="${x0 + fw + dx / 2 + 30}" y="${yt + dy / 2 + 6}" font-size="13" font-weight="700" fill="#12202b" ${F}>الطول ${l} سم</text>`;
  s += `<text x="200" y="293" text-anchor="middle" font-size="11" fill="#667" ${F}>${esc(v.kind || '')} — ${dv ? 'متقسم ' + dv + ' فاصل' : 'بدون تقسيم'} — المقاس برّه برّه</text>`;
  return svgWrap(s);
}

function drawDelf(v: Vals) {
  const W = num(v.w), H = num(v.h);
  if (!(W > 0 && H > 0)) return '';
  const k = Math.min(165 / W, 165 / H), dw = W * k, dh = H * k, x0 = 122, y0 = 62, ps = Math.max(6, Math.min(12, 3.5 * k)), hw = Math.max(ps + 3, Math.min(18, 6.5 * k)), tr = Math.max(8, Math.min(14, 4.5 * k));
  const hL = v.handle === 'both' || (v.handle === 'one' && v.hside === 'left'), hR = v.handle === 'both' || (v.handle === 'one' && v.hside !== 'left');
  const wl = hL ? hw : ps, wr = hR ? hw : ps;
  let s = `<defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f1f5"/><stop offset=".5" stop-color="#cfdde5"/><stop offset="1" stop-color="#b9cbd6"/></linearGradient><linearGradient id="bk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2d31"/><stop offset=".5" stop-color="#4a4f55"/><stop offset="1" stop-color="#1c1e21"/></linearGradient><linearGradient id="al" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d98a1"/><stop offset=".4" stop-color="#f4f6f8"/><stop offset="1" stop-color="#7b8791"/></linearGradient></defs>`;
  s += `<rect x="${x0}" y="${y0}" width="${dw}" height="${dh}" rx="2" fill="url(#bk)" stroke="#111" stroke-width="1"/><rect x="${x0 + wl}" y="${y0 + tr}" width="${dw - wl - wr}" height="${dh - 2 * tr}" fill="url(#gl)" stroke="#8d98a1" stroke-width="1.2"/><path d="M${x0 + wl + 8} ${y0 + dh - tr - 8}L${x0 + wl + Math.min(56, dw * 0.4)} ${y0 + tr + 8}M${x0 + wl + 20} ${y0 + dh - tr - 8}L${x0 + wl + Math.min(68, dw * 0.4 + 12)} ${y0 + tr + 8}" stroke="#fff" stroke-width="5" opacity=".55"/>`;
  // Handle: the stile itself is a profile with a pull lip along the leaf.
  ([[hL, x0, 1], [hR, x0 + dw - hw, -1]] as [boolean, number, number][]).forEach(([on, x, d]) => {
    if (!on) return;
    s += `<rect x="${x}" y="${y0}" width="${hw}" height="${dh}" fill="url(#al)" stroke="#59636c" stroke-width="1"/><rect x="${d > 0 ? x + hw - 4 : x + 1.5}" y="${y0 + tr}" width="2.5" height="${dh - 2 * tr}" fill="#2a2d31"/><line x1="${d > 0 ? x + hw * 0.35 : x + hw * 0.65}" y1="${y0 + 4}" x2="${d > 0 ? x + hw * 0.35 : x + hw * 0.65}" y2="${y0 + dh - 4}" stroke="#fff" stroke-width="1.4" opacity=".8"/>`;
  });
  if (v.type === 'hinged' && v.drill === 'yes') {
    const n = Math.max(1, Math.min(8, Math.round(num(v.hn) || 2))), left = v.hinge === 'left', hx = left ? x0 + wl / 2 : x0 + dw - wr / 2;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? y0 + dh / 2 : y0 + tr + 14 + ((dh - 2 * tr - 28) * i) / (n - 1);
      s += `<circle cx="${hx}" cy="${y}" r="${Math.min(5, Math.max(2.5, (left ? wl : wr) / 2 - 1.2))}" fill="#cfd6dc" stroke="#111" stroke-width="1.2"/><circle cx="${hx}" cy="${y}" r="1.5" fill="#111"/>`;
    }
  }
  // Wheels at the top and bottom rails near the edges.
  if (v.type === 'slide' && v.wheel === 'yes') {
    [x0 + dw * 0.1, x0 + dw * 0.9 - 14].forEach(x => {
      s += `<rect x="${x - 2}" y="${y0}" width="18" height="${tr}" fill="none" stroke="#e24c3b" stroke-width="1.5" stroke-dasharray="3 2"/><rect x="${x}" y="${y0 + 1}" width="14" height="${tr - 2}" rx="1.5" fill="#7b8084" stroke="#33383c"/><circle cx="${x + 7}" cy="${y0 - 5}" r="6.5" fill="#cfd6dc" stroke="#33383c" stroke-width="1.3"/><circle cx="${x + 7}" cy="${y0 - 5}" r="2" fill="#33383c"/>
   <rect x="${x - 2}" y="${y0 + dh - tr}" width="18" height="${tr}" fill="none" stroke="#e24c3b" stroke-width="1.5" stroke-dasharray="3 2"/><rect x="${x}" y="${y0 + dh - tr + 1}" width="14" height="${tr - 2}" rx="1.5" fill="#7b8084" stroke="#33383c"/><circle cx="${x + 7}" cy="${y0 + dh + 5}" r="6.5" fill="#cfd6dc" stroke="#33383c" stroke-width="1.3"/><circle cx="${x + 7}" cy="${y0 + dh + 5}" r="2" fill="#33383c"/>`;
    });
  }
  s += `<g transform="translate(288 ${y0 + 10})"><text x="46" y="-6" text-anchor="middle" font-size="11" font-weight="700" fill="#12202b" ${F}>قطاع القايم</text><rect x="22" y="10" width="34" height="46" rx="2" fill="url(#bk)" stroke="#111"/><rect x="56" y="24" width="36" height="6" fill="url(#gl)" stroke="#8d98a1"/>${hL || hR ? `<path d="M26 22h-16v26h12" fill="none" stroke="#c9d1d8" stroke-width="6" stroke-linejoin="round"/><path d="M26 22h-16v26h12" fill="none" stroke="#59636c" stroke-width="1"/><text x="46" y="76" text-anchor="middle" font-size="10" fill="#667" ${F}>شفة سحب في البروفيل</text>` : `<text x="46" y="76" text-anchor="middle" font-size="10" fill="#667" ${F}>بدون مقبض</text>`}</g>`;
  s += dimH(x0, x0 + dw, y0 + dh + 24, 'العرض ' + W + ' سم') + dimV(x0 - 14, y0, y0 + dh, 'الارتفاع ' + H + ' سم', -1);
  const lab = (v.type === 'hinged' ? 'مفصلي' : 'جرار') + ' — إطار ألمنيوم أسود وزجاج — ' + ({ none: 'بدون مقبض', one: 'مقبض من ناحية', both: 'مقبض من الناحيتين' }[v.handle] ?? '');
  return svgWrap(s + `<text x="200" y="294" text-anchor="middle" font-size="11" fill="#667" ${F}>${esc(lab)}</text>`);
}

export const DRAW: Record<Kind, (v: Vals) => string> = { steel: drawSteel, bamboo: drawBamboo, delf: drawDelf };

export const GUIDE: Record<Kind, string> = {
  steel: 'قيس سُمك الباب من الوش للضهر، وعرضه من حافة لحافة. بعدين حدّد ارتفاع الاستانلس اللي عايزه من تحت لفوق على الوش، وعلى الضهر. كل المقاسات بالسنتيمتر.',
  bamboo: 'قيس الفتحة اللي الدرج هيتركّب فيها من برّه لبرّه: العرض، الطول (من الوش للضهر)، والارتفاع (هو عمق الدرج). لو عايزه متقسم حدّد عدد الفواصل.',
  delf: 'قيس عرض الدلفة من حافة لحافة وارتفاعها من فوق لتحت بالسنتيمتر. للمفصلي اختار تتخرّم ولا لأ وعدد المفصلات (هنقترحلك عدد حسب الارتفاع). للجرار اختار فتحة العجلة لو محتاجها.',
};

export const defaults = (k: Kind): Vals => ({
  steel: { q: '1' },
  bamboo: { kind: 'طبيعي', split: 'no', dv: '2', q: '1' },
  delf: { type: 'hinged', mat: 'ألمنيوم', handle: 'none', hside: 'right', drill: 'yes', hinge: 'right', hn: '3', wheel: 'yes', q: '1' },
})[k];

/** Quick-pick sizes under some fields. */
export function quick(k: Kind, f: string): number[] | null {
  const QK: Record<string, number[]> = { t: [3, 4, 5], hf: [10, 15, 20], hb: [10, 15, 20] };
  if (k === 'delf') return ({ w: [40, 50, 60, 80, 90], h: [200, 210, 220, 240] } as Record<string, number[]>)[f] ?? null;
  if (k === 'steel' && f === 'w') return [60, 70, 80, 90];
  return QK[f] ?? null;
}

/** Suggested hinge count for a leaf height. */
export const hingesFor = (h: number) => (h <= 90 ? 2 : h <= 160 ? 3 : h <= 220 ? 4 : 5);

/** Smart warnings; `hn` set when a hinge count suggestion applies. */
export function warnings(k: Kind, V: Vals): { text: string; hn?: number }[] {
  const W: { text: string; hn?: number }[] = [];
  const t = num(V.t), w = num(V.w), h = num(V.h), hf = num(V.hf), l = num(V.l);
  if (k === 'steel') {
    if (t > 12) W.push({ text: `سُمك الباب ${t} سم كبير — اتأكد إنه بالسنتيمتر` });
    if (w > 150) W.push({ text: `عرض الباب ${w} سم — اتأكد من المقاس` });
    if (w && hf && hf > w) W.push({ text: 'ارتفاع الوش أكبر من عرض الباب — اتأكد' });
  }
  if (k === 'bamboo') {
    ([['العرض', w], ['الطول', l], ['الارتفاع', h]] as [string, number][]).forEach(([n, x]) => {
      if (x > 150) W.push({ text: `${n} ${x} سم كبير على درج بامبو — اتأكد` });
      if (x > 0 && x < 5) W.push({ text: `${n} ${x} سم صغير جداً — اتأكد إنه بالسنتيمتر` });
    });
    if (V.split === 'yes' && w && num(V.dv) > Math.floor(w / 12)) W.push({ text: 'عدد الفواصل كتير على العرض ده' });
  }
  if (k === 'delf') {
    if (V.type === 'hinged' && w > 70) W.push({ text: `الدلفة المفصلية بعرض ${w} سم تقيلة — الأفضل تقسيمها لدلفتين` });
    if (h > 260) W.push({ text: `ارتفاع ${h} سم — اتأكد من المقاس` });
    if (w && w < 20) W.push({ text: 'عرض صغير جداً — اتأكد' });
    if (V.type === 'hinged' && V.drill === 'yes' && h > 0) {
      const s = hingesFor(h);
      if (Math.round(num(V.hn)) !== s) W.push({ text: `مقترح لارتفاع ${h} سم: ${s} مفصلات`, hn: s });
    }
  }
  return W;
}

export function summary(k: Kind, V: Vals) {
  const q = Math.max(1, Math.round(num(V.q)) || 1);
  const L = [`${KIND[k]} — عدد ${q}`];
  if (k === 'steel') L.push(`سُمك الباب: ${V.t} سم`, `عرض الباب: ${V.w} سم`, `الاستانلس من الوش: ${V.hf} سم`, `الاستانلس من الضهر: ${V.hb} سم`, `طول الشريحة المفرودة: ${Math.round((num(V.hf) + num(V.t) + num(V.hb)) * 10) / 10} سم (حدّين ثنية)`);
  if (k === 'bamboo') L.push(`النوع: ${V.kind}`, V.split === 'yes' ? `متقسم — ${Math.round(num(V.dv)) || 0} فاصل` : 'بدون تقسيم', `العرض: ${V.w} سم`, `الطول: ${V.l} سم`, `الارتفاع (العمق): ${V.h} سم`, 'المقاس برّه برّه');
  if (k === 'delf') {
    L.push(`النوع: ${V.type === 'hinged' ? 'مفصلي' : 'جرار'}`, `العرض: ${V.w} سم`, `الارتفاع: ${V.h} سم`, `المقبض: ${({ none: 'بدون مقبض', one: 'من ناحية ' + (V.hside === 'left' ? 'الشمال' : 'اليمين'), both: 'من الناحيتين' } as Record<string, string>)[V.handle]}`);
    if (V.type === 'hinged') L.push(V.drill === 'yes' ? `تخريم مفصلات: ${Math.round(num(V.hn)) || 0} مفصلة — ناحية ${V.hinge === 'left' ? 'الشمال' : 'اليمين'}` : 'من غير تخريم مفصلات');
    else L.push(V.wheel === 'yes' ? 'تتخلّع لفتحة العجلة (العجلة بتتباع لوحدها)' : 'من غير فتحة عجلة');
  }
  return L.join('\n');
}

/** Missing-measurements message ('' when OK). */
export function checkSizes(k: Kind, V: Vals) {
  const n = (x: string) => num(V[x]) > 0;
  if (k === 'steel' && !(n('t') && n('w') && n('hf') && n('hb'))) return 'اكتب كل المقاسات';
  if (k === 'bamboo' && (!(n('w') && n('l') && n('h')) || (V.split === 'yes' && !(num(V.dv) >= 1)))) return 'اكتب العرض والطول والارتفاع' + (V.split === 'yes' ? ' وعدد الفواصل' : '');
  if (k === 'delf' && (!(n('w') && n('h')) || (V.type === 'hinged' && V.drill === 'yes' && !(num(V.hn) >= 1)))) return 'اكتب عرض وارتفاع الدلفة' + (V.type === 'hinged' && V.drill === 'yes' ? ' وعدد المفصلات' : '');
  return '';
}
