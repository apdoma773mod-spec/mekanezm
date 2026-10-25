'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CO_NAME } from '@mk/shared';
import { useToast } from './ui/toast';

export type Co = 'MK' | 'HY';
const KEY = 'mk_co';
const COL: Record<Co, string> = { MK: '#1d3fb8', HY: '#d97706' };

const Ctx = createContext<{ co: Co; setCo: (c: Co) => void }>({ co: 'MK', setCo: () => {} });

/** The old curCo(): which company new invoices, products and expenses belong to on this device. */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const [co, setCoState] = useState<Co>('MK');
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'HY' || v === 'hy') setCoState('HY');
    } catch {
      /* private mode */
    }
  }, []);
  const setCo = useCallback((c: Co) => {
    setCoState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* private mode */
    }
  }, []);
  const v = useMemo(() => ({ co, setCo }), [co, setCo]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const useCompany = () => useContext(Ctx);

/** «🏬 ميكانيزم / 🔧 هيدرولك» at the top of the dashboard. */
export function CompanyBar() {
  const { co, setCo } = useCompany();
  const toast = useToast();
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', marginBottom: 8 }}>
      {(['MK', 'HY'] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            setCo(k);
            toast(`شغّال على ${CO_NAME[k]}`);
          }}
          style={{
            flex: 1,
            padding: '12px 6px',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 15,
            border: `2px solid ${COL[k]}`,
            background: k === co ? COL[k] : 'transparent',
            color: k === co ? '#fff' : COL[k],
          }}
        >
          {k === 'MK' ? '🏬' : '🔧'} {CO_NAME[k]}
        </button>
      ))}
    </div>
  );
}
