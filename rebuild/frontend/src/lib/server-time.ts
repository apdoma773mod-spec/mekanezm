import { api } from './api';

/**
 * ⏱️ ساعة السيرفر: الجرد بيتحسب على «وقت العد»، ولازم يبقى بنفس ساعة السيرفر اللي بتسجّل البيع —
 * ساعة تليفون متأخرة أو مقدّمة كام دقيقة كانت هتخلّي بيع يتحسب قبل العد أو بعده بالغلط.
 * بنقيس الفرق بين ساعة الجهاز والسيرفر (من نص زمن الطلب) ونصلّح بيه كل وقت بنسجّله.
 */
let skew = 0;
let at = 0;

export async function syncServerTime(force = false): Promise<void> {
  if (!force && at && Date.now() - at < 10 * 60_000) return;
  try {
    const t0 = Date.now();
    const r = await api.get<{ time: string }>('/health');
    const t1 = Date.now();
    const s = Date.parse(r.time);
    if (!Number.isNaN(s)) {
      skew = s - (t0 + t1) / 2;
      at = t1;
    }
  } catch {
    /* بنكمّل بآخر فرق معروف */
  }
}

/** الوقت دلوقتي بساعة السيرفر (ISO) */
export const serverNowIso = () => new Date(Date.now() + skew).toISOString();
