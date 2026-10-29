'use client';

import type { StockCountDto } from '@mk/shared';
import { Modal } from '../ui/modal';
import { useModal } from './modal-host';
import { money, qtyText } from '@/lib/format';
import { printHtml, reportHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';

/** The old countResult(): what a saved count changed. */
export function CountResult({ count }: { count: StockCountDto }) {
  const { close } = useModal();
  const settings = useSettings().data;
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
      <div className="btnrow" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="secondary"
          disabled={!settings}
          onClick={() =>
            settings &&
            printHtml(
              reportHtml(
                {
                  title: `نتيجة الجرد ${count.no}`,
                  range: '',
                  sum: [
                    ['أصناف اتعدّت', String(count.itemCount)],
                    ['قيمة العجز', money(count.shortValue)],
                    ['قيمة الزيادة', money(count.excessValue)],
                    ['الصافي', money(count.excessValue - count.shortValue)],
                  ],
                  head: ['الصنف', 'الكود', 'كان', 'اتعدّ', 'الفرق', 'القيمة'],
                  rows: count.items.filter((x) => x.diff !== 0).map((x) => [x.name, x.code || '', String(x.before), String(x.counted), `${x.diff > 0 ? '+' : ''}${x.diff}`, money(Math.abs(x.diff) * x.cost)]),
                },
                settings,
              ),
            )
          }
        >
          🖨️ طباعة نتيجة الجرد
        </button>
      </div>
    </Modal>
  );
}
