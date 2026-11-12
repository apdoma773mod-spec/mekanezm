'use client';
// «ارفع رسمتك»: upload → the AI reads the units → lib/takeoff.ts counts the hardware → products from the shop.
// The craftsman types nothing; everything he sees can still be corrected with +/− (the list recounts by itself).
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShop } from '@/components/shop-provider';
import { readDrawing } from '@/lib/api';
import type { Item } from '@/lib/schema';
import { productPath } from '@/lib/shop';
import { GROUPS, RULES, candidates, lineText, mainDoorKind, markMismatch, normalize, partitions, switchDoors, takeoff, type Group, type TMark, type TModel, type TUnit } from '@/lib/takeoff';
import { drawUnit } from '@/lib/takeoff-draw';
import { ev } from '@/lib/track';
import { SAMPLE } from './sample';

type Prod = Item & { tags: string[]; top: boolean };
type Saved = { model: TModel; doubt: string[]; warnings: string[]; thumbs: string[]; qty: Record<string, number>; pick: Record<string, string>; sample?: boolean };
const KEY = 'mk-takeoff2';
const ACCEPT = 'image/*,.heic,.heif,.pdf,.xlsx,.xlsm,.xls,.csv,.tsv,.txt,.dxf,.dwg,.skp,.obj,.3ds,.max,.docx,.doc,.kdt,.kit';

const DOOR: Record<string, string> = { hinged: 'ضلف مفصلي', sliding: 'ضلف جرار', lift_up: 'قلاب لفوق', flap_down: 'قلاب لتحت', folding: 'أكورديون' };
const dims = (u: TUnit) => [u.w && `عرض ${u.w}`, u.h && `ارتفاع ${u.h}`, u.d && `عمق ${u.d}`].filter(Boolean).join(' × ');

function Step({ v, on, label }: { v: number; on: (n: number) => void; label: string }) {
  return (
    <span className="kstep tk-step" role="group" aria-label={label}>
      <button type="button" onClick={() => on(v - 1)} aria-label="نقص">−</button>
      <input type="number" inputMode="numeric" value={v} onChange={e => on(Number(e.target.value))} aria-label={label} />
      <button type="button" onClick={() => on(v + 1)} aria-label="زيادة">+</button>
    </span>
  );
}

export function Takeoff({ products, wa }: { products: Prod[]; wa: string }) {
  const { add, open, say } = useShop();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Saved | null>(null);
  const [drag, setDrag] = useState(false);
  const [openUnit, setOpenUnit] = useState('');
  const [openLine, setOpenLine] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // The last result stays while he looks at a product and comes back.
  useEffect(() => { try { const s = sessionStorage.getItem(KEY); if (s) setRes(JSON.parse(s)); } catch { /* */ } }, []);
  useEffect(() => { try { if (res) sessionStorage.setItem(KEY, JSON.stringify({ ...res, thumbs: res.thumbs.slice(0, 4) })); else sessionStorage.removeItem(KEY); } catch { /* storage full or blocked */ } }, [res]);

  // Copied right away: the input's FileList empties when its value is reset, before React runs the update.
  const addFiles = (l: FileList | File[] | null) => { const got = Array.from(l ?? []); if (got.length) { setErr(''); setFiles(f => [...f, ...got].slice(0, 12)); } };

  const run = async () => {
    if (!files.length || busy) return;
    setErr(''); setBusy('بنجهّز الملفات…');
    try {
      const { intake } = await import('@/lib/takeoff-files');
      const inx = await intake(files, setBusy);
      if (!inx.parts.length && inx.text.trim().length < 10) { setErr(inx.warnings[0] || 'مقدرناش نقرا الملف — ارفع صورة أو PDF للرسمة.'); return; }
      setBusy('بنقرا الرسمة ونعدّ القطع… (دقيقة أو اتنين)');
      const r = await readDrawing({ files: inx.parts, text: inx.text, note: note.trim() });
      if (!r.ok) { setErr(r.message); return; }
      const model = normalize(r.model);
      ev('takeoff', 'Lead', { units: model.units.length, kind: model.kind });
      if (!model.units.length) { setErr(model.summary ? `مالقيناش دواليب في الملف: ${model.summary}` : 'مالقيناش دواليب أو وحدات في الملف — ارفع رسمة أوضح.'); return; }
      setRes({ model, doubt: r.doubt, warnings: inx.warnings, thumbs: inx.thumbs, qty: {}, pick: {} });
      setFiles([]);
      setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch { setErr('حصلت مشكلة في قراءة الملف — جرّب تاني أو ارفعه صورة.'); } finally { setBusy(''); }
  };

  const lines = useMemo(() => (res ? takeoff(res.model, res.doubt) : []), [res]);
  const rows = useMemo(() => lines.map(l => {
    const cands = candidates(l, products, p => p.ok);
    const chosen = cands.find(p => p.id === res?.pick[l.k]) ?? cands[0] ?? null;
    return { l, cands, chosen, q: res?.qty[l.k] ?? l.qty };
  }), [lines, products, res]);
  const picked = useMemo(() => Object.fromEntries(rows.filter(r => r.chosen).map(r => [r.l.k, r.chosen!.name])), [rows]);

  if (!res) {
    return (
      <>
        <p className="mut">ارفع رسمة المطبخ أو الدريسنج أو الدولاب بأي شكل — من غير ما تكتب ولا تملا حاجة — واحنا نطلعلك كل الإكسسوار المطلوب بالعدد، وكل رقم معاه سببه.</p>
        <div className={'tk-drop' + (drag ? ' on' : '')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
          <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className="tk-pick" onClick={() => input.current?.click()} disabled={!!busy}>
            <span aria-hidden="true">📎</span><b>{files.length ? 'ضيف ملف كمان' : 'اختار الملف أو صوّر الرسمة'}</b>
            <small>PDF · صورة أو سكرين شوت · Excel · أوتوكاد DXF · سكتش أب · ملف 3D</small>
          </button>
          {files.length > 0 && (
            <ul className="tk-files">{files.map((f, i) => (
              <li key={i}><span>{f.name}</span><small>{f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' ميجا' : Math.max(1, Math.round(f.size / 1024)) + ' ك.ب'}</small>
                <button type="button" onClick={() => setFiles(x => x.filter((_, k) => k !== i))} aria-label={`شيل ${f.name}`} disabled={!!busy}>✕</button></li>
            ))}</ul>
          )}
        </div>
        {files.length > 0 && (
          <>
            <details className="tk-note"><summary>عايز تقول حاجة عن الرسمة؟ (اختياري)</summary>
              <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={600} rows={2} placeholder="مثلاً: الضلف كلها جرار — أو: الرسمة بالمليمتر" /></details>
            <button type="button" className="pri tk-go" onClick={run} disabled={!!busy}>{busy || '🔍 اطلعلي الإكسسوارات'}</button>
          </>
        )}
        {busy && <div className="tk-bar" role="status" aria-live="polite"><i /></div>}
        {err && <div className="tk-err" role="alert"><b>⚠️ {err}</b><a href={wa} target="_blank" rel="noopener">💬 ابعت الرسمة على الواتساب ونحصرها لك</a></div>}
        {!files.length && !busy && (
          <button type="button" className="tk-demo" onClick={() => { setRes({ ...SAMPLE, qty: {}, pick: {}, sample: true }); ev('takeoff_sample', 'ViewContent', {}); }}>👀 شوف مثال للنتيجة الأول</button>
        )}
        <div className="info-cards" style={{ marginTop: 16 }}>
          <div>
            <h2>بيطلعلك إيه؟</h2>
            <ul className="tk-ul">
              <li><b>المفصلات</b> بعددها حسب طول كل ضلفة، وأماكن تركيبها بالسنتي.</li>
              <li><b>مجر الأدراج</b> بالمقاس المناسب لعمق الدولاب.</li>
              <li><b>الجرار</b> لو الدولاب سحّاب، مع عرض كل ضلفة قبل التقطيع.</li>
              <li><b>تكايات الأرفف، زوايا التجميع، التعليقات، الرجول، والمواسير.</b></li>
              <li><b>زوايا تقوية القاعدة</b> البلدي 3×3 العريضة والضيقة.</li>
              <li>ولكل وحدة <b>رسمة</b> عليها الإكسسوار راكب بالمقاسات.</li>
            </ul>
          </div>
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------ result */
  const m = res.model;
  // `settled` = totals the craftsman has just confirmed himself, so their «اتأكد» goes away.
  const upd = (id: string, f: (u: TUnit) => TUnit, settled: string[] = []) => setRes(r => r && { ...r, qty: {}, doubt: r.doubt.filter(k => !settled.includes(k)), model: { ...r.model, units: r.model.units.map(u => (u.id === id ? f(u) : u)) } });
  const clamp = (n: number, max = 60) => Math.max(0, Math.min(max, Math.round(n) || 0));
  const have = rows.filter(r => r.chosen && r.q > 0), miss = rows.filter(r => !r.chosen && r.q > 0);
  const listText = () => `📐 حصر إكسسوارات${m.summary ? ` — ${m.summary}` : ''}\n` + rows.filter(r => r.q > 0).map(r => lineText({ ...r.l, qty: r.q }, r.chosen ? `${r.chosen.name}${r.chosen.code ? ` (كود ${r.chosen.code})` : ''}` : '')).join('\n');
  const addAll = () => {
    have.forEach(r => add(r.chosen!, Math.max(1, Math.ceil(r.q))));
    ev('add_to_cart', 'AddToCart', { takeoff: 1 });
    say(`✔ اتضاف ${have.length} صنف للطلب${miss.length ? ` — و${miss.length} هنسعّرهم لك` : ''}`);
  };
  const ask = () => open({ kind: 'price', lines: have.map(r => ({ item: r.chosen!, q: Math.max(1, Math.ceil(r.q)) })), extra: listText() });
  const groups = (Object.keys(GROUPS) as Group[]).map(g => ({ g, rows: rows.filter(r => r.l.group === g) })).filter(x => x.rows.length);
  const unsure = rows.filter(r => r.l.doubt).length;
  const mism = markMismatch(m);
  // Units whose doors the AI could not tell apart (drawn closed, no arrows, no swing marks): one tap settles it.
  const askKind = m.units.filter(u => mainDoorKind(u) && u.doors.some(d => (d.kind === 'hinged' || d.kind === 'sliding') && d.sure < RULES.doorSure));
  const pages = res.thumbs.map((t, i) => ({ t, i, marks: m.marks.filter(k => k.p === i) })).filter(x => x.t && x.marks.length);
  const MARK: Record<TMark['k'], string> = { drawer: 'درج', door: 'ضلفة مفصلي', sliding: 'ضلفة جرار', flap: 'قلاب' };
  const KindSwitch = ({ u }: { u: TUnit }) => (
    <span className="tk-seg" role="radiogroup" aria-label="نوع الضلف">
      {(['hinged', 'sliding'] as const).map(k => (
        <button type="button" key={k} role="radio" aria-checked={mainDoorKind(u) === k} className={mainDoorKind(u) === k ? 'on' : ''} onClick={() => mainDoorKind(u) !== k && upd(u.id, x => switchDoors(x, k), ['hinged', 'sliding'])}>{k === 'hinged' ? '🚪 مفصلي' : '↔️ جرار'}</button>
      ))}
    </span>
  );

  return (
    <div ref={top} className="tk-res">
      {res.sample && <div className="tk-sample">👀 ده مثال للتوضيح — ارفع رسمتك عشان تطلعلك نتيجتها.</div>}
      <div className="tk-sum">
        {!pages.length && res.thumbs.some(Boolean) && <div className="tk-thumbs">{res.thumbs.filter(Boolean).slice(0, 3).map((t, i) => <img key={i} src={t} alt="" />)}</div>}
        <div>
          <b>{m.summary || 'قرينا الرسمة'}</b>
          <small>{m.units.reduce((n, u) => n + u.count, 0)} وحدة · {rows.length} صنف إكسسوار{unsure ? ` · ${unsure} محتاج تأكيد` : ''}</small>
          {m.quality !== 'clear' && <small className="tk-warn">{m.quality === 'poor' ? '⚠️ الرسمة مش واضحة — راجع الأعداد كويس' : 'الرسمة واضحة جزئيًا — راجع اللي عليه علامة «اتأكد»'}</small>}
        </div>
      </div>
      {res.warnings.map(w => <p key={w} className="tk-warn">⚠️ {w}</p>)}
      {askKind.map(u => (
        <div key={u.id} className="tk-q tk-ask">
          <b>«{u.name}»: الضلف جرار ولا مفصلي؟</b>
          <small>الرسمة مش مبيّنة النوع بوضوح — اختار والحصر يتظبط لوحده.</small>
          <KindSwitch u={u} />
        </div>
      ))}
      {Object.entries(mism).map(([id, x]) => {
        const u = m.units.find(k => k.id === id)!;
        return (
          <div key={id} className="tk-q tk-ask">
            {x.drawers && <><b>«{u.name}»: كام درج؟</b><small>المكتوب {x.drawers[0]} بس علّمنا على {x.drawers[1]} في الرسمة — بص على العلامات واختار.</small>
              <span className="tk-seg">{x.drawers.map(n => <button type="button" key={n} className={n === x.drawers![0] ? 'on' : ''} onClick={() => upd(id, k => ({ ...k, drawers: n ? [{ count: n, inner: k.drawers[0]?.inner ?? false }] : [] }), ['drawers'])}>{n} درج</button>)}</span></>}
            {x.doors && <><b>«{u.name}»: كام ضلفة؟</b><small>المكتوب {x.doors[0]} بس علّمنا على {x.doors[1]} في الرسمة.</small>
              <span className="tk-seg">{x.doors.map(n => <button type="button" key={n} className={n === x.doors![0] ? 'on' : ''} onClick={() => upd(id, k => ({ ...k, doors: k.doors.length ? k.doors.map((d, i) => (i ? d : { ...d, count: Math.max(1, n - k.doors.slice(1).reduce((a, d2) => a + d2.count, 0)) })) : k.doors }), ['hinged', 'sliding', 'flaps'])}>{n} ضلفة</button>)}</span></>}
          </div>
        );
      })}
      {m.questions.length > 0 && <div className="tk-q"><b>محتاجين تأكيدك على:</b><ul>{m.questions.map(q => <li key={q}>{q}</li>)}</ul></div>}
      {pages.length > 0 && (
        <details className="tk-pages" open>
          <summary>📍 اللي علّمنا عليه في رسمتك ({m.marks.length})</summary>
          <p className="tk-leg"><i className="k-drawer" /> درج <i className="k-door" /> مفصلي <i className="k-sliding" /> جرار <i className="k-flap" /> قلاب — لو فيه حاجة مش متعلّمة أو متعلّمة غلط، عدّل العدد في الوحدة تحت.</p>
          {pages.map(pg => (
            <div key={pg.i} className="tk-page">
              <img src={pg.t} alt={`صفحة ${pg.i + 1} من الرسمة`} />
              {pg.marks.map((k, n) => (
                <span key={n} className={'tk-mark k-' + k.k} title={`${MARK[k.k]} — ${m.units[k.u]?.name ?? ''}`}
                  style={{ left: k.box[0] * 100 + '%', top: k.box[1] * 100 + '%', width: (k.box[2] - k.box[0]) * 100 + '%', height: (k.box[3] - k.box[1]) * 100 + '%' }}><b>{pg.marks.filter((z, j) => j <= n && z.k === k.k).length}</b></span>
              ))}
            </div>
          ))}
        </details>
      )}

      <h2 className="sec-h">🧾 الإكسسوارات المطلوبة</h2>
      {groups.map(({ g, rows: R }) => (
        <section key={g} className="tk-grp">
          <h3>{GROUPS[g]}</h3>
          {R.map(({ l, cands, chosen, q }) => (
            <div key={l.k} className={'tk-line' + (chosen ? '' : ' miss') + (q ? '' : ' off')}>
              <div className="tk-lh">
                <span className="kim">{chosen?.img ? <Image src={chosen.img} alt="" fill sizes="56px" style={{ objectFit: 'contain' }} /> : '🧩'}</span>
                <span className="tk-lt">
                  <b>{l.label}{l.doubt && <i className="tk-dbt">اتأكد</i>}</b>
                  {chosen ? <Link href={productPath(chosen.id)}>{chosen.name}{chosen.code && <small> — كود {chosen.code}</small>}</Link> : <small>مش على الموقع لسه — هنوفّره ونسعّره لك</small>}
                </span>
                <span className="tk-lq"><Step v={q} label={`عدد ${l.label}`} on={n => setRes(r => r && { ...r, qty: { ...r.qty, [l.k]: l.unit === 'متر' ? Math.max(0, Math.round(n * 100) / 100 || 0) : clamp(n, 9999) } })} /><small>{l.unit}</small></span>
              </div>
              <button type="button" className="tk-more" aria-expanded={openLine === l.k} onClick={() => setOpenLine(o => (o === l.k ? '' : l.k))}>
                {openLine === l.k ? 'اقفل' : `ليه ${l.qty}؟${cands.length > 1 ? ` · شوف الأنواع (${cands.length})` : ''}`}
              </button>
              {openLine === l.k && (
                <div className="tk-why">
                  <ul>{l.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  {l.tip && <p className="tk-tip">💡 {l.tip}{l.k === 'lift' && <> <Link href="/tools/lift">افتح الحاسبة ←</Link></>}</p>}
                  {cands.length > 1 && (
                    <div className="tk-cands" role="radiogroup" aria-label={`أنواع ${l.label}`}>{cands.map(p => (
                      <button type="button" key={p.id} role="radio" aria-checked={chosen?.id === p.id} className={chosen?.id === p.id ? 'on' : ''} onClick={() => setRes(r => r && { ...r, pick: { ...r.pick, [l.k]: p.id } })}>
                        <span className="kim">{p.img && <Image src={p.img} alt="" fill sizes="56px" style={{ objectFit: 'contain' }} />}</span>
                        <b>{p.name}</b><small>{p.ok ? 'متوفر' : 'بالحجز'}</small>
                      </button>
                    ))}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      <div className="kact tk-act">
        {have.length > 0 && <button className="pri" onClick={addAll}>🛒 ضيف المتوفر للطلب ({have.length})</button>}
        <button className="sec" onClick={ask}>💬 ابعتلي سعر الحصر كله</button>
      </div>
      <div className="tk-act2">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(listText()); say('✔ اتنسخ الحصر'); } catch { say('مقدرناش ننسخ — اطبعه بدل كده'); } }}>📋 انسخ القائمة</button>
        <button type="button" onClick={() => print()}>🖨️ اطبع</button>
        <button type="button" onClick={() => { setRes(null); setErr(''); scrollTo({ top: 0 }); }}>📎 رسمة تانية</button>
      </div>

      <h2 className="sec-h">📦 الوحدات اللي قريناها ({m.units.length})</h2>
      <p className="mut" style={{ marginTop: -4 }}>لو فيه عدد مش مظبوط عدّله هنا والحصر بيتحسب تاني لوحده. دوس على الوحدة تشوف رسمتها.</p>
      <div className="tk-units">{m.units.map(u => {
        const on = openUnit === u.id, d = on ? drawUnit(u, m.kind, picked) : null;
        return (
          <div key={u.id} className={'tk-unit' + (on ? ' on' : '')}>
            <button type="button" className="tk-uh" aria-expanded={on} onClick={() => setOpenUnit(o => (o === u.id ? '' : u.id))}>
              <b>{u.name}{u.count > 1 && <i> × {u.count}</i>}{u.confidence < 0.6 && <i className="tk-dbt">اتأكد</i>}</b>
              <small>{[dims(u) && dims(u) + ' سم', ...u.doors.map(x => `${x.count} ${DOOR[x.kind]}`), u.drawers.length ? `${u.drawers.reduce((n, x) => n + x.count, 0)} درج` : '', u.shelvesAdj + u.shelvesFixed ? `${u.shelvesAdj + u.shelvesFixed} رف` : ''].filter(Boolean).join(' · ')}</small>
            </button>
            {on && d && (
              <div className="tk-ub">
                <div className="tk-svg" dangerouslySetInnerHTML={{ __html: d.svg }} />
                <ul className="tk-notes">{d.notes.map(n => <li key={n}>{n}</li>)}</ul>
                {mainDoorKind(u) && <div className="tk-kind"><b>نوع الضلف</b><KindSwitch u={u} /></div>}
                <div className="tk-edit">
                  <label>عدد الوحدات<Step v={u.count} label="عدد الوحدات" on={n => upd(u.id, x => ({ ...x, count: Math.max(1, clamp(n)) }))} /></label>
                  {u.doors.map((dr, i) => (
                    <label key={i}>{DOOR[dr.kind]}<Step v={dr.count} label={DOOR[dr.kind]} on={n => upd(u.id, x => ({ ...x, doors: x.doors.map((y, k) => (k === i ? { ...y, count: clamp(n, 40), sure: 1 } : y)) }), ['hinged', 'sliding', 'flaps'])} /></label>
                  ))}
                  {u.doors.filter(x => x.kind === 'hinged' || x.kind === 'folding').slice(0, 1).map((dr, i) => (
                    <label key={'h' + i}>طول الضلفة (سم)<Step v={dr.h} label="طول الضلفة" on={n => upd(u.id, x => ({ ...x, doors: x.doors.map(y => (y === dr ? { ...y, h: clamp(n, 300) } : y)) }))} /></label>
                  ))}
                  {!u.doors.length && <label>ضلف مفصلي<Step v={0} label="ضلف مفصلي" on={n => upd(u.id, x => ({ ...x, doors: clamp(n, 40) ? [{ kind: 'hinged', material: 'wood', count: clamp(n, 40), h: 0, w: 0, sure: 1 }] : [] }))} /></label>}
                  <label>أدراج<Step v={u.drawers.reduce((n, x) => n + x.count, 0)} label="أدراج" on={n => upd(u.id, x => ({ ...x, drawers: clamp(n, 60) ? [{ count: clamp(n, 60), inner: x.drawers[0]?.inner ?? false }] : [] }), ['drawers'])} /></label>
                  <label>أرفف متحركة<Step v={u.shelvesAdj} label="أرفف متحركة" on={n => upd(u.id, x => ({ ...x, shelvesAdj: clamp(n) }), ['shelves'])} /></label>
                  <label>أرفف ثابتة<Step v={u.shelvesFixed} label="أرفف ثابتة" on={n => upd(u.id, x => ({ ...x, shelvesFixed: clamp(n) }))} /></label>
                  <label>قواطيع (جناب في النص){!u.dividersKnown && partitions(u).n > 0 && <small className="mut"> محسوبة من الضلف</small>}<Step v={partitions(u).n} label="قواطيع" on={n => upd(u.id, x => ({ ...x, dividers: clamp(n, 30), dividersKnown: true }))} /></label>
                  <label>العرض (سم)<Step v={u.w} label="العرض" on={n => upd(u.id, x => ({ ...x, w: clamp(n, 1000) }))} /></label>
                  <label>العمق (سم)<Step v={u.d} label="العمق" on={n => upd(u.id, x => ({ ...x, d: clamp(n, 200) }))} /></label>
                </div>
                {u.note && <p className="mut">{u.note}</p>}
              </div>
            )}
          </div>
        );
      })}</div>
      {m.assumptions.length > 0 && <details className="tk-note"><summary>افتراضات عملناها ({m.assumptions.length})</summary><ul>{m.assumptions.map(a => <li key={a}>{a}</li>)}</ul></details>}
      <p className="mut" style={{ fontSize: 13, marginTop: 14 }}>الحصر بيتحسب بقواعد الشغل المعروفة من اللي ظاهر في الرسمة — راجعه قبل ما تشتري، واحنا بنراجعه معاك قبل تأكيد الطلب.</p>
    </div>
  );
}
