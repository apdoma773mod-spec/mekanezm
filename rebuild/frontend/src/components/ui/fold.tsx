'use client';

import { useState, type ReactNode } from 'react';

/**
 * 🗂️ كارت بيتطوي — القاعدة العامة لأي شاشة طويلة: العنوان باين دايمًا ومعاه ملخص سطر واحد وهو مقفول،
 * والسيستم بيفتكر الكارت مفتوح ولا مقفول (لكل شاشة). التخزين لو مقفول بيشتغل عادي من غير ما يفتكر.
 * الحقول والأزرار جوه الكارت زي ما هي — بيتخبّوا بس.
 */
export function Fold({ k, title, hint, open0 = false, force = false, className = '', children }: { k: string; title: ReactNode; hint?: ReactNode; open0?: boolean; /** مفتوح غصب: جواه خطأ أو اختيار محتاج حقوله */ force?: boolean; className?: string; children: ReactNode }) {
  const [on, setOn] = useState(() => {
    try {
      const s = localStorage.getItem(`mkFold:${k}`);
      return s ? s === '1' : open0;
    } catch {
      return open0;
    }
  });
  return (
    <details
      className={`mk-fold ${className}`.trim()}
      open={on || force}
      onToggle={(e) => {
        const o = e.currentTarget.open;
        if (force) return; // مفتوح غصب: مايتسجلش في الذاكرة لا فتح ولا قفل
        setOn(o);
        try {
          localStorage.setItem(`mkFold:${k}`, o ? '1' : '0');
        } catch {
          /* التخزين مقفول: الكارت بيشتغل عادي من غير ما يفتكر */
        }
      }}
    >
      <summary>
        <span>{title}</span>
        {hint != null && hint !== '' && <small>{hint}</small>}
      </summary>
      <div className="mk-fold-b">{children}</div>
    </details>
  );
}
