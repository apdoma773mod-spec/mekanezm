'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useShowMore } from '@/components/ui/tiles';
import { useAllProductInfo, useAllProducts } from '@/lib/trade-queries';
import { errorMessage } from '@/lib/api';
import { fetchSite } from '@/lib/web-queries';
import { useModal } from './modal-host';

/**
 * 📋 «ملفات المنتجات»: في أي وقت تعرف إيه المنتجات اللي ملفها كمل وإيه الناقص — عشان ماتكررش شغل.
 * الملف الكامل = ٣ حاجات: 📷 صورة على الأقل، 📝 وصف مكتوب، 📐 ماركة أو مقاس أو تشطيب.
 * بنعدّ اللي مكتوب في «تفاصيل وصور» أو في منتج الموقع (أيهما فيه).
 */
type Row = { id: string; code: string; name: string; category: string; qty: number; imgs: boolean; descr: boolean; data: boolean; onSite: boolean; done: number };
type Tab = 'all' | 'full' | 'part' | 'empty' | 'site';

export function ProductFiles() {
  const { open, close } = useModal();
  const prods = useAllProducts();
  const infos = useAllProductInfo();
  const site = useQuery({ queryKey: ['product-files-site'], queryFn: fetchSite, staleTime: 60_000 });
  const [tab, setTab] = useState<Tab>('part');
  const [q, setQ] = useState('');

  const rows = useMemo<Row[]>(() => {
    const sp = new Map<string, { imgs: string[]; desc?: string }>();
    for (const p of site.data?.data.products ?? []) if (p.code) sp.set(String(p.code), p);
    return (prods.data ?? []).map((p) => {
      const i = infos.data?.[p.id];
      const s = sp.get(String(p.code));
      const imgs = (i?.imgs?.length ?? 0) > 0 || (s?.imgs?.length ?? 0) > 0;
      const descr = !!i?.descr?.trim() || !!s?.desc?.trim();
      const data = !!(i?.brand?.trim() || i?.size?.trim() || i?.finish?.trim());
      return { id: p.id, code: p.code, name: p.name, category: p.category, qty: p.qty, imgs, descr, data, onSite: !!s, done: Number(imgs) + Number(descr) + Number(data) };
    });
  }, [prods.data, infos.data, site.data]);

  const n = useMemo(() => ({ all: rows.length, full: rows.filter((r) => r.done === 3).length, part: rows.filter((r) => r.done > 0 && r.done < 3).length, empty: rows.filter((r) => r.done === 0).length, site: rows.filter((r) => r.onSite).length }), [rows]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => (tab === 'all' ? true : tab === 'full' ? r.done === 3 : tab === 'part' ? r.done > 0 && r.done < 3 : tab === 'empty' ? r.done === 0 : r.onSite))
      .filter((r) => !t || r.name.toLowerCase().includes(t) || r.code.toLowerCase().includes(t))
      .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name, 'ar'));
  }, [rows, tab, q]);
  const { shown, more } = useShowMore(list, 40, `${tab}|${q}`);

  const tabs: [Tab, string][] = [
    ['part', `⚠️ ناقصة (${n.part})`],
    ['empty', `⭕ فاضية (${n.empty})`],
    ['full', `✅ كاملة (${n.full})`],
    ['site', `🌐 على الموقع (${n.site})`],
    ['all', `الكل (${n.all})`],
  ];
  const chip = (ok: boolean, t: string) => (
    <span key={t} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: ok ? '#e6f6ec' : '#fdecea', color: ok ? '#1e7a3c' : '#b3261e' }}>
      {ok ? '✔' : '✖'} {t}
    </span>
  );

  return (
    <Modal title="📋 ملفات المنتجات" onClose={close} wide>
      {prods.isPending || infos.isPending ? (
        <Loading />
      ) : prods.error || infos.error ? (
        <ErrorBox message={errorMessage(prods.error ?? infos.error)} onRetry={() => { void prods.refetch(); void infos.refetch(); }} />
      ) : (
        <div id="pfiles">
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#7b8a90' }}>
            الملف الكامل = 📷 صورة + 📝 وصف + 📐 ماركة أو مقاس أو تشطيب (من «تفاصيل وصور» أو من منتج الموقع). دوس على المنتج يفتح «تفاصيل وصور».
          </p>
          <div className="btnrow" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {tabs.map(([k, t]) => (
              <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>
                {t}
              </button>
            ))}
          </div>
          <input className="search" style={{ width: '100%', marginBottom: 8 }} placeholder="ابحث باسم المنتج أو الكود..." value={q} onChange={(e) => setQ(e.target.value)} />
          {site.isError && <p style={{ color: '#b3261e', fontSize: 13 }}>مقدرتش أقرا منتجات الموقع — الحساب هنا من «تفاصيل وصور» بس.</p>}
          {!list.length ? (
            <p style={{ padding: 16, textAlign: 'center', color: '#7b8a90' }}>{tab === 'part' && n.part === 0 ? 'مفيش منتجات ناقصة 🎉' : 'مفيش منتجات هنا'}</p>
          ) : (
            shown.map((r) => (
              <button key={r.id} type="button" className="secondary" style={{ display: 'block', width: '100%', textAlign: 'start', marginBottom: 6, padding: '10px 12px' }} onClick={() => open({ kind: 'productDetails', id: r.id })}>
                <b>{r.name}</b> <small style={{ color: '#7b8a90' }}>{r.code}{r.category ? ` · ${r.category}` : ''}{r.onSite ? ' · 🌐' : ''}</small>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {chip(r.imgs, '📷 صورة')}
                  {chip(r.descr, '📝 وصف')}
                  {chip(r.data, '📐 ماركة/مقاس')}
                </div>
              </button>
            ))
          )}
          {more}
        </div>
      )}
    </Modal>
  );
}
