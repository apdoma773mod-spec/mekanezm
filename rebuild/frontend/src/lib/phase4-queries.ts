'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttendanceDto,
  AttendanceManualInput,
  GiftDto,
  GiftInput,
  GiftsSummary,
  GradeInput,
  KitDto,
  KitInput,
  Paginated,
  PointsBoard,
  PointsConfig,
  PunchResult,
  QuoteDto,
  QuoteInput,
  SampleDto,
  SampleInput,
  SamplesDto,
  ShipmentDto,
  ShipmentInput,
  ShipPaidInput,
  StaffConfig,
  StaffDto,
  StaffInput,
  StaffMonth,
  StaffMoveInput,
  UpdateShipmentInput,
  WantedDto,
  WantedInput,
} from '@mk/shared';
import { api } from './api';
import { invalidateTrade } from './trade-queries';

/** Phase 4 writes can touch stock, balances and expenses, so they refresh everything like trade writes. */
function useWrite<TVars, TRes>(fn: (v: TVars) => Promise<TRes>, extra: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidateTrade(qc);
      for (const k of ['quotes', 'quote', 'shipments', 'gifts', 'staff', 'points', 'kits', 'samples', 'wanted', ...extra]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

// ---------- quotes ----------
export const useQuotes = (q: string, page: number) =>
  useQuery({ queryKey: ['quotes', q, page], queryFn: ({ signal }) => api.get<Paginated<QuoteDto>>('/quotes', { q: q || undefined, page, pageSize: 50 }, signal), placeholderData: keepPreviousData });
export const useQuote = (id: string | null) =>
  useQuery({ queryKey: ['quote', id], queryFn: ({ signal }) => api.get<{ quote: QuoteDto }>(`/quotes/${id}`, undefined, signal).then((r) => r.quote), enabled: !!id });
export const useSaveQuote = () =>
  useWrite(({ id, input }: { id?: string; input: QuoteInput }) =>
    (id ? api.put<{ quote: QuoteDto }>(`/quotes/${id}`, input) : api.post<{ quote: QuoteDto }>('/quotes', input)).then((r) => r.quote),
  );
export const useDeleteQuote = () => useWrite((id: string) => api.delete<{ ok: true }>(`/quotes/${id}`));
export const useQuoteConverted = () =>
  useWrite(({ id, invoiceId }: { id: string; invoiceId: string }) => api.post<{ quote: QuoteDto }>(`/quotes/${id}/converted`, { invoiceId }).then((r) => r.quote));

// ---------- shipping ----------
export interface ShipList {
  items: ShipmentDto[];
  summary: { open: number; moving: number; movingCod: number; waiting: number; waitingCod: number };
}
export const useShipments = (q: { tab: string; kind?: string; q?: string; invoiceId?: string }, enabled = true) =>
  useQuery({ queryKey: ['shipments', q], queryFn: ({ signal }) => api.get<ShipList>('/shipments', q, signal), placeholderData: keepPreviousData, enabled, refetchInterval: 60_000 });
export const useCreateShipment = () => useWrite((input: ShipmentInput) => api.post<{ shipment: ShipmentDto }>('/shipments', input).then((r) => r.shipment));
export const useUpdateShipment = () =>
  useWrite(({ id, input }: { id: string; input: UpdateShipmentInput }) => api.patch<{ shipment: ShipmentDto }>(`/shipments/${id}`, input).then((r) => r.shipment));
export const useShipPaid = () =>
  useWrite(({ id, input }: { id: string; input: ShipPaidInput }) => api.post<{ shipment: ShipmentDto }>(`/shipments/${id}/paid`, input).then((r) => r.shipment));
export const useDeleteShipment = () => useWrite((id: string) => api.delete<{ ok: true }>(`/shipments/${id}`));

// ---------- gifts / grade / alternatives ----------
export const useGifts = (enabled = true) =>
  useQuery({ queryKey: ['gifts'], queryFn: ({ signal }) => api.get<GiftsSummary>('/stock-extras/gifts', undefined, signal), enabled });
export const useGift = () => useWrite((input: GiftInput) => api.post<{ gift: GiftDto }>('/stock-extras/gifts', input).then((r) => r.gift));
export const useGrade = () =>
  useWrite((input: GradeInput) => api.post<{ product: { productId: string; code: string; name: string } }>('/stock-extras/grade', input).then((r) => r.product));
export const useAlts = () =>
  useQuery({ queryKey: ['gifts', 'alts'], queryFn: ({ signal }) => api.get<{ alts: Record<string, string[]> }>('/stock-extras/alts', undefined, signal).then((r) => r.alts), staleTime: 30_000 });
export const useSaveAlts = () => useWrite(({ id, ids }: { id: string; ids: string[] }) => api.put<{ ids: string[] }>(`/stock-extras/alts/${id}`, { ids }));

// ---------- staff ----------
export const useStaffMonth = (month: string) =>
  useQuery({ queryKey: ['staff', month], queryFn: ({ signal }) => api.get<StaffMonth>('/staff', { month }, signal), placeholderData: keepPreviousData });
export const useSaveStaff = () =>
  useWrite(({ id, input }: { id?: string; input: StaffInput }) =>
    (id ? api.put<{ staff: StaffDto }>(`/staff/${id}`, input) : api.post<{ staff: StaffDto }>('/staff', input)).then((r) => r.staff),
  );
export const useManualAttendance = () =>
  useWrite((input: AttendanceManualInput) => api.post<{ attendance: AttendanceDto }>('/staff/attendance', input).then((r) => r.attendance));
export const useStaffMove = () => useWrite(({ id, input }: { id: string; input: StaffMoveInput }) => api.post(`/staff/${id}/moves`, input));
export const useStaffConfig = () => useWrite((cfg: StaffConfig) => api.put('/staff/config', cfg));
export const punchCode = () => api.post<{ code: string; expiresAt: string }>('/staff/punch-code');
export const staffToday = () => api.get<{ today: { name: string; inAt: string | null; outAt: string | null }[] }>('/staff/today').then((r) => r.today);
export const usePunch = () => useWrite((code: string) => api.post<{ result: PunchResult }>('/staff/punch', { code }).then((r) => r.result));
export const usePoints = (month: string, enabled = true) =>
  useQuery({ queryKey: ['points', month], queryFn: ({ signal }) => api.get<PointsBoard>('/staff/points', { month }, signal), enabled, placeholderData: keepPreviousData });
export const useGivePoints = () =>
  useWrite(({ id, pts, why, redeem }: { id: string; pts: number; why: string; redeem?: boolean }) => api.post(`/staff/${id}/points`, { pts, why, redeem: !!redeem }));
export const usePointsConfig = () => useWrite((cfg: PointsConfig) => api.put('/staff/points/config', cfg));

// ---------- kits ----------
export const useKits = () => useQuery({ queryKey: ['kits'], queryFn: ({ signal }) => api.get<{ kits: KitDto[] }>('/kits', undefined, signal).then((r) => r.kits) });
export const useSaveKit = () =>
  useWrite(({ id, input }: { id?: string; input: KitInput }) => (id ? api.put<{ kit: KitDto }>(`/kits/${id}`, input) : api.post<{ kit: KitDto }>('/kits', input)).then((r) => r.kit));
export const useDeleteKit = () => useWrite((id: string) => api.delete<{ ok: true }>(`/kits/${id}`));

// ---------- samples ----------
export const useSamples = () => useQuery({ queryKey: ['samples'], queryFn: ({ signal }) => api.get<SamplesDto>('/samples', undefined, signal) });
export const useSampleCount = (name: string | null) =>
  useQuery({ queryKey: ['samples', 'count', name], queryFn: ({ signal }) => api.get<{ count: number }>('/samples/count', { name }, signal).then((r) => r.count), enabled: !!name });
export const useSampleFlag = () => useWrite((on: boolean) => api.put('/samples/flag', { on }));
export const useCreateSample = () => useWrite((input: SampleInput) => api.post<{ sample: SampleDto }>('/samples', input).then((r) => r.sample));
export const useSampleStatus = () =>
  useWrite(({ id, status }: { id: string; status: 'returned' | 'sold' | 'lost' }) => api.post<{ sample: SampleDto }>(`/samples/${id}/status`, { status }));

// ---------- wanted ----------
export const useWanted = (enabled = true) =>
  useQuery({ queryKey: ['wanted'], queryFn: ({ signal }) => api.get<{ items: WantedDto[] }>('/wanted', undefined, signal).then((r) => r.items), enabled });
export const useAddWanted = () => useWrite((input: WantedInput) => api.post<{ item: WantedDto }>('/wanted', input).then((r) => r.item));
export const useWantedDone = () => useWrite((id: string) => api.post(`/wanted/${id}/done`));
export const useDeleteWanted = () => useWrite((id: string) => api.delete(`/wanted/${id}`));
