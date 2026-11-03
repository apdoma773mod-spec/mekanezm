import { createClient } from '@supabase/supabase-js';
// مفاتيح عامة (publishable) — نفس اللي في النسخة القديمة
export const SB_URL = 'https://rzvncstjattlklpdtkfn.supabase.co';
export const SB_KEY = 'sb_publishable_Molr1fCzsC-VbSgTFDXc5w_F1p0-Fcr';
let c: ReturnType<typeof createClient> | null = null;
export const sb = () => (c ??= createClient(SB_URL, SB_KEY, { auth: { storageKey: 'mkz-studio-auth', persistSession: true, autoRefreshToken: true } }));

export const kv = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('kv:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('kv:' + k, JSON.stringify(v)); } catch {} },
};
