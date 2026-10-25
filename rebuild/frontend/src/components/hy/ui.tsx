'use client';

import type { CSSProperties, ReactNode } from 'react';

/** The old Hydrolek screen's building blocks (F, B, card, kv, chip), same sizes for thumbs on a phone. */
export const IN: CSSProperties = {
  width: '100%',
  padding: 14,
  border: '1.5px solid var(--border,#e4eaed)',
  borderRadius: 12,
  background: 'var(--card,#fff)',
  color: 'inherit',
  fontSize: 16,
  marginTop: 4,
  boxSizing: 'border-box',
};

export function Label({ children }: { children: ReactNode }) {
  return <label style={{ display: 'block', marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>{children}</label>;
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: { label: string; value: string | number; onChange: (v: string) => void; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={IN} {...rest} />
    </>
  );
}

export function Area({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <>
      <Label>{label}</Label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...IN, minHeight: 110 }} />
    </>
  );
}

export function Sel({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={IN}>
        {children}
      </select>
    </>
  );
}

export function Btn({ children, onClick, pri, col, disabled }: { children: ReactNode; onClick: () => void; pri?: boolean; col?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        padding: 15,
        borderRadius: 12,
        fontWeight: 800,
        fontSize: 16,
        marginTop: 12,
        ...(pri ? { background: col || 'var(--blue,#087f8c)', color: '#fff', border: 0 } : { background: 'var(--card,#fff)', border: '1.5px solid var(--border,#e4eaed)', color: 'inherit' }),
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: 'var(--card,#fff)', border: '1px solid var(--border,#e4eaed)', borderRadius: 14, padding: 14, margin: '10px 0', ...style }}>{children}</div>;
}

export function KV({ l, v, c }: { l: ReactNode; v: ReactNode; c?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px dashed var(--border,#e4eaed)' }}>
      <span style={{ color: 'var(--muted)' }}>{l}</span>
      <b style={c ? { color: c } : undefined}>{v}</b>
    </div>
  );
}

export function Chip({ t, c }: { t: ReactNode; c: string }) {
  return (
    <span style={{ display: 'inline-block', color: '#fff', background: c, borderRadius: 99, padding: '3px 12px', fontSize: 13, fontWeight: 700, margin: '3px 3px 0 0' }}>{t}</span>
  );
}

export function Pills<T extends string>({ value, onChange, options, flex }: { value: T; onChange: (v: T) => void; options: [T, string][]; flex?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, ...(flex ? {} : { overflowX: 'auto' }) }}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          style={{
            flex: flex ? 1 : 'none',
            padding: flex ? '13px 4px' : '10px 14px',
            borderRadius: flex ? 12 : 99,
            fontWeight: 800,
            border: `2px solid ${value === k ? 'var(--blue,#087f8c)' : 'var(--border)'}`,
            background: value === k ? 'var(--blue,#087f8c)' : 'transparent',
            color: value === k ? '#fff' : 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** The old bottom sheet with a grab handle. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.45)', direction: 'rtl' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '90vh',
          background: 'var(--bg,#f5f7f8)',
          color: 'var(--text,#18343a)',
          borderRadius: '22px 22px 0 0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 30px rgba(0,0,0,.3)',
        }}
      >
        <div style={{ flex: 'none', padding: '12px 0 8px' }}>
          <div style={{ width: 64, height: 7, borderRadius: 99, background: 'var(--border,#b8c4c8)', margin: '0 auto' }} />
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 8px' }}>
          <b style={{ fontSize: 18, flex: 1 }}>{title}</b>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card,#fff)', color: 'inherit', fontWeight: 800, fontSize: 16 }}>
            ✕ قفل
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

export const num = (v: string | number) => {
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
export const nq = (n: number) => (Math.round((+n || 0) * 100) / 100).toLocaleString('ar-EG');
export const ago = (t: string | null) => {
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000));
  return m < 1 ? 'دلوقتي' : m < 60 ? `من ${m} دقيقة` : m < 1440 ? `من ${Math.round(m / 60)} ساعة` : `من ${Math.round(m / 1440)} يوم`;
};
export const waNum = (p: string) => {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `2${d}`;
  return d;
};
export function csvSave(name: string, head: string[], rows: (string | number)[][]) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([`﻿${[head, ...rows].map((r) => r.map(q).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
