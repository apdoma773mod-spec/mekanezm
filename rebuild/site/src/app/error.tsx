'use client';
// Friendly message instead of a broken page if something fails while rendering (and report it).
import { useEffect } from 'react';
import { reportError } from '@/lib/track';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError('render: ' + error.message + (error.digest ? ' #' + error.digest : ''), error.stack); }, [error]);
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
      <div>
        <p style={{ fontSize: 48, margin: 0 }}>😕</p>
        <h1 style={{ fontSize: 22 }}>حصلت مشكلة صغيرة في تحميل الصفحة</h1>
        <p className="mut">جرّب تاني، ولو فضلت كلّمنا على الواتساب.</p>
        <button className="pri" onClick={reset} style={{ margin: 6 }}>🔄 جرّب تاني</button>
        <a className="sec" href="/" style={{ display: 'inline-block', margin: 6, textDecoration: 'none' }}>🏠 الرئيسية</a>
      </div>
    </div>
  );
}
