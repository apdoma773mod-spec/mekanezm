'use client';

import { Fragment, useState } from 'react';
import { errorMessage } from '@/lib/api';
import type { InvoiceDto, SettingsMap } from '@mk/shared';
import { formatDateTime, money, qtyText } from '@/lib/format';
import { htmlToPdf, shareFiles, shareOrSave } from '@/lib/pdf';
import { dimOf, forLabel, invoiceA4Html, invoiceFors, invoiceLabelHtml, prepSheetHtml, printHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useInvNotes, useInvoice, useVoidInvoice } from '@/lib/trade-queries';
import { useShipments } from '@/lib/phase4-queries';
import { kindIc, stLabel, useShipActions } from './shipment-modals';
import { HtmlPreview } from '../ui/html-preview';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

/** The old «فاتورة …» window shown after saving or tapping an invoice in a list. */
export function InvoiceView({ id }: { id: string }) {
  const { open, close } = useModal();
  const toast = useToast();
  const admin = useIsAdmin();
  const inv = useInvoice(id);
  const settings = useSettings();
  const voidInv = useVoidInvoice();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const ships = useShipments({ tab: 'all', invoiceId: id }, inv.data?.kind === 'SALE');
  const { label } = useShipActions();

  if (inv.isPending) {
    return (
      <Modal title="الفاتورة" onClose={close}>
        <Loading />
      </Modal>
    );
  }
  if (inv.isError) {
    return (
      <Modal title="الفاتورة" onClose={close}>
        <ErrorBox message={errorMessage(inv.error)} onRetry={() => inv.refetch()} />
      </Modal>
    );
  }

  const r = inv.data;
  const fors = invoiceFors(r);
  const isSale = r.kind === 'SALE';
  const voided = r.status === 'VOID';
  const waNum = (ph: string) => {
    let d = ph.replace(/\D/g, '');
    if (d.startsWith('0')) d = `20${d.slice(1)}`;
    return d;
  };
  const prep = () =>
    printHtml(
      prepSheetHtml({
        owner: (r.person || '').trim(),
        no: r.no,
        date: r.date,
        src: isSale ? 'فاتورة بيع' : 'فاتورة شراء',
        lines: r.items.map((x) => ({ name: x.name, qty: x.qty, unit: x.unit, dims: dimOf(x.name) })),
        notes: r.note.replace(/\s*—\s*⚙️.*$/, ''),
      }),
    );

  // old cancelInv() wording
  const nm = (r.person || '').trim();
  const voidMsg =
    `إلغاء الفاتورة ${r.no} نهائياً؟\n` +
    (isSale ? 'الأصناف هترجع للمخزون.' : 'الأصناف هتتخصم من المخزون.') +
    (r.paid > 0
      ? nm
        ? isSale
          ? `\nالمدفوع (${money(r.paid)}) هيتسجل رصيد لـ ${nm} يتخصم من فاتورة جاية.`
          : `\nالمدفوع للمورد (${money(r.paid)}) هيتسجل رصيد ليك عند ${nm}.`
        : isSale
          ? `\nالمدفوع (${money(r.paid)}) هيتخصم من الخزنة على إنه اترجع للعميل (مفيش اسم عميل على الفاتورة).`
          : `\nالمدفوع (${money(r.paid)}) هيرجع للخزنة.`
      : '') +
    (r.remaining > 0
      ? isSale
        ? `\nوالمتبقي (${money(r.remaining)}) هيتشال من حساب العميل.`
        : `\nوالمتبقي للمورد (${money(r.remaining)}) هيتشال من حسابه.`
      : '');
  const doVoid = async () => {
    try {
      await voidInv.mutateAsync({ id: r.id, reason: reason.trim() || 'إلغاء من شاشة الفاتورة' });
      toast('تم إلغاء الفاتورة');
      setVoiding(false);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  };

  return (
    <Modal title={`${isSale ? 'فاتورة' : 'فاتورة شراء'} ${r.no}${r.online ? ' — 🌐 أونلاين' : ''}`} onClose={close}>
      {voided && (
        <div className="form-error" style={{ marginBottom: 12 }}>
          الفاتورة دي ملغية — {r.voidReason} ({formatDateTime(r.voidedAt)})
        </div>
      )}
      <div className={`inv-sheet${voided ? ' void' : ''}`}>
        <div className="inv-head">
          <div>
            <b>{settings.data?.store.name || 'ميكانيزم'}</b>
            <span>{isSale ? 'فاتورة بيع' : 'فاتورة شراء'}{r.online ? ' — 🌐 أونلاين' : ''}</span>
          </div>
          <div className="inv-no">
            <b dir="ltr">{r.no}</b>
            <span>{r.date}</span>
          </div>
        </div>
        <div className="inv-who">
          <div>
            <small>{isSale ? 'العميل' : 'المورد'}</small>
            <b>{r.person || (isSale ? 'عميل نقدي' : '—')}</b>
          </div>
          {r.phone && (
            <div>
              <small>التليفون</small>
              <b dir="ltr">{r.phone}</b>
            </div>
          )}
          {r.address && (
            <div className="wide">
              <small>العنوان</small>
              <b>{r.address}</b>
            </div>
          )}
        </div>
        <table className="inv-items">
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(fors.some(Boolean) ? fors : ['\u0000all']).map((n) => {
              const part = fors.some(Boolean) ? r.items.filter((x) => (x.forName || '').trim() === n) : r.items;
              return (
                <Fragment key={n}>
                  {fors.some(Boolean) && (
                    <tr className="inv-for">
                      <td colSpan={4}>
                        <b>👤 لحساب: {forLabel(n)}</b>
                      </td>
                    </tr>
                  )}
                  {part.map((x) => (
                    <tr key={x.id}>
                      <td>{x.name}</td>
                      <td>
                        {qtyText(x.qty)} {x.unit}
                      </td>
                      <td>{money(x.price)}</td>
                      <td>{money(x.total)}</td>
                    </tr>
                  ))}
                  {fors.some(Boolean) && (
                    <tr className="inv-for-sub">
                      <td colSpan={3}>إجمالي {forLabel(n)}</td>
                      <td>
                        <b>{money(part.reduce((a, x) => a + x.total, 0))}</b>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="inv-tot">
          {(r.shipping > 0 || r.discount > 0) && (
            <div>
              <span>إجمالي الأصناف</span>
              <b>{money(r.subtotal)}</b>
            </div>
          )}
          {r.discount > 0 && (
            <div>
              <span>الخصم</span>
              <b>{money(r.discount)}</b>
            </div>
          )}
          {r.shipping > 0 && (
            <div>
              <span>🚚 مصاريف النقل</span>
              <b>{money(r.shipping)}</b>
            </div>
          )}
          <div className="grand">
            <span>الإجمالي</span>
            <b>{money(r.total)}</b>
          </div>
          <div>
            <span>المدفوع</span>
            <b>{money(r.paid)}</b>
          </div>
          <div className={r.remaining > 0 ? 'due' : 'clear'}>
            <span>المتبقي</span>
            <b>{money(r.remaining)}</b>
          </div>
        </div>
        {(r.note || r.createdBy || (admin && r.profit !== undefined && isSale)) && (
          <div className="inv-foot">
            {r.note && <div>البيان: {r.note}</div>}
            {r.createdBy && (
              <div>
                سجّلها: <b>{r.createdBy.name}</b>
              </div>
            )}
            {admin && r.profit !== undefined && isSale && <div>الربح: {money(r.profit)}</div>}
          </div>
        )}
      </div>
      {admin && !voided && (
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => open({ kind: 'transaction', type: r.kind, editId: r.id })}>
            ✏️ تعديل الفاتورة
          </button>
          <button type="button" className="secondary danger" onClick={() => setVoiding(!voiding)}>
            إلغاء الفاتورة
          </button>
        </div>
      )}
      {voiding && (
        <div className="form" style={{ marginTop: 10 }}>
          <div className="field full">
            <label htmlFor="voidReason">سبب الإلغاء</label>
            <input id="voidReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اختياري — مثال: الفاتورة اتسجلت غلط" />
          </div>
          <div className="field full">
            <span className="hint" style={{ whiteSpace: 'pre-line' }}>{voidMsg}</span>
            <button type="button" className="primary" style={{ background: 'var(--danger)' }} disabled={voidInv.isPending} onClick={doVoid}>
              {voidInv.isPending ? '⏳' : 'إلغاء الفاتورة'}
            </button>
          </div>
        </div>
      )}
      {r.updatedBy && (
        <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
          اتعدلت آخر مرة: {formatDateTime(r.updatedAt)} — {r.updatedBy.name}
        </p>
      )}

      {isSale && !voided && (() => {
        const s = ships.data?.items[0];
        return s ? (
          <div className="shinv">
            🚚 {kindIc(s.kind)} <b>{s.no}</b> — <span className={`badge st-${s.status}`}>{stLabel(s.status, s.kind)}</span>
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button type="button" className="primary" style={{ flex: 1 }} onClick={() => label(s)}>
                🖨️ اطبع ملصق الشحن
              </button>
              <a className="secondary" href="/shipping" style={{ textDecoration: 'none' }} onClick={close}>
                المتابعة
              </a>
            </div>
          </div>
        ) : (
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => open({ kind: 'shipEdit', invoiceId: r.id })}>
              🚚 شحن / توصيل للفاتورة دي
            </button>
          </div>
        );
      })()}

      <div className="btnrow" style={{ marginTop: 8 }}>
        {isSale ? (
          <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => open({ kind: 'printAsk', id: r.id })}>
            🖨️ طباعة (إيصال أو A4)
          </button>
        ) : (
          <button type="button" className="secondary" style={{ flex: 1 }} disabled={!settings.data} onClick={() => settings.data && printHtml(invoiceA4Html(r, settings.data))}>
            🖨️ طباعة
          </button>
        )}
      </div>
      {isSale && (
        <button
          type="button"
          id="mkInvLbl"
          className="secondary"
          style={{ width: '100%', padding: 12, marginTop: 8 }}
          disabled={!settings.data}
          onClick={() => {
            const a = window.prompt('كام ليبل؟ (لو الأوردر في كذا كرتونة اكتب عددهم)', '1');
            if (a === null || !settings.data) return;
            const n = Math.max(1, Math.min(50, parseInt(a.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)), 10) || 1));
            printHtml(invoiceLabelHtml(r, settings.data, n));
          }}
        >
          🏷️ طباعة ليبل
        </button>
      )}
      {isSale && <NotesButton no={r.no} id={r.id} />}
      <div id="prepB">
        <button type="button" className="secondary" style={{ width: '100%', padding: 12, marginTop: 8 }} onClick={prep}>
          🖨️ طباعة ورق التجهيز (من غير أسعار)
        </button>
      </div>
      {isSale && fors.some(Boolean) && <SplitBox inv={r} fors={fors} settings={settings.data} />}
      {isSale && <PdfBox inv={r} settings={settings.data} wa={r.phone ? waNum(r.phone) : ''} />}
    </Modal>
  );
}

/** 👥 فاتورة مقسومة على زباين: كشف مفصّل للعميل الأساسي + صفحة (PDF) لكل زبون لوحده. */
function SplitBox({ inv, fors, settings }: { inv: InvoiceDto; fors: string[]; settings: SettingsMap | undefined }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  /** الملفات اللي اتجهّزت (بالمفتاح): الدوسة التانية بتبعت فورًا من غير تجهيز — ده اللي بيخلّي الإرسال يشتغل على الآيفون. */
  const [ready, setReady] = useState<Record<string, File>>({});
  const made = async (key: string, html: string, file: string): Promise<File> => {
    if (ready[key]) return ready[key];
    const res = await htmlToPdf(html);
    const out = new File([res.blob], file, { type: 'application/pdf' });
    setReady((r) => ({ ...r, [key]: out }));
    return out;
  };
  const send = async (files: File[], title: string) => {
    const out = await shareFiles(files, title);
    if (out === 'blocked') toast(files.length > 1 ? `✅ الـ${files.length} ملفات جاهزين — دوس الزرار تاني يتبعتوا` : '✅ الملف جاهز — دوس الزرار تاني يتبعت');
    if (out === 'saved') toast(files.length > 1 ? `الـ${files.length} ملفات اتحفظوا على الجهاز — ابعتهم من الواتساب` : 'الملف اتحفظ على الجهاز — افتحه وابعته من الواتساب');
  };
  const share = async (key: string, html: string, file: string, title: string) => {
    setBusy(key);
    try {
      await send([await made(key, html, file)], title);
    } catch {
      toast('ما قدرتش أجهّز الملف — جرّب الطباعة', 'bad');
    } finally {
      setBusy(null);
    }
  };
  const keyOf = (n: string) => n || '-';
  const allReady = fors.every((n) => ready[keyOf(n)]);
  /** كل زبون ملف لوحده، والكل في إرسال واحد: بيوصلوا في الواتساب ملفات منفصلة يتبعت كل واحد لصاحبه. */
  const shareEach = async () => {
    if (!settings) return;
    setBusy('each');
    try {
      const files: File[] = [];
      for (const [i, n] of fors.entries()) {
        setBusy(`each ${i + 1}/${fors.length}`);
        files.push(await made(keyOf(n), invoiceA4Html(inv, settings, { only: n }), `${forLabel(n)}-${inv.no}.pdf`));
      }
      await send(files, `كشوف ${inv.no}`);
    } catch {
      toast('ما قدرتش أجهّز الملفات — جرّب تاني', 'bad');
    } finally {
      setBusy(null);
    }
  };
  const untitled = fors.includes('') && fors.some(Boolean);
  return (
    <div id="splitBox" className="splitbox">
      <div className="sp-h">
        <b>👥 الفاتورة مقسومة على {fors.filter(Boolean).length} زبون</b>
        <small>كشف واحد للكل، أو صفحة لكل زبون لوحده</small>
      </div>
      {untitled && <p className="sp-note">فيه بنود من غير اسم — بتظهر تحت «بدون اسم». عدّل الفاتورة لو عايز تحط لها اسم.</p>}
      <div className="sp-all">
        <button type="button" className="primary" disabled={!settings} onClick={() => settings && printHtml(invoiceA4Html(inv, settings, { group: true }))}>
          🖨️ طباعة الكشف
        </button>
        <button type="button" className="secondary" disabled={!settings || busy !== null} onClick={() => settings && void share('all', invoiceA4Html(inv, settings, { group: true }), `كشف-${inv.no}.pdf`, `كشف مفصّل ${inv.no}`)}>
          {busy === 'all' ? '⏳ بيجهّز…' : '📤 إرسال الكشف'}
        </button>
      </div>
      <button type="button" className="primary sp-each" disabled={!settings || busy !== null} onClick={() => void shareEach()}>
        {busy?.startsWith('each') ? `⏳ بيجهّز ${busy.slice(5) || ''}…` : allReady ? `📤 ابعت الـ${fors.length} كشوف دلوقتي (كل زبون ملف)` : `📤 ابعت كل الكشوف — ${fors.length} ملفات، كل زبون لوحده`}
      </button>
      <div className="sp-list">
        {fors.map((n) => {
          const part = inv.items.filter((x) => (x.forName || '').trim() === n);
          return (
            <div key={n} className="sp-row">
              <div className="sp-who">
                <b>{forLabel(n)}</b>
                <small>
                  {part.length} صنف — <span>{money(part.reduce((a, x) => a + x.total, 0))}</span>
                </small>
              </div>
              <button type="button" className="secondary" aria-label={`طباعة صفحة ${forLabel(n)}`} disabled={!settings} onClick={() => settings && printHtml(invoiceA4Html(inv, settings, { only: n }))}>
                🖨️
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={`إرسال صفحة ${forLabel(n)} PDF`}
                disabled={!settings || busy !== null}
                onClick={() => settings && void share(keyOf(n), invoiceA4Html(inv, settings, { only: n }), `${forLabel(n)}-${inv.no}.pdf`, `${forLabel(n)} — ${inv.no}`)}
              >
                {busy === keyOf(n) ? '⏳' : '📤'}
              </button>
            </div>
          );
        })}
      </div>
      <small className="sp-foot">🖨️ طباعة — 📤 إرسال PDF (واتساب أو حفظ)</small>
    </div>
  );
}

/** 📦 استلام وناقص — بيقول «(فيه ناقص)» لو في بضاعة فاضلة. */
function NotesButton({ no, id }: { no: string; id: string }) {
  const { open } = useModal();
  const notes = useInvNotes({});
  const n = notes.data?.find((x) => x.no === no);
  return (
    <button id="invNb" type="button" className="secondary" style={{ width: '100%', padding: 14, marginTop: 10 }} onClick={() => open({ kind: 'invNotes', no, id })}>
      📦 استلام وناقص{n?.miss ? ' (فيه ناقص)' : ''}
    </button>
  );
}

type PdfState = 'idle' | 'busy' | { blob: Blob; img: string } | { err: string };

/** «تحويل إلى PDF» ← معاينة + مشاركة PDF + رسالة واتساب + حفظ. */
function PdfBox({ inv, settings, wa }: { inv: InvoiceDto; settings: SettingsMap | undefined; wa: string }) {
  const toast = useToast();
  const [state, setState] = useState<PdfState>('idle');
  const name = `فاتورة-${inv.no}.pdf`;
  const convert = async () => {
    if (!settings) return;
    setState('busy');
    try {
      setState(await htmlToPdf(invoiceA4Html(inv, settings)));
    } catch (e) {
      const m = (e as Error).message;
      setState({ err: m === 'lib' ? 'مكتبة الـ PDF لم تتحمل، تأكد من الإنترنت وجرب تاني.' : m === 'timeout' ? 'التحويل أخد وقت طويل وتوقف. اضغط إعادة المحاولة.' : m === 'empty' || m === 'frame' ? 'المتصفح ده ما عرفش يحوّلها صورة — استخدم زرار الطباعة تحت واختار «حفظ PDF».' : `حصل خطأ أثناء إنشاء الـ PDF (${m})` });
    }
  };
  const ready = typeof state === 'object' && 'blob' in state ? state : null;
  const failed = typeof state === 'object' && 'err' in state ? state : null;
  return (
    <div id="invOut" style={{ marginTop: 14 }}>
      {ready ? (
        <>
          <img src={ready.img} alt="معاينة الفاتورة" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12 }} />
          <div style={{ display: 'grid', gap: 8 }}>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                const r = await shareOrSave(ready.blob, name, `فاتورة ${inv.no}`);
                if (r === 'saved') toast('المتصفح ده مش بيدعم المشاركة المباشرة — الملف اتحفظ على الجهاز، افتحه وابعته من الواتساب');
              }}
            >
              مشاركة PDF (اختار الواتساب وبعدها العميل)
            </button>
            {wa && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const msg = `أهلاً ${inv.person || ''}\nدي فاتورتك رقم ${inv.no} من ${settings?.store.name || 'ميكانيزم'}\nالإجمالي: ${money(inv.total)}\nشكراً لتعاملك معانا 🙏`;
                  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                  toast('ابعت ملف الـ PDF مع الرسالة');
                }}
              >
                فتح محادثة العميل برسالة فقط (من غير الملف)
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                await shareOrSave(ready.blob, name, `فاتورة ${inv.no}`);
                toast('تم تجهيز ملف الفاتورة');
              }}
            >
              حفظ PDF على الجهاز
            </button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '10px 0 0' }}>تقدر ترجع لأي فاتورة في أي وقت من صفحة المبيعات (زرار PDF).</p>
        </>
      ) : failed ? (
        <>
          {settings && <HtmlPreview html={invoiceA4Html(inv, settings)} />}
          <p style={{ color: 'var(--danger)' }}>{failed.err}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <button type="button" className="primary" style={{ width: '100%' }} onClick={() => void convert()}>
              إعادة المحاولة
            </button>
            {settings && (
              <button type="button" className="secondary" style={{ width: '100%' }} onClick={() => printHtml(invoiceA4Html(inv, settings))}>
                🖨️ اطبعها أو احفظها PDF من الطباعة
              </button>
            )}
          </div>
        </>
      ) : (
        <>
        {state === 'busy' && settings && <HtmlPreview html={invoiceA4Html(inv, settings)} />}
        <button id="invBtn" type="button" className="primary" style={{ width: '100%', padding: 14 }} disabled={state === 'busy' || !settings} onClick={() => void convert()}>
          {state === 'busy' ? 'جاري تجهيز الفاتورة...' : 'تحويل إلى PDF'}
        </button>
        </>
      )}
    </div>
  );
}
