'use client';

import { Icon } from '../icon';
import { Modal } from '../ui/modal';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

/** «إضافة عملية»: the old quick-actions window behind the + buttons. */
export function QuickModal() {
  const { open, close } = useModal();
  const admin = useIsAdmin();
  return (
    <Modal title="إضافة عملية" onClose={close}>
      <div className="quick">
        {admin && (
          <button type="button" onClick={() => open({ kind: 'product' })}>
            <b>
              <Icon name="plus" /> منتج
            </b>
            <small>إضافة صنف جديد</small>
          </button>
        )}
        <button type="button" onClick={() => open({ kind: 'transaction', type: 'SALE' })}>
          <b>
            <Icon name="up" /> بيع
          </b>
          <small>فاتورة مبيعات</small>
        </button>
        <button type="button" onClick={() => open({ kind: 'transaction', type: 'PURCHASE' })}>
          <b>
            <Icon name="down" /> شراء
          </b>
          <small>فاتورة مشتريات</small>
        </button>
        <button type="button" onClick={() => open({ kind: 'quote' })}>
          <b>📝 عرض سعر</b>
          <small>مش بيخصم من المخزون</small>
        </button>
        {admin && (
          <>
            <button type="button" onClick={() => open({ kind: 'return', type: 'SALE' })}>
              <b>
                <Icon name="return" /> مرتجع
              </b>
              <small>بيع أو شراء</small>
            </button>
            <button type="button" onClick={() => open({ kind: 'contact' })}>
              <b>
                <Icon name="users" /> عميل/مورد
              </b>
              <small>إضافة جهة تعامل</small>
            </button>
            <button type="button" onClick={() => open({ kind: 'expense' })}>
              <b>
                <Icon name="wallet" /> مصروف
              </b>
              <small>تسجيل مصروف</small>
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
