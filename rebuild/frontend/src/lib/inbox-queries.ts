'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { invalidateTrade } from './trade-queries';

/** صناديق الوارد: الفلوس الواصلة، طلبات الواتساب، صور الواتساب (الباك إند في modules/inbox). */

export interface SmsPending {
  id: string;
  sender: string;
  amount: number;
  note: string;
  phone: string | null;
  direction: 'in' | 'out' | null;
  receivedAt: string;
}
export interface WaOrderRow {
  id: string;
  phone: string;
  customerName: string;
  body: string;
  status: 'new' | 'done' | 'ignored' | 'promoted';
  invoiceNo: string | null;
  createdAt: string;
  handledAt: string | null;
}
export interface WaPhotoRow {
  id: string;
  phone: string;
  name: string;
  caption: string;
  img: string;
  status: 'new' | 'sent' | 'missing' | 'ignored' | 'paid' | 'transfer';
  handledBy: string;
  createdAt: string;
}
export type InboxTab = 'new' | 'done' | 'other';

export const inboxKeys = {
  counts: ['inbox', 'counts'] as const,
  sms: ['inbox', 'sms'] as const,
  waOrders: (tab: InboxTab) => ['inbox', 'wa-orders', tab] as const,
  waPhotos: (tab: InboxTab) => ['inbox', 'wa-photos', tab] as const,
};

export const useInboxCounts = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: inboxKeys.counts,
    queryFn: () => api.get<{ sms: number; waOrders: number; waPhotos: number }>('/inbox/counts'),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

export const useSmsPending = () =>
  useQuery({
    queryKey: inboxKeys.sms,
    queryFn: () => api.get<{ items: SmsPending[] }>('/sms/pending').then((r) => r.items),
    refetchInterval: 60_000,
  });

export const useSmsStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'used' | 'ignored' }) =>
      api.post<{ ok: true }>(`/sms/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
};

export const useWaOrders = (tab: InboxTab) =>
  useQuery({
    queryKey: inboxKeys.waOrders(tab),
    queryFn: () => api.get<{ items: WaOrderRow[] }>('/inbox/wa-orders', { tab }).then((r) => r.items),
  });

export const useWaOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WaOrderRow['status'] }) =>
      api.post<{ ok: true }>(`/inbox/wa-orders/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
};

export const useWaPhotos = (tab: InboxTab) =>
  useQuery({
    queryKey: inboxKeys.waPhotos(tab),
    queryFn: () => api.get<{ items: WaPhotoRow[] }>('/inbox/wa-photos', { tab }).then((r) => r.items),
  });

export const useWaPhotoStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WaPhotoRow['status'] }) =>
      api.post<{ ok: true }>(`/inbox/wa-photos/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
};

/** A Vodafone Cash amount becomes a payment on the chosen customer or supplier account. */
export const useApplySms = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { smsId: string; contactId: string; amount: number; note: string }) => {
      await api.post('/payments', { contactId: v.contactId, amount: v.amount, method: 'WALLET', note: v.note });
      await api.post(`/sms/${v.smsId}/status`, { status: 'used' });
    },
    onSuccess: () => {
      invalidateTrade(qc);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
};
