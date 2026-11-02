'use client';
// حاسبة الدراعات القلاب: type of opening → sizes → material → front weight + power factor → the right lift for each brand.
import { useMemo, useState } from 'react';
import { useShop } from '@/components/shop-provider';
import { calculate, frontWeight, KINDS, MATERIALS, type Kind, type MatKey } from '@/lib/lifts';
import { waUrl } from '@/lib/shop';

const n = (s: string) => Number(String(s).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, '')) || 0;
const ICON: Record<Kind, string> = { flap: '⤴️', fold: '🪗', parallel: '⏫', over: '🔄' };

function Field({ label, unit, v, set, hint }: { label: string; unit: string; v: string; set: (s: string) => void; hint?: string }) {
  return (
    <label className="lf-f">{label} <small>({unit})</small>
      <input inputMode="decimal" value={v} onChange={e => set(e.target.value)} placeholder="0" />
      {hint && <small className="mut">{hint}</small>}
    </label>
  );
}

export function LiftCalc() {
  const { site, open } = useShop();
  const [kind, setKind] = useState<Kind>('flap');
  const [kb, setKb] = useState('90'), [kh, setKh] = useState('40'), [fh, setFh] = useState('');
  const [uneven, setUneven] = useState(false), [fho, setFho] = useState('');
  const [mat, setMat] = useState<MatKey>('mdf'), [t, setT] = useState('18'), [handle, setHandle] = useState('300');
  const [manual, setManual] = useState(false), [mw, setMw] = useState('');

  const KB = n(kb) * 10, KH = n(kh) * 10, FH = (n(fh) || n(kh)) * 10;
  // the front covers the cabinet: width ≈ cabinet width, height ≈ front height (both fronts together for «fold»)
  const body = manual ? n(mw) : frontWeight(mat, KB, FH, n(t));
  const hw = n(handle) / 1000;
  const fg = body + (kind === 'fold' ? hw : 2 * hw);
  const ready = KB > 0 && KH > 0 && fg > 0;
  const picks = useMemo(() => (ready ? calculate({ kind, kb: KB, kh: KH, fh: FH, fg, fho: kind === 'fold' && uneven ? n(fho) * 10 : undefined }) : []), [ready, kind, KB, KH, FH, fg, uneven, fho]);
  // Our pick: Blum's strongest-fitting system first (HK top → HK-S → HK-XS), then any that fits.
  const PREF = ['HK top', 'HF top', 'HS top', 'HL top', 'HK-S', 'HK-XS'];
  const rank = (s: string) => { const k = PREF.findIndex(x => s.includes(x)); return k < 0 ? 99 : k; };
  const best = picks.filter(p => p.ok && p.brand === 'بلوم').sort((x, y) => rank(x.system) - rank(y.system))[0] ?? picks.find(p => p.ok);
  const lf = picks.find(p => p.lf)?.lf;

  const summary = [
    `🧮 حاسبة الدراعات القلاب`,
    `النوع: ${KINDS.find(x => x.k === kind)!.t}`,
    `الدولاب: عرض ${n(kb)} سم × ارتفاع ${n(kh)} سم${n(fh) ? ` — الضلفة ${n(fh)} سم` : ''}${kind === 'fold' && uneven && n(fho) ? ` — الضلفة اللي فوق ${n(fho)} سم` : ''}`,
    manual ? `وزن الضلفة: ${n(mw)} كجم` : `الخامة: ${MATERIALS.find(m => m.k === mat)!.name} ${n(t)} مم`,
    `الوزن مع المقبض: ${fg.toFixed(1)} كجم${lf ? ` — معامل القوة ${Math.round(lf)}` : ''}`,
    ...picks.filter(p => p.ok).map(p => `✔ ${p.brand} ${p.system}: ${p.part} × ${p.qty}`),
  ].join('\n');

  return (
    <div className="lf">
      <section className="lf-s">
        <h2><i>1</i> الضلفة بتفتح إزاي؟</h2>
        <div className="lf-kinds">{KINDS.map(k => (
          <button key={k.k} type="button" className={kind === k.k ? 'on' : ''} onClick={() => setKind(k.k)}>
            <span>{ICON[k.k]}</span><b>{k.t}</b><small>{k.s}</small>
          </button>
        ))}</div>
      </section>

      <section className="lf-s">
        <h2><i>2</i> المقاسات</h2>
        <div className="lf-g">
          <Field label="عرض الدولاب" unit="سم" v={kb} set={setKb} />
          <Field label="ارتفاع الدولاب" unit="سم" v={kh} set={setKh} hint="من بره لبره" />
          {kind !== 'fold' && <Field label="ارتفاع الضلفة" unit="سم" v={fh} set={setFh} hint="سيبه فاضي لو زي ارتفاع الدولاب" />}
        </div>
        {kind === 'fold' && <>
          <label className="lf-ck"><input type="checkbox" checked={uneven} onChange={e => setUneven(e.target.checked)} /> الضلفتين مش متساويين</label>
          {uneven && <div className="lf-g"><Field label="ارتفاع الضلفة اللي فوق" unit="سم" v={fho} set={setFho} hint="الكبيرة لازم تبقى فوق" /></div>}
        </>}
      </section>

      <section className="lf-s">
        <h2><i>3</i> الخامة والوزن</h2>
        <div className="lf-seg">
          <button type="button" className={!manual ? 'on' : ''} onClick={() => setManual(false)}>احسبلي الوزن</button>
          <button type="button" className={manual ? 'on' : ''} onClick={() => setManual(true)}>أنا عارف الوزن</button>
        </div>
        {manual ? <div className="lf-g"><Field label={kind === 'fold' ? 'وزن الضلفتين' : 'وزن الضلفة'} unit="كجم" v={mw} set={setMw} /></div> : <>
          <div className="lf-mats">{MATERIALS.map(m => <button key={m.k} type="button" className={mat === m.k ? 'on' : ''} onClick={() => setMat(m.k)}>{m.name}</button>)}</div>
          <div className="lf-g"><Field label={mat === 'glass' ? 'سُمك الزجاج' : 'سُمك الضلفة'} unit="مم" v={t} set={setT} /></div>
        </>}
        <div className="lf-g"><Field label="وزن المقبض" unit="جرام" v={handle} set={setHandle} hint={kind === 'fold' ? 'بيتحسب مرة واحدة' : 'بيتحسب مرتين زي ما بلوم بتحسب'} /></div>
      </section>

      {ready && (
        <section className="lf-s lf-res" aria-live="polite">
          <h2><i>4</i> النتيجة</h2>
          <div className="lf-kpi">
            <div><small>وزن الضلفة{kind === 'fold' ? 'تين' : ''} مع المقبض</small><b>{fg.toFixed(1)} كجم</b></div>
            {lf ? <div><small>معامل القوة (LF)</small><b>{Math.round(lf).toLocaleString('en')}</b></div> : null}
          </div>
          {best && <p className="lf-best">⭐ ترشيحنا: <b>{best.brand} {best.system}</b> — {best.part} × {best.qty}</p>}
          <div className="lf-picks">{picks.map(p => (
            <div key={p.system} className={'lf-p' + (p.ok ? ' ok' : '') + (p === best ? ' best' : '')}>
              <span className="lf-b">{p.brand}</span>
              <b>{p.system}</b>
              {p.ok ? <span className="lf-part">{p.part} <small>× {p.qty}</small></span> : <span className="lf-no">✗ مش مناسب</span>}
              {p.ok && p.alt && <small className="lf-alt">الرقم في المنطقة المشتركة مع {p.alt} — بلوم بتنصح بالأقوى، ولو قريب من الحد جرّب الأول</small>}
              <small>{p.note}</small>
            </div>
          ))}</div>
          <div className="lf-act">
            <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, summary)}>💬 ابعت الحساب للمحل</a>
            <button className="pri" onClick={() => open({ kind: 'price', lines: [], extra: summary })}>💰 ابعتلي السعر</button>
          </div>
          <p className="lf-src">أرقام بلوم من كتالوج بلوم الرسمي ٢٠٢٦. معامل القوة = ارتفاع الدولاب (مم) × وزن الضلفة (كجم){kind === 'fold' ? '' : ' مع مرتين وزن المقبض'}. لو الرقم قريب من حد المدى، بلوم بتنصح تجرّب قبل التركيب. وزن الخشب تقديري حسب نوعه — لو عندك ميزان، الوزن الحقيقي أدق.</p>
        </section>
      )}
    </div>
  );
}
