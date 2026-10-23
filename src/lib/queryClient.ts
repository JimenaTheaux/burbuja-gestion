import { QueryClient } from '@tanstack/react-query'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function esErrorAuth(error: any): boolean {
  return error?.status === 401 || error?.code === 'PGRST301'
}

// staleTime por tipo de dato. Dentro de ese tiempo, volver a una pantalla usa
// el cache sin pedir nada; pasado, se muestra el cache y se refresca en segundo
// plano. Lo que cambia por una acción del usuario se invalida en la mutación.
export const STALE_CATALOGO  = 1000 * 60 * 5 // productos, categorías, clientes, usuarios
export const STALE_OPERATIVO = 1000 * 30     // pedidos, pagos, egresos, dashboard
export const STALE_VIVO      = 1000 * 10     // producción y reparto del día
// Polling solo en vistas VIVO (producción y reparto). Corre con la pestaña visible.
export const POLL_VIVO       = 1000 * 30

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            STALE_OPERATIVO,
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
