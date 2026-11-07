// الذكاء: بيبعت الصوت لدالة Supabase video-ai (مفتاح Gemini على السيرفر) ويرجّع كلام وأحداث. نقل من smart.js.
import { SB_URL, SB_KEY, sb, kv } from '@/lib/supabase';
import { wav64, splitPoints, pcmFromFile } from './audio';
import { vad } from './vad';
import { en, type Analysis, type Seg, type Ev } from './takes';

export const GLOS0 = ['ميكانيزم', 'دريسنج روم', 'أكر', 'سوفت كلوز', 'دلفة', 'جرار', 'باسكت قمامة', 'دولاب سوبر ماركت', 'خزنة بصمة', 'قطاع ألمنيوم', 'مقبض', 'كالون', 'فصالة', 'سكة'];
export const gloss = (): string[] => { let L: unknown = []; try { L = JSON.parse(localStorage.getItem('mkz-gloss') || '[]'); } catch {} return Array.from(new Set(GLOS0.concat(Array.isArray(L) ? (L as string[]) : []))).slice(0, 150); };
const prods = (): { nm?: string }[] => { const L = kv.get<unknown>('prods', []); return Array.isArray(L) ? L : []; };

export async function token(): Promise<string> {
  const { data } = await sb().auth.getSession();
  if (!data.session) throw new Error('LOGIN');
  return data.session.access_token;
}

export async function callAI(b64: string, offset: number, first: boolean, tok: string) {
  const r = await fetch(SB_URL + '/functions/v1/video-ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: SB_KEY },
    body: JSON.stringify({ audio: b64, mime: 'audio/wav', offset, first, products: prods().map(p => p.nm).filter(Boolean), gloss: gloss() }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

/** نتيجة الذكاء لكل جزء → كلام وأحداث بتوقيت الفيديو كله. */
export function mergeAI(res: any[], offs: number[]): { title: string; seg: Seg[]; ev: Ev[] } {
  const seg: Seg[] = [], ev: Ev[] = []; let title = '';
  res.forEach((r, i) => {
    const off = offs[i]; if (i === 0) title = r.title || '';
    (r.segments || []).forEach((x: any) => { if (String(x.t || '').trim()) seg.push({ s: off + (+x.s || 0), e: off + (+x.e || +x.s + 1), t: String(x.t).trim(), cut: !!x.cut, kw: Array.isArray(x.kw) ? x.kw.map(String).filter(Boolean).slice(0, 3) : [] }); });
    (r.events || []).forEach((x: any) => { if (String(x.label || '').trim()) ev.push({ s: off + (+x.s || 0), e: off + (+x.e || 0), type: String(x.type || 'point'), label: String(x.label).trim(), value: en(x.value || ''), unit: String(x.unit || ''), scene: String(x.scene || ''), action: String(x.action || ''), on: true }); });
  });
  seg.sort((a, b) => a.s - b.s); ev.sort((a, b) => a.s - b.s);
  return { title, seg, ev };
}

/** الملف كله: صوت ← أجزاء ~٤٠ ثانية (٣ مع بعض، ٣ محاولات) ← دمج + أماكن الكلام. */
export async function analyze(file: File, prog: (m: string) => void = () => {}): Promise<Analysis> {
  const tok = await token();
  const f32 = await pcmFromFile(file, prog), pts = splitPoints(f32, 40), jobs: { i: number; a: number; b: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) jobs.push({ i, a: pts[i], b: pts[i + 1] });
  const res: any[] = new Array(jobs.length); let done = 0;
  const run = async (j: { i: number; a: number; b: number }) => {
    for (let k = 0; ; k++) {
      try { res[j.i] = await callAI(wav64(f32.subarray(j.a, j.b)), j.a / 16000, j.i === 0, tok); break; }
      catch (e: any) { if (k >= 2 || /LOGIN|دخول|مفتاح Gemini|API key/.test(e.message)) throw e; await new Promise(r => setTimeout(r, 2500 * (k + 1))); }
    }
    done++; prog('🧠 بفهم الكلام… ' + done + ' من ' + jobs.length);
  };
  prog('🧠 بفهم الكلام… 0 من ' + jobs.length);
  for (let i = 0; i < jobs.length; i += 3) await Promise.all(jobs.slice(i, i + 3).map(run));
  return Object.assign(mergeAI(res, jobs.map(j => j.a / 16000)), { dur: f32.length / 16000, vad: vad(f32), ch: jobs.map(j => [j.a / 16000, j.b / 16000] as [number, number]) });
}
