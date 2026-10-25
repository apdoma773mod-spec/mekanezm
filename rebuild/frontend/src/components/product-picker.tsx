'use client';

import { useEffect, useId, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { qtyText } from '@/lib/format';
import { useProducts } from '@/lib/trade-queries';

interface Props {
  label: string;
  value: ProductDto | null;
  onPick: (p: ProductDto | null) => void;
  error?: string;
}

/** Search-as-you-type product field: name, code or barcode. */
export function ProductPicker({ label, value, onPick, error }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);
  const results = useProducts({ q, pageSize: 12 }, !value && q.length >= 1);

  return (
    <div className="field full">
      <label htmlFor={id}>{label}</label>
      {value ? (
        <div className="txl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <span>
            <b>{value.name}</b>{' '}
            <small style={{ color: '#7a8a8f' }}>
              ({qtyText(value.qty)} {value.unit})
            </small>
          </span>
          <button type="button" className="secondary" onClick={() => onPick(null)}>
            تغيير
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            autoComplete="off"
            placeholder="اكتب اسم الصنف أو كوده..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={error ? 'bad' : ''}
          />
          {q && (
            <div className="txbox">
              {results.isPending ? (
                <div style={{ color: '#888' }}>⏳</div>
              ) : results.data?.items.length ? (
                results.data.items.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onPick(p);
                      setText('');
                    }}
                  >
                    {p.name}{' '}
                    <small style={{ color: '#7a8a8f' }}>
                      — {qtyText(p.qty)} {p.unit}
                    </small>
                  </div>
                ))
              ) : (
                <div style={{ color: '#888' }}>مفيش صنف بالاسم ده</div>
              )}
            </div>
          )}
        </>
      )}
      {error && <span className="err">{error}</span>}
    </div>
  );
}
