'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Rating {
  stars: number;
  label: string;
  days: number | null;
  isNew: boolean;
}

export const useRating = (contactId?: string | null) =>
  useQuery({ queryKey: ['rating', contactId], enabled: !!contactId, staleTime: 60000, queryFn: ({ signal }) => api.get<{ rating: Rating }>(`/contact-rating/${contactId}`, undefined, signal).then((r) => r.rating) });

/** ⭐ تقييم العميل حسب التزامه بالدفع (ملخص في سطر واحد). */
export function RatingStars({ contactId }: { contactId?: string | null }) {
  const q = useRating(contactId);
  const r = q.data;
  if (!r) return null;
  const bad = r.stars <= 2;
  return (
    <span id="custRating" title={r.label} style={{ color: bad ? '#b33' : undefined, fontWeight: 700 }}>
      <span style={{ color: '#e0a100' }}>{'★'.repeat(r.stars)}</span>
      <span style={{ color: '#ccc' }}>{'★'.repeat(5 - r.stars)}</span> {r.label}
    </span>
  );
}
