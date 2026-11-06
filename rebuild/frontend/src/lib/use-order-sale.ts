'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { ContactDto, ProductDto } from '@mk/shared';
import { useModal } from '@/components/modals/modal-host';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from './api';
import { orderLines } from './order-parse';

/**
 * «🧾 تحويل رسالة العميل لفاتورة»: بيقرا الرسالة بالعامية، يطابق الأصناف مع المخزن، ويفتح فاتورة بيع جاهزة
 * بالعميل والأصناف والكميات والأسعار. اللي مش متعرف عليه بيتكتب في ملاحظة الفاتورة وفي رسالة فوق عشان يتضاف بالبحث.
 */
export function useOrderSale() {
  const qc = useQueryClient();
  const { open } = useModal();
  const toast = useToast();
  return async (o: { text: string; person: string; contactId?: string; phone?: string; note?: string; online?: boolean; onSaved?: () => Promise<void> | void }) => {
    try {
      const products = await qc.fetchQuery({ queryKey: ['products', 'all', {}], queryFn: () => api.get<{ items: ProductDto[] }>('/products/all').then((r) => r.items), staleTime: 30_000 });
      let phone = o.phone ?? '';
      let person = o.person;
      if (o.contactId) {
        const c = await api.get<{ contact: ContactDto }>(`/contacts/${o.contactId}`).then((r) => r.contact).catch(() => null);
        if (c) {
          person = c.name;
          phone = phone || c.phone;
        }
      }
      const { lines, missing } = orderLines(o.text, products);
      open({
        kind: 'transaction',
        type: 'SALE',
        preset: {
          ...(o.online ? { online: true, onlineFrom: 'WA' as const } : {}),
          person,
          phone,
          note: [o.note ?? 'من رسالة العميل', o.text.trim(), missing.length ? `⚠️ ناقص يتضاف بالبحث: ${missing.join('، ')}` : ''].filter(Boolean).join('\n'),
          lines,
          onSaved: o.onSaved,
        },
      });
      toast(missing.length ? `اتعرف على ${lines.length} صنف — ${missing.length} لسه تضيفهم بالبحث: ${missing.slice(0, 2).join('، ')}${missing.length > 2 ? '…' : ''}` : lines.length ? 'راجع الفاتورة واحفظها' : 'ما اتعرفش على أصناف — ضيفهم بالبحث', missing.length || !lines.length ? 'bad' : undefined);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
}
