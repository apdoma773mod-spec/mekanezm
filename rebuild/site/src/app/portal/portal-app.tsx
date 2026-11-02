'use client';
// حسابك عند ميكانيزم: the customer's private page from the link the shop sends (?t=token).
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalGet, portalSend, portalUpload, type PortalData, type PortalInvoice } from '@/lib/api';

const money = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج';

function Invoice({ x }: { x: PortalInvoice }) {
  return (
    <details className="inv">
      <summary>
        <span><b>فاتورة {x.no}</b><br /><span className="mut">{x.date} — {money(x.tot)}</span></span>
        {x.rem > 0 ? <span className="tag r">متبقي {money(x.rem)}</span> : <span className="tag g">مدفوعة</span>}
      </summary>
      <div className="body">
        {(x.items ?? []).map((i, k) => <div className="row" key={k}><span>{i.n} × {i.q}{i.u ? ' ' + i.u : ''}</span><b>{money(i.t)}</b></div>)}
        <div className="row"><span>الإجمالي</span><b>{money(x.tot)}</b></div>
        <div className="row"><span>المدفوع</span><b>{money(x.paid)}</b></div>
        {x.recv && <div className="row"><span>تاريخ الاستلام</span><b>{x.recv}</b></div>}
        {x.miss && <div className="miss"><b>⚠️ كان ناقص يوم الاستلام:</b>{'\n'}{x.miss}</div>}
        {x.got && <div className="miss" style={{ background: '#e9f7ef' }}><b>✅ اتسلّم{x.gotDate ? ' يوم ' + x.gotDate : ''}:</b>{'\n'}{x.got}</div>}
      </div>
    </details>
  );
}

export function PortalApp({ token }: { token: string }) {
  const [d, setD] = useState<PortalData | null>(null);
  const [err, setErr] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [st, setSt] = useState('');
  const [busy, setBusy] = useState(false);
  const inp = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (token.length < 16) return setErr('الرابط ده مش مظبوط. اطلب من المحل يبعتلك الرابط تاني.');
    try {
      const x = await portalGet(token);
      if (!x) return setErr('الرابط ده انتهى أو مش مظبوط. اطلب من المحل رابط جديد.');
      setD(x);
      document.title = 'حسابك عند ' + (x.snap?.shop?.name || 'ميكانيزم');
    } catch { setErr('مش قادرين نفتح حسابك دلوقتي. جرّب كمان شوية.'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const pick = (fs: FileList | null) => {
    const add: File[] = [];
    for (const f of fs ?? []) { if (f.size > 50 * 1024 * 1024) { alert('الملف ' + f.name + ' أكبر من 50 ميجا'); continue; } add.push(f); }
    setFiles(x => [...x, ...add].slice(0, 8));
  };
  async function send() {
    if (!body.trim() && !files.length) return setSt('اكتب طلبك أو أرفق صورة الأول.');
    setBusy(true); setSt('جاري الإرسال...');
    try {
      const media = [];
      for (let i = 0; i < files.length; i++) { setSt(`برفع المرفق ${i + 1} من ${files.length}...`); media.push(await portalUpload(token, files[i], i)); }
      if (!(await portalSend(token, body.trim(), media))) throw new Error('REJ');
      setFiles([]); setBody(''); setSt('✅ وصل طلبك. هنرد عليك في أقرب وقت.');
      setTimeout(load, 1200);
    } catch (e) {
      const m = String((e as Error)?.message || '');
      const why = m.startsWith('UP:') ? 'ماقدرناش نرفع أحد المرفقات (' + m.slice(3, 60) + '). جرّب صورة أصغر أو فيديو أقصر.'
        : m === 'REJ' ? 'السيستم رفض الطلب. ممكن تكون بعت طلبات كتير في ساعة واحدة، جرّب بعد شوية، أو كلم المحل.'
          : m.startsWith('RPC:') ? 'الطلب ماوصلش للسيرفر: ' + m.slice(4, 120)
            : 'مافيش اتصال بالنت دلوقتي. اتأكد من النت وجرّب تاني.';
      setSt('❌ ماتبعتش. ' + why);
    }
    setBusy(false);
  }

  const s = d?.snap ?? {}, sh = s.shop ?? {}, inv = s.inv ?? [];
  return (
    <div className="pt">
      <header><h1>{sh.name || 'ميكانيزم'}</h1><p>{d ? 'أهلاً ' + d.name + (s.at ? ' — آخر تحديث ' + new Date(s.at).toLocaleDateString('ar-EG') : '') : '...'}</p></header>
      <main>
        {err ? <div className="card err">{err}</div> : !d ? <div className="card">جاري التحميل...</div> : <>
          <div className="card">
            <h2>طلبك</h2>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب هنا اللي محتاجه: أصناف، كميات، مقاسات..." />
            <div className="thumbs">{files.map((f, i) => (
              <button key={i} onClick={() => setFiles(x => x.filter((_, k) => k !== i))} aria-label="شيل المرفق">
                {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" /> : '🎬 ' + f.name.slice(0, 18)}
              </button>
            ))}</div>
            <input ref={inp} type="file" accept="image/*,video/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
            <button className="sec" onClick={() => inp.current?.click()}>📷 أرفق صورة أو فيديو للصنف</button>
            <div className="note">لو مش لاقي الصنف في أي مكان، ابعت صورته أو فيديو عنه ونجيبهولك.</div>
            <button className="pri" onClick={send} disabled={busy}>إرسال الطلب</button>
            <div className="note" aria-live="polite">{st}</div>
          </div>
          <div className="card">
            <h2>حسابك</h2>
            <div className="bal" style={{ color: s.bal && s.bal.amt > 0 ? 'var(--red)' : 'var(--grn)' }}>{s.bal?.txt || 'خالص'}</div>
            <div className="row"><span>عدد الفواتير</span><b>{inv.length}</b></div>
            <div className="row"><span>إجمالي الفواتير</span><b>{money(inv.reduce((a, x) => a + (x.tot || 0), 0))}</b></div>
            <div className="row"><span>اللي اتدفع</span><b>{money(inv.reduce((a, x) => a + (x.paid || 0), 0) + (s.pays ?? []).reduce((a, x) => a + (x.amount || 0), 0))}</b></div>
          </div>
          <div className="card"><h2>فواتيرك</h2>{inv.length ? inv.map((x, i) => <Invoice key={i} x={x} />) : <div className="mut">مفيش فواتير لسه.</div>}</div>
          {(s.pays ?? []).length > 0 && <div className="card"><h2>الدفعات</h2>{s.pays!.map((p, i) => <div className="row" key={i}><span>{p.date}{p.note ? ' — ' + p.note : ''}</span><b>{money(p.amount)}</b></div>)}</div>}
          {(s.rets ?? []).length > 0 && <div className="card"><h2>المرتجعات</h2>{s.rets!.map((p, i) => <div className="row" key={i}><span>{p.date} — {p.n} × {p.q}</span><b>{money(p.t)}</b></div>)}</div>}
          {(d.msgs ?? []).length > 0 && <div className="card"><h2>طلباتك اللي بعتها</h2>{d.msgs!.map((m, i) => (
            <div className="msg" key={i}><div className="mut">{new Date(m.at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>{m.body}{(m.media ?? []).length > 0 && <div className="mut">📎 {m.media!.length} مرفق</div>}</div>
          ))}</div>}
          {sh.phone && <div className="card"><h2>تواصل معانا</h2><a className="sec" href={'tel:' + sh.phone}>📞 {sh.phone}</a></div>}
        </>}
      </main>
    </div>
  );
}
