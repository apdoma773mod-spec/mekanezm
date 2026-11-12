// A front view of one unit from the takeoff, with the hardware where it goes and the sizes the craftsman
// needs for drilling and cutting (hinge positions, sliding leaf width, slide length). Plain SVG text.
import { hingesFor } from './custom-draw';
import { RULES, doorHeight, hasBase, hasLegs, slideLen, slidingLeafW, type TUnit } from './takeoff';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const F = 'font-family="Cairo,Segoe UI,Tahoma,Arial,sans-serif"';
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Distance of each hinge from the top of the leaf (cm): 10 cm from both ends, the rest spread evenly. */
export function hingePositions(h: number, n = hingesFor(h)): number[] {
  const edge = Math.min(10, h / 4);
  return Array.from({ length: n }, (_, i) => r1(edge + ((h - 2 * edge) * i) / Math.max(1, n - 1)));
}

/** Names of the shop products chosen for this unit's hardware, by line key (shown in the legend). */
export type Picked = Record<string, string>;

export function drawUnit(u: TUnit, kind: string, picked: Picked = {}): { svg: string; notes: string[] } {
  const W = u.w || 60, H = u.h || (RULES.doorH[u.type] ?? 70) + 10;
  const VW = 420, VH = 330, padL = 46, padR = 16, padT = 34, padB = 52;
  const k = Math.min((VW - padL - padR) / W, (VH - padT - padB) / H);
  const w = W * k, h = H * k, x0 = padL + (VW - padL - padR - w) / 2, y0 = padT + (VH - padT - padB - h) / 2;
  const baseH = hasBase(u, kind) || hasLegs(u, kind) ? Math.min(10, H * 0.12) * k : 0;
  const bodyH = h - baseH;
  const wood = '#e9d3ac', edge = '#6b4a1f', gold = '#a8741a', steel = '#3a6f93';
  let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${bodyH}" fill="${wood}" stroke="${edge}" stroke-width="2"/>`;
  if (baseH) {
    s += hasLegs(u, kind)
      ? [0, 1, 2, 3].slice(0, Math.min(4, RULES.legs(W) / 2)).map((i, _, a) => `<rect x="${x0 + 8 + ((w - 22) * i) / Math.max(1, a.length - 1)}" y="${y0 + bodyH}" width="6" height="${baseH}" fill="#444"/>`).join('')
      : `<rect x="${x0 + 3}" y="${y0 + bodyH}" width="${w - 6}" height="${baseH}" fill="#c9a77a" stroke="${edge}" stroke-width="1.2"/>` +
        [x0 + 3, x0 + w - 11].map(x => `<path d="M${x} ${y0 + bodyH + baseH}v-7h8" fill="none" stroke="${steel}" stroke-width="2.4"/>`).join('');
  }

  const hinged = u.doors.filter(d => d.kind === 'hinged' || d.kind === 'folding');
  const sliding = u.doors.find(d => d.kind === 'sliding');
  const flaps = u.doors.filter(d => d.kind === 'lift_up' || d.kind === 'flap_down');
  const drawers = u.drawers.reduce((n, d) => n + (d.inner ? 0 : d.count), 0);
  const notes: string[] = [];

  // Drawers take the bottom of the front (about 18 cm each, never more than 60% unless there are no doors).
  const hasDoors = hinged.length + flaps.length > 0 || !!sliding;
  const drH = drawers ? (hasDoors ? Math.min(bodyH * 0.6, drawers * 18 * k) : bodyH) : 0;
  const doorY = y0, doorH = bodyH - drH;
  if (drawers) {
    const each = drH / drawers, sl = slideLen(u);
    for (let i = 0; i < drawers; i++) {
      const y = y0 + bodyH - drH + i * each;
      s += `<rect x="${x0 + 3}" y="${y + 2}" width="${w - 6}" height="${each - 4}" rx="2" fill="#f3e3c3" stroke="${edge}" stroke-width="1.3"/><line x1="${x0 + w / 2 - 14}" y1="${y + each / 2}" x2="${x0 + w / 2 + 14}" y2="${y + each / 2}" stroke="${edge}" stroke-width="3" stroke-linecap="round"/>`;
    }
    notes.push(`${drawers} درج — مجر ${sl.len} سم${sl.guessed ? ' (العمق مش مكتوب)' : ''}${picked['slide-' + sl.len] ? `: ${picked['slide-' + sl.len]}` : ''}`);
  }

  // Shelves and rails show through as dashed lines.
  const shelves = u.shelvesAdj + u.shelvesFixed;
  for (let i = 1; i <= Math.min(shelves, 10); i++) {
    const y = doorY + (doorH * i) / (Math.min(shelves, 10) + 1);
    s += `<line x1="${x0 + 4}" y1="${y}" x2="${x0 + w - 4}" y2="${y}" stroke="${edge}" stroke-width="1" stroke-dasharray="5 4" opacity=".55"/>`;
  }
  if (u.rails.length) s += `<line x1="${x0 + 8}" y1="${doorY + Math.min(22, doorH * 0.15)}" x2="${x0 + w - 8}" y2="${doorY + Math.min(22, doorH * 0.15)}" stroke="${steel}" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>`;

  if (sliding && doorH > 8) {
    const n = sliding.count, leaf = slidingLeafW(W, n), lw = leaf * k;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i * (w - lw)) / Math.max(1, n - 1);
      s += `<rect x="${x}" y="${doorY + 4 + (i % 2) * 3}" width="${lw}" height="${doorH - 8 - (i % 2) * 3}" fill="${i % 2 ? '#dcc195' : '#f1dfbd'}" stroke="${edge}" stroke-width="1.4" opacity=".93"/>`;
    }
    s += `<rect x="${x0}" y="${doorY}" width="${w}" height="4" fill="${steel}"/><rect x="${x0}" y="${doorY + doorH - 4}" width="${w}" height="4" fill="${steel}"/>`;
    s += `<text x="${x0 + lw / 2}" y="${doorY + doorH / 2}" text-anchor="middle" font-size="12" font-weight="800" fill="#12202b" ${F}>${leaf} سم</text><path d="M${x0 + lw / 2 - 16} ${doorY + doorH / 2 + 12}h32m-6 -4l6 4l-6 4" fill="none" stroke="${gold}" stroke-width="1.6"/>`;
    notes.push(`جرار ${n} ضلفة — عرض الضلفة ≈ ${leaf} سم (ركوب ${RULES.slideOverlap} سم) — سكة ${W} سم${picked['sliding-' + n] ? `: ${picked['sliding-' + n]}` : ''}`);
  } else if (hinged.length && doorH > 8) {
    const n = Math.min(8, hinged.reduce((a, d) => a + d.count, 0)), lw = w / n;
    const dh = doorHeight(u, hinged[0]), per = hingesFor(dh.h), pos = hingePositions(dh.h, per);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * lw, left = n === 1 ? true : i % 2 === 0;
      s += `<rect x="${x + 2}" y="${doorY + 2}" width="${lw - 4}" height="${doorH - 4}" fill="#f1dfbd" stroke="${edge}" stroke-width="1.4"/>`;
      for (const p of pos) s += `<circle cx="${left ? x + 8 : x + lw - 8}" cy="${doorY + 2 + ((doorH - 4) * p) / dh.h}" r="3.6" fill="${steel}" stroke="#fff" stroke-width="1"/>`;
      s += `<circle cx="${left ? x + lw - 9 : x + 9}" cy="${doorY + doorH / 2}" r="2.4" fill="${edge}"/>`;
    }
    // hinge distances along the first leaf
    const tx = x0 - 6;
    for (const p of pos) s += `<text x="${tx}" y="${doorY + 2 + ((doorH - 4) * p) / dh.h + 4}" text-anchor="end" font-size="10.5" font-weight="700" fill="${steel}" ${F}>${p}</text>`;
    notes.push(`${per} مفصلات للضلفة — مراكزها من فوق: ${pos.join(' / ')} سم (طول الضلفة ${dh.h} سم${dh.guessed ? ' تقديري' : ''})${picked.hinge ? ` — ${picked.hinge}` : ''}`);
    notes.push('حفر الطاسة Ø35 مم، مركزها 21–23 مم من حرف الضلفة حسب المفصلة.');
  } else if (flaps.length && doorH > 8) {
    const n = Math.min(4, flaps.reduce((a, d) => a + d.count, 0)), fh = doorH / n;
    for (let i = 0; i < n; i++) s += `<rect x="${x0 + 2}" y="${doorY + i * fh + 2}" width="${w - 4}" height="${fh - 4}" fill="#f1dfbd" stroke="${edge}" stroke-width="1.4"/><path d="M${x0 + w / 2} ${doorY + i * fh + fh - 8}v-${Math.min(18, fh - 14)}m-5 6l5 -6l5 6" fill="none" stroke="${gold}" stroke-width="1.8"/>`;
    notes.push(`${n} ضلفة قلاب — الدراع حسب وزن ومقاس الضلفة (حاسبة الدراعات)`);
  }

  // dimensions
  const dimY = y0 + h + 16;
  s += `<g stroke="${gold}" stroke-width="1.3" fill="${gold}"><line x1="${x0}" y1="${dimY}" x2="${x0 + w}" y2="${dimY}"/><path d="M${x0} ${dimY}l7 -3.5v7zM${x0 + w} ${dimY}l-7 -3.5v7z"/></g><text x="${x0 + w / 2}" y="${dimY + 15}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#12202b" ${F}>${u.w ? `العرض ${u.w} سم` : 'العرض مش مكتوب'}</text>`;
  const dx = x0 + w + 9;
  s += `<g stroke="${gold}" stroke-width="1.3" fill="${gold}"><line x1="${dx}" y1="${y0}" x2="${dx}" y2="${y0 + h}"/><path d="M${dx} ${y0}l-3.5 7h7zM${dx} ${y0 + h}l-3.5 -7h7z"/></g><text x="${dx + 4}" y="${y0 + h / 2}" font-size="12" font-weight="800" fill="#12202b" ${F} transform="rotate(90 ${dx + 4} ${y0 + h / 2})" text-anchor="middle" dy="-3">${u.h ? `${u.h} سم` : ''}</text>`;
  const inner = u.drawers.reduce((n, d) => n + (d.inner ? d.count : 0), 0);
  if (inner) { const sl = slideLen(u); notes.push(`${inner} درج داخلي — مجر ${sl.len} سم${picked['slide-' + sl.len] ? `: ${picked['slide-' + sl.len]}` : ''}`); }
  if (shelves) notes.push(`${shelves} رف${u.shelvesAdj ? ` (${u.shelvesAdj} متحرك على تكايات)` : ''}`);
  if (u.rails.length) notes.push(`${u.rails.length} ماسورة تعليق${u.rails.every(r => r > 0) ? `: ${u.rails.join(' + ')} سم` : ''}`);
  if (hasBase(u, kind)) notes.push(`قاعدة: ${RULES.baseWide} زاوية بلدي 3×3 عريضة في الأركان + ضيقة على العوارض`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" direction="ltr" style="direction:ltr;width:100%;height:auto"><rect width="${VW}" height="${VH}" fill="#fff"/><rect x="1.5" y="1.5" width="${VW - 3}" height="${VH - 3}" rx="10" fill="none" stroke="#d9a73a" stroke-width="1.6"/><text x="${VW / 2}" y="20" text-anchor="middle" font-size="12.5" font-weight="800" fill="${gold}" ${F}>MEKANEZM — ${esc(u.name)}${u.count > 1 ? ` (× ${u.count})` : ''}</text>${s}</svg>`;
  return { svg, notes };
}
