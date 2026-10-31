import Image from 'next/image';
import Link from 'next/link';
import { KINDS, SKILL_NAME, proPath } from '@/lib/pros';
import type { Pro } from '@/lib/schema';
import { ProContact } from './pro-contact';

export function ProCard({ p, msg }: { p: Pro; msg?: string }) {
  const cover = p.photo || p.imgs[0];
  return (
    <article className="pro">
      <Link href={proPath(p.id)} className="pro-h">
        <span className="pro-ph">{cover ? <Image src={cover} alt={p.name} fill sizes="72px" style={{ objectFit: 'cover' }} /> : '🧰'}</span>
        <span className="pro-t">
          <b>{p.name}</b>
          <small>{KINDS[p.kind] ?? 'فني'}{p.years ? ` · خبرة ${p.years} سنة` : ''}{p.areas.length ? ` · ${p.areas.slice(0, 2).join('، ')}` : ''}</small>
        </span>
      </Link>
      <div className="pro-sk">{p.skills.slice(0, 4).map(s => <span key={s}>{SKILL_NAME[s] ?? s}</span>)}</div>
      {p.imgs.length > 0 && (
        <Link href={proPath(p.id)} className="pro-ws" aria-label={`أعمال ${p.name}`}>
          {p.imgs.slice(0, 3).map((u, i) => <span key={u}><Image src={u} alt={`شغل ${p.name} ${i + 1}`} fill sizes="110px" style={{ objectFit: 'cover' }} /></span>)}
        </Link>
      )}
      <ProContact id={p.id} name={p.name} phone={p.phone} msg={msg} />
    </article>
  );
}

export const ProNote = () => (
  <p className="pro-note">ℹ️ ميكانيزم بتبيع الإكسسوارات ومبتركّبش. الأسماء دي صنايعية ومهندسين مستقلين راجعنا شغلهم، والاتفاق والسعر بينك وبينهم مباشرة.</p>
);
