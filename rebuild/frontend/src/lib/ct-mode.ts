'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { ContactType } from '@mk/shared';

/** The old mk_ct_mode: the sidebar's «العملاء والموردين» opens one of two screens, and the choice is remembered on the device. */
const KEY = 'mk_ct_mode';
const EVT = 'mk-ct-mode';

export const readCtMode = (): ContactType => {
  try {
    return localStorage.getItem(KEY) === 'مورد' ? 'SUPPLIER' : 'CUSTOMER';
  } catch {
    return 'CUSTOMER';
  }
};

export function setCtMode(t: ContactType) {
  try {
    localStorage.setItem(KEY, t === 'SUPPLIER' ? 'مورد' : 'عميل');
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useCtMode(): [ContactType, (t: ContactType) => void] {
  const sub = useCallback((cb: () => void) => {
    window.addEventListener(EVT, cb);
    return () => window.removeEventListener(EVT, cb);
  }, []);
  const mode = useSyncExternalStore(sub, readCtMode, () => 'CUSTOMER' as ContactType);
  return [mode, setCtMode];
}
