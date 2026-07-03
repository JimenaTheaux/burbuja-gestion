import { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

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
    mutations: {
      // Red de seguridad global — si una mutación falla por token vencido y el
      // hook que la llama no maneja el caso, se intenta refrescar sesión antes
      // de forzar logout. No reemplaza el onError propio de cada mutación.
      onError: (error) => {
        if (!esErrorAuth(error)) return
        supabase.auth.refreshSession().then(({ error: e }) => {
          if (e) window.location.href = '/login'
          else queryClient.invalidateQueries()
        })
      },
    },
  },
})
