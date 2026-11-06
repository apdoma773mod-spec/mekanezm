'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { lookupProduct, useAllProductInfo } from '@/lib/trade-queries';
import { money, qtyText } from '@/lib/format';
import { useAddWanted } from '@/lib/phase4-queries';
import { useIsAdmin } from '../use-role';
import { useToast } from '../ui/toast';

interface Match {
  code: string;
  score: number;
  why: string;
}
interface Found {
  seen: string;
  matches: { m: Match; p: ProductDto }[];
}

/**
 * «📷 صوّر القطعة يطلعلك الصنف» (old mkVS.pick/run/show): a photo of a part → the 3 closest shop products
 * (server `/ai/match-product`). Not found → «🔎 مش موجود عندي — سجّله مطلوب». `ctx` 'tx' = inside a sale/purchase window.
 */
export function PhotoSearch({ ctx, onPick, onClose }: { ctx: 'prod' | 'tx'; onPick: (p: ProductDto) => void; onClose: () => void }) {
  const toast = useToast();
  const admin = useIsAdmin();
  const infos = useAllProductInfo().data;
  const addWanted = useAddWanted();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ phase: 'idle' | 'busy' | 'done' | 'error'; big?: string; thumb?: string; found?: Found; error?: string }>({ phase: 'idle' });

  const run = async (file: File) => {
    let big: string;
    let thumb: string;
    try {
      big = await fileToDataUrl(file, 1024);
      thumb = await fileToDataUrl(file, 220);
    } catch (e) {
      toast(errorMessage(e), 'bad');
      return;
    }
    setState({ phase: 'busy', big, thumb });
    try {
      const r = await api.post<{ seen: string; matches: Match[] }>('/ai/match-product', { image: big, media_type: 'image/jpeg' });
      const matches = (
        await Promise.all(
          r.matches.map(async (m) => {
            try {
              return { m, p: await lookupProduct(m.code) };
            } catch {
              return null;
            }
          }),
        )
      ).filter((x): x is { m: Match; p: ProductDto } => !!x);
      setState({ phase: 'done', big, thumb, found: { seen: r.seen, matches } });
    } catch (e) {
      setState({ phase: 'error', big, thumb, error: errorMessage(e) });
    }
  };

  // open the camera / gallery straight away, like the old pick()
  useEffect(() => {
    fileRef.current?.click();
  }, []);

  const again = () => fileRef.current?.click();
  const want = async () => {
    try {
      await addWanted.mutateAsync({ descr: state.found?.seen || 'قطعة من صورة', thumb: state.thumb ?? '', source: 'المحل', phone: '' });
      toast('✔ اتسجلت في «مطلوب ومش عندنا»');
      onClose();
    } catch (e) {
      toast(`ماتسجلتش: ${errorMessage(e)}`, 'bad');
    }
  };

  const head = (t: string) => (
    <div className="vsh">
      <b>{t}</b>
      <button type="button" className="secondary" onClick={onClose}>
        ✕
      </button>
    </div>
  );

  return (
    <div id="vsBox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="vs">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ position: 'fixed', left: -9999, top: 0, opacity: 0 }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void run(f);
          }}
        />
        {state.phase === 'idle' && (
          <>
            {head('📷 صوّر القطعة')}
            <div className="vsseen">اختار صورة القطعة وأنا أدوّر عليها في أصنافك.</div>
            <div className="vsb">
              <button type="button" className="primary" onClick={again}>
                📷 صوّر / اختار صورة
              </button>
            </div>
          </>
        )}
        {state.phase === 'busy' && (
          <>
            {head('📷 بدوّر على القطعة…')}
            <img className="vsph" src={state.big} alt="" />
            <div className="vsseen">⏳ الذكاء الاصطناعي بيشوف الصورة ويقارنها بأصنافك… (ثواني)</div>
          </>
        )}
        {state.phase === 'error' && (
          <>
            {head('📷 صوّر القطعة')}
            <img className="vsph" src={state.big} alt="" />
            <div className="vsseen" style={{ background: '#ffe4e8' }}>
              ماعرفتش أدوّر: {state.error}
            </div>
            <div className="vsb">
              <button type="button" className="primary" onClick={again}>
                صوّر تاني
              </button>
            </div>
          </>
        )}
        {state.phase === 'done' && state.found && (
          <>
            {head('📷 القطعة دي…')}
            <img className="vsph" src={state.big} alt="" />
            {state.found.seen && <div className="vsseen">👁️ {state.found.seen}</div>}
            {state.found.matches.length ? (
              <>
                <b style={{ fontSize: 15 }}>أقرب أصناف عندك:</b>
                {state.found.matches.map(({ m, p }) => {
                  const im = infos?.[p.id]?.imgs?.[0];
                  const loc = infos?.[p.id]?.loc;
                  const sc = Math.round(m.score);
                  return (
                    <div key={p.id} className="vsm">
                      {im ? <img src={im} alt="" /> : <div className="ni">📦</div>}
                      <div className="t">
                        <b>{p.name}</b> {sc > 0 && <span className={`s ${sc >= 70 ? '' : sc >= 40 ? 'm' : 'l'}`}>{sc}%</span>}
                        <small>
                          كود {p.code} · {p.qty <= 0 ? <span style={{ color: '#c0392b' }}>نفد</span> : `متاح ${qtyText(p.qty)} ${p.unit}`}
                          {loc ? ` · ${loc}` : ''}
                          {admin || ctx === 'tx' ? ` · ${money(p.price)}` : ''}
                        </small>
                        {m.why && <small>{m.why}</small>}
                      </div>
                      <button type="button" className="primary" style={{ flex: 'none' }} onClick={() => onPick(p)}>
                        {ctx === 'tx' ? 'أضفه' : 'افتحه'}
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="vsseen" style={{ background: '#fff7e6' }}>
                مالقيتش صنف شبهها في أصنافك.
              </div>
            )}
            <div className="vsb">
              <button type="button" className="secondary" onClick={again}>
                📷 صوّر تاني
              </button>
              <button type="button" className="secondary danger" disabled={addWanted.isPending} onClick={want}>
                🔎 مش موجود عندي — سجّله مطلوب
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
