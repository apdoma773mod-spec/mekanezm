import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** 🔗 رابط العميل: الجانب بتاع المحل (الصفحة العامة بتكلم الباك إند لوحدها). */
export interface PortalMsg {
  id: string;
  contactId: string;
  name: string;
  body: string;
  media: { u: string; t: 'i' | 'v' }[];
  seen: boolean;
  createdAt: string;
}

export const usePortalLink = (contactId: string) =>
  useQuery({ queryKey: ['portal', 'link', contactId], queryFn: () => api.get<{ token: string | null }>(`/portal/link/${contactId}`).then((r) => r.token) });

export const useMakePortalLink = (contactId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ token: string }>(`/portal/link/${contactId}`).then((r) => r.token),
    onSuccess: (t) => qc.setQueryData(['portal', 'link', contactId], t),
  });
};

export const useStopPortalLink = (contactId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ ok: true }>(`/portal/link/${contactId}`),
    onSuccess: () => qc.setQueryData(['portal', 'link', contactId], null),
  });
};

export const usePortalMsgs = (q: { contactId?: string; unseen?: boolean }, enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['portal', 'msgs', q],
    queryFn: ({ signal }) => api.get<{ items: PortalMsg[] }>('/portal/msgs', { contactId: q.contactId, unseen: q.unseen ? '1' : undefined }, signal).then((r) => r.items),
  });

export const usePortalNewCount = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['portal', 'count'],
    queryFn: ({ signal }) => api.get<{ count: number }>('/portal/msgs/count', undefined, signal).then((r) => r.count),
    refetchInterval: 120_000,
    staleTime: 30_000,
  });

export const useMarkPortalSeen = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id?: string; contactId?: string }) => (v.id ? api.post<{ ok: true }>(`/portal/msgs/${v.id}/seen`) : api.post<{ ok: true }>(`/portal/msgs/seen-contact/${v.contactId}`)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal'] }),
  });
};
