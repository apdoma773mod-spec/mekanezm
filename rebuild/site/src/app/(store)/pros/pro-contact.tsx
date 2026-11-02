'use client';
import { proWa } from '@/lib/pros';
import { ev } from '@/lib/track';

/** WhatsApp + call buttons for a recommended craftsman (taps are counted as leads). */
export function ProContact({ id, name, phone, msg = '' }: { id: string; name: string; phone: string; msg?: string }) {
  const hit = (m: string) => ev('contact', 'Contact', { method: m, pro: id }, { content_name: name });
  const text = `أهلاً ${name}، وصلتلك من موقع ميكانيزم.${msg ? ' ' + msg : ''}`;
  return (
    <div className="pro-act">
      <a className="pri" href={proWa(phone, text)} target="_blank" rel="noopener" onClick={() => hit('whatsapp')}>💬 كلّمه واتساب</a>
      <a className="sec" href={'tel:' + phone.replace(/\s/g, '')} onClick={() => hit('phone')}>📞 اتصل</a>
    </div>
  );
}
