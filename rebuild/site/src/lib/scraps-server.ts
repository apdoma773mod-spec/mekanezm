import 'server-only';
import type { Scrap } from './scraps';

/** All active offcut listings (no names / phones), from the system backend. Cached 30 s; empty if it is unreachable. */
export async function getScraps(): Promise<Scrap[]> {
  try {
    const base = process.env.BACKEND_URL?.replace(/\/$/, '');
    if (!base) return [];
    const r = await fetch(base + '/api/v1/web/scraps', {
      headers: { 'ngrok-skip-browser-warning': '1' },
      next: { revalidate: 30, tags: ['scraps'] },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? (j as Scrap[]) : [];
  } catch { return []; }
}
