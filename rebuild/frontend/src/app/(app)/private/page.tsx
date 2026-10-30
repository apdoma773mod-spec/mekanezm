'use client';

import { AdminOnly } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { balanceText } from '@/lib/format';
import { useAllContacts } from '@/lib/trade-queries';

/** «🔒 خاص عبده»: the owner's own corner — the partner accounts (moved off the dashboard so staff don't see them); more goes here later. */
function Private() {
  const { open } = useModal();
  // partners are supplier accounts marked «[شريك]» in the note (the old mkPtnTile)
  const partners = (useAllContacts('SUPPLIER', true).data ?? []).filter((c) => c.note.includes('[شريك]'));
  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>🔒 خاص عبده</h1>
          <p>حاجات تخصك انت بس — محدش غيرك بيشوفها</p>
        </div>
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 8px' }}>🤝 حسابات الشركاء</h3>
        {partners.length ? (
          partners.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mkPtnTile"
              onClick={() => open({ kind: 'contactFile', id: p.id })}
              style={{ margin: '8px 0', width: '100%', padding: 12, borderRadius: 14, border: '2px solid #087f8c', background: 'var(--card,#fff)', font: 'inherit', fontWeight: 800, color: '#087f8c', textAlign: 'right' }}
            >
              🤝 حساب {p.name} — {balanceText(p)}
            </button>
          ))
        ) : (
          <div className="empty">مفيش شركاء. اكتب «[شريك]» في ملاحظة المورد عشان يظهر هنا.</div>
        )}
      </div>
    </>
  );
}

export default function PrivatePage() {
  return (
    <AdminOnly>
      <Private />
    </AdminOnly>
  );
}
