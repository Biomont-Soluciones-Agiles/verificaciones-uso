import { FluentProvider, Toaster, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { TOASTER_ID } from '../components/avisos';
import { ConfirmacionProvider } from '../components/Confirmacion';
import { RepositoriesProvider } from './RepositoriesProvider';

function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  return (
    <FluentProvider theme={webLightTheme} style={{ minHeight: '100vh' }}>
      <QueryClientProvider client={queryClient}>
        <RepositoriesProvider>
          <ConfirmacionProvider>
            {children}
            <Toaster toasterId={TOASTER_ID} position="top-end" />
          </ConfirmacionProvider>
        </RepositoriesProvider>
      </QueryClientProvider>
    </FluentProvider>
  );
}
