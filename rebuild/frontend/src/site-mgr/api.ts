// شاشات «إدارة الموقع» جوه السيستم بتحفظ في بيانات الموقع على سيرفر السيستم (نفس اللي الموقع بيقرا منه) — مش Supabase القديم.
import { api } from '@/lib/api';
import { fetchSite, saveSite } from '@/lib/web-queries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any>;
export type SiteDoc = { data: Rec; version: number };

export const loadDoc = async (): Promise<SiteDoc> => {
  const d = await fetchSite();
  return { data: d.data as Rec, version: d.version };
};

/** Read the newest version, apply `edit` to a copy, save it only if nobody saved in between (saveSite retries). */
export async function saveDoc(edit: (d: Rec) => void, allow: ('products' | 'works' | 'reviews' | 'pros')[] = []): Promise<SiteDoc> {
  const d = await saveSite((x) => {
    const r = x as Rec;
    const before = Object.fromEntries((['products', 'works', 'reviews', 'pros'] as const).map((k) => [k, r[k]?.length ?? 0]));
    edit(r);
    // أمان: الشاشة اللي مسؤولة عن المنتجات/الأعمال/الآراء/الفنيين بس هي اللي تضيف أو تشيل منهم
    for (const k of ['products', 'works', 'reviews', 'pros'] as const) {
      if (!allow.includes(k) && before[k] !== (r[k]?.length ?? 0)) throw new Error('الحفظ اتلغى: كان هيغيّر في ' + k);
    }
  });
  return { data: d.data as Rec, version: d.version };
}

/** Upload a photo to the system's files; the site gets its full address from the server. */
export async function uploadImage(blob: Blob): Promise<string> {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const data = await new Promise<string>((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => bad(new Error('مقدرتش أقرا الصورة'));
    r.readAsDataURL(blob);
  });
  return (await api.post<{ url: string }>('/work/files', { data, ext })).url;
}

/** الموقع بيتحدّث لوحده خلال دقيقة من آخر حفظ (بيقرا من السيرفر). */
export const publishNow = () => undefined;

export const SITE_URL = 'https://mekanezm.vercel.app';
