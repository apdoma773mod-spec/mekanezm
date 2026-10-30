'use client';
// «عرض المزيد» link that also loads the next batch by itself when the customer scrolls near it.
// Still a real link (works without JS, Google follows it).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function AutoMore({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(false);
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting) { io.disconnect(); setBusy(true); router.replace(href, { scroll: false }); }
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [href, router]);
  return (
    <Link ref={ref} className="more" href={href} scroll={false} rel="next" aria-busy={busy}>
      {busy ? '⏳ بنحمّل باقي المنتجات…' : children}
    </Link>
  );
}
