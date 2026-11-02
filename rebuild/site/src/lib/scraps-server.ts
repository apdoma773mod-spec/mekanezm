import 'server-only';
import { SB_KEY, SB_URL } from './config';
import type { Scrap } from './scraps';

/** All active offcut listings (no names / phones). Cached 30 s; empty if the table does not exist yet. */
export async function getScraps(): Promise<Scrap[]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/scrap_list`, {
      method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: '{}',
      next: { revalidate: 30, tags: ['scraps'] },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? (j as Scrap[]) : [];
  } catch { return []; }
}
