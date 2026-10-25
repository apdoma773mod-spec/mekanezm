'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AdjustStockInput,
  CashQuery,
  CashSummary,
  ContactDto,
  ContactInput,
  ContactStatement,
  ExpenseDto,
  ExpenseInput,
  InvoiceDto,
  InvoiceInput,
  InvoiceListItem,
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
  for (const key of ['products', 'product', 'contacts', 'contact', 'statement', 'invoices', 'invoice', 'payments', 'returns', 'expenses', 'cash', 'today', 'moves']) {
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
    queryFn: ({ signal }) => api.get<Paginated<InvoiceListItem>>('/invoices', q, signal),
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

export const useToday = () =>
  useQuery({
    queryKey: ['today'],
    queryFn: ({ signal }) => api.get<{ today: TodaySummary }>('/cash/today', undefined, signal).then((r) => r.today),
    refetchInterval: 60_000,
  });
