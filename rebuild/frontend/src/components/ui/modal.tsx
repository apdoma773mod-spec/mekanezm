'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon } from '../icon';

interface Props {
  title: ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

/** The old system's centered window: dimmed background, close on outside tap or Esc, background doesn't scroll. */
export function Modal({ title, onClose, wide, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="قفل">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
