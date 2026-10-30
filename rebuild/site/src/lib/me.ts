// The customer's name/phone, remembered on their phone so they type them once (cart, price request, trade form…).
const K = 'mk_me';
export type Me = { name: string; phone: string };

export function getMe(): Me {
  try { const j = JSON.parse(localStorage.getItem(K) || '{}'); return { name: String(j.name ?? ''), phone: String(j.phone ?? '') }; } catch { return { name: '', phone: '' }; }
}
export function saveMe(m: Partial<Me>) {
  try { localStorage.setItem(K, JSON.stringify({ ...getMe(), ...Object.fromEntries(Object.entries(m).filter(([, v]) => v && String(v).trim())) })); } catch { /* */ }
}
