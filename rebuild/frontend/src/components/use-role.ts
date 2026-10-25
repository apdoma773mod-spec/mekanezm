'use client';

import { useMe } from '@/lib/queries';

/** Hides admin-only buttons; the API refuses staff anyway. */
export function useIsAdmin(): boolean {
  return useMe().data?.role === 'ADMIN';
}
