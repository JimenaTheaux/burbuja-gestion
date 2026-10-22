import { QueryClient } from '@tanstack/react-query'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function esErrorAuth(error: any): boolean {
  return error?.status === 401 || error?.code === 'PGRST301'
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 3,  // 3 min — no re-fetch si datos frescos
      gcTime:               1000 * 60 * 10, // 10 min en memoria aunque no se use
      retry:                (failureCount, error) => !esErrorAuth(error) && failureCount < 1,
      retryDelay:           800,
      refetchOnWindowFocus: false,           // no re-fetch al volver a la ventana
      refetchOnReconnect:   true,            // sí re-fetch al reconectar (repartidor)
    },
    // Sin onError global en mutaciones: la renovación del token la hace
    // auth-js sola, y forzar refreshSession desde acá competía con ella.
  },
})
