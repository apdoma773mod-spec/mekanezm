'use client';

import { useEffect, useRef, useState } from 'react';

/** 📷 ماسح الباركود بالكاميرا (mkScan القديمة): نفس html5-qrcode ونفس الرسايل، وكل مسحة = قطعة لو multi. */
interface Html5Qr {
  start: (cam: unknown, cfg: unknown, ok: (t: string) => void, err: () => void) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
}
declare global {
  interface Window {
    Html5Qrcode?: new (id: string, cfg: { verbose: boolean }) => Html5Qr;
  }
}

const SRC = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
const loadLib = () =>
  new Promise<void>((ok, bad) => {
    if (window.Html5Qrcode) return ok();
    const s = document.createElement('script');
    s.src = SRC;
    s.onload = () => ok();
    s.onerror = () => bad(new Error('مكتبة الكاميرا ماتحمّلتش — اتأكد من النت'));
    document.head.appendChild(s);
  });

function beep() {
  try {
    const c = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 1200;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.09);
    setTimeout(() => void c.close(), 400);
  } catch {
    /* no audio */
  }
}

export function CameraScanner({
  title = 'امسح الباركود',
  multi,
  onCode,
  onClose,
}: {
  title?: string;
  multi?: boolean;
  /** Return false for «not found», a string for a note, anything else for ok. */
  onCode: (code: string) => boolean | string | void | Promise<boolean | string | void>;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState('جاري فتح الكاميرا…');
  const [typed, setTyped] = useState('');
  const scanner = useRef<Html5Qr | null>(null);
  const last = useRef({ t: '', at: 0 });
  const cb = useRef(onCode);
  cb.current = onCode;
  const closing = useRef(false);

  const hit = async (raw: string) => {
    const t = String(raw || '').trim();
    if (!t) return;
    if (t === last.current.t && Date.now() - last.current.at < 1800) return;
    last.current = { t, at: Date.now() };
    beep();
    const r = await cb.current(t);
    setMsg(`${r === false ? '⚠️ ' : '✔ '}${t}${typeof r === 'string' ? ` — ${r}` : ''}`);
    if (!multi) setTimeout(onClose, 250);
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        await loadLib();
        if (dead || !window.Html5Qrcode) return;
        const sc = new window.Html5Qrcode('scanCam', { verbose: false });
        scanner.current = sc;
        await sc.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: (w: number, h: number) => ({ width: Math.min(300, w * 0.85), height: Math.min(150, h * 0.5) }) },
          (t) => void hit(t),
          () => {},
        );
        if (!dead) setMsg(multi ? 'وجّه الكاميرا على الباركود — كل مسحة بتتحسب' : 'وجّه الكاميرا على الباركود');
      } catch (e) {
        const m = String((e as Error)?.message || e);
        setMsg(/Permission|NotAllowed/i.test(m) ? '⚠️ الكاميرا مقفولة — اسمح للموقع يستخدم الكاميرا من إعدادات المتصفح' : /NotFound|no camera/i.test(m) ? '⚠️ مفيش كاميرا — اكتب الكود تحت أو استخدم جهاز الباركود' : `⚠️ ${m}`);
      }
    })();
    return () => {
      dead = true;
      if (closing.current) return;
      closing.current = true;
      const s = scanner.current;
      scanner.current = null;
      if (s) void s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* already cleared */ } });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id="scanBox">
      <div className="sb">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <b>{title}</b>
          <button className="close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div id="scanCam" />
        <div style={{ marginTop: 8, fontSize: 13, color: '#555', minHeight: 20 }}>{msg}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            placeholder="أو اكتب الكود هنا"
            style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 10 }}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void hit(typed);
                setTyped('');
              }
            }}
          />
          <button
            type="button"
            className="primary"
            onClick={() => {
              void hit(typed);
              setTyped('');
            }}
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
}
