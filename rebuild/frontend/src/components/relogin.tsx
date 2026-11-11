'use client';

import { useEffect, useRef, useState } from 'react';
import { setReloginHandler } from '@/lib/api';

/**
 * 🔐 لو الجلسة انتهت وإنت شغال: بدل ما الصفحة تتحمّل من الأول (وكل اللي كتبته يضيع)،
 * بتظهر نافذة دخول صغيرة فوق الشاشة. تدخل، والشاشة والعملية اللي كنت فيها بيكملوا زي ما هما.
 * (الكود اللي بيطلبها: lib/api.ts — setReloginHandler)
 */
export function Relogin() {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const waiters = useRef<((ok: boolean) => void)[]>([]);

  useEffect(() => {
    setReloginHandler(
      () =>
        new Promise<boolean>((resolve) => {
          waiters.current.push(resolve);
          setOpen(true);
        }),
    );
    return () => setReloginHandler(null);
  }, []);

  const done = (ok: boolean) => {
    setOpen(false);
    setPassword('');
    setMsg('');
    const w = waiters.current;
    waiters.current = [];
    w.forEach((r) => r(ok));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      // مباشرة (مش من api.ts) عشان ماندخلش في لفّة 401
      const r = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: login.trim(), password }) });
      if (r.ok) return done(true);
      setMsg(r.status === 401 ? 'رقم الموبايل أو كلمة السر غلط' : 'السيرفر مش بيرد دلوقتي — جرّب تاني بعد لحظة');
    } catch {
      setMsg('مفيش اتصال بالسيرفر — اتأكد من النت وجرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#0f2a2eaa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} style={{ background: 'var(--card,#fff)', borderRadius: 18, padding: 20, width: 'min(380px,100%)', boxShadow: '0 10px 40px #0006' }}>
        <h3 style={{ margin: '0 0 6px' }}>🔐 الجلسة انتهت</h3>
        <p style={{ margin: '0 0 12px', color: '#7b8a90', fontSize: 14 }}>سجّل دخولك وكمّل من نفس المكان — اللي كتبته مش هيضيع.</p>
        <input className="search" style={{ width: '100%', marginBottom: 8 }} dir="ltr" autoComplete="username" placeholder="رقم الموبايل أو الإيميل" value={login} onChange={(e) => setLogin(e.target.value)} />
        <input className="search" style={{ width: '100%', marginBottom: 8 }} dir="ltr" type="password" autoComplete="current-password" placeholder="الرقم السري" value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p style={{ color: '#b3261e', margin: '0 0 8px', fontSize: 14 }}>{msg}</p>}
        <div className="btnrow">
          <button type="submit" className="primary" disabled={busy || !login.trim() || !password}>
            {busy ? '...' : 'دخول وكمّل'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              done(false);
              window.location.assign('/login');
            }}
          >
            صفحة الدخول
          </button>
        </div>
      </form>
    </div>
  );
}
