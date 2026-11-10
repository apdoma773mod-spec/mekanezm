'use client';

import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { errorMessage } from '@/lib/api';
import { dimSig, generateDimImage, hasDims, parseDims } from '@/lib/dim-auto';
import { fetchSite, saveSite, type SiteProduct } from '@/lib/web-queries';
import { uploadSiteImage } from './site-admin';
import { useModal } from './modal-host';

/** 📐 «صورة المقاسات» for every site product that has photos and sizes written in its specs and does not have an up-to-date one yet. */
type Prod = SiteProduct & { dimImg?: string; dimSig?: string; dimTxt?: string };

const specRows = (desc: string): [string, string][] => {
  const rows: [string, string][] = [];
  for (const l of (desc ?? '').split('\n')) {
    const m = l.trim().match(/^([^:：]{1,30})[:：]\s*(.+)$/);
    if (m) rows.push([m[1]!.trim(), m[2]!.trim()]);
  }
  return rows;
};

export function DimBulk() {
  const { close } = useModal();
  const [state, setState] = useState<'idle' | 'run' | 'done'>('idle');
  const [info, setInfo] = useState('');
  const [log, setLog] = useState<{ name: string; ok: boolean; msg?: string }[]>([]);
  const [counts, setCounts] = useState({ todo: -1, total: 0, noDims: 0, noImgs: 0 });
  const stop = useRef(false);

  const scan = async () => {
    const doc = await fetchSite();
    const all = doc.data.products as Prod[];
    let noDims = 0;
    let noImgs = 0;
    const todo: Prod[] = [];
    for (const p of all) {
      if (!(p.imgs?.length ?? 0)) { noImgs++; continue; }
      const dims = parseDims(specRows(p.desc ?? ''), p.dimTxt ?? '');
      if (!hasDims(dims)) { noDims++; continue; }
      if (p.dimImg && p.dimSig === dimSig(dims) && p.imgs.includes(p.dimImg)) continue;
      todo.push(p);
    }
    setCounts({ todo: todo.length, total: all.length, noDims, noImgs });
    return { todo, doc };
  };

  const start = async () => {
    setState('run');
    stop.current = false;
    setLog([]);
    try {
      const { todo, doc } = await scan();
      const phones = (doc.data.phones ?? []).filter(Boolean).join(' - ');
      const foot = phones ? `ميكانيزم — ${phones}` : 'ميكانيزم — MEKANIZM';
      let i = 0;
      for (const p of todo) {
        if (stop.current) break;
        i++;
        setInfo(`⏳ ${i} من ${todo.length}: ${p.name}`);
        try {
          const dims = parseDims(specRows(p.desc ?? ''), p.dimTxt ?? '');
          const pool = p.imgs.filter((u) => u !== p.dimImg);
          const blob = await generateDimImage(pool, dims, foot);
          const url = await uploadSiteImage(new File([blob], 'dim.jpg', { type: 'image/jpeg' }));
          const sig = dimSig(dims);
          await saveSite((d) => {
            const o = d.products.find((x) => x.id === p.id) as Prod | undefined;
            if (!o) return;
            const now = o.imgs.filter((u) => u !== o.dimImg);
            o.imgs = [url, ...now];
            o.img = o.imgs[0] ?? '';
            o.dimImg = url;
            o.dimSig = sig;
          });
          setLog((l) => [...l, { name: p.name, ok: true }]);
        } catch (e) {
          setLog((l) => [...l, { name: p.name, ok: false, msg: errorMessage(e) }]);
        }
      }
    } catch (e) {
      setInfo(errorMessage(e));
    }
    setState('done');
  };

  const okN = log.filter((x) => x.ok).length;
  return (
    <Modal title="📐 صور المقاسات لكل المنتجات" onClose={state === 'run' ? () => (stop.current = true) : close} wide>
      {state === 'idle' && (
        <>
          <p style={{ lineHeight: 1.9 }}>
            السيستم هيعدّي على كل منتجات الموقع، وللمنتج اللي ليه صور ومقاساته مكتوبة في «المواصفات» (عرض / ارتفاع / عمق) هيختار أوضح صورة ويرسم عليها صورة المقاسات ويحطها <b>تاني صورة</b>.
            المنتجات اللي ملهاش مقاسات مكتوبة بيعدّي عليها. سيب الشاشة مفتوحة لحد ما يخلص (حوالي ١٠ ثواني للمنتج).
          </p>
          {counts.todo >= 0 && (
            <p style={{ color: 'var(--muted)' }}>
              هيتعمل لـ {counts.todo} منتج · من غير مقاسات: {counts.noDims} · من غير صور: {counts.noImgs}
            </p>
          )}
          <div className="modal-foot">
            <button type="button" className="primary" onClick={() => void start()}>
              🪄 ابدأ
            </button>
            <button type="button" className="secondary" onClick={() => void scan()}>
              🔎 اعرف الأول هيتعمل لكام منتج
            </button>
            <button type="button" className="secondary" onClick={close}>
              إلغاء
            </button>
          </div>
        </>
      )}
      {state !== 'idle' && (
        <>
          <p style={{ fontWeight: 700 }}>{state === 'run' ? info : `✔ خلص — اتعمل ${okN} من ${log.length}${log.length - okN ? `، فشل ${log.length - okN}` : ''}${counts.noDims ? ` · ${counts.noDims} منتج من غير مقاسات` : ''}`}</p>
          <div style={{ maxHeight: 320, overflow: 'auto', fontSize: 13 }}>
            {log.map((x, i) => (
              <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)', color: x.ok ? 'inherit' : '#b3261e' }}>
                {x.ok ? '✔' : '✘'} {x.name}
                {x.msg ? ` — ${x.msg}` : ''}
              </div>
            ))}
          </div>
          <div className="modal-foot">
            {state === 'run' ? (
              <button type="button" className="secondary" onClick={() => (stop.current = true)}>
                ⏹ وقّف بعد المنتج ده
              </button>
            ) : (
              <button type="button" className="primary" onClick={close}>
                تمام
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
