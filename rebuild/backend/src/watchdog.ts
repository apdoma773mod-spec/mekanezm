import { PrismaClient } from '@prisma/client';
import { alertConfig, ALERT_BY } from './lib/alerts.js';

/**
 * 🚨 حارس السيستم: برنامج منفصل (مش جوه السيرفر، عشان لو السيرفر وقع يفضل شغّال) بيفتح /health كل دقيقة.
 * لو فشل ٣ مرات ورا بعض يبعتلك «السيستم واقف»، ولما يرجع يبعتلك «رجع». التنبيه بيروح:
 *  - لتليفونك عن طريق تطبيق ntfy (مجاني) لو حطيت NTFY_TOPIC — ده الوحيد اللي بيوصل حتى لو السيرفر واقع.
 *  - ولطابور الواتساب (OutboundMessage) — بيتبعت أول ما السيرفر والجسر يرجعوا.
 * بيتشغّل: npx tsx --env-file=.env src/watchdog.ts   (WATCH_URLS=http://127.0.0.1:4000/api/v1/health,https://….trycloudflare.com/api/v1/health)
 */
export interface WatchState {
  fails: Map<string, number>;
  down: Map<string, number>; // url → when it was declared down
  lastTold: Map<string, number>;
}
export interface WatchDeps {
  now: () => number;
  ping: (url: string) => Promise<boolean>;
  tell: (text: string) => Promise<void>;
}
export const FAILS_TO_DECLARE = 3;
export const REPEAT_EVERY_MS = 30 * 60_000;

const short = (u: string) => (/127\.0\.0\.1|localhost/.test(u) ? 'السيرفر على الكمبيوتر' : 'الرابط بتاع الموبايل');
const mins = (ms: number) => Math.max(1, Math.round(ms / 60_000));

export async function watchOnce(urls: string[], st: WatchState, d: WatchDeps): Promise<void> {
  for (const u of urls) {
    const ok = await d.ping(u);
    if (ok) {
      st.fails.set(u, 0);
      const since = st.down.get(u);
      if (since) {
        st.down.delete(u);
        st.lastTold.delete(u);
        await d.tell(`✅ ${short(u)} رجع يشتغل (كان واقف ${mins(d.now() - since)} دقيقة)`);
      }
      continue;
    }
    const n = (st.fails.get(u) ?? 0) + 1;
    st.fails.set(u, n);
    if (n < FAILS_TO_DECLARE) continue;
    if (!st.down.has(u)) st.down.set(u, d.now() - (FAILS_TO_DECLARE - 1) * 60_000);
    const last = st.lastTold.get(u) ?? 0;
    if (d.now() - last >= REPEAT_EVERY_MS || !last) {
      st.lastTold.set(u, d.now());
      await d.tell(`🚨 ${short(u)} واقف من ${mins(d.now() - st.down.get(u)!)} دقيقة — السيستم مش بيرد.`);
    }
  }
}

async function main() {
  const urls = (process.env.WATCH_URLS || 'http://127.0.0.1:4000/api/v1/health').split(',').map((s) => s.trim()).filter(Boolean);
  const topic = process.env.NTFY_TOPIC?.trim();
  const db = new PrismaClient();
  const deps: WatchDeps = {
    now: () => Date.now(),
    ping: async (url) => {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return r.ok;
      } catch {
        return false;
      }
    },
    tell: async (text) => {
      console.log(new Date().toISOString(), text);
      if (topic) await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', body: text, headers: { Title: 'ميكانيزم', Priority: '5' } }).catch(() => undefined);
      try {
        for (const to of (await alertConfig(db)).to) await db.outboundMessage.create({ data: { toPhone: to, body: `🔔 تنبيه من السيستم\n${text}`, byName: ALERT_BY } });
      } catch {
        /* the database may be down too: the phone alert above is the one that counts */
      }
    },
  };
  const st: WatchState = { fails: new Map(), down: new Map(), lastTold: new Map() };
  console.log('watchdog on:', urls.join(' , '), topic ? '(+ phone alerts via ntfy)' : '(no phone topic)');
  for (;;) {
    await watchOnce(urls, st, deps).catch((e) => console.error('watch error', e));
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

if (process.argv[1] && /watchdog\.(ts|js)$/.test(process.argv[1])) void main();
