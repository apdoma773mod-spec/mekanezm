'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiClientError } from '@/lib/api';
import { ToastProvider } from '@/components/ui/toast';
import { CompanyProvider } from '@/components/company';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, err) =>
              count < 2 && !(err instanceof ApiClientError && err.status >= 400 && err.status < 500),
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <CompanyProvider>{children}</CompanyProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
