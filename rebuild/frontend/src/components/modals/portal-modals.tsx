'use client';

import { useEffect } from 'react';
import { waNum } from '@/components/hy/ui';
import { ErrorBox, Loading } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useMakePortalLink, useMarkPortalSeen, usePortalLink, usePortalMsgs, useStopPortalLink, type PortalMsg } from '@/lib/portal-queries';
import { useContact } from '@/lib/trade-queries';
import { useOrderSale } from '@/lib/use-order-sale';
import { useModal } from './modal-host';

const when = (t: string) => new Date(t).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

function Media({ m }: { m: PortalMsg['media'] }) {
  return (
    <>
      {m.map((x, i) => (
        <a key={x.u} href={x.u} target="_blank" rel="noopener" style={{ display: 'inline-block', margin: '6px 6px 0 0', padding: '10px 14px', background: 'var(--tint2)', borderRadius: 10 }}>
          {x.t === 'v' ? '🎬 فيديو' : '🖼️ صورة'} {i + 1}
        </a>
      ))}
    </>
  );
}

/** 🔗 رابط العميل (portalOpen القديمة): الرابط الخاص بيه، نسخ، واتساب، إيقاف، وطلباته. */
export function PortalLink({ id }: { id: string }) {
  const { open } = useModal();
  const toast = useToast();
  const contact = useContact(id);
  const link = usePortalLink(id);
  const make = useMakePortalLink(id);
  const stop = useStopPortalLink(id);
  const msgs = usePortalMsgs({ contactId: id });
  const seen = useMarkPortalSeen();
  const c = contact.data;

  useEffect(() => {
    if (link.data === null && !make.isPending && !make.isSuccess && !make.isError) make.mutate();
  }, [link.data, make]);
  // reading the requests here marks them read
  useEffect(() => {
    if (msgs.data?.some((m) => !m.seen)) seen.mutate({ contactId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.data]);

  const back = () => open({ kind: 'contactFile', id });
  const L = link.data ? `${location.origin}/portal/${link.data}` : '';
  const wa = c && L ? `https://wa.me/${waNum(c.phone)}?text=${encodeURIComponent(`أهلاً ${c.name} 🌟\nدي صفحتك الخاصة عندنا في ميكانيزم: تقدر تشوف حسابك وفواتيرك، وتكتب طلبك وتبعت صور أو فيديو لأي صنف محتاجه:\n${L}`)}` : '';

  return (
    <Modal title={`🔗 رابط ${c?.name ?? ''}`} onClose={back}>
      {(link.isPending || make.isPending) && <Loading />}
      {link.isError && <ErrorBox message={errorMessage(link.error)} />}
      {make.isError && <ErrorBox message={errorMessage(make.error)} />}
      {L && (
        <>
          <div style={{ lineHeight: 1.9 }}>الرابط ده خاص بالعميل ده بس. بيشوف منه حسابه وفواتيره، ويكتب طلبه ويبعت صور وفيديو.</div>
          <input readOnly value={L} dir="ltr" style={{ width: '100%', margin: '10px 0', padding: 14, fontSize: 14 }} onFocus={(e) => e.currentTarget.select()} />
          <div className="btnrow">
            <button
              type="button"
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(L);
                } catch {
                  /* the field is selectable anyway */
                }
                toast('اتنسخ');
              }}
            >
              نسخ الرابط
            </button>
            {c?.phone ? (
              <a className="secondary" style={{ textDecoration: 'none', padding: '10px 14px' }} target="_blank" rel="noopener" href={wa}>
                إرسال على واتساب
              </a>
            ) : null}
          </div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="secondary"
              style={{ color: 'var(--danger)' }}
              disabled={stop.isPending}
              onClick={async () => {
                if (!window.confirm('الرابط هيقف خالص. متأكد؟')) return;
                await stop.mutateAsync();
                toast('اتوقف');
                back();
              }}
            >
              إيقاف الرابط
            </button>
          </div>
          <h3 style={{ margin: '16px 0 8px' }}>طلبات العميل ({msgs.data?.length ?? 0})</h3>
          {msgs.data?.length ? (
            msgs.data.map((m) => (
              <div key={m.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {when(m.createdAt)}
                  {m.seen ? '' : ' • '}
                  {m.seen ? null : <b style={{ color: 'var(--danger)' }}>جديد</b>}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{m.body}</div>
                <Media m={m.media} />
              </div>
            ))
          ) : (
            <div className="empty">لسه مفيش طلبات.</div>
          )}
        </>
      )}
    </Modal>
  );
}

/** «🔗 طلبات العملاء الجديدة»: اللي العملاء كتبوه من رابطهم ولسه ماتقراش. */
export function PortalNew() {
  const { open, close } = useModal();
  const list = usePortalMsgs({ unseen: true });
  const seen = useMarkPortalSeen();
  const toInvoice = useOrderSale();
  return (
    <Modal title={`🔗 طلبات العملاء الجديدة (${list.data?.length ?? 0})`} onClose={close}>
      {list.isPending && <Loading />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && !list.data.length && (
        <div className="card">
          <div className="empty">مفيش طلبات جديدة 👌</div>
        </div>
      )}
      {list.data?.map((m) => (
        <div key={m.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b>{m.name || 'عميل'}</b>
            <small style={{ color: 'var(--muted)' }}>{when(m.createdAt)}</small>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: '6px 0' }}>{m.body}</div>
          <Media m={m.media} />
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await seen.mutateAsync({ id: m.id });
                await toInvoice({ text: m.body, person: m.name, contactId: m.contactId, note: 'من رسالة العميل (رابطه)' });
              }}
            >
              🧾 تحويل لفاتورة
            </button>
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                await seen.mutateAsync({ id: m.id });
                open({ kind: 'contactFile', id: m.contactId });
              }}
            >
              فتح ملف العميل
            </button>
            <button type="button" className="secondary" disabled={seen.isPending} onClick={() => seen.mutate({ id: m.id })}>
              ✔ اتقرا
            </button>
          </div>
        </div>
      ))}
    </Modal>
  );
}
