'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AlertsConfig,
  CloseDto,
  CoIdent,
  ContractDto,
  FieldOrderDto,
  HyRules,
  HyToday,
  IcAccount,
  IcDeal,
  IcTransferResult,
  OutboundDto,
  PartnersBoard,
  VanState,
  VehicleDto,
} from '@mk/shared';
import { api } from './api';
import { invalidateTrade } from './trade-queries';

const KEYS = ['hy'];

/** Every Hydrolek write can touch stock, invoices, balances and expenses. */
export function useHyWrite<TVars, TRes>(fn: (v: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidateTrade(qc);
      for (const k of [...KEYS, 'wanted']) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useHyToday = () => useQuery({ queryKey: ['hy', 'today'], queryFn: ({ signal }) => api.get<{ today: HyToday }>('/hy/today', undefined, signal).then((r) => r.today), refetchInterval: 45_000 });
export const useHyRules = () => useQuery({ queryKey: ['hy', 'rules'], queryFn: ({ signal }) => api.get<{ rules: HyRules }>('/hy/rules', undefined, signal).then((r) => r.rules) });
export const useSaveHyRules = () => useHyWrite((v: Partial<HyRules>) => api.put('/hy/rules', v));
export const useIdent = () => useQuery({ queryKey: ['hy', 'ident'], queryFn: ({ signal }) => api.get<{ ident: Record<'MK' | 'HY', CoIdent> }>('/hy/ident', undefined, signal).then((r) => r.ident), staleTime: 60_000 });
export const useSaveIdent = () => useHyWrite((v: Record<'MK' | 'HY', CoIdent>) => api.put('/hy/ident', v));

export const useIcDeals = () => useQuery({ queryKey: ['hy', 'ic'], queryFn: ({ signal }) => api.get<{ deals: IcDeal[] }>('/hy/ic', undefined, signal).then((r) => r.deals) });
export const useIcTransfer = () =>
  useHyWrite((v: { seller: 'MK' | 'HY'; lines: { productId: string; qty: number; price: number }[]; paid: number; note: string; force: boolean }) =>
    api.post<{ result: IcTransferResult }>('/hy/ic', v).then((r) => r.result),
  );
export const useIcCancel = () => useHyWrite((ref: string) => api.delete(`/hy/ic/${ref}`));
export const useIcAccount = () => useQuery({ queryKey: ['hy', 'account'], queryFn: ({ signal }) => api.get<{ account: IcAccount }>('/hy/account', undefined, signal).then((r) => r.account) });
export const useIcSettle = () => useHyWrite((v: { dir: 'h2m' | 'm2h'; amount: number; note: string }) => api.post('/hy/account/settle', v));

export const usePartners = (enabled = true) =>
  useQuery({ queryKey: ['hy', 'partners'], queryFn: ({ signal }) => api.get<{ board: PartnersBoard }>('/hy/partners', undefined, signal).then((r) => r.board), enabled });
export const useSavePartner = () =>
  useHyWrite(({ id, input }: { id?: string; input: { name: string; phone: string; share: number; note: string } }) => (id ? api.put(`/hy/partners/${id}`, input) : api.post('/hy/partners', input)));
export const useDeletePartner = () => useHyWrite((id: string) => api.delete(`/hy/partners/${id}`));
export const usePartnerMove = () => useHyWrite(({ id, input }: { id: string; input: { kind: string; amount: number; date: string; note: string } }) => api.post(`/hy/partners/${id}/moves`, input));
export const useDeletePartnerMove = () => useHyWrite((id: string) => api.delete(`/hy/partner-moves/${id}`));

export const useVehicles = () =>
  useQuery({
    queryKey: ['hy', 'vehicles'],
    queryFn: ({ signal }) => api.get<{ vehicles: VehicleDto[]; alerts: { t: string; d: number; late: boolean }[] }>('/hy/vehicles', undefined, signal),
  });
export const useAddVehicle = () => useHyWrite((v: { name: string; plate: string }) => api.post('/hy/vehicles', v));
export const useVehicleMeta = () => useHyWrite(({ id, meta }: { id: string; meta: VehicleDto['meta'] }) => api.put(`/hy/vehicles/${id}/meta`, meta));
export const useVehicleLog = () =>
  useHyWrite(({ id, input }: { id: string; input: { kind: string; amount: number; km: number | null; liters: number | null; date: string; note: string } }) => api.post(`/hy/vehicles/${id}/log`, input));
export const useDeleteVehicleLog = () => useHyWrite((id: string) => api.delete(`/hy/vehicle-log/${id}`));

export const useFieldOrders = () =>
  useQuery({ queryKey: ['hy', 'orders'], queryFn: ({ signal }) => api.get<{ orders: FieldOrderDto[] }>('/hy/orders', undefined, signal).then((r) => r.orders), refetchInterval: 45_000 });
export const useCreateFieldOrder = () => useHyWrite((v: unknown) => api.post<{ order: FieldOrderDto }>('/hy/orders', v).then((r) => r.order));
export const useLineState = () => useHyWrite(({ id, idx, st, dm, dd }: { id: string; idx: number; st: string; dm?: string; dd?: string }) => api.post(`/hy/orders/${id}/lines/${idx}`, { st, dm, dd }));
export const useFieldReply = () => useHyWrite(({ id, eta, note }: { id: string; eta: string; note: string }) => api.patch(`/hy/orders/${id}`, { eta, note }));
export const useFieldCancel = () => useHyWrite((id: string) => api.post(`/hy/orders/${id}/cancel`));
export const useFieldInvoice = () => useHyWrite(({ id, paid }: { id: string; paid: number }) => api.post(`/hy/orders/${id}/invoice`, { paid }));

export const useVan = () => useQuery({ queryKey: ['hy', 'van'], queryFn: ({ signal }) => api.get<{ van: VanState }>('/hy/van', undefined, signal).then((r) => r.van) });
export const useVanLoad = () => useHyWrite((v: { vehicleId: string; lines: { productId: string; qty: number; src: string; price: number }[] }) => api.post('/hy/van/load', v));
export const useClose = (date: string, vehicleId: string) =>
  useQuery({ queryKey: ['hy', 'close', date, vehicleId], queryFn: ({ signal }) => api.get<{ close: CloseDto }>('/hy/van/close', { date, vehicleId }, signal).then((r) => r.close) });
export const useDoClose = () => useHyWrite((v: { date: string; vehicleId: string; handed: number | null; note: string; items: { pid: string; cnt: number; why: string; back: boolean }[] }) => api.post('/hy/van/close', v));
export const useReopenClose = () => useHyWrite((v: { date: string; vehicleId: string }) => api.post('/hy/van/close/reopen', v));

export const useContracts = () => useQuery({ queryKey: ['hy', 'contracts'], queryFn: ({ signal }) => api.get<{ contracts: ContractDto[] }>('/hy/contracts', undefined, signal).then((r) => r.contracts) });
export const useCreateContract = () => useHyWrite((v: unknown) => api.post<{ contract: ContractDto }>('/hy/contracts', v).then((r) => r.contract));
export const useContractAction = () => useHyWrite(({ id, action }: { id: string; action: unknown }) => api.post<{ contract: ContractDto }>(`/hy/contracts/${id}`, action).then((r) => r.contract));

export const useAlerts = () =>
  useQuery({ queryKey: ['hy', 'alerts'], queryFn: ({ signal }) => api.get<{ alerts: AlertsConfig; outbox: OutboundDto[] }>('/hy/alerts', undefined, signal) });
export const useSaveAlerts = () => useHyWrite((v: AlertsConfig) => api.put('/hy/alerts', v));
export const useWaSend = () => useHyWrite((v: { to: string; body: string; byName: string }) => api.post('/hy/wa', v));
