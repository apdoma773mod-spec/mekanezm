'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Windows are drawn on <body>, not inside the screen that opened them: the screens' green title bars and sticky panels
 * make their own stacking boxes, and a window inside them gets cut off or sits under them.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
