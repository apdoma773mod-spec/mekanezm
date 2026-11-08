'use client';
import { useEffect, useRef, type ReactNode } from 'react';
/** Footer link group: collapsed on phones (keeps the page short), always open on wide screens. */
export function FtGroup({ title, children }: { title: string; children: ReactNode }) {
  const r = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (r.current && window.matchMedia('(min-width: 720px)').matches) r.current.open = true; }, []);
  return <details className="ftg" ref={r}><summary>{title}</summary><div className="ftl">{children}</div></details>;
}
