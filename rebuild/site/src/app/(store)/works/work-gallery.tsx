'use client';
import Image from 'next/image';
import { useShop } from '@/components/shop-provider';

/** Swipeable photo strip; tap opens the full-screen viewer. */
export function WorkGallery({ imgs, title }: { imgs: string[]; title: string }) {
  const { open } = useShop();
  return (
    <div className="wkg">{imgs.map((u, k) => (
      <button key={u} type="button" onClick={() => open({ kind: 'image', srcs: imgs, i: k })} aria-label={`${title} — صورة ${k + 1}`}>
        <Image src={u} alt={`${title} ${k + 1}`} fill sizes="(max-width:720px) 85vw, 520px" style={{ objectFit: 'cover' }} />
      </button>
    ))}</div>
  );
}
