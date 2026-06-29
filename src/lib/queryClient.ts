import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 3,  // 3 min — no re-fetch si datos frescos
      gcTime:               1000 * 60 * 10, // 10 min en memoria aunque no se use
      retry:                1,
      retryDelay:           800,
      refetchOnWindowFocus: false,           // no re-fetch al volver a la ventana
      refetchOnReconnect:   true,            // sí re-fetch al reconectar (repartidor)
    },
  },
})
