import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** The old mk_settings documents (points, follow, reservations, combos, usd, plists, credit…): one JSON value per key. */
export type KvKey = 'points' | 'follow' | 'reservations' | 'combos' | 'usd' | 'plists' | 'credit';

/** 🚦 حد الآجل (تبويب «حد الآجل» في تحليلات ذكية): حد لكل عميل وحد افتراضي، للمدير. */
export const useCreditLimits = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ['kv', 'credit'],
    queryFn: ({ signal }) => api.get<{ value: { def: number; lim: Record<string, number> } | null }>('/work/kv/credit', undefined, signal).then((r) => r.value ?? { def: 0, lim: {} }),
    staleTime: 60_000,
  });

export function useKv<T>(key: KvKey, def: T) {
  const qc = useQueryClient();
  const q = useQuery<T>({
    queryKey: ['kv', key],
    queryFn: ({ signal }) => api.get<{ value: T | null }>(`/work/kv/${key}`, undefined, signal).then((r) => (r.value ?? def) as T),
  });
  const save = useMutation({
    mutationFn: (value: T) => api.put<{ ok: true }>(`/work/kv/${key}`, { value }),
    onSuccess: (_r, value) => qc.setQueryData(['kv', key], value),
  });
  return { value: q.data, isPending: q.isPending, error: q.error, save: save.mutateAsync, saving: save.isPending };
}
