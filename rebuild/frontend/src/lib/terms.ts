'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** 🏷️ أسعار وحدود العملاء: خصم ثابت % + فئة + حد أقصى للدين + ملاحظة، لكل عميل بالاسم (cust_terms القديمة). */
export interface CustTerm {
  tier?: string;
  pct?: number;
  limit?: number;
  note?: string;
}
export type CustTerms = Record<string, CustTerm>;

export const TIERS: [string, number][] = [
  ['جملة', 5],
  ['صنايعي', 8],
  ['معرض/وكيل', 12],
  ['VIP', 15],
];

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export const useTerms = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['terms'],
    queryFn: () => api.get<{ terms: CustTerms }>('/terms').then((r) => r.terms),
    staleTime: 60_000,
  });

export function termsFor(terms: CustTerms | undefined, name: string): { key: string; t: CustTerm } | null {
  if (!terms || !name.trim()) return null;
  const k = norm(name);
  const key = Object.keys(terms).find((x) => norm(x) === k);
  return key ? { key, t: terms[key] } : null;
}

export const useSaveTerms = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (terms: CustTerms) => api.put<{ ok: true }>('/terms', { terms }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['terms'] }),
  });
};
