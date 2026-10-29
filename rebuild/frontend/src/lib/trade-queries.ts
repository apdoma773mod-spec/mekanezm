'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AdjustStockInput,
  CashQuery,
  CashSummary,
  ClosingDto,
  ClosingInput,
  ContactDto,
  DaybookAddInput,
  DaybookDay,
  DaybookEntryDto,
  DaybookPay,
  DaybookPostResult,
  DaybookUpdateInput,
  DaySummary,
  DashboardCharts,
  DebtsDto,
  ReorderSuggestion,
  ReportHeadline,
  ReportId,
  ReportPeriods,
  ReportResult,
  StockCountDto,
  StockCountInput,
  ContactInput,
  ContactStatement,
  ExpenseDto,
  ExpenseInput,
  InvoiceDto,
  InvoiceInput,
  InvoiceListResult,
  ListContactsQuery,
  ListExpensesQuery,
  ListInvoicesQuery,
  ListPaymentsQuery,
  ListProductsQuery,
  ListReturnsQuery,
  Overview,
  Paginated,
  PaymentDto,
  PaymentInput,
  ProductDto,
  ProductInput,
  ReturnDto,
  ReturnInput,
  StockMoveDto,
  TodaySummary,
  UpdateContactInput,
  UpdateExpenseInput,
  UpdateInvoiceInput,
  UpdateProductInput,
} from '@mk/shared';
import { api } from './api';

type Q<T> = Partial<T>;

/**
 * Any money or stock write can change products, balances, invoices and the drawer at once,
 * so all trade data is refreshed together instead of guessing which lists are affected.
 */
export function invalidateTrade(qc: QueryClient) {
  for (const key of ['products', 'product', 'contacts', 'contact', 'statement', 'invoices', 'invoice', 'payments', 'returns', 'expenses', 'cash', 'today', 'moves', 'daybook', 'closing', 'closings', 'counts', 'reports']) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

function useTradeMutation<TVars, TRes>(fn: (v: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateTrade(qc) });
}

// ---------- products ----------

export const useProducts = (q: Q<ListProductsQuery>, enabled = true) =>
  useQuery({
    queryKey: ['products', q],
    queryFn: ({ signal }) => api.get<Paginated<ProductDto>>('/products', q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useProduct = (id: string | null) =>
  useQuery({
    queryKey: ['product', id],
    queryFn: ({ signal }) => api.get<{ product: ProductDto }>(`/products/${id}`, undefined, signal).then((r) => r.product),
    enabled: !!id,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['products', 'categories'],
    queryFn: ({ signal }) => api.get<{ categories: string[] }>('/products/categories', undefined, signal).then((r) => r.categories),
    staleTime: 60_000,
  });

export const useProductMoves = (id: string | null, page: number) =>
  useQuery({
    queryKey: ['moves', id, page],
    queryFn: ({ signal }) => api.get<Paginated<StockMoveDto>>(`/products/${id}/moves`, { page, pageSize: 20 }, signal),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

export const lookupProduct = (code: string) =>
  api.get<{ product: ProductDto }>('/products/lookup', { code }).then((r) => r.product);

export const useCreateProduct = () =>
  useTradeMutation((input: ProductInput) => api.post<{ product: ProductDto }>('/products', input).then((r) => r.product));

export const useUpdateProduct = () =>
  useTradeMutation(({ id, input }: { id: string; input: UpdateProductInput }) =>
    api.patch<{ product: ProductDto }>(`/products/${id}`, input).then((r) => r.product),
  );

export const useDeleteProduct = () => useTradeMutation((id: string) => api.delete<{ ok: true }>(`/products/${id}`));

export const useAdjustStock = () =>
  useTradeMutation(({ id, input }: { id: string; input: AdjustStockInput }) =>
    api.post<{ product: ProductDto }>(`/products/${id}/adjust`, input).then((r) => r.product),
  );

// ---------- contacts ----------

export const useContacts = (q: Q<ListContactsQuery>, enabled = true) =>
  useQuery({
    queryKey: ['contacts', q],
    queryFn: ({ signal }) => api.get<Paginated<ContactDto>>('/contacts', q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useContact = (id: string | null) =>
  useQuery({
    queryKey: ['contact', id],
    queryFn: ({ signal }) => api.get<{ contact: ContactDto }>(`/contacts/${id}`, undefined, signal).then((r) => r.contact),
    enabled: !!id,
  });

export const useStatement = (id: string | null, from?: string, to?: string) =>
  useQuery({
    queryKey: ['statement', id, from, to],
    queryFn: ({ signal }) =>
      api.get<{ statement: ContactStatement }>(`/contacts/${id}/statement`, { from, to }, signal).then((r) => r.statement),
    enabled: !!id,
  });

export const useCreateContact = () =>
  useTradeMutation((input: ContactInput) => api.post<{ contact: ContactDto }>('/contacts', input).then((r) => r.contact));

export const useUpdateContact = () =>
  useTradeMutation(({ id, input }: { id: string; input: UpdateContactInput }) =>
    api.patch<{ contact: ContactDto }>(`/contacts/${id}`, input).then((r) => r.contact),
  );

export const useDeleteContact = () => useTradeMutation((id: string) => api.delete<{ ok: true }>(`/contacts/${id}`));

export const useZeroAccount = () =>
  useTradeMutation(({ id, cash }: { id: string; cash: boolean }) =>
    api.post<{ contact: ContactDto }>(`/contacts/${id}/zero`, { cash }).then((r) => r.contact),
  );

// ---------- invoices ----------

export const useInvoices = (q: Q<ListInvoicesQuery>, enabled = true) =>
  useQuery({
    queryKey: ['invoices', q],
    queryFn: ({ signal }) => api.get<InvoiceListResult>('/invoices', q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useInvoice = (id: string | null) =>
  useQuery({
    queryKey: ['invoice', id],
    queryFn: ({ signal }) => api.get<{ invoice: InvoiceDto }>(`/invoices/${id}`, undefined, signal).then((r) => r.invoice),
    enabled: !!id,
  });

export const useCreateInvoice = () =>
  useTradeMutation((input: InvoiceInput) => api.post<{ invoice: InvoiceDto }>('/invoices', input).then((r) => r.invoice));

export const useUpdateInvoice = () =>
  useTradeMutation(({ id, input }: { id: string; input: UpdateInvoiceInput }) =>
    api.put<{ invoice: InvoiceDto }>(`/invoices/${id}`, input).then((r) => r.invoice),
  );

export const useVoidInvoice = () =>
  useTradeMutation(({ id, reason }: { id: string; reason: string }) =>
    api.post<{ invoice: InvoiceDto }>(`/invoices/${id}/void`, { reason }).then((r) => r.invoice),
  );

// ---------- payments / returns / expenses ----------

export const usePayments = (q: Q<ListPaymentsQuery>, enabled = true) =>
  useQuery({
    queryKey: ['payments', q],
    queryFn: ({ signal }) => api.get<Paginated<PaymentDto>>('/payments', q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useCreatePayment = () =>
  useTradeMutation((input: PaymentInput) => api.post<{ payment: PaymentDto }>('/payments', input).then((r) => r.payment));

export const useCancelPayment = () =>
  useTradeMutation((id: string) => api.post<{ payment: PaymentDto }>(`/payments/${id}/cancel`).then((r) => r.payment));

export const useReturns = (q: Q<ListReturnsQuery>) =>
  useQuery({
    queryKey: ['returns', q],
    queryFn: ({ signal }) => api.get<Paginated<ReturnDto>>('/returns', q, signal),
    placeholderData: keepPreviousData,
  });

export const useCreateReturn = () =>
  useTradeMutation((input: ReturnInput) => api.post<{ return: ReturnDto }>('/returns', input).then((r) => r.return));

export const useExpenses = (q: Q<ListExpensesQuery>) =>
  useQuery({
    queryKey: ['expenses', q],
    queryFn: ({ signal }) => api.get<Paginated<ExpenseDto>>('/expenses', q, signal),
    placeholderData: keepPreviousData,
  });

export const useExpenseCategories = () =>
  useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: ({ signal }) => api.get<{ categories: string[] }>('/expenses/categories', undefined, signal).then((r) => r.categories),
  });

export const useCreateExpense = () =>
  useTradeMutation((input: ExpenseInput) => api.post<{ expense: ExpenseDto }>('/expenses', input).then((r) => r.expense));

export const useUpdateExpense = () =>
  useTradeMutation(({ id, input }: { id: string; input: UpdateExpenseInput }) =>
    api.patch<{ expense: ExpenseDto }>(`/expenses/${id}`, input).then((r) => r.expense),
  );

export const useDeleteExpense = () => useTradeMutation((id: string) => api.delete<{ ok: true }>(`/expenses/${id}`));

// ---------- cash ----------

export const useCash = (q: Q<CashQuery>, enabled = true) =>
  useQuery<CashSummary>({
    queryKey: ['cash', q],
    queryFn: ({ signal }) => api.get<{ summary: CashSummary }>('/cash/summary', q, signal).then((r) => r.summary),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useOverview = () =>
  useQuery({
    queryKey: ['cash', 'overview'],
    queryFn: ({ signal }) => api.get<{ overview: Overview }>('/cash/overview', undefined, signal).then((r) => r.overview),
  });

// ---------- daybook / closing / stock count ----------

export const useDaybook = (day: string) =>
  useQuery({
    queryKey: ['daybook', day],
    queryFn: ({ signal }) => api.get<DaybookDay>('/daybook', { day }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

export const useDaybookAdd = () =>
  useTradeMutation((input: DaybookAddInput) => api.post<{ entry: DaybookEntryDto }>('/daybook', input).then((r) => r.entry));

export const useDaybookUpdate = () =>
  useTradeMutation(({ id, input }: { id: string; input: DaybookUpdateInput }) =>
    api.patch<{ entry: DaybookEntryDto }>(`/daybook/${id}`, input).then((r) => r.entry),
  );

export const useDaybookDelete = () => useTradeMutation((id: string) => api.delete<{ ok: true }>(`/daybook/${id}`));

export const useDaybookSetPay = () =>
  useTradeMutation(({ id, pay }: { id: string; pay: DaybookPay }) =>
    api.post<{ entry: DaybookEntryDto }>(`/daybook/${id}/pay`, { pay }).then((r) => r.entry),
  );

export const useDaybookDeliver = () =>
  useTradeMutation((id: string) => api.post<{ entry: DaybookEntryDto }>(`/daybook/${id}/deliver`).then((r) => r.entry));

export const useDaybookPost = () =>
  useTradeMutation((input: { day: string; person?: string }) => api.post<DaybookPostResult>('/daybook/post', input));

export const useDaySummary = (day: string) =>
  useQuery({
    queryKey: ['closing', day],
    queryFn: ({ signal }) => api.get<{ summary: DaySummary }>('/closings/summary', { day }, signal).then((r) => r.summary),
  });

export const useSaveClosing = () =>
  useTradeMutation((input: ClosingInput) => api.post<{ closing: ClosingDto }>('/closings', input).then((r) => r.closing));

export const useClosings = () =>
  useQuery({
    queryKey: ['closings'],
    queryFn: ({ signal }) => api.get<Paginated<ClosingDto>>('/closings', { pageSize: 40 }, signal),
  });

export const useCounts = () =>
  useQuery({
    queryKey: ['counts'],
    queryFn: ({ signal }) => api.get<Paginated<StockCountDto>>('/counts', { pageSize: 30 }, signal),
  });

export const useCreateCount = () =>
  useTradeMutation((input: StockCountInput) => api.post<{ count: StockCountDto }>('/counts', input).then((r) => r.count));

// ---------- reports ----------

export const useReport = (id: ReportId | null, from?: string, to?: string) =>
  useQuery<ReportResult>({
    queryKey: ['reports', id, from, to],
    queryFn: ({ signal }) => api.get<{ report: ReportResult }>(`/reports/${id}`, { from, to }, signal).then((r) => r.report),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

export const useReportHeadline = (from?: string, to?: string) =>
  useQuery<ReportHeadline>({
    queryKey: ['reports', 'headline', from, to],
    queryFn: ({ signal }) => api.get<{ headline: ReportHeadline }>('/reports/headline', { from, to }, signal).then((r) => r.headline),
    placeholderData: keepPreviousData,
  });

export const useReportPeriods = () =>
  useQuery({
    queryKey: ['reports', 'periods'],
    queryFn: ({ signal }) => api.get<{ periods: ReportPeriods }>('/reports/periods', undefined, signal).then((r) => r.periods),
  });

// ---------- debts / reorder / charts ----------

export const useDebts = () =>
  useQuery({ queryKey: ['reports', 'debts'], queryFn: ({ signal }) => api.get<DebtsDto>('/insights/debts', undefined, signal) });

export const useRemind = () => useTradeMutation((id: string) => api.post<{ ok: true }>(`/insights/debts/${id}/remind`));

export const useSaveDebtTemplate = () => useTradeMutation((text: string) => api.put<{ ok: true }>('/insights/debts/template', { text }));

export const useReorder = (days: number) =>
  useQuery<ReorderSuggestion[]>({
    queryKey: ['reports', 'reorder', days],
    queryFn: ({ signal }) => api.get<{ suggestions: ReorderSuggestion[] }>('/insights/reorder', { days }, signal).then((r) => r.suggestions),
    placeholderData: keepPreviousData,
  });

export const useCharts = (top: number, stag: number, enabled = true) =>
  useQuery<DashboardCharts>({
    queryKey: ['reports', 'charts', top, stag],
    queryFn: ({ signal }) => api.get<{ charts: DashboardCharts }>('/insights/charts', { top, stag }, signal).then((r) => r.charts),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useToday = () =>
  useQuery({
    queryKey: ['today'],
    queryFn: ({ signal }) => api.get<{ today: TodaySummary }>('/cash/today', undefined, signal).then((r) => r.today),
    refetchInterval: 60_000,
  });

// ---------- product tools (bulk price, labels, print, old goods, import, split) ----------

export interface AllProductsQuery {
  q?: string;
  category?: string;
  company?: 'MK' | 'HY';
  stock?: 'all' | 'low' | 'out';
}

/** Every live product at once (print lists, labels, bulk price, pickers). */
export const useAllProducts = (q: AllProductsQuery = {}, enabled = true) =>
  useQuery<ProductDto[]>({
    queryKey: ['products', 'all', q],
    queryFn: ({ signal }) => api.get<{ items: ProductDto[] }>('/products/all', q as Record<string, string>, signal).then((r) => r.items),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

export const useBulkPrice = () =>
  useTradeMutation((v: { ids: string[]; field: 'price' | 'cost' | 'both'; pct: number; round: number }) =>
    api.post<{ updated: number }>('/products/bulk-price', v).then((r) => r.updated),
  );

export const useSplitProduct = () =>
  useTradeMutation((v: { sourceId: string; targetId: string; ratio: number; qty: number }) =>
    api.post<{ source: ProductDto; target: ProductDto }>('/products/split', v),
  );

export const useZeroCost = () =>
  useQuery({
    queryKey: ['products', 'zero-cost'],
    queryFn: ({ signal }) => api.get<{ count: number; items: { code: string; name: string; price: number }[] }>('/products/old-goods', undefined, signal),
  });

export const useEstimateCosts = () => useTradeMutation((pct: number) => api.post<{ updated: number }>('/products/old-goods/estimate', { pct }).then((r) => r.updated));

export const useAddOldGoods = () =>
  useTradeMutation((v: { pct: number; category: string; unit: string; lines: { name: string; qty: number; price: number; cost?: number }[] }) =>
    api.post<{ added: number; estimated: number; skipped: string[] }>('/products/old-goods/add', v),
  );

export const useImportNames = () =>
  useTradeMutation((v: { category: string; rows: { name: string; price: number; cost: number }[] }) =>
    api.post<{ added: number; skipped: number }>('/products/import', v),
  );

// ---------- purchases screen extras ----------

export const useInvoicePersons = (kind: 'SALE' | 'PURCHASE', company?: 'MK' | 'HY') =>
  useQuery({
    queryKey: ['invoices', 'persons', kind, company],
    queryFn: ({ signal }) => api.get<{ persons: string[] }>('/invoices/persons', { kind, company }, signal).then((r) => r.persons),
    staleTime: 30_000,
  });

export interface CostChangeRow {
  name: string;
  productId: string | null;
  price: number;
  prev: number | null;
  cost: number | null;
}
export const useCostChange = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['invoices', 'cost-change', id],
    queryFn: ({ signal }) => api.get<{ items: CostChangeRow[] }>(`/invoices/${id}/cost-change`, undefined, signal).then((r) => r.items),
    enabled,
  });

export const useApplyCost = () => useTradeMutation((id: string) => api.post<{ updated: number }>(`/invoices/${id}/apply-cost`).then((r) => r.updated));

export const checkDuplicatePurchase = (v: { person: string; total: number; sno?: string }) =>
  api.post<{ duplicate: { no: string; total: number } | null }>('/invoices/check-duplicate', v).then((r) => r.duplicate);

// ---------- 💹 market prices ----------

export interface MarketOffer {
  s: string;
  p: number;
  at: string;
}
export interface MarketBuy extends MarketOffer {
  pid: string;
}
export interface MarketData {
  prices: Record<string, MarketOffer[]>;
  buys: MarketBuy[];
  last: MarketBuy[];
}
export const useMarketPrices = (enabled = true) =>
  useQuery({
    queryKey: ['market'],
    queryFn: ({ signal }) => api.get<MarketData>('/market-prices', undefined, signal),
    enabled,
    staleTime: 20_000,
  });

export const useSaveMarketPrices = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prices: Record<string, MarketOffer[]>) => api.put<{ ok: true }>('/market-prices', { prices }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['market'] }),
  });
};

// ---------- contacts screen extras ----------

export const useAllContacts = (type: 'CUSTOMER' | 'SUPPLIER', enabled = true) =>
  useQuery<ContactDto[]>({
    queryKey: ['contacts', 'all', type],
    queryFn: ({ signal }) => api.get<{ items: ContactDto[] }>('/contacts/all', { type }, signal).then((r) => r.items),
    enabled,
    placeholderData: keepPreviousData,
  });

export interface InvNote {
  recv: string;
  miss: string;
  gotDate: string;
  got: string;
}
export interface InvNoteRow extends InvNote {
  id: string;
  no: string;
  person: string;
  contactId: string | null;
  date: string;
  total: number;
}
export const useInvNotes = (q: { person?: string; missing?: boolean } = {}, enabled = true) =>
  useQuery<InvNoteRow[]>({
    queryKey: ['inv-notes', q],
    queryFn: ({ signal }) => api.get<{ items: InvNoteRow[] }>('/invoices/notes', { person: q.person, missing: q.missing ? 'true' : undefined }, signal).then((r) => r.items),
    enabled,
  });

export const useSaveInvNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, note }: { no: string; note: InvNote }) => api.put<{ ok: true }>(`/invoices/notes/${encodeURIComponent(no)}`, note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inv-notes'] }),
  });
};
