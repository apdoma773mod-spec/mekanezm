'use client';
// «مفتوح دلوقتي / مقفول» badge from the shop hours, in Cairo time (shown after load, so cached pages stay correct).
import { useEffect, useState } from 'react';
import { OPENING } from '@/lib/config';

function status(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(now).map(p => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), h = Number(parts.hour);
  const open = !OPENING.closedDays.includes(day) && h >= OPENING.open && h < OPENING.close;
  return open ? { open, t: 'مفتوح دلوقتي' } : { open, t: OPENING.closedDays.includes(day) ? 'مقفول النهارده (إجازة) — اطلب أونلاين' : `مقفول دلوقتي — بنفتح الساعة ${OPENING.open}` };
}

export function OpenNow() {
  const [s, setS] = useState<{ open: boolean; t: string } | null>(null);
  useEffect(() => { setS(status()); const t = setInterval(() => setS(status()), 60000); return () => clearInterval(t); }, []);
  if (!s) return null;
  return <span className={'opn' + (s.open ? ' on' : '')}><i />{s.t}</span>;
}
