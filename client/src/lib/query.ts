import { QueryClient } from '@tanstack/react-query';

/** Instance QueryClient global untuk server state (TanStack Query). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
