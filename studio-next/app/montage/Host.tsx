'use client';
import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// بيجهّز البيئة اللي المحرك محتاجها (window.supabase / __KV / toast) وبعدين يشغّل المحرك جوه #mk-host.
export default function Host() {
  useEffect(() => {
    const w = window as any;
    w.supabase = { createClient };
    if (!w.__KV) {
      const KV = new Map<string, string>();
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; KV.set(k, localStorage.getItem(k)!); } } catch {}
      w.__KV = KV; w.__put = (k: string, v: string) => { KV.set(k, v); try { localStorage.setItem(k, v); } catch {} };
    }
    w.toast = (m: string) => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.style.display = 'block'; clearTimeout((t as any)._); (t as any)._ = setTimeout(() => (t.style.display = 'none'), 2800); };
    w.__ready = Promise.resolve();
    let off = false;
    import('@/lib/montage/engine').then(m => {
      if (off || document.getElementById('v-smart')) return;
      m.startEngine();
      setTimeout(() => (document.getElementById('mk-go') as HTMLElement | null)?.click(), 60);
    });
    document.body.classList.add('mk-montage');
    return () => { off = true; document.body.classList.remove('mk-montage'); };
  }, []);
  return (
    <>
      <main style={{ marginRight: 0, maxWidth: 1150, marginInline: 'auto' }}>
        <p><a href="/shell" style={{ color: 'var(--a2)' }}>← رجوع للستوديو</a></p>
        <div id="mk-host" />
        <button id="mk-go" data-go="smart" hidden />
      </main>
      <div id="toast" />
    </>
  );
}
