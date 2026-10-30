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
            // a screen opened again within 15 s shows what it has without asking the server again
            // (saves one round trip through the tunnel per list; every save still invalidates its lists)
            staleTime: 15_000,
            gcTime: 10 * 60_000,
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
