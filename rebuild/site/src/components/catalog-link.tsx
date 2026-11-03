'use client';
// The published flip-book catalog lives on the backend. These pieces show only when one is published (HEAD answers 200).
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const CATALOG_SRC = '/mkapi/web/public/catalog-latest';

export function useCatalog() {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_NEW_BACKEND !== '1') return;
    let alive = true;
    fetch(CATALOG_SRC, { method: 'HEAD' }).then(r => { if (alive) setHas(r.ok); }).catch(() => { /* hidden */ });
    return () => { alive = false; };
  }, []);
  return has;
}

/** Slim strip on the home page: says what it is, no big icon covering anything. */
export function CatalogBanner() {
  if (!useCatalog()) return null;
  return (
    <Link href="/catalog" className="cat-strip">
      <span aria-hidden="true">📖</span>
      <span><b>كتالوج ميكانيزم</b><small>قلّب المنتجات زي الكتاب، وحمّله أو اطبعه</small></span>
      <em>افتح الكتالوج ←</em>
    </Link>
  );
}

export function CatalogFooterLink() {
  if (!useCatalog()) return null;
  return <Link href="/catalog">📖 الكتالوج (تقليب وطباعة)</Link>;
}
