// محرك رسم القوالب على canvas: نفس الدالة بترسم المعاينة والتصدير (فيديو أو صور). كل حاجة متناسبة مع المقاس
// (u = أصغر ضلع / 1080) فبتطلع مظبوطة في ٩:١٦ و٤:٥ و١:١ و١٦:٩.
import type { Item } from './media';
import { type Style, type Pal, type Seg, arN, arDate } from './styles';

export interface Texts { title: string; sub: string; price: string; old: string; cta: string; phone: string; shop: string; addr: string; stages: string[]; badge: string; date: boolean }
export interface Proj { items: Item[]; st: Style; pal: Pal; T: Texts; W: number; H: number; logo: CanvasImageSource | null; logoOn: boolean; segs: Seg[]; dur: number; live: boolean; font?: string }
type C2 = CanvasRenderingContext2D;

const cl = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x, e = (x: number) => { x = cl(x); return x * x * (3 - 2 * x); };
const eo = (x: number) => 1 - Math.pow(1 - cl(x), 3), back = (x: number) => { x = cl(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const priceTxt = (p: string) => { const en = String(p).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, ''), [i, f] = en.split('.'); return arN((i || '').replace(/\B(?=(\d{3})+(?!\d))/g, '٬') + (f ? '٫' + f : '')); };

function rr(c: C2, x: number, y: number, w: number, h: number, r: number) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const fnt = (P: Proj, px: number, w = 800, f?: string) => `${w} ${Math.round(px)}px "${f || P.font || P.st.font}", Cairo, Tajawal, sans-serif`;

/** نص بلف كلمات (يمين لشمال) — بيرجع ارتفاعه. */
function txt(c: C2, P: Proj, s: string, x: number, y: number, px: number, o: { w?: number; col?: string; f?: string; al?: CanvasTextAlign; max?: number; lines?: number; stroke?: string; sh?: boolean; lh?: number; base?: CanvasTextBaseline } = {}): number {
  if (!s) return 0; c.save(); c.font = fnt(P, px, o.w || 800, o.f); c.textAlign = o.al || 'center'; c.textBaseline = o.base || 'middle'; try { (c as any).direction = 'rtl'; } catch { }
  const max = o.max || P.W * .86, words = String(s).split(/\s+/).filter(Boolean), L: string[] = []; let cur = '';
  words.forEach(w => { const n = cur ? cur + ' ' + w : w; if (c.measureText(n).width > max && cur) { L.push(cur); cur = w; } else cur = n; }); if (cur) L.push(cur);
  const lines = L.slice(0, o.lines || 3); if (L.length > lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '') + '…';
  const lh = px * (o.lh || 1.28), y0 = y - (lines.length - 1) * lh / 2;
  if (o.sh) { c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = px * .35; c.shadowOffsetY = px * .06; }
  if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = px * .14; c.strokeStyle = o.stroke; lines.forEach((l, i) => c.strokeText(l, x, y0 + i * lh)); c.shadowBlur = 0; }
  c.fillStyle = o.col || '#fff'; lines.forEach((l, i) => c.fillText(l, x, y0 + i * lh)); c.restore(); return lines.length * lh;
}
function pill(c: C2, P: Proj, s: string, cx: number, cy: number, px: number, bg: string, fg: string, w = 800) {
  c.save(); c.font = fnt(P, px, w); const tw = c.measureText(s).width, ph = px * 1.7, pw = tw + px * 1.6; rr(c, cx - pw / 2, cy - ph / 2, pw, ph, ph / 2); c.fillStyle = bg; c.fill(); c.restore();
  txt(c, P, s, cx, cy + px * .04, px, { col: fg, w, max: pw + 10 }); return pw;
}

/* ───── الصور: قص ذكي على نقطة التركيز + خلفية ممسوحة للصور اللي مقاسها مختلف ───── */
const BLUR = new Map<string, HTMLCanvasElement>();
function blurOf(it: Item): HTMLCanvasElement {
  const k = it.id + (it.kind === 'vid' ? ':' + Math.floor(((it.src as HTMLVideoElement).currentTime || 0) * 2) : '');
  let b = BLUR.get(k); if (b) return b;
  const s = document.createElement('canvas'), r = it.w / it.h; s.width = r >= 1 ? 32 : Math.max(8, Math.round(32 * r)); s.height = r >= 1 ? Math.max(8, Math.round(32 / r)) : 32;
  s.getContext('2d')!.drawImage(it.src, 0, 0, s.width, s.height);
  b = document.createElement('canvas'); b.width = s.width * 8; b.height = s.height * 8; const x = b.getContext('2d')!; x.imageSmoothingQuality = 'high'; try { (x as any).filter = 'blur(6px)'; } catch { } x.drawImage(s, 0, 0, b.width, b.height);
  if (it.kind === 'vid') { if (BLUR.size > 60) BLUR.clear(); } BLUR.set(k, b); return b;
}
export function clearCaches() { BLUR.clear(); }

const LIVE = new Set<HTMLVideoElement>();
function syncVid(P: Proj, it: Item, lt: number) {
  const v = it.vel; if (!v || !P.live) return; LIVE.add(v); const d = v.duration || 1, want = lt % d;
  if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => { }); }
  if (Math.abs(v.currentTime - want) > .4 && !v.seeking) { try { v.currentTime = want; } catch { } }
}
export function endFrame() { document.querySelectorAll('video').forEach(() => { }); }

function coverRect(it: Item, x: number, y: number, w: number, h: number, z: number, px: number, py: number) {
  const s = Math.max(w / it.w, h / it.h) * z, dw = it.w * s, dh = it.h * s;
  let dx = x + w / 2 - it.fx * dw + px * w, dy = y + h / 2 - it.fy * dh + py * h;
  dx = Math.min(x, Math.max(x + w - dw, dx)); dy = Math.min(y, Math.max(y + h - dh, dy)); return [dx, dy, dw, dh];
}
function motionOf(m: string, lt: number, d: number, idx: number): [number, number, number, number] {
  const p = cl(lt / Math.max(.1, d)), dir = idx % 2 ? -1 : 1;
  switch (m) {
    case 'kb': return [1.04 + .12 * e(p), dir * .03 * (e(p) - .5), .02 * (e(p) - .5), 0];
    case 'kbOut': return [1.17 - .12 * e(p), -dir * .02 * (e(p) - .5), 0, 0];
    case 'punch': { const q = eo(lt / .38); return [1 + .2 * (1 - q) + .03 * p, 0, 0, 0]; }
    case 'drift': return [1.14, dir * .06 * (p - .5), 0, 0];
    case 'tilt': return [1.12, dir * .02 * (p - .5), 0, dir * (1.8 - 1.2 * e(p)) * Math.PI / 180];
    case 'float': return [1.02 + .04 * Math.sin(p * Math.PI), 0, -.015 * Math.sin(p * Math.PI * 2), 0];
    case 'handheld': return [1.09, .008 * Math.sin(lt * 2.3) + .006 * Math.sin(lt * 5.1), .008 * Math.sin(lt * 1.9 + 1), .004 * Math.sin(lt * 1.3)];
    case 'dolly': return [1.02 + .2 * e(p), 0, 0, dir * .02 * (e(p) - .5)];
    case 'pan': return [1.24, dir * .2 * (p - .5), 0, 0];
    default: return [1, 0, 0, 0];
  }
}
/** بيرسم صورة/فيديو جوه مستطيل بالحركة المطلوبة. لو مقاس الصورة بعيد عن المستطيل (أفقي في طولي): الصورة كاملة فوق نسخة ممسوحة منها. */
export function drawItem(c: C2, P: Proj, it: Item, x: number, y: number, w: number, h: number, lt: number, d: number, motion: string, idx: number) {
  if (!it) return; syncVid(P, it, lt);
  const [z, px, py, rot] = motionOf(motion, lt, d, idx), r = it.w / it.h, R = w / h, mis = Math.max(r / R, R / r);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (rot) { c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.translate(-x - w / 2, -y - h / 2); }
  if (mis > 1.45) {
    const b = blurOf(it), [bx, by, bw, bh] = coverRect({ ...it, w: b.width, h: b.height, fx: .5, fy: .5 } as Item, x, y, w, h, 1.1, 0, 0);
    c.drawImage(b, bx, by, bw, bh); c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, y, w, h);
    const s = Math.min(w / it.w, h / it.h) * (.94 + (z - 1) * .5), dw = it.w * s, dh = it.h * s;
    c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 30 * (w / 1080); c.drawImage(it.src, x + (w - dw) / 2 + px * w * .3, y + (h - dh) / 2 + py * h * .3, dw, dh);
  } else { const [dx, dy, dw, dh] = coverRect(it, x, y, w, h, z, px, py); c.drawImage(it.src, dx, dy, dw, dh); }
  c.restore();
}

/* ───── الإطارات ───── */
interface FR { x: number; y: number; w: number; h: number; r: number; shape?: 'circle' | 'arch'; tx: number; ty: number; tw: number; th: number; tcol: string; rot?: number }
const portrait = (P: Proj) => P.H / P.W > 1.15, landscape = (P: Proj) => P.W / P.H > 1.15;
function frameRect(P: Proj, idx: number): FR {
  const { W, H } = P, u = Math.min(W, H) / 1080, f = P.st.frame, pal = P.pal, L = landscape(P), Pt = portrait(P);
  const below = (x: number, y: number, w: number, h: number, r: number, shape?: FR['shape']): FR => L
    ? { x: W * .4, y: H * .08, w: W * .55, h: H * .84, r, shape, tx: W * .06, ty: H * .2, tw: W * .3, th: H * .6, tcol: pal.fg }
    : { x, y, w, h, r, shape, tx: W * .08, ty: y + h + 18 * u, tw: W * .84, th: Math.max(90 * u, H - (y + h) - 40 * u), tcol: pal.fg };
  switch (f) {
    case 'card': return below(W * .07, H * (Pt ? .09 : .07), W * .86, H * (Pt ? .66 : .62), 34 * u);
    case 'minimal': { const r = below(W * .06, W * .06, W * .88, H * (Pt ? .7 : .66), 0); r.tcol = pal.light ? pal.fg : '#1A1A1A'; return r; }
    case 'arch': return below(W * .13, H * (Pt ? .1 : .08), W * .74, H * (Pt ? .62 : .6), 0, 'arch');
    case 'circle': { const R = Math.min(W, H) * (L ? .4 : .39); return below(W / 2 - R, (L ? H / 2 : H * .4) - R, 2 * R, 2 * R, 0, 'circle'); }
    case 'polaroid': { const w = Math.min(W * .74, H * .56), h = w * 1.02, x = (W - w) / 2, y = H * (Pt ? .2 : .1); return { x, y, w, h, r: 0, tx: x, ty: y + h, tw: w, th: w * .2, tcol: '#2A2A2A', rot: (hash(idx + 3) - .5) * .1 }; }
    case 'split': return Pt ? { x: 0, y: 0, w: W, h: H * .62, r: 0, tx: W * .08, ty: H * .64, tw: W * .84, th: H * .33, tcol: pal.fg } : { x: W * .42, y: 0, w: W * .58, h: H, r: 0, tx: W * .04, ty: H * .1, tw: W * .34, th: H * .8, tcol: pal.fg };
    case 'neon': return below(W * .08, H * (Pt ? .1 : .08), W * .84, H * (Pt ? .64 : .64), 30 * u);
    case 'film': return Pt ? { x: W * .1, y: H * .1, w: W * .8, h: H * .8, r: 0, tx: W * .1, ty: H * .62, tw: W * .8, th: H * .3, tcol: '#fff' } : { x: W * .06, y: H * .12, w: W * .88, h: H * .76, r: 0, tx: W * .1, ty: H * .6, tw: W * .8, th: H * .3, tcol: '#fff' };
    default: return { x: 0, y: 0, w: W, h: H, r: 0, tx: W * .07, ty: H * .7, tw: W * .86, th: H * .25, tcol: '#fff' };
  }
}
function bgFill(c: C2, P: Proj, it?: Item, soft = false) {
  const { W, H, pal } = P; const g = c.createRadialGradient(W / 2, H * .38, 10, W / 2, H * .45, Math.max(W, H) * .8);
  g.addColorStop(0, shade(pal.bg, pal.light ? -6 : 22)); g.addColorStop(1, pal.bg); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (soft && it) { c.save(); c.globalAlpha = pal.light ? .18 : .3; const b = blurOf(it), [bx, by, bw, bh] = coverRect({ ...it, w: b.width, h: b.height, fx: .5, fy: .5 } as Item, 0, 0, W, H, 1.15, 0, 0); c.drawImage(b, bx, by, bw, bh); c.restore(); }
}
function shade(hex: string, amt: number) { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.max(0, Math.min(255, v + amt)); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }

function clipShape(c: C2, F: FR) {
  c.beginPath();
  if (F.shape === 'circle') c.arc(F.x + F.w / 2, F.y + F.h / 2, F.w / 2, 0, Math.PI * 2);
  else if (F.shape === 'arch') { const r = F.w / 2; c.moveTo(F.x, F.y + F.h); c.lineTo(F.x, F.y + r); c.arc(F.x + r, F.y + r, r, Math.PI, 0); c.lineTo(F.x + F.w, F.y + F.h); c.closePath(); }
  else if (F.r) rr(c, F.x, F.y, F.w, F.h, F.r); else c.rect(F.x, F.y, F.w, F.h);
  c.clip();
}

/** رسم تغطية كاملة (من غير خلفية ممسوحة) — للشرايط الضيقة. */
function drawCover(c: C2, P: Proj, it: Item, x: number, y: number, w: number, h: number, lt: number, d: number, motion: string, idx: number) {
  if (!it) return; syncVid(P, it, lt); const [z, px, py] = motionOf(motion, lt, d, idx), [dx, dy, dw, dh] = coverRect(it, x, y, w, h, z, px, py); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.drawImage(it.src, dx, dy, dw, dh); c.restore();
}
/** شريحة بإطار: خلفية ← صورة بالحركة ← زخرفة الإطار ← الكلام. */
function framed(c: C2, P: Proj, it: Item, idx: number, lt: number, d: number, label: string, extra?: (F: FR) => void) {
  const { W, H, pal, st } = P, u = Math.min(W, H) / 1080, F = frameRect(P, idx), f = st.frame;
  if (f !== 'full' && f !== 'gold' && f !== 'magazine') {
    if (f === 'minimal') { c.fillStyle = pal.light ? pal.bg : '#F7F5F0'; c.fillRect(0, 0, W, H); }
    else if (f === 'film') { c.fillStyle = '#0A0A0A'; c.fillRect(0, 0, W, H); }
    else bgFill(c, P, it, f !== 'neon');
  }
  c.save();
  if (F.rot) { const cx = F.x + F.w / 2, cy = F.y + F.h / 2; c.translate(cx, cy); c.rotate(F.rot); c.translate(-cx, -cy); }
  if (f === 'polaroid') { c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 14 * u; c.fillStyle = '#FBFAF6'; const m = F.w * .05; c.fillRect(F.x - m, F.y - m, F.w + 2 * m, F.h + m + F.th); c.restore(); }
  else if (F.r && f !== 'neon') { c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 36 * u; c.shadowOffsetY = 12 * u; rr(c, F.x, F.y, F.w, F.h, F.r); c.fillStyle = '#000'; c.fill(); c.restore(); }
  c.save(); clipShape(c, F); drawItem(c, P, it, F.x, F.y, F.w, F.h, lt, d, st.motion, idx); c.restore();
  // زخرفة
  if (f === 'gold') { c.strokeStyle = pal.ac; c.lineWidth = 3 * u; const a = 26 * u, b = 40 * u; c.strokeRect(a, a, W - 2 * a, H - 2 * a); c.lineWidth = 1.2 * u; c.strokeRect(b, b, W - 2 * b, H - 2 * b); [[a, a], [W - a, a], [a, H - a], [W - a, H - a]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 9 * u, 0, 7); c.fillStyle = pal.ac; c.fill(); }); }
  else if (f === 'neon') { const pu = .6 + .4 * Math.sin(lt * 5); c.save(); c.shadowColor = pal.ac; c.shadowBlur = 40 * u * pu; c.strokeStyle = pal.ac; c.lineWidth = 6 * u; rr(c, F.x, F.y, F.w, F.h, F.r); c.stroke(); c.shadowColor = pal.ac2; c.strokeStyle = pal.ac2; c.lineWidth = 2 * u; rr(c, F.x - 12 * u, F.y - 12 * u, F.w + 24 * u, F.h + 24 * u, F.r + 10 * u); c.stroke(); c.restore(); }
  else if (f === 'circle') { c.save(); c.strokeStyle = pal.ac; c.lineWidth = 6 * u; c.beginPath(); c.arc(F.x + F.w / 2, F.y + F.h / 2, F.w / 2 + 10 * u, 0, 7); c.stroke(); c.setLineDash([14 * u, 18 * u]); c.lineDashOffset = -lt * 60 * u; c.lineWidth = 2.5 * u; c.beginPath(); c.arc(F.x + F.w / 2, F.y + F.h / 2, F.w / 2 + 34 * u, 0, 7); c.stroke(); c.restore(); }
  else if (f === 'arch') { c.save(); c.strokeStyle = pal.ac; c.lineWidth = 3 * u; const g = 16 * u, F2 = { ...F, x: F.x - g, y: F.y - g, w: F.w + 2 * g, h: F.h + 2 * g }; c.beginPath(); const r = F2.w / 2; c.moveTo(F2.x, F2.y + F2.h); c.lineTo(F2.x, F2.y + r); c.arc(F2.x + r, F2.y + r, r, Math.PI, 0); c.lineTo(F2.x + F2.w, F2.y + F2.h); c.stroke(); c.restore(); }
  else if (f === 'film') { c.fillStyle = 'rgba(240,235,220,.88)'; const hs = 30 * u, gap = 64 * u, off = (lt * 90 * u) % gap; if (portrait(P)) { for (let y = -gap + off; y < H; y += gap) { rr(c, W * .03, y, W * .04, hs, 6 * u); c.fill(); rr(c, W * .93, y, W * .04, hs, 6 * u); c.fill(); } } else { for (let x = -gap + off; x < W; x += gap) { rr(c, x, H * .03, hs, H * .05, 6 * u); c.fill(); rr(c, x, H * .92, hs, H * .05, 6 * u); c.fill(); } } }
  else if (f === 'magazine') {
    const g = c.createLinearGradient(0, 0, 0, H * .3); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H * .3);
    txt(c, P, P.T.shop || 'ميكانيزم', W / 2, H * .085, 150 * u, { w: 900, col: pal.ac2 === '#2A2A2A' ? '#fff' : pal.ac2, max: W * .92, lines: 1, sh: true });
    txt(c, P, 'عدد خاص • ' + arN(new Date().getFullYear()), W / 2, H * .085 + 110 * u, 30 * u, { w: 700, col: '#fff', lines: 1 });
  }
  c.restore();
  if (extra) extra(F);
  if (label) caption(c, P, F, label, lt, d);
}

/** الكلام على الشريحة حسب مكانه وشكل ظهوره. */
function caption(c: C2, P: Proj, F: FR, s: string, lt: number, d: number) {
  const { W, H, pal, st } = P, u = Math.min(W, H) / 1080, a = st.anim, t0 = .2, p = cl((lt - t0) / .45), out = d > 1.2 ? cl((d - lt) / .25) : 1, al = (a === 'fade' ? e(p) : 1) * out;
  if (p <= 0 || al <= 0) return; c.save(); c.globalAlpha = al;
  const show = a === 'type' ? s.slice(0, Math.max(1, Math.floor(s.length * cl((lt - t0) / Math.max(.4, s.length * .04))))) : s;
  const sc = a === 'pop' ? back(p) : 1, dy = a === 'slide' ? (1 - eo(p)) * 60 * u : 0;
  switch (st.text) {
    case 'lower': { const g = c.createLinearGradient(0, H * .62, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); c.fillStyle = g; c.fillRect(0, H * .62, W, H * .38);
      const y = H * (landscape(P) ? .83 : .82) + dy; c.fillStyle = pal.ac; c.fillRect(W / 2 - 50 * u * e(p), y - 74 * u, 100 * u * e(p), 7 * u);
      c.translate(W / 2, y); c.scale(sc, sc); c.translate(-W / 2, -y); txt(c, P, show, W / 2, y, 66 * u, { w: 900, col: '#fff', sh: true, lines: 2 }); break; }
    case 'center': { const y = H * .5 + dy; c.translate(W / 2, y); c.scale(sc, sc); c.translate(-W / 2, -y); txt(c, P, show, W / 2, y, 96 * u, { w: 900, col: '#fff', stroke: 'rgba(0,0,0,.8)', sh: true, lines: 3 }); break; }
    case 'top': { const y = H * .13 + dy; c.translate(W / 2, y); c.scale(sc, sc); c.translate(-W / 2, -y); pill(c, P, show, W / 2, y, 50 * u, pal.ac, pal.light ? '#fff' : '#111', 900); break; }
    case 'below': case 'panel': {
      const cx = F.tx + F.tw / 2, cy = F.ty + Math.min(F.th, 220 * u) / 2 + dy, size = st.frame === 'polaroid' ? 46 * u : st.text === 'panel' ? 70 * u : 60 * u;
      if (st.frame === 'polaroid' && F.rot) { c.translate(F.x + F.w / 2, F.y + F.h / 2); c.rotate(F.rot); c.translate(-F.x - F.w / 2, -F.y - F.h / 2); }
      c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); txt(c, P, show, cx, cy, size, { w: 800, col: F.tcol, max: F.tw, lines: 2, f: st.frame === 'polaroid' ? 'Marhey' : undefined }); break; }
  }
  c.restore();
}

function logoAt(c: C2, P: Proj, corner = true, alpha = .95) {
  if (!P.logoOn || !P.logo) return; const { W, H } = P, u = Math.min(W, H) / 1080, s = 128 * u; c.save(); c.globalAlpha = alpha; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 16 * u;
  if (corner) c.drawImage(P.logo, 30 * u, 30 * u, s, s); c.restore();
}
function priceBadge(c: C2, P: Proj, x: number, y: number, R: number, p: number, lt: number) {
  const T = P.T; if (!T.price || p <= 0) return; const u = Math.min(P.W, P.H) / 1080, s = back(p), wob = Math.sin(lt * 6) * .04;
  c.save(); c.translate(x, y); c.rotate(-.18 + wob); c.scale(s, s);
  c.beginPath(); for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, r = i % 2 ? R * .86 : R; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath();
  c.fillStyle = P.pal.ac; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24 * u; c.fill(); c.shadowBlur = 0; c.lineWidth = 4 * u; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
  const dark = /^#(F|E|D|C|9)/i.test(P.pal.ac) ? '#111' : '#fff';
  if (T.old) { txt(c, P, priceTxt(T.old), 0, -R * .42, R * .26, { col: dark, w: 700 }); c.fillStyle = dark; c.fillRect(-R * .32, -R * .44, R * .64, 3 * u); }
  txt(c, P, priceTxt(T.price), 0, T.old ? R * .02 : -R * .08, R * .5, { col: dark, w: 900, max: R * 1.7, lines: 1 });
  txt(c, P, 'جنيه', 0, R * .46, R * .22, { col: dark, w: 800 }); c.restore();
}

/* ───── أنواع الشرايح الخاصة ───── */
function slide(c: C2, P: Proj, seg: Seg, lt: number, d: number) {
  const { W, H, pal, st, T, items } = P, u = Math.min(W, H) / 1080, its = seg.items.map(i => items[i]).filter(Boolean), it = its[0], idx = seg.i, n = seg.n;
  if (!it) return;
  const label = it.cap || '';
  if (MOD[st.special]) { MOD[st.special](c, P, seg, lt, d, its); return; }
  switch (st.special) {
    case 'ba-wipe': case 'ba-split': {
      const b = its[1]; if (!b) { framed(c, P, it, idx, lt, d, label); break; }
      const after = cl((lt - d * .28) / (d * .45)), ep = e(after);
      if (st.special === 'ba-wipe') {
        drawItem(c, P, it, 0, 0, W, H, 0, d, 'static', idx); const xl = W * (1 - ep);
        c.save(); c.beginPath(); c.rect(xl, 0, W - xl, H); c.clip(); drawItem(c, P, b, 0, 0, W, H, lt, d, 'kb', idx); c.restore();
        if (after > 0 && after < 1) { c.fillStyle = '#fff'; c.fillRect(xl - 3 * u, 0, 6 * u, H); c.beginPath(); c.arc(xl, H / 2, 42 * u, 0, 7); c.fillStyle = pal.ac; c.fill(); txt(c, P, '⟷', xl, H / 2, 44 * u, { col: '#111', w: 900 }); }
        if (ep < .98) pill(c, P, 'قبل', W * .2, H * .1, 44 * u, 'rgba(0,0,0,.65)', '#fff', 900);
        if (ep > .02) { c.save(); c.globalAlpha = ep; pill(c, P, 'بعد ✨', W * .8, H * .1, 44 * u, pal.ac, '#111', 900); c.restore(); }
      } else {
        const Pt = !landscape(P), h2 = Pt ? H / 2 : H, w2 = Pt ? W : W / 2;
        drawItem(c, P, it, Pt ? 0 : W / 2, 0, w2, h2, lt, d, 'kb', idx);
        const off = (1 - ep) * (Pt ? h2 : -w2); c.save(); c.beginPath(); Pt ? c.rect(0, h2, W, h2) : c.rect(0, 0, w2, H); c.clip(); drawItem(c, P, b, Pt ? 0 : off, Pt ? h2 + off : 0, w2, h2, lt, d, 'kb', idx + 1); c.restore();
        c.fillStyle = pal.ac; Pt ? c.fillRect(0, h2 - 4 * u, W, 8 * u) : c.fillRect(w2 - 4 * u, 0, 8 * u, H);
        pill(c, P, 'قبل', Pt ? W * .82 : W * .9, Pt ? 70 * u : 70 * u, 40 * u, 'rgba(0,0,0,.65)', '#fff', 900);
        if (ep > .02) { c.save(); c.globalAlpha = ep; pill(c, P, 'بعد ✨', Pt ? W * .82 : W * .1, Pt ? h2 + 70 * u : 70 * u, 40 * u, pal.ac, '#111', 900); c.restore(); }
      }
      if (b.cap || it.cap) { c.save(); c.globalAlpha = e(cl((lt - d * .75) / .3)); txt(c, P, b.cap || it.cap, W / 2, H * .9, 56 * u, { w: 900, col: '#fff', stroke: 'rgba(0,0,0,.8)', lines: 2 }); c.restore(); }
      logoAt(c, P); break;
    }
    case 'grid': {
      bgFill(c, P, it, true); const m = 44 * u, g = 16 * u, top = H * (portrait(P) ? .12 : .08), bot = H * (portrait(P) ? .1 : .06), cols = its.length === 1 ? 1 : 2, rows = Math.ceil(its.length / cols);
      const cw = (W - 2 * m - (cols - 1) * g) / cols, ch = (H - top - bot - (rows - 1) * g) / rows;
      its.forEach((x, k) => { const p = back(cl((lt - k * .22) / .4)); if (p <= 0) return; const col = k % cols, row = Math.floor(k / cols), X = W - m - (col + 1) * cw - col * g, Y = top + row * (ch + g);
        c.save(); c.translate(X + cw / 2, Y + ch / 2); c.scale(p, p); c.translate(-X - cw / 2, -Y - ch / 2); rr(c, X, Y, cw, ch, 24 * u); c.save(); c.clip(); drawItem(c, P, x, X, Y, cw, ch, lt, d, 'kb', k); c.restore();
        c.lineWidth = 3 * u; c.strokeStyle = pal.ac; rr(c, X, Y, cw, ch, 24 * u); c.stroke();
        if (x.cap) { const gy = c.createLinearGradient(0, Y + ch * .6, 0, Y + ch); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,.7)'); c.save(); rr(c, X, Y, cw, ch, 24 * u); c.clip(); c.fillStyle = gy; c.fillRect(X, Y + ch * .6, cw, ch * .4); c.restore(); txt(c, P, x.cap, X + cw / 2, Y + ch - 40 * u, 38 * u, { col: '#fff', w: 800, max: cw * .9, lines: 1 }); }
        c.restore(); });
      if (T.title) txt(c, P, T.title, W / 2, top / 2 + 10 * u, 54 * u, { w: 900, col: pal.fg, lines: 1 });
      logoAt(c, P); break;
    }
    case 'carousel': {
      bgFill(c, P, it, true); const N = its.length, step = d / N, f = lt / step, base = Math.floor(f), fr = f - base, pos = base + e((fr - .62) / .38);
      const cw = Math.min(W * .62, H * .5), chh = Math.min(cw * 1.3, H * .58), cy = H * (landscape(P) ? .48 : .42);
      const order = [-2, 2, -1, 1, 0].map(k => Math.round(pos) + k);
      order.forEach(k => { if (k < 0 || k >= N) return; const dx = k - pos, ad = Math.abs(dx); if (ad > 2.3) return; const s = 1 - .2 * Math.min(ad, 2), x = W / 2 - dx * cw * .78;
        c.save(); c.translate(x, cy); c.scale(s, s); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40 * u; rr(c, -cw / 2, -chh / 2, cw, chh, 28 * u); c.fillStyle = '#000'; c.fill(); c.shadowBlur = 0; c.clip();
        drawItem(c, P, its[k], -cw / 2, -chh / 2, cw, chh, lt, d, 'static', k); if (ad > .05) { c.fillStyle = 'rgba(0,0,0,' + (.5 * Math.min(1, ad)) + ')'; c.fillRect(-cw / 2, -chh / 2, cw, chh); } c.restore(); });
      const cur = its[Math.min(N - 1, Math.max(0, Math.round(pos)))]; const lab = cur && cur.cap || (T.title || '');
      if (lab) txt(c, P, lab, W / 2, cy + chh / 2 + 90 * u, 58 * u, { w: 900, col: pal.fg, lines: 2 });
      for (let k = 0; k < N && N <= 30; k++) { c.beginPath(); c.arc(W / 2 + (k - (N - 1) / 2) * 26 * u * (N > 15 ? .6 : 1), H * .93, (Math.round(pos) === k ? 8 : 5) * u, 0, 7); c.fillStyle = Math.round(pos) === k ? pal.ac : 'rgba(255,255,255,.4)'; c.fill(); }
      logoAt(c, P); break;
    }
    case 'polaroid': {
      bgFill(c, P, it, false); const prev = Math.min(3, idx);
      for (let k = idx - prev; k < idx; k++) { const pi = P.items[seg.items[0] - (idx - k)]; if (!pi) continue; const F = frameRect(P, k), dx = (hash(k + 9) - .5) * W * .1, dy = (hash(k + 5) - .5) * H * .04;
        c.save(); c.globalAlpha = .9; c.translate(dx, dy); c.translate(F.x + F.w / 2, F.y + F.h / 2); c.rotate(F.rot || 0); c.translate(-F.x - F.w / 2, -F.y - F.h / 2); const m = F.w * .05; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24 * u; c.fillStyle = '#F4F1EA'; c.fillRect(F.x - m, F.y - m, F.w + 2 * m, F.h + m + F.th); c.shadowBlur = 0; drawItem(c, P, pi, F.x, F.y, F.w, F.h, 0, d, 'static', k); c.restore(); }
      const drop = eo(lt / .55); c.save(); c.translate(0, -(1 - drop) * H * .5); const sc = 1.12 - .12 * drop; c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2);
      const P2 = { ...P, st: { ...st, frame: 'polaroid' } } as Proj; const keep = st.frame; void keep;
      const F = frameRect(P2, idx); c.save(); c.translate(F.x + F.w / 2, F.y + F.h / 2); c.rotate(F.rot || 0); c.translate(-F.x - F.w / 2, -F.y - F.h / 2); const m = F.w * .05; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 16 * u; c.fillStyle = '#FBFAF6'; c.fillRect(F.x - m, F.y - m, F.w + 2 * m, F.h + m + F.th); c.shadowBlur = 0; c.shadowOffsetY = 0; drawItem(c, P, it, F.x, F.y, F.w, F.h, lt, d, 'kb', idx);
      const lab = label || (T.date ? arDate(it.date) : ''); if (lab) txt(c, P, lab, F.x + F.w / 2, F.y + F.h + F.th / 2, 46 * u, { col: '#2A2A2A', f: 'Marhey', w: 700, max: F.w, lines: 1 });
      c.restore(); c.restore(); logoAt(c, P); break;
    }
    case 'journey': {
      drawItem(c, P, it, 0, 0, W, H, lt, d, st.motion, idx);
      const g = c.createLinearGradient(0, 0, 0, H * .36); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H * .36);
      const g2 = c.createLinearGradient(0, H * .78, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = g2; c.fillRect(0, H * .78, W, H * .22);
      const p = eo(lt / .5), name = T.stages[idx] || it.cap || '';
      c.save(); c.globalAlpha = p; pill(c, P, 'المرحلة ' + arN(idx + 1) + ' من ' + arN(n), W / 2, H * .085 + (1 - p) * -30 * u, 40 * u, pal.ac, '#111', 900);
      if (name) txt(c, P, name, W / 2, H * .17, 78 * u, { w: 900, col: '#fff', sh: true, lines: 2, stroke: 'rgba(0,0,0,.5)' });
      if (T.date) txt(c, P, '📅 ' + arDate(it.date), W / 2, H * (name ? .245 : .17), 34 * u, { w: 700, col: '#fff', sh: true }); c.restore();
      const y = H * .93, x0 = W * .1, x1 = W * .9, pr = (idx + e(lt / d)) / n; c.lineCap = 'round'; c.lineWidth = 8 * u; c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(x1, y); c.lineTo(x0, y); c.stroke();
      c.strokeStyle = pal.ac; c.beginPath(); c.moveTo(x1, y); c.lineTo(x1 - (x1 - x0) * pr, y); c.stroke();
      if (n <= 24) for (let k = 0; k < n; k++) { const x = x1 - (x1 - x0) * (n === 1 ? 0 : k / (n - 1)); c.beginPath(); c.arc(x, y, (k === idx ? 13 + 3 * Math.sin(lt * 6) : 9) * u, 0, 7); c.fillStyle = k <= idx ? pal.ac : 'rgba(255,255,255,.55)'; c.fill(); }
      logoAt(c, P); break;
    }
    case 'timelapse': {
      drawItem(c, P, it, 0, 0, W, H, lt, d, 'static', idx); const pct = Math.round(((idx + cl(lt / d)) / n) * 100);
      c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, W / 2 - 150 * u, H * .06, 300 * u, 110 * u, 55 * u); c.fill(); txt(c, P, arN(pct) + '٪', W / 2, H * .06 + 58 * u, 70 * u, { w: 900, col: pal.ac2 });
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, H - 14 * u, W, 14 * u); c.fillStyle = pal.ac; c.fillRect(W - W * pct / 100, H - 14 * u, W * pct / 100, 14 * u);
      if (idx === n - 1) { c.save(); c.globalAlpha = e(lt / .3); txt(c, P, T.sub || 'من الصفر للتسليم ✅', W / 2, H * .82, 70 * u, { w: 900, col: '#fff', stroke: 'rgba(0,0,0,.8)', lines: 2 }); c.restore(); }
      else if (label) txt(c, P, label, W / 2, H * .84, 54 * u, { w: 800, col: '#fff', stroke: 'rgba(0,0,0,.8)', lines: 2 });
      logoAt(c, P); break;
    }
    case 'count': {
      framed(c, P, it, idx, lt, d, label); const num = n - idx, p = back(cl(lt / .4));
      c.save(); const x = W * .78, y = H * .14; c.translate(x, y); c.scale(p, p); c.rotate(-.06); c.fillStyle = pal.ac; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 30 * u; rr(c, -120 * u, -100 * u, 240 * u, 200 * u, 30 * u); c.fill(); c.shadowBlur = 0;
      txt(c, P, '#' + arN(num), 0, 8 * u, 140 * u, { w: 900, col: '#111', f: 'Lalezar' }); c.restore(); logoAt(c, P); break;
    }
    case 'price': {
      framed(c, P, it, idx, lt, d, label, F => {
        if (st.frame === 'neon' || st.id === 'flash') { const pu = .5 + .5 * Math.sin(lt * 9); c.save(); c.fillStyle = pal.ac; c.fillRect(0, H * .03, W, 90 * u); c.globalAlpha = .25; for (let x = -W; x < W * 2; x += 60 * u) { c.beginPath(); c.moveTo(x + lt * 120 * u % (60 * u), H * .03); c.lineTo(x + 30 * u + lt * 120 * u % (60 * u), H * .03); c.lineTo(x + lt * 120 * u % (60 * u), H * .03 + 90 * u); c.lineTo(x - 30 * u + lt * 120 * u % (60 * u), H * .03 + 90 * u); c.fillStyle = '#000'; c.fill(); } c.restore(); txt(c, P, (T.badge || 'عرض لفترة محدودة') + ' ⏳', W / 2, H * .03 + 46 * u, 46 * u, { w: 900, col: '#fff', lines: 1 }); c.globalAlpha = 1; void pu; }
        priceBadge(c, P, Math.min(F.x + F.w - 40 * u, W - 170 * u), Math.max(F.y + 60 * u, H * .2), 150 * u, cl((lt - .25) / .45), lt);
      });
      if (idx === n - 1) { const pu = 1 + .05 * Math.sin(lt * 7); c.save(); c.translate(W / 2, H * .935); c.scale(pu, pu); pill(c, P, (T.cta || 'اطلب دلوقتي') + (T.phone ? ' 📞 ' + arN(T.phone) : ''), 0, 0, 40 * u, pal.ac, '#111', 900); c.restore(); }
      logoAt(c, P); break;
    }
    default: framed(c, P, it, idx, lt, d, label || (idx === 0 && st.intro === 'none' ? T.title : '')); logoAt(c, P);
  }
}

/* ───── البداية والنهاية ───── */
function intro(c: C2, P: Proj, lt: number, d: number) {
  const { W, H, pal, st, T, items } = P, u = Math.min(W, H) / 1080, it = items[0], p = eo(lt / .7), out = cl((d - lt) / .3);
  if (st.intro === 'logo') {
    bgFill(c, P, it, true); const s = back(cl(lt / .55)) * (1 - .25 * e((lt - .9) / .5)), y = H * (.45 - .1 * e((lt - .9) / .5)), R = 230 * u;
    if (P.logo) { c.save(); c.translate(W / 2, y); c.scale(s, s); c.drawImage(P.logo, -R, -R, 2 * R, 2 * R); c.restore(); }
    c.save(); c.globalAlpha = e((lt - 1) / .4) * out; txt(c, P, T.title || T.shop, W / 2, H * .62, 74 * u, { w: 900, col: pal.fg, lines: 2 }); if (T.sub) txt(c, P, T.sub, W / 2, H * .62 + 110 * u, 40 * u, { w: 600, col: pal.ac2 }); c.restore(); return;
  }
  if (introModern(c, P, lt, d)) return;
  if (it) drawItem(c, P, it, 0, 0, W, H, lt, d, 'kbOut', 0);
  if (st.intro === 'mag') {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.35, 'rgba(0,0,0,0)'); g.addColorStop(.65, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = out; txt(c, P, T.shop || 'ميكانيزم', W / 2, H * .1, 170 * u * (1.2 - .2 * p), { w: 900, col: pal.light ? '#fff' : pal.ac2, max: W * .94, lines: 1, sh: true });
    c.globalAlpha = e((lt - .4) / .5) * out; txt(c, P, T.title, W / 2, H * .78, 84 * u, { w: 900, col: '#fff', sh: true, lines: 2 }); if (T.sub) txt(c, P, T.sub, W / 2, H * .78 + 120 * u, 40 * u, { w: 700, col: pal.ac2, sh: true }); c.restore(); logoAt(c, P); return;
  }
  if (st.intro === 'split') { c.fillStyle = pal.bg; c.save(); c.beginPath(); c.moveTo(0, H); c.lineTo(W * (1.2 - p), H); c.lineTo(W * (.8 - p * .8), 0); c.lineTo(0, 0); c.closePath(); c.globalAlpha = .9; c.fill(); c.restore(); }
  else { c.fillStyle = 'rgba(0,0,0,' + (.5 * out) + ')'; c.fillRect(0, 0, W, H); }
  c.save(); c.globalAlpha = out; const y = H * .46; c.fillStyle = pal.ac; c.fillRect(W / 2 - 160 * u * p, y + 120 * u, 320 * u * p, 8 * u);
  c.translate(0, (1 - p) * 50 * u); txt(c, P, T.title || T.shop || 'ميكانيزم', W / 2, y, 96 * u, { w: 900, col: '#fff', sh: true, lines: 3 });
  if (T.sub) { c.globalAlpha = e((lt - .35) / .5) * out; txt(c, P, T.sub, W / 2, y + 190 * u, 46 * u, { w: 700, col: pal.ac2, sh: true, lines: 2 }); }
  c.restore(); logoAt(c, P);
}
function outro(c: C2, P: Proj, lt: number, d: number) {
  const { W, H, pal, st, T, items } = P, u = Math.min(W, H) / 1080, p = eo(lt / .6);
  if (outroModern(c, P, lt, d)) return;
  bgFill(c, P, items[items.length - 1], st.outro !== 'grid');
  if (st.outro === 'grid' || items.length >= 4) {
    const n = Math.min(9, items.length), cols = n >= 7 ? 3 : n >= 4 ? 2 : 1, rows = Math.ceil(n / cols), cw = W / cols, ch = H / rows;
    c.save(); c.globalAlpha = .28 * p; for (let k = 0; k < n; k++) drawItem(c, P, items[k], (k % cols) * cw, Math.floor(k / cols) * ch, cw, ch, lt, d, 'static', k); c.restore();
  }
  const ly = H * (portrait(P) ? .27 : .25), R = 170 * u * back(cl(lt / .5));
  if (P.logo) { c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40 * u; c.drawImage(P.logo, W / 2 - R, ly - R, 2 * R, 2 * R); c.restore(); } else txt(c, P, T.shop, W / 2, ly, 90 * u, { w: 900, col: pal.ac2 });
  c.save(); c.globalAlpha = p; let y = ly + 230 * u;
  if (T.price) { priceBadge(c, P, W * .78, ly, 120 * u, cl((lt - .3) / .4), lt); }
  txt(c, P, T.shop || 'ميكانيزم', W / 2, y, 70 * u, { w: 900, col: pal.fg }); y += 110 * u;
  if (T.phone) { txt(c, P, '📞 ' + arN(T.phone), W / 2, y, 64 * u, { w: 900, col: pal.ac2 === '#2A2A2A' ? pal.ac : pal.ac2, f: 'Cairo' }); y += 96 * u; }
  if (T.addr) { txt(c, P, '📍 ' + T.addr, W / 2, y, 38 * u, { w: 700, col: pal.fg, lines: 2 }); y += 90 * u; }
  const pu = 1 + .05 * Math.sin(lt * 6.5); c.translate(W / 2, y + 40 * u); c.scale(pu, pu); pill(c, P, T.cta || 'اطلب دلوقتي', 0, 0, 50 * u, pal.ac, pal.light ? '#fff' : '#111', 900);
  c.restore();
}

/* ───── الجيل الحديث: قوالب ترند (كلمات متحركة، زجاجي، ستوري، كروت، بينتو، مجلة…) + لمسات سينمائية ───── */
const darken = (c: C2, P: Proj, a: number) => { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, P.W, P.H); };
const sheetGrad = (c: C2, P: Proj, y0: number, a: number) => { const g = c.createLinearGradient(0, P.H * y0, 0, P.H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); c.fillStyle = g; c.fillRect(0, P.H * y0, P.W, P.H * (1 - y0)); };
const pad2 = (i: number) => arN(String(i + 1).padStart(2, '0'));
const words = (s: string, n: number) => String(s || '').split(/\s+/).filter(Boolean).slice(0, n);
function circLogo(c: C2, P: Proj, x: number, y: number, r: number) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = P.pal.ac; c.fill(); c.clip();
  if (P.logo) c.drawImage(P.logo, x - r, y - r, 2 * r, 2 * r); else txt(c, P, (P.T.shop || 'م').slice(0, 1), x, y, r * 1.2, { w: 900, col: '#111' }); c.restore();
}
const MOD: Record<string, (c: C2, P: Proj, seg: Seg, lt: number, d: number, its: Item[]) => void> = {
  kinetic(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0], i = seg.i;
    drawItem(c, P, it, 0, 0, W, H, lt, d, P.st.motion, i); darken(c, P, .5);
    const ws = words(it.cap || (i === 0 ? T.title : ''), 5);
    if (!ws.length) {
      const p = back(lt / .5); c.save(); c.translate(W / 2, H * .46); c.scale(p, p); txt(c, P, pad2(i), 0, 0, 420 * u, { w: 900, col: pal.ac, stroke: 'rgba(0,0,0,.45)', lines: 1 }); c.restore();
      if (T.sub) { c.save(); c.globalAlpha = e((lt - .3) / .4); txt(c, P, T.sub, W / 2, H * .72, 54 * u, { w: 800, col: '#fff', sh: true, lines: 2 }); c.restore(); }
    } else {
      const px = Math.min(190 * u, W * .86 / (Math.max(...ws.map(x => x.length)) * .55));
      ws.forEach((w, k) => { const p = back((lt - k * .2) / .35); if (p <= 0) return; const y = H * .5 + (k - (ws.length - 1) / 2) * px * 1.18; c.save(); c.translate(W / 2, y); c.rotate((k % 2 ? 1 : -1) * .04 * (1 - cl((lt - k * .2) / .5) * .6)); c.scale(p, p); txt(c, P, w, 0, 0, px, { w: 900, col: k % 2 ? pal.fg : pal.ac, stroke: 'rgba(0,0,0,.55)', sh: true, lines: 1, max: W * .95 }); c.restore(); });
    }
    c.fillStyle = pal.ac; c.fillRect(0, H - 12 * u, W * cl(lt / d), 12 * u); logoAt(c, P);
  },
  glass(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0], Pt = !landscape(P), b = blurOf(it);
    const [bx, by, bw, bh] = coverRect({ ...it, w: b.width, h: b.height, fx: .5, fy: .5 } as Item, 0, 0, W, H, 1.3 + .05 * Math.sin(lt), 0, 0); c.drawImage(b, bx, by, bw, bh); darken(c, P, .38);
    const p = eo(lt / .6), cw = W * (Pt ? .8 : .46), chh = H * (Pt ? .56 : .74), cx = W / 2, cy = H * (Pt ? .4 : .5) + Math.sin(lt * 1.6) * 10 * u;
    c.save(); c.globalAlpha = p; c.translate(cx, cy); c.scale(.92 + .08 * p, .92 + .08 * p); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 50 * u; c.shadowOffsetY = 20 * u; rr(c, -cw / 2, -chh / 2, cw, chh, 44 * u); c.fillStyle = '#000'; c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0; c.save(); c.clip(); drawItem(c, P, it, -cw / 2, -chh / 2, cw, chh, lt, d, 'kb', seg.i); c.restore(); c.lineWidth = 2 * u; c.strokeStyle = 'rgba(255,255,255,.35)'; rr(c, -cw / 2, -chh / 2, cw, chh, 44 * u); c.stroke();
    const ph = 150 * u, py = chh / 2 - ph * .55, pw = cw * .9; rr(c, -pw / 2, py, pw, ph, 36 * u); c.fillStyle = 'rgba(20,20,28,.42)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
    txt(c, P, it.cap || (seg.i === 0 ? T.title : T.shop) || '', 0, py + ph / 2, 56 * u, { w: 900, col: '#fff', max: pw * .9, lines: 2, sh: true }); c.restore();
    c.save(); c.globalAlpha = p; pill(c, P, arN(seg.i + 1) + ' / ' + arN(seg.n), W / 2, H * (Pt ? .085 : .08), 34 * u, 'rgba(255,255,255,.18)', '#fff', 800); c.restore(); logoAt(c, P);
  },
  story(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0], m = 34 * u, n = seg.n, i = seg.i;
    drawItem(c, P, it, 0, 0, W, H, lt, d, P.st.motion, i); const g = c.createLinearGradient(0, 0, 0, H * .22); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H * .22); sheetGrad(c, P, .72, .6);
    const bars = Math.min(n, 12), bw = (W - 2 * m - (bars - 1) * 8 * u) / bars; for (let k = 0; k < bars; k++) { const x = W - m - (k + 1) * bw - k * 8 * u, f = n > 12 ? (k === 0 ? (i + cl(lt / d)) / n : 0) : (k < i ? 1 : k === i ? cl(lt / d) : 0); c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, x, 34 * u, bw, 7 * u, 4 * u); c.fill(); c.fillStyle = '#fff'; rr(c, x + bw * (1 - f), 34 * u, bw * f, 7 * u, 4 * u); c.fill(); }
    circLogo(c, P, W - m - 38 * u, 108 * u, 38 * u); txt(c, P, T.shop || 'ميكانيزم', W - m - 96 * u, 100 * u, 36 * u, { w: 900, col: '#fff', al: 'right', sh: true, lines: 1 }); txt(c, P, 'الآن • ممول', W - m - 96 * u, 142 * u, 24 * u, { w: 600, col: 'rgba(255,255,255,.8)', al: 'right', lines: 1 });
    const lab = it.cap || (i === 0 ? T.title : ''); if (lab) { const p = back((lt - .25) / .4); c.save(); c.translate(W / 2, H * .68); c.rotate(-.04); c.scale(p, p); c.font = fnt(P, 58 * u, 900); const tw = Math.min(W * .84, c.measureText(lab).width + 90 * u); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24 * u; rr(c, -tw / 2, -62 * u, tw, 124 * u, 30 * u); c.fillStyle = '#fff'; c.fill(); c.shadowBlur = 0; txt(c, P, lab, 0, 4 * u, 58 * u, { w: 900, col: '#111', max: tw - 50 * u, lines: 1 }); c.restore(); }
    c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3 * u; rr(c, m, H - 150 * u, W - 2 * m - 130 * u, 84 * u, 42 * u); c.stroke(); c.restore(); txt(c, P, 'ابعتلنا رسالة…', W - m - 40 * u, H - 108 * u, 32 * u, { w: 600, col: 'rgba(255,255,255,.85)', al: 'right', lines: 1 }); txt(c, P, i === n - 1 ? '📲' : '❤', m + 50 * u, H - 108 * u, 56 * u, { lines: 1 });
  },
  stack(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0], Pt = !landscape(P), base = seg.items[0], cw = W * (Pt ? .78 : .42), chh = H * (Pt ? .6 : .74), cy = H * (Pt ? .42 : .5); bgFill(c, P, it, true);
    const card = (item: Item | undefined, s: number, dx: number, dy: number, rot: number, al: number, live: boolean) => { if (!item) return; c.save(); c.globalAlpha = al; c.translate(W / 2 + dx, cy + dy); c.rotate(rot); c.scale(s, s); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40 * u; rr(c, -cw / 2, -chh / 2, cw, chh, 36 * u); c.fillStyle = '#000'; c.fill(); c.shadowBlur = 0; c.save(); c.clip(); drawItem(c, P, item, -cw / 2, -chh / 2, cw, chh, live ? lt : 0, d, live ? 'kb' : 'static', base); c.restore(); c.lineWidth = 3 * u; c.strokeStyle = 'rgba(255,255,255,.25)'; rr(c, -cw / 2, -chh / 2, cw, chh, 36 * u); c.stroke(); c.restore(); };
    const ent = eo(lt / .5); card(P.items[base + 2], .88, 0, -46 * u, .06, .65, false); card(P.items[base + 1], .88 + .06 * ent * 0, 0, -22 * u, -.035, .9, false); card(it, .94 + .06 * ent, 0, 0, 0, 1, true);
    if (base > 0 && lt < .55) { const q = eo(lt / .5); card(P.items[base - 1], 1, -q * W * 1.15, q * 80 * u, -q * .4, 1 - q * .3, false); }
    const lab = it.cap || (seg.i === 0 ? T.title : ''); if (lab) txt(c, P, lab, W / 2, cy + chh / 2 + 90 * u, 58 * u, { w: 900, col: pal.fg, lines: 2 });
    txt(c, P, arN(seg.i + 1) + ' / ' + arN(seg.n), W / 2, H * .07, 38 * u, { w: 800, col: pal.ac2, lines: 1 }); logoAt(c, P);
  },
  bento(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, Pt = !landscape(P), m = 36 * u, g = 14 * u, top = H * (Pt ? .13 : .1), bot = H * .06, aw = W - 2 * m, ah = H - top - bot, n = its.length; bgFill(c, P, its[0], false);
    const R: number[][] = n === 1 ? [[0, 0, 1, 1]] : n === 2 ? (Pt ? [[0, 0, 1, .5], [0, .5, 1, .5]] : [[0, 0, .5, 1], [.5, 0, .5, 1]]) : n === 3 ? [[0, 0, 1, .55], [0, .55, .5, .45], [.5, .55, .5, .45]] : [[0, 0, .62, .62], [.62, 0, .38, .31], [.62, .31, .38, .31], [0, .62, 1, .38]];
    its.forEach((x, k) => { const r = R[k]; if (!r) return; const X = m + aw * (1 - r[0] - r[2]) + g / 2, Y = top + ah * r[1] + g / 2, w = aw * r[2] - g, h = ah * r[3] - g, p = back((lt - k * .18) / .45); if (p <= 0) return;
      c.save(); c.translate(X + w / 2, Y + h / 2); c.scale(p, p); c.translate(-X - w / 2, -Y - h / 2); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24 * u; rr(c, X, Y, w, h, 30 * u); c.fillStyle = '#000'; c.fill(); c.shadowBlur = 0; c.save(); c.clip(); drawCover(c, P, x, X, Y, w, h, lt, d, 'kb', k); c.restore();
      if (x.cap) { c.save(); rr(c, X, Y, w, h, 30 * u); c.clip(); const gy = c.createLinearGradient(0, Y + h * .55, 0, Y + h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,.7)'); c.fillStyle = gy; c.fillRect(X, Y + h * .55, w, h * .45); c.restore(); txt(c, P, x.cap, X + w / 2, Y + h - 38 * u, 36 * u, { w: 800, col: '#fff', max: w * .88, lines: 1 }); }
      c.fillStyle = pal.ac; c.beginPath(); c.arc(X + w - 36 * u, Y + 36 * u, 22 * u, 0, 7); c.fill(); txt(c, P, arN(k + 1 + seg.i * 4), X + w - 36 * u, Y + 38 * u, 24 * u, { w: 900, col: '#111', lines: 1 }); c.restore(); });
    if (T.title) txt(c, P, T.title, W / 2, top / 2 + 6 * u, 54 * u, { w: 900, col: pal.fg, lines: 1 }); logoAt(c, P);
  },
  editorial(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0], i = seg.i, p = eo(lt / .7); c.fillStyle = pal.light ? pal.bg : shade(pal.bg, 10); c.fillRect(0, 0, W, H);
    const x = W * .14, y = H * .12, w = W * .76, h = H * .58, o = 24 * u * p; c.strokeStyle = pal.ac; c.lineWidth = 3 * u; c.strokeRect(x - o, y + o, w, h);
    c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 16 * u; c.fillStyle = '#000'; c.fillRect(x, y, w, h); c.restore(); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); drawItem(c, P, it, x, y, w, h, lt, d, 'kb', i); c.restore();
    c.save(); c.font = fnt(P, 340 * u, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6 * u; c.strokeStyle = pal.ac; c.globalAlpha = .95 * p; c.fillStyle = 'rgba(255,255,255,.22)'; c.fillText(pad2(i), W * .26, y + h * .86 + (1 - p) * 60 * u); c.strokeText(pad2(i), W * .26, y + h * .86 + (1 - p) * 60 * u); c.restore();
    const lab = it.cap || (i === 0 ? T.title : ''); c.fillStyle = pal.ac; c.fillRect(W * .86 - 120 * u * p, H * .765, 120 * u * p, 5 * u);
    if (lab) { c.save(); c.globalAlpha = e((lt - .25) / .4); txt(c, P, lab, W * .86, H * .83, 64 * u, { w: 900, col: pal.fg, al: 'right', max: W * .7, lines: 2 }); c.restore(); }
    txt(c, P, (T.shop || 'ميكانيزم') + '  •  ' + arN(new Date().getFullYear()), W / 2, H * .94, 30 * u, { w: 700, col: pal.light ? pal.fg : pal.ac2, lines: 1 }); logoAt(c, P);
  },
  callout(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0]; drawItem(c, P, it, 0, 0, W, H, lt, d, P.st.motion, seg.i); sheetGrad(c, P, .55, .7);
    const fx = W * (.5 + (it.fx - .5) * .5), fy = H * (.5 + (it.fy - .5) * .4), p = eo((lt - .3) / .5), lx = W / 2, ly = H * .8;
    if (p > 0) { for (let k = 0; k < 3; k++) { const q = ((lt * .9 + k / 3) % 1); c.beginPath(); c.arc(fx, fy, (26 + q * 90) * u * p, 0, 7); c.strokeStyle = pal.ac; c.globalAlpha = (1 - q) * .8; c.lineWidth = 4 * u; c.stroke(); } c.globalAlpha = 1;
      c.beginPath(); c.arc(fx, fy, 14 * u * p, 0, 7); c.fillStyle = pal.ac; c.fill(); c.lineWidth = 4 * u; c.strokeStyle = '#fff'; c.stroke(); c.beginPath(); c.moveTo(fx, fy + 16 * u); c.lineTo(fx + (lx - fx) * p, fy + 16 * u + (ly - 50 * u - fy - 16 * u) * p); c.strokeStyle = '#fff'; c.lineWidth = 3 * u; c.stroke(); }
    const lab = it.cap || (seg.i === 0 ? T.title : ''); if (lab && p > .5) { const q = back((p - .5) * 2); c.save(); c.translate(lx, ly); c.scale(q, q); pill(c, P, lab, 0, 0, 52 * u, pal.ac, pal.light ? '#fff' : '#111', 900); c.restore(); }
    logoAt(c, P);
  },
  vhs(c, P, seg, lt, d, its) {
    const { W, H, T } = P, u = Math.min(W, H) / 1080, it = its[0]; drawItem(c, P, it, 0, 0, W, H, lt, d, 'handheld', seg.i);
    c.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 0; y < H; y += 5 * u) c.fillRect(0, y, W, 2 * u);
    const ty = ((lt * .4 + seg.i * .3) % 1.2 - .1) * H, th = 46 * u; try { c.drawImage(c.canvas, 0, Math.max(0, ty), W, th, 12 * u, Math.max(0, ty), W, th); } catch { }
    c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .12; c.fillStyle = '#4af'; c.fillRect(0, 0, W, H); c.restore();
    if (Math.floor(lt * 2) % 2 === 0) { c.beginPath(); c.arc(60 * u, 70 * u, 15 * u, 0, 7); c.fillStyle = '#ff2d2d'; c.fill(); } txt(c, P, 'REC', 100 * u, 70 * u, 38 * u, { w: 900, col: '#fff', al: 'left', f: 'Cairo', lines: 1 }); txt(c, P, 'PLAY ▶', W - 60 * u, 70 * u, 34 * u, { w: 800, col: '#fff', al: 'right', f: 'Cairo', lines: 1 });
    txt(c, P, '٠٠:' + arN(String(Math.floor((seg.s + lt) / 60) % 60).padStart(2, '0')) + ':' + arN(String(Math.floor(seg.s + lt) % 60).padStart(2, '0')), 60 * u, H - 70 * u, 36 * u, { w: 800, col: '#fff', al: 'left', f: 'Cairo', lines: 1 });
    const lab = it.cap || (seg.i === 0 ? T.title : ''); if (lab) txt(c, P, lab, W / 2, H * .83, 62 * u, { w: 900, col: '#fff', stroke: 'rgba(0,0,0,.85)', lines: 2 }); logoAt(c, P);
  },
  duo(c, P, seg, lt, d, its) {
    const { W, H, pal } = P, u = Math.min(W, H) / 1080, a = its[0], b = its[1]; if (!b) { framed(c, P, a, seg.i, lt, d, a.cap || ''); logoAt(c, P); return; }
    drawItem(c, P, a, 0, 0, W, H, lt, d, 'kb', seg.i); const s = (W + H * .45) * e((lt - .3) / .7), k = H * .45;
    c.save(); c.beginPath(); c.moveTo(W, 0); c.lineTo(W - s, 0); c.lineTo(W - s + k, H); c.lineTo(W, H); c.closePath(); c.clip(); drawItem(c, P, b, 0, 0, W, H, lt, d, 'kb', seg.i + 1); c.restore();
    if (s > 0 && s < W + k) { c.beginPath(); c.moveTo(W - s, 0); c.lineTo(W - s + k, H); c.strokeStyle = pal.ac; c.lineWidth = 10 * u; c.stroke(); }
    sheetGrad(c, P, .72, .6); if (a.cap) txt(c, P, a.cap, W * .76, H * .9, 46 * u, { w: 900, col: '#fff', max: W * .42, lines: 2, sh: true }); if (b.cap) { c.save(); c.globalAlpha = e((lt - .9) / .3); txt(c, P, b.cap, W * .24, H * .9, 46 * u, { w: 900, col: pal.ac2, max: W * .42, lines: 2, sh: true }); c.restore(); } logoAt(c, P);
  },
  tri(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, n = its.length, gap = 10 * u, sw = (W - gap * (n - 1)) / n; bgFill(c, P, its[0], false);
    its.forEach((x, k) => { const p = eo((lt - k * .15) / .6), X = W - (k + 1) * sw - k * gap; c.save(); c.beginPath(); c.rect(X, 0, sw, H); c.clip(); c.translate(0, (k % 2 ? 1 : -1) * (1 - p) * H); drawCover(c, P, x, X, 0, sw, H, lt, d, 'kb', k + seg.i * 3); sheetGrad(c, P, .78, .65); if (x.cap) txt(c, P, x.cap, X + sw / 2, H * .91, 40 * u, { w: 800, col: '#fff', max: sw * .88, lines: 2, sh: true }); c.restore(); });
    c.fillStyle = pal.ac; for (let k = 1; k < n; k++) c.fillRect(W - k * sw - (k - .5) * gap - 2 * u, 0, 4 * u, H); if (T.title) pill(c, P, T.title, W / 2, H * .07, 40 * u, 'rgba(0,0,0,.55)', '#fff', 900); logoAt(c, P);
  },
  sheet(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0], idx = seg.i, n = seg.n; drawItem(c, P, it, 0, 0, W, H * .78, lt, d, P.st.motion, idx);
    const ph = H * .36, p = eo((lt - .15) / .5), y0 = H - ph * p, panel = pal.light ? '#FFFFFF' : shade(pal.bg, 10), ink = pal.light ? '#161616' : '#fff';
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 40 * u; rr(c, 0, y0, W, ph + 80 * u, 52 * u); c.fillStyle = panel; c.fill(); c.restore(); c.fillStyle = 'rgba(128,128,128,.4)'; rr(c, W / 2 - 50 * u, y0 + 18 * u, 100 * u, 8 * u, 4 * u); c.fill();
    txt(c, P, it.cap || (idx === 0 ? T.title : T.shop) || '', W - 56 * u, y0 + 90 * u, 54 * u, { w: 900, col: ink, al: 'right', max: W * .84, lines: 1 }); txt(c, P, '★★★★★  ' + arN('٤٫٩'), W - 56 * u, y0 + 150 * u, 30 * u, { w: 700, col: '#F5B301', al: 'right', lines: 1 });
    if (T.price) { if (T.old) { txt(c, P, priceTxt(T.old), W - 56 * u, y0 + 222 * u, 36 * u, { w: 700, col: 'rgba(128,128,128,.9)', al: 'right', lines: 1 }); c.fillStyle = 'rgba(128,128,128,.9)'; c.fillRect(W - 56 * u - 110 * u, y0 + 222 * u, 110 * u, 3 * u); } txt(c, P, priceTxt(T.price) + ' جنيه', W - 56 * u, y0 + (T.old ? 296 : 250) * u, 84 * u, { w: 900, col: pal.ac, al: 'right', max: W * .6, lines: 1 }); }
    else if (T.sub) txt(c, P, T.sub, W - 56 * u, y0 + 240 * u, 40 * u, { w: 600, col: ink, al: 'right', max: W * .8, lines: 2 });
    const bp = 1 + .04 * Math.sin(lt * 6); c.save(); c.translate(150 * u, y0 + 270 * u); c.scale(bp, bp); pill(c, P, T.cta || 'اطلب دلوقتي', 0, 0, 38 * u, pal.ac, pal.light ? '#fff' : '#111', 900); c.restore(); if (n > 1) txt(c, P, arN(idx + 1) + '/' + arN(n), 70 * u, H * .06, 30 * u, { w: 800, col: '#fff', sh: true, lines: 1 }); logoAt(c, P);
  },
  duotone(c, P, seg, lt, d, its) {
    const { W, H, pal, T } = P, u = Math.min(W, H) / 1080, it = its[0]; drawItem(c, P, it, 0, 0, W, H, lt, d, P.st.motion, seg.i);
    c.save(); c.globalCompositeOperation = 'color'; c.globalAlpha = .9; c.fillStyle = pal.ac; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'multiply'; const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal.ac2); g.addColorStop(1, pal.bg); c.globalAlpha = .55; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    const ws = words(it.cap || (seg.i === 0 ? T.title : ''), 3); if (ws.length) { const px = Math.min(220 * u, W * .9 / (Math.max(...ws.map(x => x.length)) * .55)); c.save(); c.font = fnt(P, px, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; try { (c as any).direction = 'rtl'; } catch { } c.lineWidth = 5 * u; c.strokeStyle = '#fff'; ws.forEach((w, k) => { const p = eo((lt - k * .15) / .5); c.globalAlpha = p; c.strokeText(w, W / 2, H * .5 + (k - (ws.length - 1) / 2) * px * 1.1 + (1 - p) * 60 * u); }); c.restore(); }
    c.fillStyle = '#fff'; c.fillRect(W * .08, H * .93, W * .84 * cl(lt / d), 6 * u); logoAt(c, P);
  },
};

let GRN2: HTMLCanvasElement | null = null;
/** لمسات سينمائية فوق الفريم: حبوب فيلم، فينييت، تسريب ضوء عند القطع، شرايط سينما. */
function finish(c: C2, P: Proj, t: number) {
  const fx = P.st.fx; if (!fx || !fx.length) return; const { W, H } = P, u = Math.min(W, H) / 1080; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (fx.includes('leak')) {
    let a = .1 + .05 * Math.sin(t * .8), gx = W * (.5 + .5 * Math.sin(t * .5));
    for (const s of P.segs) if (s.s > .1 && t >= s.s && t - s.s < .6) { const q = (t - s.s) / .6; a = Math.max(a, Math.sin(q * Math.PI) * .75); gx = W * (1.15 - q * 1.3); }
    c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(gx, H * .3, 10, gx, H * .3, W * .9); g.addColorStop(0, `rgba(255,190,110,${a})`); g.addColorStop(.5, `rgba(255,100,60,${a * .45})`); g.addColorStop(1, 'rgba(255,80,40,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  }
  if (fx.includes('vig')) { const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .58); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  if (fx.includes('grain')) {
    if (!GRN2) { GRN2 = document.createElement('canvas'); GRN2.width = GRN2.height = 180; const g = GRN2.getContext('2d')!, im = g.createImageData(180, 180); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }
    const pt = c.createPattern(GRN2, 'repeat'); if (pt) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = .1; c.translate(Math.floor(Math.random() * 180), Math.floor(Math.random() * 180)); c.fillStyle = pt; c.fillRect(-180, -180, W + 360, H + 360); c.restore(); }
  }
  if (fx.includes('bars')) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; const bh = Math.max(0, (H - W / 2.35) / 2); if (portrait(P)) { const h2 = H * .09; c.fillStyle = '#000'; c.fillRect(0, 0, W, h2); c.fillRect(0, H - h2, W, h2); } else { c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh); } void u; }
  c.restore();
}

/** مقدمات ونهايات حديثة. */
function introModern(c: C2, P: Proj, lt: number, d: number): boolean {
  const { W, H, pal, st, T, items } = P, u = Math.min(W, H) / 1080, it = items[0], out = cl((d - lt) / .3);
  if (st.intro === 'words') {
    if (it) drawItem(c, P, it, 0, 0, W, H, lt, d, 'kbOut', 0); darken(c, P, .58); const ws = words(T.title || T.shop || 'ميكانيزم', 5), px = Math.min(170 * u, W * .86 / (Math.max(...ws.map(x => x.length)) * .55));
    c.save(); c.globalAlpha = out; ws.forEach((w, k) => { const p = back((lt - k * .17) / .32); if (p <= 0) return; c.save(); c.translate(W / 2, H * .44 + (k - (ws.length - 1) / 2) * px * 1.2); c.scale(p, p); txt(c, P, w, 0, 0, px, { w: 900, col: k % 2 ? '#fff' : pal.ac, stroke: 'rgba(0,0,0,.5)', sh: true, lines: 1, max: W * .95 }); c.restore(); });
    const y = H * .44 + (ws.length / 2) * px * 1.2 + 30 * u; c.fillStyle = pal.ac; c.fillRect(W / 2 - 200 * u * e(lt / .8), y, 400 * u * e(lt / .8), 8 * u); if (T.sub) { c.globalAlpha = e((lt - .7) / .4) * out; txt(c, P, T.sub, W / 2, y + 80 * u, 46 * u, { w: 700, col: pal.ac2, sh: true, lines: 2 }); } c.restore(); logoAt(c, P); return true;
  }
  if (st.intro === 'curtain') {
    if (it) drawItem(c, P, it, 0, 0, W, H, lt, d, 'kbOut', 0); else { c.fillStyle = pal.bg; c.fillRect(0, 0, W, H); } const o = e((lt - .5) / .9); c.save(); c.globalAlpha = e((lt - .9) / .5) * out; darken(c, P, .3); txt(c, P, T.title || T.shop, W / 2, H * .5, 92 * u, { w: 900, col: '#fff', sh: true, lines: 3 }); if (T.sub) txt(c, P, T.sub, W / 2, H * .5 + 150 * u, 44 * u, { w: 700, col: pal.ac2, sh: true, lines: 2 }); c.restore();
    c.fillStyle = pal.bg; c.fillRect(0, 0, W / 2 * (1 - o), H); c.fillRect(W - W / 2 * (1 - o), 0, W / 2 * (1 - o), H); if (o < 1) { c.fillStyle = pal.ac; c.fillRect(W / 2 * (1 - o) - 4 * u, 0, 8 * u, H); c.fillRect(W - W / 2 * (1 - o) - 4 * u, 0, 8 * u, H); c.save(); c.globalAlpha = 1 - o; if (P.logo) { const R = 150 * u; c.drawImage(P.logo, W / 2 - R, H * .5 - R, 2 * R, 2 * R); } c.restore(); } logoAt(c, P); return true;
  }
  return false;
}
function outroModern(c: C2, P: Proj, lt: number, d: number): boolean {
  const { W, H, pal, T, items } = P, u = Math.min(W, H) / 1080, p = eo(lt / .6); void d; if (P.st.outro !== 'cta') return false;
  bgFill(c, P, items[items.length - 1], true); const R = 150 * u * back(lt / .5), ly = H * .24; if (P.logo) { c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40 * u; c.drawImage(P.logo, W / 2 - R, ly - R, 2 * R, 2 * R); c.restore(); }
  c.save(); c.globalAlpha = p; txt(c, P, T.shop || 'ميكانيزم', W / 2, ly + 210 * u, 64 * u, { w: 900, col: pal.fg, lines: 1 }); txt(c, P, T.cta || 'اطلب دلوقتي', W / 2, ly + 330 * u, 84 * u, { w: 900, col: pal.ac, lines: 2 });
  if (T.phone) txt(c, P, arN(T.phone), W / 2, ly + 470 * u, 110 * u, { w: 900, col: pal.ac2 === '#2A2A2A' ? pal.fg : pal.ac2, lines: 1, f: 'Cairo' });
  const pu = 1 + .05 * Math.sin(lt * 6.5); c.translate(W / 2, ly + 640 * u); c.scale(pu, pu); pill(c, P, '📲 كلمنا واتساب', 0, 0, 52 * u, '#25D366', '#fff', 900); c.restore();
  if (T.addr) { c.save(); c.globalAlpha = p; txt(c, P, '📍 ' + T.addr, W / 2, H * .92, 36 * u, { w: 700, col: pal.fg, lines: 2 }); c.restore(); } return true;
}

/* ───── الانتقالات بين شريحتين ───── */
let BA: HTMLCanvasElement | null = null, BB: HTMLCanvasElement | null = null, PXB: HTMLCanvasElement | null = null;
const buf = (b: HTMLCanvasElement | null, W: number, H: number) => { if (!b) b = document.createElement('canvas'); if (b.width !== W || b.height !== H) { b.width = W; b.height = H; } return b; };
function trans(c: C2, P: Proj, A: HTMLCanvasElement, B: HTMLCanvasElement, p: number, k: string) {
  const { W, H, pal } = P, u = Math.min(W, H) / 1080, q = e(p);
  const both = (fa: () => void, fb: () => void) => { c.save(); fa(); c.restore(); c.save(); fb(); c.restore(); };
  switch (k) {
    case 'push': both(() => c.drawImage(A, q * W, 0), () => c.drawImage(B, -(1 - q) * W, 0)); break;
    case 'up': both(() => { const s = 1 - .08 * q; c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.drawImage(A, 0, 0); c.fillStyle = 'rgba(0,0,0,' + .4 * q + ')'; c.fillRect(0, 0, W, H); }, () => { c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 50 * u; c.drawImage(B, 0, (1 - eo(p)) * H); }); break;
    case 'zoom': both(() => { const s = 1 + .5 * q; c.globalAlpha = 1 - q; c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.drawImage(A, 0, 0); }, () => { const s = .8 + .2 * eo(p); c.globalAlpha = q; c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.drawImage(B, 0, 0); }); break;
    case 'wipe': { c.drawImage(A, 0, 0); const x = W * (1 - q); c.save(); c.beginPath(); c.rect(x, 0, W - x, H); c.clip(); c.drawImage(B, 0, 0); c.restore(); if (p > 0 && p < 1) { c.fillStyle = pal.ac; c.fillRect(x - 5 * u, 0, 10 * u, H); } break; }
    case 'diag': { c.drawImage(A, 0, 0); const s = (W + H) * q; c.save(); c.beginPath(); c.moveTo(W, 0); c.lineTo(W - s, 0); c.lineTo(W - s + H, H); c.lineTo(W, H); c.lineTo(W, 0); c.closePath(); c.clip(); c.drawImage(B, 0, 0); c.restore(); break; }
    case 'circle': { c.drawImage(A, 0, 0); c.save(); c.beginPath(); c.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * q, 0, 7); c.clip(); c.drawImage(B, 0, 0); c.restore(); break; }
    case 'blinds': { c.drawImage(A, 0, 0); const n = 9, sh = H / n; c.save(); c.beginPath(); for (let i = 0; i < n; i++) { const qq = e(p * 1.6 - i / n * .6); c.rect(0, i * sh, W, sh * qq); } c.clip(); c.drawImage(B, 0, 0); c.restore(); break; }
    case 'flash': { c.drawImage(p < .5 ? A : B, 0, 0); c.fillStyle = 'rgba(255,255,255,' + (1 - Math.abs(p - .5) * 2) + ')'; c.fillRect(0, 0, W, H); break; }
    case 'cube': { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); const wa = W * (1 - q), wb = W * q;
      c.save(); c.drawImage(A, W - wa, 0, wa, H); c.fillStyle = 'rgba(0,0,0,' + .55 * q + ')'; c.fillRect(W - wa, 0, wa, H); c.restore(); c.save(); c.drawImage(B, 0, 0, wb, H); c.fillStyle = 'rgba(0,0,0,' + .55 * (1 - q) + ')'; c.fillRect(0, 0, wb, H); c.restore(); break; }
    case 'glitch': { c.drawImage(p < .5 ? A : B, 0, 0); const n = 10; for (let i = 0; i < n; i++) { const y = hash(i + Math.floor(p * 12)) * H, h = (8 + hash(i * 7) * 50) * u, dx = (hash(i * 3 + Math.floor(p * 20)) - .5) * 80 * u; c.drawImage(p < .5 ? B : A, 0, y, W, h, dx, y, W, h); }
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .25 * (1 - Math.abs(p - .5) * 2); c.fillStyle = '#ff0040'; c.fillRect(0, 0, W, H); c.restore(); break; }
    case 'doors': { c.drawImage(B, 0, 0); const o = q * W / 2; c.save(); c.beginPath(); c.rect(0, 0, W / 2 - o, H); c.clip(); c.drawImage(A, -o, 0); c.restore(); c.save(); c.beginPath(); c.rect(W / 2 + o, 0, W / 2, H); c.clip(); c.drawImage(A, o, 0); c.restore(); if (p > 0 && p < 1) { c.fillStyle = pal.ac; c.fillRect(W / 2 - o - 3 * u, 0, 6 * u, H); c.fillRect(W / 2 + o - 3 * u, 0, 6 * u, H); } break; }
    case 'whip': { const off = q * W; c.save(); c.globalAlpha = 1; c.drawImage(A, off, 0); c.drawImage(B, off - W, 0); c.globalAlpha = .25 * Math.sin(p * Math.PI); c.drawImage(A, off + 60 * u, 0); c.drawImage(B, off - W - 60 * u, 0); c.restore(); break; }
    case 'cut': c.drawImage(p < .5 ? A : B, 0, 0); break;
    case 'slice': { const n = 7, sw = W / n; for (let i = 0; i < n; i++) { const qq = e(p * 1.5 - (i / n) * .5), sg = i % 2 ? 1 : -1; c.save(); c.beginPath(); c.rect(i * sw, 0, sw + 1, H); c.clip(); c.drawImage(A, 0, -qq * H * sg); c.drawImage(B, 0, (1 - qq) * H * sg); c.restore(); } break; }
    case 'spin': both(() => { c.globalAlpha = 1 - q; c.translate(W / 2, H / 2); c.rotate(q * .5); c.scale(1 + q * .6, 1 + q * .6); c.translate(-W / 2, -H / 2); c.drawImage(A, 0, 0); }, () => { c.globalAlpha = q; c.translate(W / 2, H / 2); c.rotate(-(1 - q) * .5); c.scale(1.5 - .5 * q, 1.5 - .5 * q); c.translate(-W / 2, -H / 2); c.drawImage(B, 0, 0); }); break;
    case 'pixel': { const kk = 1 - Math.abs(2 * p - 1), s = Math.max(1, Math.round(1 + kk * kk * 70 * u)), src = p < .5 ? A : B; PXB = buf(PXB, Math.ceil(W / s), Math.ceil(H / s)); const x = PXB.getContext('2d')!; x.imageSmoothingEnabled = true; x.drawImage(src, 0, 0, PXB.width, PXB.height); c.save(); c.imageSmoothingEnabled = false; c.drawImage(PXB, 0, 0, PXB.width, PXB.height, 0, 0, PXB.width * s, PXB.height * s); c.restore(); break; }
    case 'leak': { c.drawImage(A, 0, 0); c.globalAlpha = q; c.drawImage(B, 0, 0); c.globalAlpha = 1; const a = Math.sin(p * Math.PI); c.save(); c.globalCompositeOperation = 'screen'; const gx = W * (1.2 - p * 1.5), g = c.createRadialGradient(gx, H * .35, 10, gx, H * .35, W * .95); g.addColorStop(0, 'rgba(255,190,110,' + a * .9 + ')'); g.addColorStop(.5, 'rgba(255,100,60,' + a * .4 + ')'); g.addColorStop(1, 'rgba(255,80,40,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); break; }
    case 'swipe': { c.save(); c.translate(-q * W * .3, 0); c.drawImage(A, 0, 0); c.restore(); c.fillStyle = 'rgba(0,0,0,' + .5 * q + ')'; c.fillRect(0, 0, W, H); c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 60 * u; c.drawImage(B, (1 - eo(p)) * W, 0); c.restore(); break; }
    case 'rgb': { const src = p < .5 ? A : B, a = Math.sin(p * Math.PI), o = a * 46 * u; c.drawImage(src, 0, 0); c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .45 * a; c.drawImage(src, o, 0); c.drawImage(src, -o, 0); c.fillStyle = 'rgba(0,229,255,' + .2 * a + ')'; c.fillRect(0, 0, o * 2, H); c.fillStyle = 'rgba(255,0,110,' + .2 * a + ')'; c.fillRect(W - o * 2, 0, o * 2, H); c.restore(); break; }
    case 'shutter': { const s = Math.abs(2 * p - 1), h = H / 2 * (1 - s); c.drawImage(p < .5 ? A : B, 0, 0); c.fillStyle = pal.bg; c.fillRect(0, 0, W, h); c.fillRect(0, H - h, W, h); if (h > 2) { c.fillStyle = pal.ac; c.fillRect(0, h - 3 * u, W, 6 * u); c.fillRect(0, H - h - 3 * u, W, 6 * u); } break; }
    default: c.drawImage(A, 0, 0); c.globalAlpha = q; c.drawImage(B, 0, 0); c.globalAlpha = 1;
  }
}

function segDraw(c: C2, P: Proj, s: Seg, t: number) {
  const lt = Math.max(0, t - s.s), d = s.e - s.s;
  c.save(); if (s.k === 'intro') intro(c, P, lt, d); else if (s.k === 'outro') outro(c, P, lt, d); else slide(c, P, s, lt, d); c.restore();
}
/** فريم واحد عند وقت t. */
export function frame(c: C2, P: Proj, t: number) {
  const { W, H } = P; LIVE.clear();
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = P.pal.bg; c.fillRect(0, 0, W, H);
  t = Math.max(0, Math.min(t, P.dur - 1e-3)); const act = P.segs.filter(s => t >= s.s && t < s.e);
  if (act.length >= 2) {
    const a = act[0], b = act[act.length - 1], p = (t - b.s) / Math.max(.01, a.e - b.s), tr = P.st.trans, k = b.k === 'outro' ? 'fade' : tr[(b.i + (b.k === 'slide' ? 0 : 1)) % tr.length];
    BA = buf(BA, W, H); BB = buf(BB, W, H); const xa = BA.getContext('2d')!, xb = BB.getContext('2d')!;
    [xa, xb].forEach(x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.fillStyle = P.pal.bg; x.fillRect(0, 0, W, H); });
    segDraw(xa, P, a, t); segDraw(xb, P, b, t); trans(c, P, BA, BB, p, k);
  } else if (act.length) segDraw(c, P, act[0], t);
  finish(c, P, t);
  P.items.forEach(it => { if (it.vel && !LIVE.has(it.vel) && !it.vel.paused) it.vel.pause(); });
}
export function stopVideos(P: Proj) { P.items.forEach(it => { try { it.vel && it.vel.pause(); } catch { } }); }

/* ───── البوسترات (صورة واحدة) ───── */
export function posterCount(P: Proj) { return P.st.poster === 'price' ? Math.max(1, P.items.length) : 1; }
export function poster(c: C2, P: Proj, which = 0) {
  const { W, H, pal, st, T, items } = P, u = Math.min(W, H) / 1080, m = 44 * u; c.setTransform(1, 0, 0, 1, 0, 0); bgFill(c, P, items[0], st.poster !== 'catalog');
  const head = (y: number) => { if (T.title) txt(c, P, T.title, W / 2, y, 70 * u, { w: 900, col: pal.fg, lines: 2, max: W - 2 * 175 * u }); if (T.sub) txt(c, P, T.sub, W / 2, y + 86 * u, 38 * u, { w: 700, col: pal.ac }); };
  const foot = () => { const y = H - 70 * u; c.fillStyle = pal.ac; c.fillRect(W * .3, y - 54 * u, W * .4, 5 * u); txt(c, P, [T.shop, T.phone && '📞 ' + arN(T.phone)].filter(Boolean).join('  •  '), W / 2, y, 40 * u, { w: 800, col: pal.fg, lines: 1 }); };
  const top = T.title ? (T.sub ? 230 : 170) * u : 150 * u, bot = 150 * u, x0 = m, y0 = top, w0 = W - 2 * m, h0 = H - top - bot, g = 14 * u;
  const tile = (it: Item, x: number, y: number, w: number, h: number, r = 18 * u) => { c.save(); rr(c, x, y, w, h, r); c.clip(); drawItem(c, P, it, x, y, w, h, 0, 1, 'static', 0); c.restore(); };
  if (st.poster === 'collage') {
    const N = items.length, ar = items.map(i => Math.max(.4, Math.min(2.5, i.w / i.h))); let best: number[][] = [], bh = 0, bd = 1e9;
    for (let r = 1; r <= Math.min(N, 8); r++) { const tot = ar.reduce((a, b) => a + b, 0), per = tot / r, rows: number[][] = [[]]; let acc = 0; ar.forEach((a, i) => { if (acc >= per * rows.length - a / 2 && rows.length < r) rows.push([]); rows[rows.length - 1].push(i); acc += a; });
      const hh = rows.reduce((s, row) => s + (w0 - (row.length - 1) * g) / row.reduce((q, i) => q + ar[i], 0), 0) + (rows.length - 1) * g; const dd = Math.abs(hh - h0) + (hh > h0 ? (hh - h0) * .5 : 0); if (dd < bd) { bd = dd; best = rows; bh = hh; } }
    const k = Math.min(1, h0 / bh); let y = y0 + (h0 - bh * k) / 2;
    best.forEach(row => { const sa = row.reduce((q, i) => q + ar[i], 0), rh = (w0 - (row.length - 1) * g) / sa * k, rw = sa * rh + (row.length - 1) * g; let x = x0 + (w0 + rw) / 2; row.forEach(i => { const w = ar[i] * rh; x -= w; tile(items[i], x, y, w, rh); x -= g; }); y += rh + g; });
    head(top * .45); foot();
  } else if (st.poster === 'ba') {
    const a = items[0], b = items[1] || items[0], Pt = !landscape(P), w = Pt ? w0 : (w0 - g) / 2, h = Pt ? (h0 - g) / 2 : h0;
    tile(a, Pt ? x0 : x0 + w + g, y0, w, h); tile(b, x0, Pt ? y0 + h + g : y0, w, h);
    pill(c, P, 'قبل', Pt ? x0 + w - 110 * u : x0 + w + g + w - 110 * u, y0 + 60 * u, 40 * u, 'rgba(0,0,0,.7)', '#fff', 900); pill(c, P, 'بعد ✨', Pt ? x0 + w - 120 * u : x0 + w - 120 * u, (Pt ? y0 + h + g : y0) + 60 * u, 40 * u, pal.ac, '#111', 900);
    head(top * .45); foot();
  } else if (st.poster === 'journey' || st.poster === 'catalog') {
    const N = Math.min(items.length, 16), cols = N <= 1 ? 1 : N <= 4 ? 2 : N <= 9 ? 3 : 4, rows = Math.ceil(N / cols), capH = st.poster === 'catalog' ? 64 * u : 56 * u;
    const cw = (w0 - (cols - 1) * g) / cols, ch = (h0 - (rows - 1) * g) / rows - capH;
    for (let i = 0; i < N; i++) { const col = i % cols, row = Math.floor(i / cols), x = x0 + w0 - (col + 1) * cw - col * g, y = y0 + row * (ch + capH + g), it = items[i]; tile(it, x, y, cw, ch);
      const lab = st.poster === 'journey' ? (T.stages[i] || it.cap || 'المرحلة ' + arN(i + 1)) : (it.cap || ''); if (lab) txt(c, P, lab, x + cw / 2, y + ch + capH / 2, Math.min(36 * u, cw / 9), { w: 800, col: pal.fg, max: cw, lines: 1 });
      if (st.poster === 'journey') { c.beginPath(); c.arc(x + cw - 40 * u, y + 40 * u, 30 * u, 0, 7); c.fillStyle = pal.ac; c.fill(); txt(c, P, arN(i + 1), x + cw - 40 * u, y + 43 * u, 34 * u, { w: 900, col: '#111' }); } }
    head(top * .45); foot();
  } else { // price
    const it = items[which] || items[0]; drawItem(c, P, it, 0, 0, W, H, 0, 1, 'static', 0); const g2 = c.createLinearGradient(0, H * .55, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.82)'); c.fillStyle = g2; c.fillRect(0, H * .55, W, H * .45);
    txt(c, P, it.cap || T.title, W / 2, H * .76, 76 * u, { w: 900, col: '#fff', sh: true, lines: 2 }); priceBadge(c, P, W * .76, H * .2, 160 * u, 1, 0);
    pill(c, P, (T.cta || 'اطلب دلوقتي') + (T.phone ? ' 📞 ' + arN(T.phone) : ''), W / 2, H * .9, 42 * u, pal.ac, '#111', 900);
  }
  if (P.logoOn && P.logo) { const s = 130 * u; c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 14 * u; c.drawImage(P.logo, st.poster === 'price' ? 30 * u : W - s - 24 * u, st.poster === 'price' ? 30 * u : 20 * u, s, s); c.restore(); }
}
