import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from './api';

/** «🌐 الموقع»: طلبات الموقع ومحتواه (الباك إند في modules/web). */

export interface WebOrderItem {
  code: string;
  qty: number;
  backorder?: boolean;
}
export interface WebOrderRow {
  id: string;
  customerName: string;
  phone: string;
  items: WebOrderItem[];
  status: 'new' | 'done' | 'cancelled';
  eta: string;
  invoiceNo: string | null;
  repliedAt: string | null;
  handledAt: string | null;
  createdAt: string;
}

export const useWebOrders = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['web', 'orders'],
    queryFn: ({ signal }) => api.get<{ items: WebOrderRow[] }>('/web/orders', undefined, signal).then((r) => r.items),
    refetchInterval: 60_000,
  });

export const useWebOrderCount = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['web', 'count'],
    queryFn: ({ signal }) => api.get<{ count: number }>('/web/orders/count', undefined, signal).then((r) => r.count),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

export const usePatchWebOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: WebOrderRow['status']; eta?: string; invoiceNo?: string | null }) =>
      api.patch<{ order: WebOrderRow }>(`/web/orders/${id}`, body).then((r) => r.order),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['web'] }),
  });
};

/** The old site_content document: sections, the products shown on the site, works, reviews, delivery, contact. */
export interface SiteData {
  theme?: Record<string, unknown>;
  sections: { id: string; name: string }[];
  products: SiteProduct[];
  works?: { id: string; title: string; desc?: string; imgs: string[] }[];
  reviews?: { id: string; name: string; area?: string; stars: number; text: string }[];
  delivery?: { area: string; fee: string; days: string }[];
  deliveryNote?: string;
  policy?: string;
  shipLocal?: { fee?: string; days?: string; note?: string };
  shipGov?: { fee?: string; days?: string; note?: string };
  phone?: string;
  phones?: string[];
  hours?: string;
  mapUrl?: string;
  catalog?: boolean;
  [k: string]: unknown;
}
export interface SiteProduct {
  id: string;
  code: string;
  name: string;
  desc?: string;
  sec: string;
  imgs: string[];
  img?: string;
  top?: boolean;
  video?: string;
}
export interface SiteDoc {
  data: SiteData;
  version: number;
}

const normalize = (s: SiteDoc): SiteDoc => ({ ...s, data: { ...s.data, sections: s.data.sections ?? [], products: s.data.products ?? [] } });

export const fetchSite = () => api.get<{ site: SiteDoc }>('/web/site').then((r) => normalize(r.site));

/** Safe save like the old one: if someone saved in between, reload and apply the same change again. */
export async function saveSite(mutate: (d: SiteData) => void): Promise<SiteDoc> {
  for (let t = 0; t < 4; t++) {
    const cur = await fetchSite();
    const d = JSON.parse(JSON.stringify(cur.data)) as SiteData;
    mutate(d);
    try {
      return normalize((await api.put<{ site: SiteDoc }>('/web/site', { data: d, version: cur.version })).site);
    } catch (e) {
      if (!(e instanceof ApiClientError && e.status === 409)) throw e;
    }
  }
  throw new Error('في تعديل تاني على الموقع في نفس اللحظة — جرّب تاني');
}
