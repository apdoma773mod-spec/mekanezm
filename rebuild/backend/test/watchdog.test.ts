import { describe, expect, it } from 'vitest';
import { watchOnce, type WatchState } from '../src/watchdog.js';

const URL = 'http://127.0.0.1:4000/api/v1/health';
const mk = () => {
  const st: WatchState = { fails: new Map(), down: new Map(), lastTold: new Map() };
  const sent: string[] = [];
  let t = 1_000_000;
  let up = true;
  const deps = { now: () => t, ping: async () => up, tell: async (x: string) => void sent.push(x) };
  return { st, sent, deps, tick: async () => (await watchOnce([URL], st, deps), (t += 60_000)), set: (v: boolean) => (up = v), at: (ms: number) => (t += ms) };
};

describe('watchdog', () => {
  it('says nothing for one or two failures, tells once after three, and says when it is back', async () => {
    const w = mk();
    w.set(false);
    await w.tick();
    await w.tick();
    expect(w.sent).toHaveLength(0);
    await w.tick();
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0]).toContain('🚨');
    await w.tick();
    await w.tick();
    expect(w.sent).toHaveLength(1);
    w.set(true);
    await w.tick();
    expect(w.sent).toHaveLength(2);
    expect(w.sent[1]).toContain('✅');
  });

  it('a short blip does not count, and it repeats after half an hour while still down', async () => {
    const w = mk();
    w.set(false);
    await w.tick();
    w.set(true);
    await w.tick();
    w.set(false);
    await w.tick();
    await w.tick();
    expect(w.sent).toHaveLength(0);
    await w.tick();
    expect(w.sent).toHaveLength(1);
    w.at(31 * 60_000);
    await w.tick();
    expect(w.sent).toHaveLength(2);
  });
});
