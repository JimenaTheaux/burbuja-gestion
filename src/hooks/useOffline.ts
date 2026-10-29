import { useState, useEffect, useCallback } from 'react'
import {
  addToQueue, getQueue, removeFromQueue, getQueueCount,
  moverAFallidas, getFallidas, descartarFallida,
  type OfflineAction, type AccionFallida,
} from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { hoyLocal } from '@/lib/fechas'
import { useAuthStore } from '@/store/authStore'
import type { EstadoPedido } from '@/types'

// ─── Tipos públicos ───────────────────────────────────────────────────────────
// Mismas RPCs que el flujo online (cambiar_estado_pedido / cerrar_pedido) —
// así la cola offline respeta la misma validación de rol y queda registrada
// en pedido_historial, en vez de hacer UPDATE directo sobre `pedidos`.

export type AddActionInput =
  | { type: 'cambiarEstado'; pedidoId: string; estadoActual: EstadoPedido; estadoNuevo: EstadoPedido; notas?: string }
  | { type: 'cerrarPedido';  pedidoId: string; estadoActual: EstadoPedido; pagos: { forma_pago: string; monto: number; fecha_pago?: string }[]; notas?: string }

export type { AccionFallida }

// ─── Clasificación de errores de supabase.rpc ─────────────────────────────────
// supabase.rpc no lanza: devuelve { error, status }. Un fallo de red o el
// timeout de 20 s (AbortSignal) llegan como status 0.
//   red     → status 0, 408, 429, 5xx: queda en cola, se reintenta.
//   auth    → 401/403, JWT inválido/vencido, permiso denegado: queda en cola,
//             se reintenta con la sesión nueva.
//   aplicada→ "El pedido ya está cerrado": el cierre ya entró (doble envío).
//   negocio → el resto (no encontrado, anulado, rol): va a 'fallidas'.

type TipoError = 'red' | 'auth' | 'aplicada' | 'negocio'

function clasificar(
  action: OfflineAction,
  error: { message?: string; code?: string },
  status: number,
): TipoError {
  const msg = error.message ?? ''
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'red'
  if (status === 401 || status === 403 || /^PGRST30\d$/.test(error.code ?? '') || error.code === '42501' || /jwt/i.test(msg)) return 'auth'
  if (action.type === 'cerrarPedido' && /ya está cerrado/i.test(msg)) return 'aplicada'
  return 'negocio'
}

// ─── Estado compartido entre instancias ───────────────────────────────────────
// useOffline se usa a la vez en RepartidorLayout y en RepartidorView: el lock
// es del módulo (si fuera por instancia, al volver la conexión las dos
// procesarían la misma cola en paralelo y mandarían cada acción dos veces).

let sincronizando = false
const EVENTO = 'burbuja-offline-cambio'
const avisar = () => window.dispatchEvent(new Event(EVENTO))

async function sincronizarCola(usuarioId: string | null): Promise<void> {
  if (sincronizando || !navigator.onLine) return
  sincronizando = true
  avisar()

  let procesadas = 0
  try {
    const queue = (await getQueue()).sort((a, b) => a.timestamp - b.timestamp)

    for (const action of queue) {
      let tipo: TipoError | null = null
      let motivo = ''
      try {
        const { error, status } = action.type === 'cambiarEstado'
          ? await supabase.rpc('cambiar_estado_pedido', {
              p_pedido_id:       action.pedidoId,
              p_estado_nuevo:    action.estadoNuevo,
              p_estado_anterior: action.estadoActual,
              p_usuario_id:      usuarioId,
              p_notas:           action.notas ?? null,
            })
          : await supabase.rpc('cerrar_pedido', {
              p_pedido_id:  action.pedidoId,
              p_usuario_id: usuarioId,
              p_pagos:      action.pagos,
              p_notas:      action.notas ?? null,
            })
        if (error) {
          tipo   = clasificar(action, error, status)
          motivo = error.message
        }
      } catch {
        tipo = 'red'   // cualquier excepción inesperada: no perder la acción
      }

      // Red o sesión: cortar acá y mantener el orden para el próximo intento
      if (tipo === 'red' || tipo === 'auth') break

      if (tipo === 'negocio') {
        const { data } = await supabase.from('pedidos').select('numero').eq('id', action.pedidoId).maybeSingle()
        await moverAFallidas({ ...action, motivo, numero: data?.numero ?? null, fallidaEn: Date.now() })
      } else {
        await removeFromQueue(action.id)   // ok o 'aplicada'
        procesadas++
      }
      avisar()
    }
  } finally {
    sincronizando = false
    avisar()
    // Una sola invalidación al terminar la cola (no por acción).
    if (procesadas > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedidos.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.produccion.all() })
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOffline() {
  const usuarioId = useAuthStore(s => s.usuario?.id ?? null)
  const [isOnline,     setIsOnline]     = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing,      setSyncing]      = useState(sincronizando)
  const [fallidas,     setFallidas]     = useState<AccionFallida[]>([])

  // ── Leer cola y fallidas (también cuando otra instancia las cambia) ─────────

  const refrescar = useCallback(async () => {
    const [count, f] = await Promise.all([getQueueCount(), getFallidas()])
    setPendingCount(count)
    setFallidas(f.sort((a, b) => a.fallidaEn - b.fallidaEn))
    setSyncing(sincronizando)
  }, [])

  useEffect(() => {
    refrescar()
    window.addEventListener(EVENTO, refrescar)
    return () => window.removeEventListener(EVENTO, refrescar)
  }, [refrescar])

  const sync = useCallback(() => sincronizarCola(usuarioId), [usuarioId])

  // Al abrir la app o al entrar con una sesión nueva: vaciar lo que haya quedado
  // (p. ej. acciones frenadas por un 401). Sin cola es una lectura de IndexedDB.
  useEffect(() => {
    if (usuarioId) sync()
  }, [usuarioId, sync])

  // ── Escuchar eventos de red ─────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      sync()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  // ── Agregar acción a la cola ────────────────────────────────────────────────

  const addAction = useCallback(async (input: AddActionInput) => {
    // La fecha de cada pago se fija al encolar (momento del cobro), no al
    // sincronizar: una cola que se vacía al día siguiente no cambia el día.
    const conFecha: AddActionInput = input.type === 'cerrarPedido'
      ? { ...input, pagos: input.pagos.map(p => ({ ...p, fecha_pago: p.fecha_pago ?? hoyLocal() })) }
      : input
    const action: OfflineAction = {
      ...conFecha,
      id:        crypto.randomUUID(),
      timestamp: Date.now(),
    }
    await addToQueue(action)
    avisar()
  }, [])

  const descartar = useCallback(async (id: string) => {
    await descartarFallida(id)
    avisar()
  }, [])

  return { isOnline, pendingCount, syncing, addAction, sync, fallidas, descartar }
}
