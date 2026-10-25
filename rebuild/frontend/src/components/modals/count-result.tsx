'use client';

import type { StockCountDto } from '@mk/shared';
import { Modal } from '../ui/modal';
import { useModal } from './modal-host';
import { money, qtyText } from '@/lib/format';

/** The old countResult(): what a saved count changed. */
export function CountResult({ count }: { count: StockCountDto }) {
  const { close } = useModal();
  const rows = count.items.filter((x) => x.diff !== 0);
  return (
    <Modal title={`✔ الجرد اتحفظ ${count.no}`} onClose={close}>
      <div className="cstats">
        <div>
          <small>أصناف اتعدّت</small>
          <b>{count.itemCount}</b>
        </div>
        <div>
          <small>قيمة العجز</small>
          <b style={{ color: 'var(--danger)' }}>{money(count.shortValue)}</b>
        </div>
        <div>
          <small>قيمة الزيادة</small>
          <b style={{ color: 'var(--green)' }}>{money(count.excessValue)}</b>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>الصنف</th>
              <th>كان</th>
              <th>اتعدّ</th>
              <th>الفرق</th>
              <th>القيمة</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((x) => (
                <tr key={x.productId}>
                  <td>{x.name}</td>
                  <td>{qtyText(x.before)}</td>
                  <td>{qtyText(x.counted)}</td>
                  <td style={{ color: x.diff < 0 ? 'var(--danger)' : 'var(--green)' }}>
                    {x.diff > 0 ? '+' : ''}
                    {qtyText(x.diff)}
                  </td>
                  <td>{money(Math.abs(x.diff) * x.cost)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">مفيش فروق — كله مظبوط 👌</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
