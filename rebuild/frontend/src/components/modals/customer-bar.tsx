'use client';

import { money } from '@/lib/format';
import type { CustTerm } from '@/lib/terms';

/** شريط العميل في فاتورة البيع (ctBar القديم): خصمه، فئته، اللي عليه، وحد دينه. */
export function CustomerBar({ name, term, balance }: { name: string; term?: CustTerm; balance: number }) {
  const over = !!(term?.limit && balance >= term.limit);
  return (
    <div id="ctBar" style={{ margin: '6px 0', padding: '8px 12px', borderRadius: 12, fontSize: 14, fontWeight: 700, lineHeight: 1.8, background: over ? '#fdecec' : '#fff7e0', color: over ? '#b33' : '#7a5200' }}>
      👤 {name}
      {term?.pct ? <> · خصمه <b>{term.pct}%</b></> : null}
      {term?.tier ? ` (${term.tier})` : ''}
      {balance ? <> · عليه دلوقتي <b>{money(balance)}</b></> : null}
      {term?.limit ? <> · حد الدين <b>{money(term.limit)}</b>{over ? ' ⛔ عدّى الحد' : ''}</> : null}
      {term?.note ? (
        <>
          <br />
          <small>📝 {term.note}</small>
        </>
      ) : null}
    </div>
  );
}
