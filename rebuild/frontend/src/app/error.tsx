'use client';

import { useEffect } from 'react';

/** Any screen that breaks shows this instead of a blank page: the shop keeps working, the owner can try again. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[mk] screen error', error);
  }, [error]);
  return (
    <div className="card" role="alert" style={{ margin: '40px auto', maxWidth: 520, textAlign: 'center', lineHeight: 1.9 }}>
      <h2 style={{ marginTop: 0 }}>حصلت مشكلة في الشاشة دي</h2>
      <p>الشاشة وقعت لوحدها، والبيانات اللي اتسجلت قبل كده مابتتأثرش. جرّب تاني، ولو فضلت تحصل قول لعبده.</p>
      {error.digest && <p dir="ltr" style={{ color: 'var(--muted)', fontSize: 12 }}>رقم المشكلة: {error.digest}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={() => reset()}>
          🔄 جرّب تاني
        </button>
        <button type="button" className="secondary" onClick={() => (window.location.href = '/')}>
          🏠 الرئيسية
        </button>
      </div>
    </div>
  );
}
