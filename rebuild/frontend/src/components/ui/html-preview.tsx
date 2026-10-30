'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * previewInvoice() القديمة: الفاتورة بعرض A4 (794px) متصغّرة على عرض الشاشة جوه شباك، من غير PDF ولا طباعة.
 * بتترسم في إطار لوحدها عشان ستايلها وخطوطها تفضل زي الطباعة بالظبط.
 */
export function HtmlPreview({ html, width = 794 }: { html: string; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [k, setK] = useState(0.4);
  const [h, setH] = useState(1123);

  useEffect(() => {
    const fit = () => setK(Math.min(1, (box.current?.clientWidth || 340) / width));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [width]);

  const measure = () => {
    const d = frame.current?.contentDocument;
    if (d?.documentElement) setH(Math.max(400, d.documentElement.scrollHeight));
  };

  return (
    <div ref={box} style={{ overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10, background: '#fff', position: 'relative', height: Math.ceil(h * k) }}>
      <iframe
        ref={frame}
        title="معاينة الفاتورة"
        srcDoc={html}
        onLoad={() => {
          measure();
          // fonts and the logo can still change the height after load
          setTimeout(measure, 600);
        }}
        style={{ width, height: h, border: 0, position: 'absolute', top: 0, right: 0, transform: `scale(${k})`, transformOrigin: 'top right', pointerEvents: 'none' }}
      />
    </div>
  );
}
