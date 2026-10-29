'use client';

import type { ReactNode } from 'react';
import type { InboxTab } from '@/lib/inbox-queries';

/** The old «جديدة / اتعملها / متجاهلة» tabs of the inbox screens. */
export function InboxTabs({
  value,
  onChange,
  counts,
}: {
  value: InboxTab;
  onChange: (t: InboxTab) => void;
  counts?: Partial<Record<InboxTab, number>>;
}) {
  const tabs: [InboxTab, string][] = [
    ['new', 'جديدة'],
    ['done', 'اتعملها'],
    ['other', 'متجاهلة'],
  ];
  return (
    <div className="toolbar">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" className={value === k ? 'primary' : 'secondary'} onClick={() => onChange(k)}>
          {label}
          {counts?.[k] ? ` (${counts[k]})` : ''}
        </button>
      ))}
    </div>
  );
}

export function InboxCard({ children, tone }: { children: ReactNode; tone?: 'new' | 'done' | 'other' }) {
  const border = tone === 'new' ? '2px solid var(--danger)' : '1px solid var(--border)';
  return (
    <div className="card" style={{ marginBottom: 10, padding: 12, border }}>
      {children}
    </div>
  );
}
