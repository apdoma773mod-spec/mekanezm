'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { usePunch } from '@/lib/phase4-queries';
import { Modal } from './ui/modal';

const KEY = 'mkPunch';
const hm = (t: string) => new Date(t).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' });

/**
 * The employee photographed the shop's QR: the link opens with `#punch=<code>`. The code is kept
 * for a few minutes (in case the login screen came first) and sent once the app is signed in.
 */
export function PunchCatcher() {
  const punch = usePunch();
  const [msg, setMsg] = useState<{ ic: string; t: string; s: string } | null>(null);

  useEffect(() => {
    const grab = () => {
      const m = window.location.hash.match(/punch=([0-9a-f]{6,40})/i);
      if (m) {
        try {
          sessionStorage.setItem(KEY, JSON.stringify({ c: m[1], t: Date.now() }));
        } catch {
          /* private mode */
        }
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      let p: { c: string; t: number } | null = null;
      try {
        p = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        sessionStorage.removeItem(KEY);
      } catch {
        p = null;
      }
      if (!p) return;
      if (Date.now() - p.t > 3 * 60_000) return setMsg({ ic: '⚠️', t: 'ماتسجلش', s: 'الكود قديم — صوّر الكود اللي على الشاشة تاني' });
      punch
        .mutateAsync(p.c)
        .then((d) =>
          setMsg(
            d.kind === 'in'
              ? { ic: '✅', t: `أهلاً يا ${d.name} — اتسجل حضورك`, s: `${hm(d.at)}${d.late > 10 ? ` · متأخر ${d.late} دقيقة ⏰` : ' · في ميعادك 👌'}` }
              : { ic: '👋', t: `مع السلامة يا ${d.name}`, s: `اتسجل انصرافك ${hm(d.at)}` },
          ),
        )
        .catch((e) => setMsg({ ic: '⚠️', t: 'ماتسجلش', s: errorMessage(e) }));
    };
    grab();
    window.addEventListener('hashchange', grab);
    return () => window.removeEventListener('hashchange', grab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!msg) return null;
  return (
    <Modal title="" onClose={() => setMsg(null)}>
      <div style={{ textAlign: 'center', padding: '26px 10px' }}>
        <div style={{ fontSize: 64 }}>{msg.ic}</div>
        <h2 style={{ margin: '8px 0', fontSize: 24 }}>{msg.t}</h2>
        <p style={{ color: '#6b7c82', fontSize: 16, margin: 0 }}>{msg.s}</p>
        <button type="button" className="primary" style={{ marginTop: 18 }} onClick={() => setMsg(null)}>
          تمام
        </button>
      </div>
    </Modal>
  );
}
