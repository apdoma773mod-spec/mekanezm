'use client';
// Full-screen catalog (the backend's flip-book) with our own bar: close (back to the shop), print, save as PDF.
import Link from 'next/link';
import { CATALOG_SRC } from '@/components/catalog-link';

export default function CatalogPage() {
  // The backend's print view opens the print / save-as-PDF sheet by itself.
  const printAll = () => { window.open(CATALOG_SRC + '/print', '_blank'); };
  return (
    <div className="catv">
      <div className="catv-bar">
        <Link href="/" className="catv-x" aria-label="إغلاق الكتالوج والرجوع للمتجر">✕</Link>
        <b>الكتالوج</b>
        <button type="button" onClick={printAll}>🖨 طباعة</button>
        <button type="button" onClick={printAll}>⬇ تنزيل PDF</button>
      </div>
      <iframe className="catv-f" src={CATALOG_SRC} title="كتالوج ميكانيزم" />
    </div>
  );
}
