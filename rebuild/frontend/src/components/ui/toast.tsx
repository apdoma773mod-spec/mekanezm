'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Tone = 'ok' | 'bad';
const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

/** One toast at a time at the bottom center, like the old system. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone: Tone = 'ok') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div aria-live="polite" className={`toast${toast.tone === 'bad' ? ' bad' : ''}`}>
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
